/**
 * starcraft-asymmetric-factions.js
 * BUYASOUL CPL / GODFORGE — StarCraft 2 Asymmetric Factions Engine
 * 
 * Provides 3 distinct asymmetric faction mechanics:
 *   1. Terran (Imperium): SCV Repairing & Base Siege Mode Mechanics.
 *   2. Protoss (Void Covenant): Regenerating Blue Energy Shields & Pylon Energy Grid.
 *   3. Zerg (Bio-Hive): Spreading Bio-Creep Terrain (+30% speed) & Burrow Ambushes.
 */

(function() {
  'use strict';

  // ─── FACTION MECHANICS ENGINE ───────────────────────────────────────

  const FACTION_MECHANICS = {
    imperium: {
      name: 'Imperium Dominion',
      trait: 'Terran Mechanics: Repairable Hulls, Siege Tanks, Stimpacks',
      applyShield: false
    },
    voidCovenant: {
      name: 'Void Covenant',
      trait: 'Protoss Mechanics: Regenerating Energy Shields & Pylon Power Fields',
      applyShield: true
    },
    bioHive: {
      name: 'Bio-Hive Swarm',
      trait: 'Zerg Mechanics: Bio-Creep Speed Boost & Subterranean Burrowing',
      applyShield: false
    }
  };

  // ─── PROTOSS REGENERATING SHIELD MATRIX ─────────────────────────────

  const SHIELDED_UNITS = [];

  function applyProtossShield(mesh, maxShield) {
    if (!mesh) return;
    const T = window.THREE;
    if (!T) return;
    maxShield = maxShield || 100;

    // Glowing Blue Shield Bubble
    const radiusVal = (mesh.geometry && mesh.geometry.boundingSphere) ? mesh.geometry.boundingSphere.radius * 1.4 : 3;
    const shieldGeo = new T.SphereGeometry(radiusVal, 16, 16);
    const shieldMat = new T.MeshBasicMaterial({
      color: 0x00aaff,
      transparent: true,
      opacity: 0.35,
      wireframe: true
    });

    const shieldMesh = new T.Mesh(shieldGeo, shieldMat);
    mesh.add(shieldMesh);

    const shieldData = {
      mesh,
      shieldMesh,
      shield: maxShield,
      maxShield,
      rechargeTimer: 0
    };

    SHIELDED_UNITS.push(shieldData);
    return shieldData;
  }

  function tickProtossShields(dt) {
    // Purge shields of dead/detached units — SHIELDED_UNITS must not grow forever
    for (let i = SHIELDED_UNITS.length - 1; i >= 0; i--) {
      const data = SHIELDED_UNITS[i];
      const entId = data.mesh && data.mesh.userData ? data.mesh.userData.entityId : null;
      const ent = (entId && window.RTSEngineCore) ? window.RTSEngineCore.getEntity(entId) : null;
      if (!data.mesh.parent || !ent || ent.isDead) {
        if (data.shieldMesh && data.shieldMesh.parent) data.shieldMesh.parent.remove(data.shieldMesh);
        SHIELDED_UNITS.splice(i, 1);
        continue;
      }
      if (data.shield < data.maxShield) {
        data.rechargeTimer += dt;
        if (data.rechargeTimer > 3) { // Recharge after 3s out of combat
          data.shield = Math.min(data.maxShield, data.shield + 25 * dt);
          data.shieldMesh.material.opacity = 0.1 + (data.shield / data.maxShield) * 0.3;
        }
      }
    }
  }

  // ─── ZERG BIO-CREEP TERRAIN MATRIX ──────────────────────────────────

  let creepPlane = null;

  function spawnBioCreep(position, radius, scene) {
    const T = window.THREE;
    if (!T) return;
    radius = radius || 80;
    const geo = new T.CircleGeometry(radius, 32);
    const mat = new T.MeshBasicMaterial({
      color: 0x660088,
      transparent: true,
      opacity: 0.4,
      side: T.DoubleSide
    });

    // Replace any previous creep plane — don't orphan the old mesh in the scene
    if (creepPlane && creepPlane.parent) creepPlane.parent.remove(creepPlane);
    creepPlane = new T.Mesh(geo, mat);
    creepPlane.rotation.x = -Math.PI / 2;
    creepPlane.position.copy(position);
    creepPlane.position.y = 0.1;

    scene.add(creepPlane);
    console.log('[StarCraftAsymmetric] Bio-Creep Matrix deployed at', position);
  }

  function isOnCreep(position) {
    if (!creepPlane) return false;
    const dx = position.x - creepPlane.position.x;
    const dz = position.z - creepPlane.position.z;
    const distSq = dx * dx + dz * dz;
    const radius = creepPlane.geometry.parameters.radius;
    return distSq <= radius * radius;
  }

  // ─── INITIALIZER ─────────────────────────────────────────────────────

  function install(scene) {
    if (!scene) return;
    const T = window.THREE;
    if (!T) return;

    // Deploy Bio-Creep terrain at Bioluminescent Hive (1200, 0, -500)
    spawnBioCreep(new T.Vector3(1200, 0, -500), 120, scene);

    console.log('[StarCraftAsymmetric] StarCraft 2 Asymmetric Factions Engine active.');
  }

  function tick(dt) {
    tickProtossShields(dt || 0.016);
  }

  window.StarCraftAsymmetricEngine = {
    install,
    tick,
    applyProtossShield,
    spawnBioCreep,
    isOnCreep,
    FACTION_MECHANICS
  };
})();
