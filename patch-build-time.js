const fs = require('fs');
let code = fs.readFileSync('src/genesis/rts-engine-core.js', 'utf8');

// 1. Modify GameEntity constructor - add buildTime and buildProgress
code = code.replace(
  'constructor(mesh, type, faction, maxHp, radius) {',
  'constructor(mesh, type, faction, maxHp, radius, buildTime, buildProgress) {'
);

// Add buildTime/buildProgress fields after the radius line
code = code.replace(
  'this.radius = radius || 1.0;\r\n\r\n      this.isDead = false;',
  'this.radius = radius || 1.0;\r\n\r\n      this.isDead = false;\r\n\r\n      // Construction phase\r\n      this.buildTime = buildTime || 0;\r\n      this.buildProgress = (buildProgress !== undefined && buildProgress !== null) ? buildProgress : 1;'
);

// 2. Modify tickEntities - add construction tick logic for buildings
const oldBuildingSection = '      // building turrets auto-defend\r\n      if (ent.type === \'building\') {\r\n        if (ent.isTurret) {';
const newBuildingSection = "      // building construction & turrets\r\n      if (ent.type === 'building') {\r\n        // Construction progress\r\n        if (ent.buildProgress < 1 && ent.buildTime > 0) {\r\n          ent.buildProgress = Math.min(1, ent.buildProgress + dt / ent.buildTime);\r\n          // Update transparency based on progress\r\n          if (ent.mesh) {\r\n            ent.mesh.traverse(function(c) {\r\n              if (c.isMesh && c.material) {\r\n                c.material.transparent = true;\r\n                c.material.opacity = ent.buildProgress;\r\n              }\r\n            });\r\n          }\r\n          if (ent.buildProgress >= 1) {\r\n            // Construction complete - set full opacity\r\n            if (ent.mesh) {\r\n              ent.mesh.traverse(function(c) {\r\n                if (c.isMesh && c.material) {\r\n                  c.material.transparent = true;\r\n                  c.material.opacity = 1.0;\r\n                }\r\n              });\r\n            }\r\n          }\r\n          continue; // Skip everything else while under construction\r\n        }\r\n        if (ent.isTurret) {";
code = code.replace(oldBuildingSection, newBuildingSection);

// 3. Add BUILD_TIME constants and createBuildingWithBuildTime function before the INITIALIZER section
const buildTimeAddition = '\r\n  // --- CONSTRUCTION BUILD TIMES (seconds) ---\r\n  const BUILD_TIMES = {\r\n    house: 10,\r\n    barracks: 25,\r\n    tower: 20,\r\n    market: 20,\r\n    university: 30\r\n  };\r\n\r\n  function createBuildingWithBuildTime(scene, buildingDef) {\r\n    const T = window.THREE;\r\n    if (!T || !scene) return null;\r\n\r\n    // Create ghost wireframe mesh (green wireframe)\r\n    const geometry = new T.BoxGeometry(\r\n      buildingDef.size || 4,\r\n      buildingDef.height || 6,\r\n      buildingDef.size || 4\r\n    );\r\n    const material = new T.MeshBasicMaterial({\r\n      color: 0x00ff88,\r\n      wireframe: true,\r\n      transparent: true,\r\n      opacity: 0.3\r\n    });\r\n    const mesh = new T.Mesh(geometry, material);\r\n    mesh.position.set(\r\n      buildingDef.x || 0,\r\n      (buildingDef.height || 6) / 2,\r\n      buildingDef.z || 0\r\n    );\r\n    scene.add(mesh);\r\n\r\n    // Create entity with buildTime, buildProgress starts at 0\r\n    const bt = BUILD_TIMES[buildingDef.variant] || 15;\r\n    const ent = new GameEntity(\r\n      mesh,\r\n      "building",\r\n      buildingDef.faction || "voidCovenant",\r\n      buildingDef.hp || 500,\r\n      buildingDef.radius || 3,\r\n      bt,\r\n      0\r\n    );\r\n\r\n    // Copy optional building properties\r\n    if (buildingDef.isTurret !== undefined) ent.isTurret = buildingDef.isTurret;\r\n    if (buildingDef.isTownHall !== undefined) ent.isTownHall = buildingDef.isTownHall;\r\n    if (buildingDef.attackRange !== undefined) ent.attackRange = buildingDef.attackRange;\r\n    if (buildingDef.attackDamage !== undefined) ent.attackDamage = buildingDef.attackDamage;\r\n    if (buildingDef.variant) ent.variant = buildingDef.variant;\r\n\r\n    ENTITIES.set(ent.id, ent);\r\n    return ent;\r\n  }\r\n\r\n  // --- INITIALIZER ---';

code = code.replace('  // --- INITIALIZER ---', buildTimeAddition);

// 4. Add new functions to the export
code = code.replace(
  'window.RTSEngineCore = {\r\n    install,\r\n    tick,\r\n    registerEntity,\r\n    getEntity,\r\n    getEntitiesInRadius,\r\n    ENTITIES\r\n  };',
  'window.RTSEngineCore = {\r\n    install,\r\n    tick,\r\n    registerEntity,\r\n    getEntity,\r\n    getEntitiesInRadius,\r\n    createBuildingWithBuildTime,\r\n    BUILD_TIMES,\r\n    ENTITIES\r\n  };'
);

fs.writeFileSync('src/genesis/rts-engine-core.js', code);
console.log('Patch applied successfully.');