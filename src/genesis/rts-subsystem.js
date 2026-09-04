/**
 * rts-subsystem.js
 * Real-Time Strategy Subsystem — StarCraft II / Warcraft III Style Controls
 * 
 * Provides:
 *   1. Mouse drag-box unit selection (2D overlay → 3D raycasting)
 *   2. Unit command system (Move, Attack-Move, Hold Position, Patrol, Build)
 *   3. Formation steering (V-Shape, Circle, Line)
 *   4. RTS HUD overlay (selection info, command buttons, minimap indicator)
 *   5. PLT Resource economy integration for unit production
 */

(function() {
  'use strict';

  const T = window.THREE;

  // ─── CONFIG ─────────────────────────────────────────────────────────
  const RTS_CFG = {
    SELECTION_COLOR: 0x00ff88,
    SELECTION_OPACITY: 0.25,
    MOVE_MARKER_COLOR: 0x00ff00,
    ATTACK_MARKER_COLOR: 0xff0000,
    MARKER_DURATION: 1.5,
    UNIT_RING_COLOR: 0x00ff88,
    ENEMY_RING_COLOR: 0xff4444,
    MAX_SELECTION: 50,
    FORMATION_SPACING: 5,
    COMMAND_RADIUS: 3,
  };

  // ─── UNIT REGISTRY ──────────────────────────────────────────────────

  const allUnits = [];      // All RTS-controllable units
  const selectedUnits = []; // Currently selected units
  const commandMarkers = []; // Visual markers for move/attack commands

  // ─── UNIT CLASSES ───────────────────────────────────────────────────

  const UNIT_DEFS = {
    scout: {
      name: 'Scout Drone',
      hp: 50, maxHp: 50,
      speed: 12, turnRate: 5,
      damage: 5, attackSpeed: 0.8, range: 15,
      visionRange: 40,
      cost: { profit: 100, love: 0 },
      tax: 2,
      buildTime: 3
    },
    frigate: {
      name: 'Line Frigate',
      hp: 150, maxHp: 150,
      speed: 6, turnRate: 3,
      damage: 15, attackSpeed: 1.2, range: 20,
      visionRange: 25,
      cost: { profit: 250, love: 50 },
      tax: 5,
      buildTime: 8
    },
    battleship: {
      name: 'Heavy Battleship',
      hp: 400, maxHp: 400,
      speed: 3, turnRate: 1.5,
      damage: 35, attackSpeed: 2.0, range: 30,
      visionRange: 20,
      cost: { profit: 600, love: 150 },
      tax: 12,
      buildTime: 15
    },
    carrier: {
      name: 'Carrier Dreadnought',
      hp: 600, maxHp: 600,
      speed: 2, turnRate: 1,
      damage: 10, attackSpeed: 0.5, range: 35,
      visionRange: 30,
      cost: { profit: 1000, love: 300 },
      tax: 20,
      buildTime: 25,
      spawnsSwarm: true,
      swarmCount: 6
    },
    harvester: {
      name: 'Harvester Ship',
      hp: 100, maxHp: 100,
      speed: 5, turnRate: 3,
      damage: 0, attackSpeed: 0, range: 0,
      visionRange: 15,
      harvestRate: 10,
      cost: { profit: 150, love: 25 },
      tax: 3,
      buildTime: 6
    }
  };

  // ─── SELECTION BOX (2D OVERLAY) ─────────────────────────────────────

  let selectionBox = null;
  let selBoxStart = null;
  let selBoxActive = false;

  function createSelectionBoxOverlay() {
    selectionBox = document.createElement('div');
    selectionBox.id = 'rts-selection-box';
    Object.assign(selectionBox.style, {
      position: 'fixed',
      border: '1px solid #00ff88',
      backgroundColor: 'rgba(0, 255, 136, 0.15)',
      pointerEvents: 'none',
      display: 'none',
      zIndex: '9000'
    });
    document.body.appendChild(selectionBox);
  }

  function startSelectionBox(e) {
    if (e.button !== 0) return; // Left click only
    if (e.shiftKey || e.ctrlKey || e.altKey) return; // Don't interfere with camera controls

    selBoxStart = { x: e.clientX, y: e.clientY };
    selBoxActive = false;
  }

  function updateSelectionBox(e) {
    if (!selBoxStart) return;

    const dx = Math.abs(e.clientX - selBoxStart.x);
    const dy = Math.abs(e.clientY - selBoxStart.y);

    // Only activate box if dragged more than 5px
    if (dx + dy > 5) {
      selBoxActive = true;
      const left = Math.min(selBoxStart.x, e.clientX);
      const top = Math.min(selBoxStart.y, e.clientY);
      const width = Math.abs(e.clientX - selBoxStart.x);
      const height = Math.abs(e.clientY - selBoxStart.y);

      Object.assign(selectionBox.style, {
        display: 'block',
        left: left + 'px',
        top: top + 'px',
        width: width + 'px',
        height: height + 'px'
      });
    }
  }

  function endSelectionBox(e, camera) {
    if (!selBoxStart) return;
    selectionBox.style.display = 'none';

    if (selBoxActive && camera) {
      // Box selection — select all units within the 2D box
      const minX = Math.min(selBoxStart.x, e.clientX);
      const maxX = Math.max(selBoxStart.x, e.clientX);
      const minY = Math.min(selBoxStart.y, e.clientY);
      const maxY = Math.max(selBoxStart.y, e.clientY);

      clearSelection();

      for (const unit of allUnits) {
        if (!unit.mesh || unit.faction !== 'voidCovenant') continue;
        const screenPos = unit.mesh.position.clone().project(camera);
        const sx = (screenPos.x + 1) / 2 * window.innerWidth;
        const sy = (-screenPos.y + 1) / 2 * window.innerHeight;

        if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
          selectUnit(unit);
          if (selectedUnits.length >= RTS_CFG.MAX_SELECTION) break;
        }
      }
    } else if (!selBoxActive && camera) {
      // Single click — select one unit or issue command
      handleClick(e, camera);
    }

    selBoxStart = null;
    selBoxActive = false;
  }

  // ─── UNIT SELECTION ─────────────────────────────────────────────────

  function selectUnit(unit) {
    if (selectedUnits.includes(unit)) return;
    if (selectedUnits.length >= RTS_CFG.MAX_SELECTION) return;
    selectedUnits.push(unit);
    showSelectionRing(unit);
    updateHUD();
  }

  function clearSelection() {
    for (const unit of selectedUnits) {
      hideSelectionRing(unit);
    }
    selectedUnits.length = 0;
    updateHUD();
  }

  function showSelectionRing(unit) {
    if (!unit.mesh || unit._selRing) return;
    const ring = new T.Mesh(
      new T.RingGeometry(1.5, 2, 16),
      new T.MeshBasicMaterial({
        color: unit.faction === 'voidCovenant' ? RTS_CFG.UNIT_RING_COLOR : RTS_CFG.ENEMY_RING_COLOR,
        transparent: true, opacity: 0.6, side: T.DoubleSide
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    unit.mesh.add(ring);
    unit._selRing = ring;
  }

  function hideSelectionRing(unit) {
    if (unit._selRing) {
      if (unit._selRing.parent) unit._selRing.parent.remove(unit._selRing);
      unit._selRing = null;
    }
  }

  // ─── CLICK HANDLING (Single Click) ──────────────────────────────────

  function handleClick(e, camera) {
    const raycaster = new T.Raycaster();
    const mouse = new T.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);

    // Check if clicked on a unit
    const unitMeshes = allUnits.filter(u => u.mesh).map(u => u.mesh);
    const hits = raycaster.intersectObjects(unitMeshes, true);

    if (hits.length > 0) {
      // Find the unit this mesh belongs to
      let hitObj = hits[0].object;
      while (hitObj && !hitObj._rtsUnit) hitObj = hitObj.parent;
      if (hitObj && hitObj._rtsUnit) {
        if (!e.shiftKey) clearSelection();
        selectUnit(hitObj._rtsUnit);
        return;
      }
    }

    // If no unit hit, clear selection (left click on ground)
    if (e.button === 0 && !e.shiftKey) {
      clearSelection();
    }
  }

  // ─── RIGHT-CLICK COMMANDS ───────────────────────────────────────────

  function handleRightClick(e, camera, scene) {
    if (selectedUnits.length === 0) return;

    e.preventDefault();

    const raycaster = new T.Raycaster();
    const mouse = new T.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);

    // Intersect with a ground plane at y=0
    const groundPlane = new T.Plane(new T.Vector3(0, 1, 0), 0);
    const target = new T.Vector3();
    raycaster.ray.intersectPlane(groundPlane, target);

    if (!target) return;

    // Check if right-clicked on an enemy unit
    const enemyMeshes = allUnits.filter(u => u.mesh && u.faction !== 'voidCovenant').map(u => u.mesh);
    const enemyHits = raycaster.intersectObjects(enemyMeshes, true);

    let command;
    if (enemyHits.length > 0) {
      let hitObj = enemyHits[0].object;
      while (hitObj && !hitObj._rtsUnit) hitObj = hitObj.parent;
      if (hitObj && hitObj._rtsUnit) {
        command = { type: 'attack', target: hitObj._rtsUnit };
      }
    }

    if (!command) {
      command = { type: 'move', target: target.clone() };
    }

    // Issue command to selected units with formation
    issueFormationCommand(selectedUnits, command, scene);
  }

  // ─── FORMATION ENGINE ──────────────────────────────────────────────

  function issueFormationCommand(units, command, scene) {
    if (units.length === 0) return;

    const targetPos = command.type === 'move' ? command.target :
                      command.type === 'attack' && command.target.mesh ? command.target.mesh.position : null;

    if (!targetPos) return;

    // Calculate V-formation offsets
    const positions = getVFormation(units.length, RTS_CFG.FORMATION_SPACING);

    // Direction from group center to target
    const center = new T.Vector3();
    for (const u of units) {
      if (u.mesh) center.add(u.mesh.position);
    }
    center.divideScalar(units.length);

    const dir = new T.Vector3().subVectors(targetPos, center).normalize();
    const right = new T.Vector3().crossVectors(dir, new T.Vector3(0, 1, 0)).normalize();

    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      const offset = positions[i];
      const dest = targetPos.clone()
        .add(right.clone().multiplyScalar(offset.x))
        .add(dir.clone().multiplyScalar(offset.z));

      unit.order = {
        type: command.type,
        destination: dest,
        attackTarget: command.type === 'attack' ? command.target : null
      };
    }

    // Show move/attack marker
    spawnCommandMarker(targetPos, command.type, scene);
  }

  function getVFormation(count, spacing) {
    const positions = [];
    positions.push({ x: 0, z: 0 }); // Leader at front

    let row = 1;
    let placed = 1;
    while (placed < count) {
      for (let side = -1; side <= 1; side += 2) {
        if (placed >= count) break;
        positions.push({
          x: side * row * spacing,
          z: -row * spacing * 0.8
        });
        placed++;
      }
      row++;
    }
    return positions;
  }

  // ─── COMMAND MARKERS ────────────────────────────────────────────────

  function spawnCommandMarker(pos, type, scene) {
    const color = type === 'attack' ? RTS_CFG.ATTACK_MARKER_COLOR : RTS_CFG.MOVE_MARKER_COLOR;
    const marker = new T.Mesh(
      new T.RingGeometry(1, 1.5, 16),
      new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: T.DoubleSide })
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.copy(pos);
    marker.position.y = 0.2;
    marker.userData.life = RTS_CFG.MARKER_DURATION;
    scene.add(marker);
    commandMarkers.push(marker);
  }

  // ─── KEYBOARD COMMANDS ──────────────────────────────────────────────

  let attackMoveMode = false;

  function handleKeyDown(e) {
    switch (e.key.toLowerCase()) {
      case 'a':
        attackMoveMode = true;
        document.body.style.cursor = 'crosshair';
        break;
      case 's':
        // Stop
        for (const unit of selectedUnits) {
          unit.order = null;
        }
        break;
      case 'h':
        // Hold position
        for (const unit of selectedUnits) {
          unit.order = { type: 'hold' };
        }
        break;
      case 'p':
        // Patrol (simplified — patrol between current pos and a clicked point)
        for (const unit of selectedUnits) {
          if (unit.mesh) {
            unit.order = { type: 'patrol', patrolStart: unit.mesh.position.clone() };
          }
        }
        break;
    }
  }

  function handleKeyUp(e) {
    if (e.key.toLowerCase() === 'a') {
      attackMoveMode = false;
      document.body.style.cursor = '';
    }
  }

  // ─── UNIT AI TICK ───────────────────────────────────────────────────

  function tickUnits(dt) {
    for (const unit of allUnits) {
      if (!unit.mesh || unit.hp <= 0) continue;

      // Process order
      if (unit.order) {
        switch (unit.order.type) {
          case 'move':
            moveToward(unit, unit.order.destination, dt);
            // Arrival check
            if (unit.mesh.position.distanceTo(unit.order.destination) < RTS_CFG.COMMAND_RADIUS) {
              unit.order = null;
            }
            break;

          case 'attack':
            if (unit.order.attackTarget && unit.order.attackTarget.hp > 0) {
              const targetPos = unit.order.attackTarget.mesh.position;
              const dist = unit.mesh.position.distanceTo(targetPos);
              if (dist > unit.def.range) {
                moveToward(unit, targetPos, dt);
              } else {
                // In range — fire
                unit._attackTimer = (unit._attackTimer || 0) + dt;
                if (unit._attackTimer >= unit.def.attackSpeed) {
                  unit._attackTimer = 0;
                  dealDamage(unit, unit.order.attackTarget);
                }
                // Face target
                unit.mesh.lookAt(targetPos);
              }
            } else {
              unit.order = null; // Target dead
            }
            break;

          case 'hold':
            // Auto-acquire enemies in range
            autoAcquire(unit);
            break;

          case 'patrol':
            if (unit.order.patrolStart && unit.order.destination) {
              const dest = unit._patrolForward ? unit.order.destination : unit.order.patrolStart;
              moveToward(unit, dest, dt);
              if (unit.mesh.position.distanceTo(dest) < RTS_CFG.COMMAND_RADIUS) {
                unit._patrolForward = !unit._patrolForward;
              }
              autoAcquire(unit);
            }
            break;
        }
      } else {
        // Idle — auto-acquire if aggressive
        if (unit.aggressive !== false) {
          autoAcquire(unit);
        }
      }
    }
  }

  function moveToward(unit, target, dt) {
    if (!unit.mesh || !target) return;
    const dir = new T.Vector3().subVectors(target, unit.mesh.position);
    dir.y = 0;
    const dist = dir.length();
    if (dist < 0.1) return;
    dir.normalize();
    const step = Math.min(unit.def.speed * dt, dist);
    unit.mesh.position.add(dir.multiplyScalar(step));
    unit.mesh.lookAt(target);
  }

  function autoAcquire(unit) {
    if (!unit.mesh || unit.def.range <= 0) return;
    // Find nearest enemy in range
    let nearest = null;
    let nearDist = unit.def.range;

    for (const other of allUnits) {
      if (other === unit || other.faction === unit.faction || other.hp <= 0) continue;
      if (!other.mesh) continue;
      const d = unit.mesh.position.distanceTo(other.mesh.position);
      if (d < nearDist) {
        nearDist = d;
        nearest = other;
      }
    }

    if (nearest) {
      unit.order = { type: 'attack', attackTarget: nearest };
    }
  }

  function dealDamage(attacker, target) {
    if (!target || target.hp <= 0) return;
    target.hp -= attacker.def.damage;
    if (target.hp <= 0) {
      target.hp = 0;
      onUnitDeath(target);
    }
  }

  function onUnitDeath(unit) {
    if (unit.mesh) {
      // Simple death animation — shrink and fade
      unit._dying = true;
      unit._deathTimer = 0.5;
    }
    // Remove from selection
    const idx = selectedUnits.indexOf(unit);
    if (idx >= 0) {
      hideSelectionRing(unit);
      selectedUnits.splice(idx, 1);
    }
  }

  // ─── HUD ────────────────────────────────────────────────────────────

  let hudElement = null;

  function createHUD() {
    hudElement = document.createElement('div');
    hudElement.id = 'rts-hud';
    Object.assign(hudElement.style, {
      position: 'fixed',
      top: '72px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      border: '1px solid #00ff88',
      borderRadius: '8px',
      padding: '8px 16px',
      color: '#00ff88',
      fontFamily: 'monospace',
      fontSize: '13px',
      zIndex: '107',
      display: 'none',
      minWidth: '200px',
      textAlign: 'center',
      pointerEvents: 'none'
    });
    document.body.appendChild(hudElement);
  }

  function updateHUD() {
    if (!hudElement) return;
    if (selectedUnits.length === 0) {
      hudElement.style.display = 'none';
      return;
    }

    hudElement.style.display = 'block';
    const counts = {};
    let totalHp = 0, totalMaxHp = 0;
    for (const u of selectedUnits) {
      const name = u.def.name || 'Unit';
      counts[name] = (counts[name] || 0) + 1;
      totalHp += u.hp;
      totalMaxHp += u.def.maxHp;
    }

    const lines = [`<b>Selected: ${selectedUnits.length}</b>`];
    for (const [name, count] of Object.entries(counts)) {
      lines.push(`${name} × ${count}`);
    }
    lines.push(`HP: ${Math.floor(totalHp)} / ${totalMaxHp}`);
    lines.push(`<span style="font-size:11px;color:#888">A=Attack | S=Stop | H=Hold | P=Patrol</span>`);
    hudElement.innerHTML = lines.join('<br>');
  }

  // ─── MAIN TICK ──────────────────────────────────────────────────────

  function tick(dt, scene) {
    tickUnits(dt);

    // Update command markers
    for (let i = commandMarkers.length - 1; i >= 0; i--) {
      const m = commandMarkers[i];
      m.userData.life -= dt;
      m.material.opacity = m.userData.life / RTS_CFG.MARKER_DURATION;
      m.scale.setScalar(1 + (1 - m.userData.life / RTS_CFG.MARKER_DURATION) * 0.5);
      if (m.userData.life <= 0) {
        if (m.parent) m.parent.remove(m);
        commandMarkers.splice(i, 1);
      }
    }

    // Update dying units
    for (let i = allUnits.length - 1; i >= 0; i--) {
      const unit = allUnits[i];
      if (unit._dying) {
        unit._deathTimer -= dt;
        if (unit.mesh) {
          const s = Math.max(0.01, unit._deathTimer / 0.5);
          unit.mesh.scale.setScalar(s);
        }
        if (unit._deathTimer <= 0) {
          if (unit.mesh && unit.mesh.parent) unit.mesh.parent.remove(unit.mesh);
          allUnits.splice(i, 1);
        }
      }
    }
  }

  // ─── INSTALL ────────────────────────────────────────────────────────

  function install(camera, scene) {
    if (!T) {
      console.warn('[RTS] THREE not loaded, skipping RTS install');
      return;
    }

    createHUD();

    // Register with the unified input router (replaces old duplicated listeners)
    if (window.RTSInputRouter) {
      // Box selection
      window.RTSInputRouter.registerBoxSelector(function(ctx) {
        const minX = ctx.rect.left, maxX = ctx.rect.right;
        const minY = ctx.rect.top, maxY = ctx.rect.bottom;
        if (!ctx.shiftKey) clearSelection();
        for (const unit of allUnits) {
          if (!unit.mesh || unit.faction !== 'voidCovenant') continue;
          const screenPos = unit.mesh.position.clone().project(camera);
          const sx = (screenPos.x + 1) / 2 * window.innerWidth;
          const sy = (-screenPos.y + 1) / 2 * window.innerHeight;
          if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
            selectUnit(unit);
            if (selectedUnits.length >= RTS_CFG.MAX_SELECTION) break;
          }
        }
        console.log('[RTS] Box Selected', selectedUnits.length, 'units.');
      });
      // Right-click commands (move/attack with formation)
      window.RTSInputRouter.registerRightClick(50, function(ctx) {
        if (selectedUnits.length === 0) return false;
        const targetPos = ctx.point;
        if (!targetPos) return false;
        let command;
        const enemyMeshes = allUnits.filter(u => u.mesh && u.faction !== 'voidCovenant').map(u => u.mesh);
        if (ctx.hits && ctx.hits.length > 0) {
          let hitObj = ctx.hits[0].object;
          while (hitObj && !hitObj._rtsUnit) hitObj = hitObj.parent;
          if (hitObj && hitObj._rtsUnit) command = { type: 'attack', target: hitObj._rtsUnit };
        }
        if (!command) command = { type: 'move', target: targetPos.clone() };
        issueFormationCommand(selectedUnits, command, scene);
        return true; // consumed
      });
      // Single-click unit selection (ground click clears)
      window.RTSInputRouter.registerLeftClick(50, function(ctx) {
        // Only consume if we actually clicked an RTS unit — else let later handlers run
        let hitUnit = null;
        if (ctx.hits && ctx.hits.length > 0) {
          for (const hit of ctx.hits) {
            let obj = hit.object;
            while (obj) {
              if (obj._rtsUnit) { hitUnit = obj._rtsUnit; break; }
              obj = obj.parent;
            }
            if (hitUnit) break;
          }
        }
        if (!hitUnit) {
          if (!ctx.shiftKey) clearSelection();
          return false;
        }
        if (!ctx.shiftKey) clearSelection();
        selectUnit(hitUnit);
        return true;
      });
      // Hotkeys
      window.RTSInputRouter.registerKeyHandler(50, function(key, e) {
        if (key === 'a') { attackMoveMode = true; document.body.style.cursor = 'crosshair'; return true; }
        if (key === 's') { for (const unit of selectedUnits) unit.order = null; return true; }
        if (key === 'h') { for (const unit of selectedUnits) unit.order = { type: 'hold' }; return true; }
        if (key === 'p') { for (const unit of selectedUnits) { if (unit.mesh) unit.order = { type: 'patrol', patrolStart: unit.mesh.position.clone() }; } return true; }
        return false;
      });
      window.addEventListener('keyup', function(e) { if (e.key.toLowerCase() === 'a') { attackMoveMode = false; document.body.style.cursor = ''; } });
    }

    console.log('[RTS] Subsystem installed — drag-select, right-click commands, A/S/H/P keys active');
  }

  // ─── REGISTER UNIT ──────────────────────────────────────────────────

  function registerUnit(mesh, defKey, faction) {
    const def = UNIT_DEFS[defKey] || UNIT_DEFS.scout;
    const unit = {
      mesh,
      def: { ...def },
      faction: faction || 'voidCovenant',
      hp: def.hp,
      order: null,
      aggressive: true,
      _attackTimer: 0
    };
    mesh._rtsUnit = unit;
    allUnits.push(unit);
    return unit;
  }

  // ─── EXPORTS ────────────────────────────────────────────────────────

  window.RTSSubsystem = {
    install,
    tick,
    registerUnit,
    selectUnit,
    clearSelection,
    allUnits,
    selectedUnits,
    UNIT_DEFS,
    RTS_CFG
  };

  console.log('[RTS] Subsystem loaded — 5 unit classes, formation engine, PLT economy ready');
})();
