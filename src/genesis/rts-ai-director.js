/**
 * rts-ai-director.js
 * BUYASOUL CPL / GODFORGE — RTS Enemy AI Director
 * 
 * Brain for enemy factions (bioHive & imperium):
 * 1. Spawns units near their respective home bases.
 * 2. Groups them into squads and marches them to attack the Player's Grand Tower.
 * 3. Uses A* pathfinding automatically since it triggers the core movement states.
 */

(function() {
  'use strict';

  let SCENE_REF = null;

  const FACTIONS = {
    bioHive: {
      name: 'Bio Hive (Alien)',
      homeBase: { x: 400, y: 0, z: -300 }, // Closer to player for visible combat
      resources: 0,
      spawnCost: 80,
      squadSizeThreshold: 6,
      idleUnits: new Set(),
      squads: []
    },
    imperium: {
      name: 'Imperium (Terran)',
      homeBase: { x: -400, y: 0, z: -300 }, // Closer to player for visible combat
      resources: 0,
      spawnCost: 120,
      squadSizeThreshold: 4,
      idleUnits: new Set(),
      squads: []
    }
  };

  let _unitSpeedMult = 1;
  const PLAYER_FACTION = 'voidCovenant';
  const PLAYER_HOME = { x: -104, y: 0, z: 401 }; // Grand Tower coordinates

  function spawnAIUnit(factionId) {
    if (!SCENE_REF || !window.AdvancedNPCEngine || !window.RTSEngineCore) return;
    
    const factionData = FACTIONS[factionId];
    const isAlien = (factionId === 'bioHive');
    const color = isAlien ? 0xff0055 : 0xffaa00; // Red-purple alien or golden-yellow armor
    
    const mesh = window.AdvancedNPCEngine.createHumanoidRig(color, isAlien);
    
    // Spawn offset around home base
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnDist = 40 + Math.random() * 20;
    mesh.position.set(
      factionData.homeBase.x + Math.cos(spawnAngle) * spawnDist,
      0,
      factionData.homeBase.z + Math.sin(spawnAngle) * spawnDist
    );
    
    SCENE_REF.add(mesh);
    
    const hp = isAlien ? 80 : 130;
    const ent = window.RTSEngineCore.registerEntity(mesh, 'unit', factionId, hp, 1.2);
    ent.baseSpeed = isAlien ? 5.5 : 3.8;
    ent.speed = ent.baseSpeed * _unitSpeedMult;
    
    factionData.idleUnits.add(ent.id);
    console.log(`[RTS AI Director] Spawned ${factionId} unit ${ent.id}`);
  }

  function tickAI(dt) {
    if (!window.RTSEngineCore) return;

    for (const factionId of Object.keys(FACTIONS)) {
      const faction = FACTIONS[factionId];
      
      // 1. Resource regeneration & Unit Spawning
      faction.resources += _resRate * dt; // passively gain resources
      if (faction.resources >= faction.spawnCost) {
        faction.resources -= faction.spawnCost;
        spawnAIUnit(factionId);
      }

      // Clean up dead units from idle pools
      for (const entId of faction.idleUnits) {
        const ent = window.RTSEngineCore.getEntity(entId);
        if (!ent || ent.isDead) {
          faction.idleUnits.delete(entId);
        }
      }

      // 2. Coordinated Attack Waves
      if (faction.idleUnits.size >= faction.squadSizeThreshold) {
        const squad = Array.from(faction.idleUnits);
        faction.squads.push(squad);
        faction.idleUnits.clear();
        
        console.log(`[RTS AI Director] ${faction.name} formed Strike Wave of ${squad.length} units!`);
        _notifyWave(factionId, squad);
        
        // Attack-move commands to Grand Tower
        for (const entId of squad) {
          const ent = window.RTSEngineCore.getEntity(entId);
          if (ent && !ent.isDead) {
            const T = window.THREE;
            const jitterX = (Math.random() - 0.5) * 60;
            const jitterZ = (Math.random() - 0.5) * 60;
            ent.targetPos = new T.Vector3(PLAYER_HOME.x + jitterX, 0, PLAYER_HOME.z + jitterZ);
            ent.state = 'moving';
            ent.targetId = null;
          }
        }
      }
      
      // Clean up dead squads
      faction.squads = faction.squads.filter(squad => {
        let aliveCount = 0;
        for (const entId of squad) {
          const ent = window.RTSEngineCore.getEntity(entId);
          if (ent && !ent.isDead) aliveCount++;
        }
        return aliveCount > 0;
      });
    }
  }

  function install(scene) {
    if (!scene) return;
    SCENE_REF = scene;
    console.log('[RTS AI Director] Hostile AI Director Ready.');
  }

  // ─── PACING + WAVE ALERTS (War Command hooks) ───────────────────────
  // Default pacing is glacial (18 res/s, 6-unit squads, 1200u march) so
  // nothing ever reaches the player. WarCommand calls setPacing to crash the
  // timeline into "real war" speeds and registers onWave to get alerts.
  let _onWave = null;
  let _resRate = 18;
  function setPacing(opts) {
    if (!opts) return;
    if (typeof opts.resourceRate === 'number') _resRate = opts.resourceRate;
    if (typeof opts.unitSpeed === 'number' && opts.unitSpeed !== _unitSpeedMult) {
      _unitSpeedMult = opts.unitSpeed;
      // Re-apply to every living AI unit already on the field
      if (window.RTSEngineCore) {
        for (const ent of window.RTSEngineCore.ENTITIES.values()) {
          if (!ent.isDead && ent.type === 'unit' && ent.baseSpeed && FACTIONS[ent.faction]) {
            ent.speed = ent.baseSpeed * _unitSpeedMult;
          }
        }
      }
    }
    for (const id of Object.keys(FACTIONS)) {
      const f = FACTIONS[id];
      if (typeof opts.spawnCost === 'number') f.spawnCost = opts.spawnCost;
      if (typeof opts.squadThreshold === 'number') f.squadSizeThreshold = opts.squadThreshold;
      if (typeof opts.homeBase === 'object' && opts.homeBase[id]) {
        f.homeBase.x = opts.homeBase[id].x != null ? opts.homeBase[id].x : f.homeBase.x;
        f.homeBase.z = opts.homeBase[id].z != null ? opts.homeBase[id].z : f.homeBase.z;
      }
    }
    if (typeof console !== 'undefined') console.log('[RTS AI Director] Pacing set:', JSON.stringify({ resourceRate: _resRate, spawnCost: FACTIONS.bioHive.spawnCost, squadThreshold: FACTIONS.bioHive.squadSizeThreshold }));
  }
  function onWave(fn) { _onWave = fn; }
  function _notifyWave(factionId, squad) {
    if (typeof _onWave === 'function') {
      try { _onWave({ factionId, name: FACTIONS[factionId] && FACTIONS[factionId].name, count: squad.length }); } catch (_) {}
    }
  }

  window.RTSAIDirector = {
    install,
    tick: tickAI,
    setPacing,
    onWave,
    _notifyWave
  };
})();
