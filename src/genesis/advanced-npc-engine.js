/**
 * advanced-npc-engine.js
 * BUYASOUL CPL / GODFORGE — RTS Unit Visuals & Spawner
 * 
 * Re-architected to use RTSEngineCore for movement, collision, and combat.
 * This file now only handles Mesh generation, Limb Animations, and Selection UI.
 */

(function() {
  'use strict';

  // ─── PROCEDURAL 3D HUMANOID RIG CREATOR ──────────────────────────────

  function createHumanoidRig(colorHex, isAlien) {
    const T = window.THREE;
    if (!T) { console.warn('[AdvancedNPCEngine] THREE not ready'); return new (function(){})(); }
    const group = new T.Group();
    group.scale.setScalar(3); // Scale up 3x so units are visible at world scale

    const skinMat = new T.MeshStandardMaterial({
      color: colorHex || 0x00ffcc,
      roughness: 0.4,
      metalness: isAlien ? 0.8 : 0.2,
      emissive: colorHex || 0x00ffcc,
      emissiveIntensity: 0.3
    });

    const jointMat = new T.MeshBasicMaterial({ color: 0xffaa00 });

    // 1. Torso
    const torso = new T.Mesh(new T.BoxGeometry(0.8, 1.2, 0.5), skinMat);
    torso.position.y = 1.4;
    group.add(torso);

    // 2. Head
    const headGeo = isAlien ? new T.ConeGeometry(0.35, 0.7, 5) : new T.SphereGeometry(0.35, 12, 12);
    const head = new T.Mesh(headGeo, skinMat);
    head.position.y = 2.3;
    group.add(head);

    // Glowing Visor
    const visor = new T.Mesh(new T.BoxGeometry(0.4, 0.12, 0.2), new T.MeshBasicMaterial({ color: 0x00ffff }));
    visor.position.set(0, 2.3, 0.22);
    group.add(visor);

    // 3. Left & Right Arms (Group pivot at shoulder)
    const leftArmGroup = new T.Group();
    leftArmGroup.position.set(-0.55, 1.9, 0);
    const leftArm = new T.Mesh(new T.BoxGeometry(0.25, 0.9, 0.25), skinMat);
    leftArm.position.y = -0.45;
    leftArmGroup.add(leftArm);
    group.add(leftArmGroup);

    const rightArmGroup = new T.Group();
    rightArmGroup.position.set(0.55, 1.9, 0);
    const rightArm = new T.Mesh(new T.BoxGeometry(0.25, 0.9, 0.25), skinMat);
    rightArm.position.y = -0.45;
    rightArmGroup.add(rightArm);
    group.add(rightArmGroup);

    // 4. Left & Right Legs (Group pivot at hip)
    const leftLegGroup = new T.Group();
    leftLegGroup.position.set(-0.25, 0.8, 0);
    const leftLeg = new T.Mesh(new T.BoxGeometry(0.3, 0.8, 0.3), skinMat);
    leftLeg.position.y = -0.4;
    leftLegGroup.add(leftLeg);
    group.add(leftLegGroup);

    const rightLegGroup = new T.Group();
    rightLegGroup.position.set(0.25, 0.8, 0);
    const rightLeg = new T.Mesh(new T.BoxGeometry(0.3, 0.8, 0.3), skinMat);
    rightLeg.position.y = -0.4;
    rightLegGroup.add(rightLeg);
    group.add(rightLegGroup);

    group.userData = {
      leftArmGroup,
      rightArmGroup,
      leftLegGroup,
      rightLegGroup,
      head,
      walkPhase: Math.random() * Math.PI * 2
    };

    // Faction glow light so units are visible at distance
    const glow = new T.PointLight(colorHex || 0x00ffcc, 0.8, 15);
    glow.position.y = 2.3;
    group.add(glow);

    return group;
  }

  // ─── ADVANCED NPC SPAWNER ────────────────────────────────────────────

  function spawnNPCPopulation(scene, count) {
    const T = window.THREE;
    if (!T) { console.warn('[AdvancedNPCEngine] THREE not ready, skipping NPC population'); return; }
    count = count || 60;
    const group = new T.Group();
    group.name = 'advanced-npc-population';

    const colors = [0x00ffcc, 0xff0055, 0xffaa00, 0x0088ff, 0xaa00ff];
    const factions = ['imperium', 'voidCovenant', 'bioHive'];

    // 1. Spawn starting player units (voidCovenant) at the Grand Tower (-104, 0, 401)
    const playerUnitCount = 12;
    const towerPos = new T.Vector3(-104, 0, 401);
    for (let i = 0; i < playerUnitCount; i++) {
      const npcMesh = createHumanoidRig(0x00ffcc, false); // Cyan humanoid rig for player
      const angle = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * 25;
      npcMesh.position.set(
        towerPos.x + Math.cos(angle) * dist,
        0,
        towerPos.z + Math.sin(angle) * dist
      );
      group.add(npcMesh);
      if (window.RTSEngineCore) {
        window.RTSEngineCore.registerEntity(npcMesh, 'unit', 'voidCovenant', 100, 1.2);
      }
    }

    // 2. Spawn remaining units distributed randomly
    for (let i = 0; i < (count - playerUnitCount); i++) {
      const isAlien = Math.random() > 0.6;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const faction = factions[Math.floor(Math.random() * factions.length)];
      
      const npcMesh = createHumanoidRig(color, isAlien);

      // Distribute across city / marketplace radius
      const radius = 150 + Math.random() * 300;
      const angle = Math.random() * Math.PI * 2;
      npcMesh.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);

      group.add(npcMesh);

      // Register with Core Engine
      if (window.RTSEngineCore) {
        window.RTSEngineCore.registerEntity(npcMesh, 'unit', faction, 50, 1.2);
      }
    }

    scene.add(group);
    console.log('[AdvancedNPCEngine] Spawned and Registered starting player units at Grand Tower and other NPCs.');
  }

  // ─── PROCEDURAL ANIMATION TICK ───────────────────────────────────────

  function tickAnimations(dt) {
    if (!window.RTSEngineCore) return;

    for (const ent of window.RTSEngineCore.ENTITIES.values()) {
      if (ent.type !== 'unit' || ent.isDead || !ent.mesh || !ent.mesh.userData || ent.mesh.userData.walkPhase === undefined) continue;

      const ud = ent.mesh.userData;

      // Only swing limbs if moving
      if (ent.state === 'moving') {
        ud.walkPhase += dt * ent.speed * 2.5;
        const swing = Math.sin(ud.walkPhase) * 0.8;

        ud.leftLegGroup.rotation.x = swing;
        ud.rightLegGroup.rotation.x = -swing;
        ud.leftArmGroup.rotation.x = -swing * 0.8;
        ud.rightArmGroup.rotation.x = swing * 0.8;
      } else if (ent.state === 'attacking') {
        // Attack swing (simple chop with right arm)
        ud.walkPhase += dt * 10;
        ud.rightArmGroup.rotation.x = Math.sin(ud.walkPhase) * 1.5;
        ud.leftArmGroup.rotation.x = 0;
        ud.leftLegGroup.rotation.x = 0;
        ud.rightLegGroup.rotation.x = 0;
      } else {
        // Reset to idle pose
        ud.leftLegGroup.rotation.x = 0;
        ud.rightLegGroup.rotation.x = 0;
        ud.leftArmGroup.rotation.x = 0;
        ud.rightArmGroup.rotation.x = 0;
      }
    }
  }

  // ─── DIRECT PLAYER COMMAND CONTROLS ─────────────────────────────────

  const SELECTED_ENTITIES = new Set();

  function selectEntity(mesh) {
    if (!mesh || !mesh.userData.entityId) return;
    const ent = window.RTSEngineCore.getEntity(mesh.userData.entityId);
    if (!ent || ent.isDead) return;

    SELECTED_ENTITIES.add(ent.id);

    if (!mesh.userData.badgeRing) {
      const T = window.THREE;
      if (!T) return;
      const ringMat = new T.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
      const ring = new T.Mesh(new T.TorusGeometry(ent.radius + 0.2, 0.08, 8, 16), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.1;
      mesh.add(ring);
      mesh.userData.badgeRing = ring;
    }
  }

  function clearSelection() {
    for (const entId of SELECTED_ENTITIES) {
      const ent = window.RTSEngineCore.getEntity(entId);
      if (ent && ent.mesh && ent.mesh.userData.badgeRing) {
        ent.mesh.remove(ent.mesh.userData.badgeRing);
        ent.mesh.userData.badgeRing = null;
      }
    }
    SELECTED_ENTITIES.clear();
  }

  function commandSelectedTo(point, targetEntityId = null) {
    if (!point && !targetEntityId) return;
    
    for (const entId of SELECTED_ENTITIES) {
      const ent = window.RTSEngineCore.getEntity(entId);
      if (!ent || ent.isDead) continue;

      if (targetEntityId && targetEntityId !== ent.id) {
        // Attack / harvest / drop-off target
        ent.targetId = targetEntityId;
        ent.state = 'moving';
      } else {
        // Move to point
        ent.targetPos = point.clone();
        ent.state = 'moving';
        ent.targetId = null;
      }
    }
    console.log(`[AdvancedNPCEngine] Commanded ${SELECTED_ENTITIES.size} units.`);
  }

  // ─── INITIALIZER ─────────────────────────────────────────────────────

  function install(scene) {
    if (!scene) return;
    spawnNPCPopulation(scene, 60);

    // Overriding selection methods for compatibility with UI scripts
    window.AdvancedNPCEngine.selectNPC = selectEntity;
    window.AdvancedNPCEngine.clearNPCSelection = clearSelection;
    window.AdvancedNPCEngine.commandNPCsTo = commandSelectedTo;

    // Register right-click command with the unified input router
    if (window.RTSInputRouter) {
      window.RTSInputRouter.registerRightClick(5, function(ctx) {
        if (SELECTED_ENTITIES.size === 0) return false;
        if (!ctx.point) return false;
        if (window.RTSEngineCore) {
          const clickRadius = 2.0;
          const hits = window.RTSEngineCore.getEntitiesInRadius(ctx.point, clickRadius);
          let targetId = null;
          if (hits.length > 0) {
            targetId = hits[0].id;
          }
          commandSelectedTo(ctx.point, targetId);
        }
        return true; // consumed
      });
      // Single-click NPC selection
      window.RTSInputRouter.registerLeftClick(5, function(ctx) {
        if (!ctx.hits || ctx.hits.length === 0) {
          if (!ctx.shiftKey) clearSelection();
          return false;
        }
        let hitNPC = null;
        for (const hit of ctx.hits) {
          let obj = hit.object;
          while (obj) {
            // Match NPC entities (entityId set) but skip RTS units (_rtsUnit set) 
            // and RTSEngineCore units (faction is voidCovenant/imperium/bioHive, not neutral)
            const entId = obj.userData && obj.userData.entityId;
            if (entId && !obj._rtsUnit && !obj.userData.isWarship) {
              const ent = window.RTSEngineCore ? window.RTSEngineCore.getEntity(entId) : null;
              // Skip RTS combat units (voidCovenant/imperium/bioHive) — let RTS handlers deal with them
              if (ent && ent.type === 'unit' && ['voidCovenant','imperium','bioHive'].includes(ent.faction)) continue;
              hitNPC = obj; break;
            }
            obj = obj.parent;
          }
          if (hitNPC) break;
        }
        if (hitNPC) {
          if (!ctx.shiftKey) clearSelection();
          selectEntity(hitNPC);
          return true; // consumed
        }
        return false;
      });
      console.log('[AdvancedNPCEngine] Right-click + click handlers registered with input router.');
    }

    window.AdvancedNPCEngine.selectNPC = selectEntity;
    window.AdvancedNPCEngine.clearNPCSelection = clearSelection;
  }

  function tick(dt) {
    tickAnimations(dt || 0.016);
  }

  window.AdvancedNPCEngine = {
    install,
    tick,
    createHumanoidRig,
    selectNPC: selectEntity,
    clearNPCSelection: clearSelection,
    commandNPCsTo: commandSelectedTo
  };

  console.log('[AdvancedNPCEngine] RTS Unit Visuals engine loaded (hooked to Core).');
})();
