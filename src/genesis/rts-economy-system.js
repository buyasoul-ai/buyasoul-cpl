(function() {
  'use strict';

  // RTSEconomySystem — ensure resource nodes support harvester slots
  const RESOURCES = {
    profit: 500,
    food: 200,
    wood: 200,
    love: 100,
    tax: 0,
    aether: 50
  };

  function addResource(type, amount) {
    if (RESOURCES[type] !== undefined) {
      RESOURCES[type] += amount;
      const pltTicker = document.getElementById('plt-value');
      if (pltTicker && type === 'profit') {
        pltTicker.innerText = Math.floor(RESOURCES.profit).toString();
      }
    }
  }

  function spendResource(type, amount) {
    if (RESOURCES[type] >= amount) {
      RESOURCES[type] -= amount;
      return true;
    }
    return false;
  }

  const NODE_MESHES = [];

  function spawnCrystalNodes(scene, count) {
    const T = window.THREE;
    if (!T) return;
    count = count || 20;
    const group = new T.Group();
    group.name = 'rts-resource-nodes';

    const crystalGeo = new T.ConeGeometry(1.5, 4, 6);
    const crystalMat = new T.MeshStandardMaterial({
      color: 0x00ffcc,
      emissive: 0x004433,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.9
    });

    for (let i = 0; i < count; i++) {
      const cluster = new T.Group();

      const numCrystals = 3 + Math.floor(Math.random() * 3);
      for (let j = 0; j < numCrystals; j++) {
        const mesh = new T.Mesh(crystalGeo, crystalMat);
        mesh.position.set((Math.random() - 0.5) * 3, 2 + (Math.random() - 0.5) * 1, (Math.random() - 0.5) * 3);
        mesh.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI, (Math.random() - 0.5) * 0.5);
        cluster.add(mesh);
      }

      const radius = 100 + Math.random() * 1400; // spread across the playable ring, not just 100-800u
      const angle = Math.random() * Math.PI * 2;
      cluster.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);

      group.add(cluster);
      NODE_MESHES.push(cluster);

      if (window.RTSEngineCore) {
        const ent = window.RTSEngineCore.registerEntity(cluster, 'resource', 'neutral', 1000, 3.0);
        ent.resourceType = 'profit';
        ent.resourceAmount = 1000;
        ent.maxHarvesters = 3; // allow up to 3 harvesters simultaneously
        ent.harvesterIds = [];
      }
    }

    scene.add(group);
    console.log('[RTSEconomy] Spawned', count, 'Crystal Nodes.');
  }

  function tick(dt) {
    const t = performance.now() * 0.002;
    let pruned = false;
    for (let i = NODE_MESHES.length - 1; i >= 0; i--) {
      const cluster = NODE_MESHES[i];
      if (!cluster.parent) { NODE_MESHES.splice(i, 1); pruned = true; continue; }
      cluster.position.y = Math.sin(t + cluster.position.x) * 0.5;
      if (window.RTSEngineCore && cluster.userData.entityId) {
        const ent = window.RTSEngineCore.getEntity(cluster.userData.entityId);
        if (ent) {
          const scale = Math.max(0.1, ent.resourceAmount / 1000);
          cluster.scale.setScalar(scale);
        }
      }
    }
    if (pruned && window.RTSEngineCore) {
      // Drop entities whose node mesh was removed from the scene
      for (const ent of window.RTSEngineCore.ENTITIES.values()) {
        if (ent.type === 'resource' && ent.mesh && !ent.mesh.parent) {
          ent.isDead = true;
          window.RTSEngineCore.ENTITIES.delete(ent.id);
        }
      }
    }
  }

  function install(scene) {
    if (!scene) return;
    spawnCrystalNodes(scene, 30);

    window.addEventListener('rts:build', function(e) {
      const buildDefs = { barracks: 20, turret: 5, wall: 8, refinery: 15 };
      const gain = (e.detail && buildDefs[e.detail.defId]) || 10;
      addResource('love', gain);
    });

    window.addEventListener('rts:unit-spawned', function() { addResource('tax', 5); });

    console.log('[RTSEconomy] RTS Economy System Active.');
  }

  window.RTSEconomySystem = { install, tick, RESOURCES, addResource, spendResource };
  // Replace the RESOURCES export with a live READ-ONLY view — direct mutation
  // from outside would bypass validation; all changes must go through
  // addResource/spendResource. Getters keep the values live.
  const RESOURCES_VIEW = {};
  for (const k of Object.keys(RESOURCES)) {
    Object.defineProperty(RESOURCES_VIEW, k, { enumerable: true, get: () => RESOURCES[k] });
  }
  window.RTSEconomySystem.RESOURCES = RESOURCES_VIEW;
})();
