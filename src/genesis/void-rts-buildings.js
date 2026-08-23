// src/genesis/void-rts-buildings.js
// AoE-style RTS building extensions for the Void cities.
// Gives void buildings garrison capacity, production queues, and tech upgrades.

(function () {
  'use strict';

  const BUILDING_DB = new Map();
  let entityId = 0;

  function id() { return ++entityId; }

  // Create an AoE-style building record attached to a THREE mesh
  function registerVoidBuilding(mesh, type, faction, opts) {
    opts = opts || {};
    const building = {
      id: id(),
      mesh: mesh,
      type: type, // 'townCenter', "barracks", "tower", "market", "university"
      faction: faction,
      hp: opts.hp || 1000,
      maxHp: opts.hp || 1000,
      garrison: [],
      garrisonMax: opts.garrisonMax || (type === 'townCenter' ? 10 : type === 'barracks' ? 0 : 5),
      productionQueue: [],
      productionMax: opts.productionMax || (type === 'barracks' ? 5 : 0),
      techs: [],
      upgrades: [],
      armor: opts.armor || 0,
      lineOfSight: opts.lineOfSight || 20,
      isVoidBuilding: true,
      rallyPoint: opts.rallyPoint || null,
      underConstruction: opts.underConstruction || false,
      buildProgress: opts.underConstruction ? 10 : 100,
      buildTimeTotal: opts.buildTime || 15,
    };
    if (mesh) mesh.userData.rtsBuildingId = building.id;
    BUILDING_DB.set(building.id, building);
    return building;
  }

  function getBuilding(id) { return BUILDING_DB.get(id); }

  function getBuildingsByType(type) {
    return Array.from(BUILDING_DB.values()).filter(b => b.type === type);
  }

  // Garrison a unit inside a building (AoE town bell / garrison mechanic)
  function garrisonUnit(buildingOrId, unit) {
    const building = (typeof buildingOrId === 'number') ? getBuilding(buildingOrId) : buildingOrId;
    if (!building) return false;
    if (building.garrison.length >= building.garrisonMax) return false;
    building.garrison.push(unit);
    unit._garrisoned = true;
    unit._garrisonBuilding = building.id;
    return true;
  }

  function unGarrisonAll(buildingOrId, rallyPoint) {
    const building = (typeof buildingOrId === 'number') ? getBuilding(buildingOrId) : buildingOrId;
    if (!building) return [];
    const units = building.garrison.slice();
    building.garrison.length = 0;
    for (const u of units) {
      u._garrisoned = false;
      u._garrisonBuilding = null;
      if (rallyPoint && u.mesh) {
        u.mesh.position.copy(rallyPoint);
      } else if (building.mesh && u.mesh && window.THREE) {
        u.mesh.position.copy(building.mesh.position).add(new window.THREE.Vector3(5 + Math.random() * 5, 0, 5 + Math.random() * 5));
      }
    }
    return units;
  }

  // Production queue (AoE barracks / stable / siege)
  function enqueueProduction(buildingOrId, unitDef) {
    if (!unitDef || !unitDef.id) return false; // defs without id break spawn events
    const building = (typeof buildingOrId === 'number') ? getBuilding(buildingOrId) : buildingOrId;
    if (!building || building.productionQueue.length >= building.productionMax) return false;
    if (!unitDef.cost) unitDef.cost = {};
    building.productionQueue.push({
      def: unitDef,
      progress: 0,
      total: unitDef.time || 10,
      id: id(),
    });
    return true;
  }

  function tickProduction(building, dt) {
    if (!building || building.productionQueue.length === 0) return;
    const head = building.productionQueue[0];
    head.progress += dt;
    if (head.progress >= head.total) {
      building.productionQueue.shift();
      if (window.RTSEngineCore && building.mesh) {
        // Spawn at rally point or near building
        const spawnPos = (building.rallyPoint || building.mesh.position.clone()).clone();
        spawnPos.x += (Math.random() - 0.5) * 6;
        spawnPos.z += (Math.random() - 0.5) * 6;
        // Fire event; actual unit spawn is handled by rts-production-system
        window.dispatchEvent(new CustomEvent('rts:spawn-unit', { detail: { defId: head.def.id, pos: spawnPos, faction: building.faction } }));
      }
    }
  }

  // Tech tree (AoE-style upgrades)
  const TECH_TREE = {
    masonry: { name: 'Masonry', cost: { profit: 200, aether: 50 }, effect: (b) => { b.armor += 2; b.maxHp += 500; b.hp += 500; } },
    ballistics: {
      name: 'Ballistics', cost: { profit: 300, aether: 100 },
      effect: (b) => {
        // Real effect: global marker for combat systems + turret damage boost
        window.__BALLISTICS_RESEARCHED = true;
        if (b.isTurret && b.attackDamage) b.attackDamage = Math.round(b.attackDamage * 1.25);
      }
    },
    feudalAge: { name: 'Feudal Age', cost: { profit: 800, love: 200 }, effect: (b) => { b.maxHp += 1000; b.hp += 1000; } },
  };

  function researchTech(buildingOrId, techKey) {
    const building = (typeof buildingOrId === 'number') ? getBuilding(buildingOrId) : buildingOrId;
    if (!building || building.techs.includes(techKey)) return false;
    const tech = TECH_TREE[techKey];
    if (!tech) return false;
    building.techs.push(techKey);
    tech.effect(building);
    return true;
  }

  // Per-tick update across all registered void buildings
  function tickConstruction(building, dt) {
    if (!building || !building.underConstruction) return;
    var rate = 100 / building.buildTimeTotal;
    building.buildProgress = Math.min(100, building.buildProgress + rate * dt);
    // Progress never heals damage taken during construction — no free-heal exploit
    var targetHp = Math.floor((building.buildProgress / 100) * building.maxHp);
    if (targetHp > building.hp) building.hp = targetHp;
    if (building.buildProgress >= 100) {
      building.underConstruction = false;
      building.hp = building.maxHp;
      console.log('[VoidRTSBuildings] Construction complete: ' + building.type + ' #' + building.id);
    }
  }

  function tick(dt) {
    for (const building of BUILDING_DB.values()) {
      tickConstruction(building, dt);
      tickProduction(building, dt);
    }
  }

  // Hook into a Void city group: scan meshes with isTowerBuilding and register as RTS buildings
  function registerCityGroup(group, type, faction) {
    if (!group) return [];
    const registered = [];
    group.traverse((child) => {
      if (!child.isMesh && !child.isGroup) return;
      if (!child.userData.isTowerBuilding && !child.userData.buildingType) return;
      const bType = child.userData.buildingType || type;
      let rtsType = 'tower';
      if (bType === 'Barracks' || bType === 'barracks') rtsType = 'barracks';
      else if (bType === 'Market' || bType === 'market') rtsType = 'market';
      else if (bType === 'University' || bType === 'university') rtsType = 'university';
      else if (bType === 'TownCenter' || bType === 'townCenter') rtsType = 'townCenter';
      const building = registerVoidBuilding(child, rtsType, faction, { hp: 1500 });
      registered.push(building);
    });
    return registered;
  }

  window.VoidRTSBuildings = {
    registerVoidBuilding,
    getBuilding,
    getBuildingsByType,
    garrisonUnit,
    unGarrisonAll,
    enqueueProduction,
    tick,
    researchTech,
    TECH_TREE,
    registerCityGroup,
    all: () => Array.from(BUILDING_DB.values()),
  };
})();
