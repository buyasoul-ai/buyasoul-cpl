// src/genesis/rts-farm-system.js
// Farm system — reseedable food source for the RTS economy.
// Farms are flat green planes placed near mills/town centers.
// Villagers harvest food from them; when depleted they can be reseeded.

(function () {
  'use strict';

  var FARMS = new Map();
  var farmIdCounter = 0;
  var SCENE = null;
  // Reseeding costs 60 wood — must be explicit, never drain silently mid-game.
  // Opt in via RTSFarmSystem.setAutoReseed(true).
  var autoReseedEnabled = false;

  // Procedural crop canvas texture
  var cropTexture = null;

  function getCropTexture() {
    var T = window.THREE;
    if (!T) return null;
    if (cropTexture) return cropTexture;
    var canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    var ctx = canvas.getContext('2d');

    // Soil base
    ctx.fillStyle = '#5a3d1e';
    ctx.fillRect(0, 0, 128, 128);

    // Furrow rows
    for (var y = 0; y < 128; y += 12) {
      ctx.fillStyle = (y / 12) % 2 === 0 ? '#6b4a24' : '#4d3518';
      ctx.fillRect(0, y, 128, 6);
    }

    // Crops (green dots)
    for (var i = 0; i < 120; i++) {
      var cx = 4 + Math.random() * 120;
      var cy = 4 + Math.random() * 120;
      var r = 2 + Math.random() * 3;
      ctx.fillStyle = ['#5fa83a', '#4d9c2a', '#6bb044', '#3d8b1e'][Math.floor(Math.random() * 4)];
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    cropTexture = new T.CanvasTexture(canvas);
    cropTexture.wrapS = T.RepeatWrapping;
    cropTexture.wrapT = T.RepeatWrapping;
    return cropTexture;
  }

  function findNearestTownHall(pos, faction) {
    if (!window.RTSEngineCore) return null;
    var best = null;
    var minD = Infinity;
    for (var ent of window.RTSEngineCore.ENTITIES.values()) {
      if (ent.isDead || !ent.mesh) continue;
      if (ent.type !== 'building') continue;
      if (ent.isTownHall || (ent.variant === 'townHall')) {
        var d = ent.mesh.position.distanceTo(pos);
        if (d < minD) { minD = d; best = ent; }
      }
    }
    return best;
  }

  function registerFarm(scene, x, z, faction) {
    var T = window.THREE;
    if (!T || !scene) return null;

    var pos = new T.Vector3(x, 0, z);

    // Validate: farms REQUIRE a town hall within 8 units
    var hall = findNearestTownHall(pos, faction);
    if (!hall) {
      console.warn('[RTSFarm] Cannot place farm: no town hall exists.');
      return null;
    }
    if (hall.mesh.position.distanceTo(pos) > 8) {
      console.warn('[RTSFarm] Cannot place farm: too far from town hall.');
      return null;
    }

    var tex = getCropTexture();
    var geo = new T.BoxGeometry(4, 0.15, 4);
    var mat = new T.MeshStandardMaterial({
      map: tex,
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0.05
    });
    var mesh = new T.Mesh(geo, mat);
    mesh.position.set(x, 0.08, z);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    scene.add(mesh);

    var id = ++farmIdCounter;
    var farm = {
      id: id,
      mesh: mesh,
      foodRemaining: 300,
      maxFood: 300,
      ownerFaction: faction || 'voidCovenant',
      position: new T.Vector3(x, 0, z),
      depleted: false,
      harvesters: 0
    };

    // Register as entity so it can be targeted/destroyed
    var ent = window.RTSEngineCore.registerEntity(mesh, 'building', faction, 100, 2, 5, 0);
    ent.isFarm = true;
    ent.farmId = id;
    ent.buildProgress = 1; // farms build fast, start visible

    FARMS.set(id, farm);
    console.log('[RTSFarm] Farm placed at (' + x + ', ' + z + ') with 300 food. ID=' + id);
    return farm;
  }

  function harvestFarm(farmId, amount) {
    var farm = FARMS.get(farmId);
    if (!farm || farm.depleted) return 0;
    var harvested = Math.min(amount, farm.foodRemaining);
    farm.foodRemaining -= harvested;
    if (farm.foodRemaining <= 0) {
      farm.depleted = true;
      // Visual: turn brown
      if (farm.mesh && farm.mesh.material) {
        farm.mesh.material.color = new (window.THREE.Color)(0x5a3d1e);
        farm.mesh.material.map = null;
        farm.mesh.material.needsUpdate = true;
      }
      console.log('[RTSFarm] Farm ' + farmId + ' depleted.');

      // Auto-reseed if enabled
      if (autoReseedEnabled) {
        reseedFarm(farmId);
      }
    }
    return harvested;
  }

  function reseedFarm(farmId) {
    var farm = FARMS.get(farmId);
    if (!farm) return false;

    // Cost: 60 wood
    if (window.RTSEconomySystem && window.RTSEconomySystem.spendResource) {
      if (!window.RTSEconomySystem.spendResource('wood', 60)) {
        console.log('[RTSFarm] Cannot reseed: not enough wood.');
        return false;
      }
    }

    farm.foodRemaining = farm.maxFood;
    farm.depleted = false;

    // Restore crop texture
    if (farm.mesh && farm.mesh.material) {
      var tex = getCropTexture();
      farm.mesh.material.map = tex;
      farm.mesh.material.color = new (window.THREE.Color)(0xffffff);
      farm.mesh.material.needsUpdate = true;
    }

    console.log('[RTSFarm] Farm ' + farmId + ' reseeded to ' + farm.maxFood + ' food.');
    return true;
  }

  function removeFarm(farmId) {
    var farm = FARMS.get(farmId);
    if (!farm) return;
    if (farm.mesh && farm.mesh.parent) {
      farm.mesh.parent.remove(farm.mesh);
    }
    // Kill the engine entity too — otherwise a ghost stays targetable
    if (window.RTSEngineCore && window.RTSEngineCore.ENTITIES) {
      for (var ent of window.RTSEngineCore.ENTITIES.values()) {
        if (ent.farmId === farmId) {
          ent.isDead = true;
          window.RTSEngineCore.ENTITIES.delete(ent.id);
          break;
        }
      }
    }
    FARMS.delete(farmId);
  }

  function tick(dt) {
    // Subtle crop sway animation
    var t = performance.now() * 0.001;
    for (var farm of FARMS.values()) {
      if (farm.depleted || !farm.mesh) continue;
      farm.mesh.scale.z = 1 + Math.sin(t + farm.position.x) * 0.01;
    }
  }

  function getFarm(id) { return FARMS.get(id); }
  function getAllFarms() { return FARMS; }
  function setAutoReseed(val) { autoReseedEnabled = val; }

  window.RTSFarmSystem = {
    registerFarm: registerFarm,
    harvestFarm: harvestFarm,
    reseedFarm: reseedFarm,
    removeFarm: removeFarm,
    getFarm: getFarm,
    getAllFarms: getAllFarms,
    setAutoReseed: setAutoReseed,
    tick: tick
  };
})();
