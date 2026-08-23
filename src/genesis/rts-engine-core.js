/* rts-engine-core.js — patched: projectile pooling, harvesting slots, target policy, deposit flag */
(function() {
  'use strict';

  // --- ENTITY SYSTEM ---

  let entityIdCounter = 0;
  const ENTITIES = new Map();
  let SCENE_REF = null;

    // --- PATH CACHING & THROTTLING ---
  var PATH_CACHE = new Map();
  var MAX_CACHE_SIZE = 100;
  var pathRequestsThisFrame = 0;
  var MAX_PATH_REQUESTS_PER_FRAME = 8;

  function getCachedPath(sx, sz, tx, tz) {
    var key = Math.round(sx/4) + '_' + Math.round(sz/4) + '_' + Math.round(tx/4) + '_' + Math.round(tz/4);
    return PATH_CACHE.get(key) || null;
  }

  function setCachedPath(sx, sz, tx, tz, waypoints) {
    var key = Math.round(sx/4) + '_' + Math.round(sz/4) + '_' + Math.round(tx/4) + '_' + Math.round(tz/4);
    if (PATH_CACHE.size >= MAX_CACHE_SIZE) {
      var first = PATH_CACHE.keys().next().value;
      PATH_CACHE.delete(first);
    }
    PATH_CACHE.set(key, waypoints);
  }

  class GameEntity {
    constructor(mesh, type, faction, maxHp, radius, buildTime, buildProgress) {
      this.id = ++entityIdCounter;
      this.mesh = mesh; // THREE.Object3D
      this.type = type; // 'unit' or 'building' or 'resource'
      this.faction = faction; // 'imperium', 'voidCovenant', 'bioHive', 'neutral'

      this.maxHp = maxHp;
      this.hp = maxHp;
      this.radius = radius || 1.0;

      this.isDead = false;

      // Construction phase
      this.buildTime = buildTime || 0;
      this.buildProgress = (buildProgress !== undefined && buildProgress !== null) ? buildProgress : 1;

      // Combat stats
      this.attackRange = (type === 'unit') ? 5 : 0;
      this.attackDamage = (type === 'unit') ? 10 : 0;
      this.attackCooldown = 1.0; // Seconds
      this.currentCooldown = 0;
      this.targetId = null;

      // Vision (consumed by rts-fog-of-war)
      this.visionRange = (type === 'building') ? 60 : 45;

      // State
      this.state = 'idle'; // 'idle', 'moving', 'attacking', 'harvesting', 'returning', 'waiting', 'repairing'
      this.targetPos = null;
      this.speed = (type === 'unit') ? (3 + Math.random() * 2) : 0;

      // Town Hall (drop-off) flag — Phase 5: harvesters only return here
      this.isTownHall = false;

      // Economy
      this.carryAmount = 0;
      this.maxCarry = 15;

      // Harvesting helpers
      this._harvestSlot = null; // assigned slot index on node
      this._justDeposited = false; // set by engine when deposit happens

      // Targeting policy (nearest | lowestHp)
      this.targetPolicy = 'nearest';

      // Attach back-reference
      if (this.mesh) {
        this.mesh.userData.entityId = this.id;
      }

      // Asymmetric Factions: Apply Protoss Shields
      if (this.faction === 'voidCovenant' && window.StarCraftAsymmetricEngine) {
        this.shieldData = window.StarCraftAsymmetricEngine.applyProtossShield(this.mesh, this.maxHp);
      }
    }

    takeDamage(amount) {
      if (this.isDead) return;

      // Any damage resets the Protoss "out of combat" recharge window
      if (this.shieldData) this.shieldData.rechargeTimer = 0;

      // Asymmetric Factions: Protoss Shield Intercept
      if (this.shieldData && this.shieldData.shield > 0) {
        if (amount > this.shieldData.shield) {
           amount -= this.shieldData.shield;
           this.shieldData.shield = 0;
           if (this.shieldData.shieldMesh) this.shieldData.shieldMesh.material.opacity = 0;
           this.shieldData.rechargeTimer = 0;
        } else {
           this.shieldData.shield -= amount;
           this.shieldData.rechargeTimer = 0; // reset recharge
           if (this.shieldData.shieldMesh) this.shieldData.shieldMesh.material.opacity = 0.1 + (this.shieldData.shield / this.shieldData.maxShield) * 0.3;
           return; // All damage absorbed
        }
      }

      this.hp -= amount;

      // Visual feedback (flash red)
      if (this.mesh) {
        this.mesh.traverse((child) => {
          if (child.isMesh && child.material && child.material.emissive) {
            const original = child.material.emissive.getHex();
            child.material.emissive.setHex(0xff0000);
            setTimeout(() => {
              if (child && child.material) child.material.emissive.setHex(original);
            }, 150);
          }
        });
      }

      if (this.hp <= 0) {
        this.die();
      }
    }

    die() {
      this.isDead = true;
      this.hp = 0;
      console.log(`[RTSEngine] Entity ${this.id} (${this.type}) died.`);

      if (this.mesh && this.mesh.parent) {
        // Simple death animation: sink into ground (visual only)
        const startY = this.mesh.position.y;
        let t = 0;
        const sinkInterval = setInterval(() => {
          t += 0.05;
          if (this.mesh) {
            this.mesh.position.y -= 0.1;
            this.mesh.scale.setScalar(Math.max(0.01, 1 - t));
          }
          if (t >= 1) {
            clearInterval(sinkInterval);
            if (this.mesh && this.mesh.parent) {
               try { this.mesh.parent.remove(this.mesh); } catch(_) {}
            }
          }
        }, 16);
      }

      // Clean up harvest slot if any
      if (this._harvestSlot && this._harvestSlot.nodeId) {
        const node = ENTITIES.get(this._harvestSlot.nodeId);
        if (node && node.harvesterIds) {
          const i = node.harvesterIds.indexOf(this.id);
          if (i >= 0) node.harvesterIds.splice(i,1);
        }
      }

      ENTITIES.delete(this.id);
    }
  }

  function registerEntity(mesh, type, faction, maxHp, radius, buildTime, buildProgress) {
    const ent = new GameEntity(mesh, type, faction, maxHp, radius, buildTime, buildProgress);
    ENTITIES.set(ent.id, ent);
    return ent;
  }

  // Build time constants (seconds)
  const BUILD_TIMES = {
    house: 10, barracks: 25, tower: 20, market: 20,
    university: 30, farm: 5, wall: 3, gate: 5, townHall: 60
  };

  function getBuildTime(buildingType) {
    return BUILD_TIMES[buildingType] || 0;
  }

  // Create a building with construction phase (legacy mesh-based signature)
  function registerBuildingFromMesh(scene, mesh, type, faction, maxHp, radius, buildTime) {
    var bt = buildTime || getBuildTime(type) || 0;
    var ent = registerEntity(mesh, "building", faction, maxHp, radius, bt, bt > 0 ? 0 : 1);
    ent.buildingType = type;
    if (bt > 0 && ent.mesh) {
      ent.mesh.traverse(function(c) {
        if (c.isMesh && c.material) {
          c.material.transparent = true;
          c.material.opacity = 0.3;
        }
      });
    }
    return ent;
  }

  function getEntity(id) {
    return ENTITIES.get(id);
  }

  function getEntitiesInRadius(position, radius) {
    const found = [];
    for (const ent of ENTITIES.values()) {
      if (ent.isDead || !ent.mesh) continue;
      const dx = ent.mesh.position.x - position.x;
      const dz = ent.mesh.position.z - position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq <= radius * radius) {
        found.push(ent);
      }
    }
    return found;
  }

  // --- PROJECTILES (pooled) ---
  const PROJECTILES = [];
  const PROJECTILE_POOL = [];
  let PROJECTILE_GEOMETRY = null;

  function createProjectileMesh(color) {
    const T = window.THREE;
    if (!PROJECTILE_GEOMETRY) {
      PROJECTILE_GEOMETRY = new T.CylinderGeometry(0.8, 0.4, 6, 6);
      PROJECTILE_GEOMETRY.translate(0, 3, 0);
      PROJECTILE_GEOMETRY.rotateX(Math.PI / 2);
    }
    const mat = new T.MeshBasicMaterial({ color: color });
    const mesh = new T.Mesh(PROJECTILE_GEOMETRY, mat);
    mesh.visible = false;
    mesh.userData._pooled = true;
    return mesh;
  }

  function spawnProjectile(startPos, targetPos, color = 0x00ffcc) {
    if (!SCENE_REF) return;
    const T = window.THREE;
    if (!T) return;

    let mesh = null;
    if (PROJECTILE_POOL.length > 0) {
      mesh = PROJECTILE_POOL.pop();
      // ensure material color matches
      try { mesh.material.color.setHex(color); } catch (e) {}
    } else {
      mesh = createProjectileMesh(color);
    }

    mesh.position.copy(startPos);
    mesh.position.y += 2;

    const targetOffset = targetPos.clone();
    targetOffset.y += 2;
    mesh.lookAt(targetOffset);

    mesh.visible = true;
    SCENE_REF.add(mesh);

    PROJECTILES.push({ mesh: mesh, target: targetOffset, speed: 80, life: 1.0 });
  }

  function recycleProjectile(p) {
    try {
      if (p.mesh && p.mesh.parent) p.mesh.parent.remove(p.mesh);
      p.mesh.visible = false;
      PROJECTILE_POOL.push(p.mesh);
    } catch (e) {
      // swallow
    }
  }

  function tickProjectiles(dt) {
    const T = window.THREE;
    if (!T) return;
    for (let i = PROJECTILES.length - 1; i >= 0; i--) {
      const p = PROJECTILES[i];
      p.life -= dt;

      const dir = new T.Vector3().subVectors(p.target, p.mesh.position);
      const dist = dir.length();

      if (dist < 2 || p.life <= 0) {
        recycleProjectile(p);
        PROJECTILES.splice(i, 1);
      } else {
        dir.normalize();
        p.mesh.position.add(dir.multiplyScalar(p.speed * dt));
      }
    }
  }

  // --- COMBAT & MOVEMENT LOOP ---

  function chooseTarget(unit, candidates) {
    if (!candidates || candidates.length === 0) return null;
    if (unit.targetPolicy === 'lowestHp') {
      let best = null; let bestHp = Infinity;
      for (const c of candidates) {
        if (c.isDead) continue;
        if (c.hp < bestHp) { bestHp = c.hp; best = c; }
      }
      return best;
    }
    // default nearest
    let nearest = null; let minD = Infinity;
    for (const c of candidates) {
      if (c.isDead || !c.mesh) continue;
      const d = unit.mesh.position.distanceTo(c.mesh.position);
      if (d < minD) { minD = d; nearest = c; }
    }
    return nearest;
  }

  function tickEntities(dt) {
    const T = window.THREE;
    if (!T) return;
    const allEnts = Array.from(ENTITIES.values());

    for (let i = 0; i < allEnts.length; i++) {
      const ent = allEnts[i];
      if (ent.isDead || !ent.mesh) continue;

      // cooldowns
      if (ent.currentCooldown > 0) ent.currentCooldown -= dt;

      // building construction & turrets
      if (ent.type === 'building') {
        // Construction progress
        if (ent.buildProgress < 1 && ent.buildTime > 0) {
          ent.buildProgress = Math.min(1, ent.buildProgress + dt / ent.buildTime);
          // Update transparency based on progress
          if (ent.mesh) {
            ent.mesh.traverse(function(c) {
              if (c.isMesh && c.material) {
                c.material.transparent = true;
                c.material.opacity = ent.buildProgress;
              }
            });
          }
          if (ent.buildProgress >= 1) {
            // Construction complete - set full opacity
            if (ent.mesh) {
              ent.mesh.traverse(function(c) {
                if (c.isMesh && c.material) {
                  c.material.transparent = true;
                  c.material.opacity = 1.0;
                }
              });
            }
          }
          continue; // Skip everything else while under construction
        }
        if (ent.isTurret) {
          const aggroRange = ent.attackRange || 20;
          const candidates = [];
          for (let j = 0; j < allEnts.length; j++) {
            const other = allEnts[j];
            if (other.isDead || other.type !== 'unit') continue;
            if (other.faction === ent.faction) continue;
            const d = ent.mesh.position.distanceTo(other.mesh.position);
            if (d < aggroRange) candidates.push(other);
          }
          const nearestEnemy = chooseTarget(ent, candidates);
          if (nearestEnemy) {
            ent.mesh.lookAt(nearestEnemy.mesh.position.x, ent.mesh.position.y, nearestEnemy.mesh.position.z);
            if (ent.currentCooldown <= 0) {
              nearestEnemy.takeDamage(ent.attackDamage || 15);
              ent.currentCooldown = ent.attackCooldown || 1.0;
              spawnProjectile(ent.mesh.position, nearestEnemy.mesh.position, 0x00ffff);
            }
          }
        }
        continue;
      }

      // auto-aggro for idle units
      if (ent.type === 'unit' && ent.state === 'idle' && !ent.targetId && !ent._noAggro) {
        const aggroRange = ent.aggroRange || 15;
        const candidates = [];
        for (let j = 0; j < allEnts.length; j++) {
          const other = allEnts[j];
          if (other.id === ent.id || other.isDead || !other.mesh) continue;
          if (other.faction === ent.faction || other.faction === 'neutral') continue;
          if (other.type !== 'unit' && other.type !== 'building') continue;
          const d = ent.mesh.position.distanceTo(other.mesh.position);
          if (d < aggroRange) candidates.push(other);
        }
        const target = chooseTarget(ent, candidates);
        if (target) {
          ent.targetId = target.id;
          ent.state = 'moving';
        }
      }

      // If has explicit targetId handle combat/harvest/return logic
      if (ent.targetId) {
        const target = getEntity(ent.targetId);
        if (!target || target.isDead) {
          ent.targetId = null;
          ent.state = 'idle';
        } else {
          const dist = ent.mesh.position.distanceTo(target.mesh.position);

          if (target.type === 'resource') {
             // HARVESTING: manage harvester slot assignment
             const node = target;
             if (!node.harvesterIds) node.harvesterIds = [];
             // If not yet assigned a slot, try to acquire one
             if (!ent._harvestSlot) {
               if (node.harvesterIds.length < (node.maxHarvesters || 3)) {
                 node.harvesterIds.push(ent.id);
                 ent._harvestSlot = { nodeId: node.id };
               } else {
                 // Wait outside until a slot frees up
                 ent.state = 'waiting';
                 continue;
               }
             }

             if (dist <= ent.attackRange + ent.radius + target.radius + 2) {
                ent.state = 'harvesting';
                if (ent.currentCooldown <= 0) {
                   const amount = Math.min(5, target.resourceAmount);
                   target.resourceAmount -= amount;
                   ent.carryAmount += amount;
                   ent.currentCooldown = ent.attackCooldown; // mining time

                   if (target.resourceAmount <= 0) {
                     target.die();
                     // free all harvester slots
                     if (target.harvesterIds) {
                       for (const hid of target.harvesterIds) {
                         const h = ENTITIES.get(hid);
                         if (h) h._harvestSlot = null;
                       }
                       target.harvesterIds = [];
                     }
                   }

                   if (ent.carryAmount >= ent.maxCarry) {
                      // Full! Return to the nearest TOWN HALL (isTownHall === true)
                      ent.state = 'returning';
                      ent.targetId = null;
                      let nearest = null;
                      let minDist = Infinity;
                      for (const other of ENTITIES.values()) {
                         if (other.type === 'building' && !other.isDead && other.isTownHall && (other.faction === ent.faction || other.faction === 'neutral')) {
                            const d = ent.mesh.position.distanceTo(other.mesh.position);
                            if (d < minDist) { minDist = d; nearest = other; }
                         }
                      }
                      if (nearest) {
                         ent.targetId = nearest.id;
                      }
                      // free slot at node so others can mine
                      if (ent._harvestSlot && ent._harvestSlot.nodeId) {
                        const n = ENTITIES.get(ent._harvestSlot.nodeId);
                        if (n && n.harvesterIds) {
                          const ii = n.harvesterIds.indexOf(ent.id);
                          if (ii >= 0) n.harvesterIds.splice(ii,1);
                        }
                        ent._harvestSlot = null;
                      }
                   }
                }
             } else {
                ent.state = 'moving';
                ent.targetPos = target.mesh.position.clone();
             }
                    } else if (ent.state === 'repairing' && target.type === 'building') {
             // WORKER REPAIR MECHANIC (AoE II)
             if (dist <= ent.attackRange + ent.radius + target.radius + 3) {
                if (ent.currentCooldown <= 0) {
                   target.hp = Math.min(target.maxHp, target.hp + 25);
                   ent.currentCooldown = 1.0;
                   if (target.hp >= target.maxHp) {
                      ent.state = 'idle';
                      ent.targetId = null;
                   }
                }
             } else {
                ent.state = 'moving';
                ent.targetPos = target.mesh.position.clone();
             }

          } else if (ent.state === 'returning' && target.type === 'building') {
             // Returning resources to base
             if (dist <= 15 + ent.radius + target.radius) { // dropoff range
                if (window.RTSEconomySystem) {
                   window.RTSEconomySystem.addResource('profit', ent.carryAmount);
                }
                ent.carryAmount = 0;
                ent.state = 'idle';
                ent.targetId = null;
                // mark deposit event for executor
                ent._justDeposited = true;
             } else {
                ent.state = 'moving';
                ent.targetPos = target.mesh.position.clone();
             }
          } else {
             // Combat Logic
             if (dist <= ent.attackRange + ent.radius + target.radius) {
               ent.state = 'attacking';
               if (ent.currentCooldown <= 0) {
                 target.takeDamage(ent.attackDamage);
                 ent.currentCooldown = ent.attackCooldown;
                 const color = (ent.faction === 'imperium') ? 0xff4400 : (ent.faction === 'voidCovenant' ? 0x00ffff : 0x00ff00);
                 spawnProjectile(ent.mesh.position, target.mesh.position, color);
               }
             } else {
               ent.state = 'moving';
               ent.targetPos = target.mesh.position.clone();
             }
          }
        }
      }

      // Movement — with A* waypoint following
      if (ent.state === 'moving' && ent.targetPos) {
        const dir = new T.Vector3().subVectors(ent.targetPos, ent.mesh.position);
        dir.y = 0;
        const distToTarget = dir.length();

        if (window.RTSNavGrid && (!ent._navTarget || ent._navTarget.distanceTo(ent.targetPos) > 2)) {
          ent._navTarget = ent.targetPos.clone();
          ent._navWaypoints = window.RTSNavGrid.findPath(
            ent.mesh.position.x, ent.mesh.position.z,
            ent.targetPos.x, ent.targetPos.z
          );
          ent._navWPIndex = 0;
        }

        let moveSpeed = ent.speed;
        if (ent.faction === 'bioHive' && window.StarCraftAsymmetricEngine && window.StarCraftAsymmetricEngine.isOnCreep(ent.mesh.position)) {
           moveSpeed *= 1.3;
        }

        if (distToTarget > 0.5) {
          let steerDir = dir.clone().normalize();
          if (ent._navWaypoints && ent._navWPIndex < ent._navWaypoints.length) {
            const wp = ent._navWaypoints[ent._navWPIndex];
            const wpVec = new T.Vector3(wp.x, ent.mesh.position.y, wp.z);
            const wpDist = ent.mesh.position.distanceTo(wpVec);
            if (wpDist < 2) {
              ent._navWPIndex++;
            }
            if (ent._navWPIndex < ent._navWaypoints.length) {
              const nextWP = ent._navWaypoints[ent._navWPIndex];
              steerDir = new T.Vector3(nextWP.x - ent.mesh.position.x, 0, nextWP.z - ent.mesh.position.z).normalize();
            }
          } else {
            // obstacle avoidance simple
            let avoidForce = new T.Vector3(0,0,0);
            for (let j = 0; j < allEnts.length; j++) {
              const other = allEnts[j];
              if (other.id === ent.id || other.isDead || !other.mesh || other.type !== 'building') continue;
              const toOther = new T.Vector3().subVectors(other.mesh.position, ent.mesh.position);
              toOther.y = 0;
              const distToOther = toOther.length();
              const detectionRadius = other.radius + 10;
              if (distToOther < detectionRadius) {
                 toOther.normalize();
                 const dot = steerDir.dot(toOther);
                 if (dot > 0) {
                   const right = new T.Vector3(-steerDir.z, 0, steerDir.x);
                   const avoidSign = (toOther.dot(right) > 0) ? -1 : 1;
                   avoidForce.add(right.multiplyScalar(avoidSign * dot * (1.5)));
                 }
              }
            }
            steerDir.add(avoidForce).normalize();
          }

          ent.mesh.position.add(steerDir.multiplyScalar(moveSpeed * dt));
          ent.mesh.lookAt(ent.mesh.position.x + steerDir.x, ent.mesh.position.y, ent.mesh.position.z + steerDir.z);
        } else {
          ent.state = 'idle';
          ent.targetPos = null;
          ent._navTarget = null;
          ent._navWaypoints = null;
          ent._navWPIndex = 0;
        }
      }

      // Basic Collision (Push apart overlapping units)
      if (ent.type === 'unit') {
        for (let j = 0; j < allEnts.length; j++) {
          if (i === j) continue;
          const other = allEnts[j];
          if (other.isDead || !other.mesh) continue;

          const dx = ent.mesh.position.x - other.mesh.position.x;
          const dz = ent.mesh.position.z - other.mesh.position.z;
          const distSq = dx * dx + dz * dz;
          const minD = ent.radius + other.radius;

          if (distSq > 0 && distSq < minD * minD) {
            const dist = Math.sqrt(distSq);
            const overlap = minD - dist;
            const pushFactor = (other.type === 'building') ? 1.0 : 0.5;
            ent.mesh.position.x += (dx / dist) * overlap * pushFactor;
            ent.mesh.position.z += (dz / dist) * overlap * pushFactor;
          }
        }
      }
    }
  }


  // createBuildingWithBuildTime is defined above (uses BUILD_TIMES from line 167)
  function createBuildingFromDef(scene, buildingDef) {
    const T = window.THREE;
    if (!T || !scene) return null;

    // Create ghost wireframe mesh (green wireframe)
    const geometry = new T.BoxGeometry(
      buildingDef.size || 4,
      buildingDef.height || 6,
      buildingDef.size || 4
    );
    const material = new T.MeshBasicMaterial({
      color: 0x00ff88,
      wireframe: true,
      transparent: true,
      opacity: 0.3
    });
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(
      buildingDef.x || 0,
      (buildingDef.height || 6) / 2,
      buildingDef.z || 0
    );
    scene.add(mesh);

    // Create entity with buildTime, buildProgress starts at 0
    const bt = BUILD_TIMES[buildingDef.variant] || 15;
    const ent = new GameEntity(
      mesh,
      "building",
      buildingDef.faction || "voidCovenant",
      buildingDef.hp || 500,
      buildingDef.radius || 3,
      bt,
      0
    );

    // Copy optional building properties
    if (buildingDef.isTurret !== undefined) ent.isTurret = buildingDef.isTurret;
    if (buildingDef.isTownHall !== undefined) ent.isTownHall = buildingDef.isTownHall;
    if (buildingDef.attackRange !== undefined) ent.attackRange = buildingDef.attackRange;
    if (buildingDef.attackDamage !== undefined) ent.attackDamage = buildingDef.attackDamage;
    if (buildingDef.variant) ent.variant = buildingDef.variant;

    ENTITIES.set(ent.id, ent);
    return ent;
  }

  // Single public entry point — dispatches on signature:
  //   createBuildingWithBuildTime(scene, mesh, type, faction, maxHp, radius, buildTime)
  //   createBuildingWithBuildTime(scene, buildingDef)
  function createBuildingWithBuildTime(scene, meshOrDef, type, faction, maxHp, radius, buildTime) {
    if (meshOrDef && meshOrDef.isObject3D) {
      return registerBuildingFromMesh(scene, meshOrDef, type, faction, maxHp, radius, buildTime);
    }
    return createBuildingFromDef(scene, meshOrDef);
  }

  // --- INITIALIZER ---

  let _passiveTimer = 0;
  function tickPassiveIncome(dt) {
    if (!window.RTSEconomySystem) return;
    _passiveTimer += dt;
    if (_passiveTimer >= 5.0) {
      _passiveTimer = 0;
      let playerBuildings = 0;
      for (const ent of ENTITIES.values()) {
        if (!ent.isDead && ent.type === 'building' && ent.faction === 'voidCovenant') playerBuildings++;
      }
      const base = 3 + playerBuildings * 2;
      window.RTSEconomySystem.addResource('profit', base);
      window.RTSEconomySystem.addResource('aether', 1);
    }
  }

  function install(scene) {
    if (!scene) { console.warn('[RTSEngineCore] No scene provided to install()'); return; }
    SCENE_REF = scene;
    console.log('[RTSEngineCore] Installed. Entities ready.');
  }

  function tick(dt) {
    tickEntities(dt || 0.016);
    tickProjectiles(dt || 0.016);
    tickPassiveIncome(dt || 0.016);
    applyFogVisibility();
  }

  function applyFogVisibility() {
    var fog = window.RTSFogOfWarInstance;
    if (!fog) return;
    var playerIndex = 0;
    for (var ent of ENTITIES.values()) {
      if (ent.isDead || !ent.mesh) continue;
      var pos = ent.mesh.position;
      if (fog.canSee(playerIndex, ent)) {
        ent.mesh.visible = true;
        ent.mesh.traverse(function(c) {
          if (c.isMesh && c.material) { c.material.transparent = true; c.material.opacity = 1.0; }
        });
      } else if (fog.isExplored(playerIndex, pos.x, pos.z)) {
        ent.mesh.visible = true;
        ent.mesh.traverse(function(c) {
          if (c.isMesh && c.material) { c.material.transparent = true; c.material.opacity = 0.3; }
        });
      } else {
        ent.mesh.visible = false;
      }
    }
  }

  window.RTSEngineCore = {
    install,
    tick,
    registerEntity,
    createBuildingWithBuildTime,
    getBuildTime,
    BUILD_TIMES,
    getEntity,
    getEntitiesInRadius,
    ENTITIES
  };
})();
