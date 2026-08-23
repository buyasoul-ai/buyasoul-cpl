// src/genesis/rts-wall-system.js
// Wall system — palisade and stone walls with gates for defense.
// Walls block movement via nav grid and can be destroyed.

(function () {
  'use strict';

  var WALLS = new Map();
  var GATES = new Map();
  var wallIdCounter = 0;
  var gateIdCounter = 0;

  var WALL_TYPES = {
    palisade: { hp: 100, height: 3, thickness: 0.3, color: 0x8b6914, cost: { wood: 2 } },
    stone: { hp: 500, height: 5, thickness: 0.8, color: 0x888888, cost: { stone: 100 } }
  };

  function placeWallSegment(scene, x, z, direction, type, faction) {
    var T = window.THREE;
    if (!T || !scene) return null;

    var def = WALL_TYPES[type] || WALL_TYPES.palisade;
    var geo = new T.BoxGeometry(def.thickness, def.height, 3);
    var mat = new T.MeshStandardMaterial({
      color: def.color,
      roughness: 0.9,
      metalness: 0.05
    });
    var mesh = new T.Mesh(geo, mat);
    mesh.position.set(x, def.height / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Rotate based on direction
    if (direction === 'horizontal') {
      mesh.rotation.y = Math.PI / 2;
    }

    scene.add(mesh);

    var id = ++wallIdCounter;
    var wall = {
      id: id,
      mesh: mesh,
      type: type,
      direction: direction,
      hp: def.hp,
      maxHp: def.hp,
      faction: faction || 'voidCovenant',
      position: new T.Vector3(x, 0, z)
    };

    // Register as entity
    var ent = window.RTSEngineCore.registerEntity(mesh, 'building', faction, def.hp, 1.5, 3, 0);
    ent.isWall = true;
    ent.wallId = id;
    ent.buildProgress = 1;

    WALLS.set(id, wall);

    // Block nav grid
    if (window.RTSNavGrid && window.RTSNavGrid.blockCircle) {
      window.RTSNavGrid.blockCircle(x, z, 1.5, true);
    }

    return wall;
  }

  function placeWall(scene, startX, startZ, endX, endZ, type, faction) {
    var dx = endX - startX;
    var dz = endZ - startZ;
    var len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.5) return null;

    var direction = Math.abs(dx) > Math.abs(dz) ? 'horizontal' : 'vertical';
    var segmentSpacing = 3; // 3-unit segments
    var segments = Math.max(1, Math.round(len / segmentSpacing));
    var placed = [];

    for (var i = 0; i <= segments; i++) {
      var t = segments > 0 ? i / segments : 0;
      var x = startX + dx * t;
      var z = startZ + dz * t;
      var wall = placeWallSegment(scene, x, z, direction, type, faction);
      if (wall) placed.push(wall);
    }

    console.log('[RTSWall] Placed ' + placed.length + ' ' + type + ' wall segments.');
    return placed;
  }

  function placeGate(scene, x, z, direction, faction) {
    var T = window.THREE;
    if (!T || !scene) return null;

    // Two pillars + a door beam
    var group = new T.Group();

    var pillarGeo = new T.BoxGeometry(0.8, 5, 0.8);
    var pillarMat = new T.MeshStandardMaterial({ color: 0x666666, roughness: 0.9 });

    var leftPillar = new T.Mesh(pillarGeo, pillarMat);
    leftPillar.position.set(-4, 2.5, 0);
    leftPillar.castShadow = true;
    group.add(leftPillar);

    var rightPillar = new T.Mesh(pillarGeo, pillarMat);
    rightPillar.position.set(4, 2.5, 0);
    rightPillar.castShadow = true;
    group.add(rightPillar);

    // Door beam
    var beamGeo = new T.BoxGeometry(8.8, 0.5, 0.5);
    var beam = new T.Mesh(beamGeo, pillarMat);
    beam.position.set(0, 5, 0);
    group.add(beam);

    // Door (starts closed)
    var doorGeo = new T.BoxGeometry(7.2, 4, 0.3);
    var doorMat = new T.MeshStandardMaterial({
      color: 0x8b6914,
      roughness: 0.8,
      transparent: true,
      opacity: 0.9
    });
    var door = new T.Mesh(doorGeo, doorMat);
    door.position.set(0, 2, 0);
    door.userData.isOpen = false;
    group.add(door);

    group.position.set(x, 0, z);
    if (direction === 'horizontal') {
      group.rotation.y = Math.PI / 2;
    }
    scene.add(group);

    var id = ++gateIdCounter;
    var gate = {
      id: id,
      group: group,
      door: door,
      direction: direction,
      isOpen: false,
      faction: faction || 'voidCovenant',
      position: new T.Vector3(x, 0, z),
      hp: 300,
      maxHp: 300
    };

    // Register as entity
    var ent = window.RTSEngineCore.registerEntity(group, 'building', faction, 300, 4, 5, 0);
    ent.isGate = true;
    ent.gateId = id;
    ent.buildProgress = 1;

    GATES.set(id, gate);

    // Don't block nav grid — gates are passable
    console.log('[RTSWall] Gate placed at (' + x + ', ' + z + '). ID=' + id);
    return gate;
  }

  function openGate(gateId) {
    var gate = GATES.get(gateId);
    if (!gate || gate.isOpen) return;
    gate.isOpen = true;
    // Animate door up
    if (gate.door) {
      gate.door.position.y = 6;
      gate.door.material.opacity = 0.3;
    }
    console.log('[RTSWall] Gate ' + gateId + ' opened.');
  }

  function closeGate(gateId) {
    var gate = GATES.get(gateId);
    if (!gate || !gate.isOpen) return;
    gate.isOpen = false;
    if (gate.door) {
      gate.door.position.y = 2;
      gate.door.material.opacity = 0.9;
    }
    console.log('[RTSWall] Gate ' + gateId + ' closed.');
  }

  function removeWall(wallId) {
    var wall = WALLS.get(wallId);
    if (!wall) return;
    if (wall.mesh && wall.mesh.parent) wall.mesh.parent.remove(wall.mesh);
    // Unblock nav grid
    if (window.RTSNavGrid && window.RTSNavGrid.unblockCircle) {
      window.RTSNavGrid.unblockCircle(wall.position.x, wall.position.z, 1.5);
    }
    // Kill the engine entity too — otherwise a ghost stays targetable
    if (window.RTSEngineCore && window.RTSEngineCore.ENTITIES) {
      for (var ent of window.RTSEngineCore.ENTITIES.values()) {
        if (ent.wallId === wallId) {
          ent.isDead = true;
          window.RTSEngineCore.ENTITIES.delete(ent.id);
          break;
        }
      }
    }
    WALLS.delete(wallId);
  }

  function tick(dt) {
    // Damage visual: reduce opacity when HP is low
    for (var wall of WALLS.values()) {
      if (!wall.mesh || !wall.mesh.material) continue;
      var hpRatio = wall.hp / wall.maxHp;
      if (hpRatio < 0.5) {
        wall.mesh.material.transparent = true;
        wall.mesh.material.opacity = Math.max(0.3, hpRatio + 0.2);
      }
    }
    for (var gate of GATES.values()) {
      if (!gate.door || !gate.door.material) continue;
      var ratio = gate.hp / gate.maxHp;
      if (ratio < 0.5 && !gate.isOpen) {
        gate.door.material.opacity = Math.max(0.3, ratio + 0.2);
      }
    }
  }

  function getWall(id) { return WALLS.get(id); }
  function getGate(id) { return GATES.get(id); }
  function getAllWalls() { return WALLS; }
  function getAllGates() { return GATES; }

  window.RTSWallSystem = {
    placeWall: placeWall,
    placeWallSegment: placeWallSegment,
    placeGate: placeGate,
    openGate: openGate,
    closeGate: closeGate,
    removeWall: removeWall,
    getWall: getWall,
    getGate: getGate,
    getAllWalls: getAllWalls,
    getAllGates: getAllGates,
    WALL_TYPES: WALL_TYPES,
    tick: tick
  };
})();
