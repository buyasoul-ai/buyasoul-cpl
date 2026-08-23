// src/genesis/void-population.js
// VOID POPULATION — Lost Worlds scattered ALL AROUND the city in every direction.
// Each world is a complete Realm with districts, buildings, agents, weather.
// Beacons are created SYNCHRONOUSLY so they're always visible.
// Flag-gated by window.__GENESIS_VOID_POPULATION (default ON).

import * as THREE from 'three';
import { installVoidCosmos } from './void-cosmos.js';

const WORLD_COUNT = 30;
const MIN_DIST = 360; // Lost Mechanics Ring starts here (CPL Territory ends at 360u)
const MAX_DIST = 3000;
const WAKE_RADIUS = 800;
const SLEEP_RADIUS = 1200;
const NO_BUILD_ZONE = 360; // CPL Territory: 0-360u forbidden zone

// Explicit world coordinates from VOID-COORDINATES.md / void-map.html
// Zone 1: Lost Mechanics Ring (360-600u) - 3 Lost Mechanics cities
// Zone 2: Lost Worlds Ring (600-3000u) - 10 Worlds
const WORLD_COORDINATES = [
  // Lost Mechanics Ring (360-600u)
  { x: -490, y: 0, z: 59, zone: 'lost-mechanics' },    // Lost Mech I - Physics Gate
  { x: -360, y: 0, z: -21, zone: 'lost-mechanics' },  // Lost Mech II - Arena Core  
  { x: -218, y: 0, z: -288, zone: 'lost-mechanics' }, // Lost Mech III - Soul Home
  // Lost Worlds Ring (600-3000u)
  { x: 2090, y: 39.6, z: 221 },    // Neon Citadel — combat
  { x: 2301, y: 19.1, z: 632 },    // Shadow Forge — crafting
  { x: 400, y: 0, z: 400 },        // Crystal Nexus — trading/refactored
  { x: -23, y: -27.3, z: 1409 },   // Void Empire — exploration
  { x: -976, y: -22.6, z: 510 },   // Ember Sanctum — breeding
  { x: -589, y: 0, z: -118 },      // Frost Wilds — governance/PLT Engine
  { x: -2211, y: -14.1, z: -567 }, // Storm Hub — economy
  { x: -1048, y: -8.8, z: -2792 }, // Soul Arena — building
  { x: 1553, y: 17.3, z: -2135 },  // Cosmic Garden — conversation
  { x: 1152, y: 32.5, z: -561 },   // Phantom Spire — districts
  // New City — CPL clone at (313, 0, 179) in Lost Mechanics Ring
  { x: 313, y: 0, z: 179, zone: 'lost-mechanics', cplclone: true },   // New City — LM bible randomized
  // Grand Tower — the central tower at (-104, 0, 401)
  { x: -104, y: 0, z: 401, zone: 'lost-mechanics' },
  // Stormhold Castle — Outer Void at 3800u
  { x: 3800, y: 0, z: 0, zone: 'outer-void' },
  // Cosmic Colosseum — Outer Void at 4000u
  { x: 0, y: 0, z: -4000, zone: 'outer-void' },
  // Expansion cities — new districts beyond the original ring
  { x: 2200, y: 12.5, z: 1800, zone: 'lost-worlds' },   // Abyssal Market — trade
  { x: -1800, y: -6.2, z: 2100, zone: 'lost-worlds' },  // Sunken Archive — knowledge
  { x: 2600, y: 8.0, z: -1200, zone: 'lost-worlds' },  // Radiant Foundry — industry
  { x: -1500, y: 4.5, z: -2300, zone: 'lost-worlds' }, // Hollow Court — governance
  { x: 3100, y: 0, z: 900, zone: 'outer-void' },       // Obsidian Spire — military
  { x: -2600, y: 0, z: -900, zone: 'outer-void' },      // Verdant Coil — bio-lab
  { x: 0, y: 0, z: 4200, zone: 'outer-void' },         // Solar Spire — energy
  // === NEW CITIES (Expansion Pack 1) ===
  { x: 3500, y: 0, z: -2500, zone: 'outer-void' },      // Chrono Bastion — time manipulation
  { x: -3200, y: 0, z: 1800, zone: 'outer-void' },      // Quantum Foundry — reality bending
  { x: 1800, y: 0, z: 3200, zone: 'lost-worlds' },      // Stellar Archive — cosmic knowledge
  { x: -2800, y: 0, z: -2800, zone: 'outer-void' },     // Voidheart Citadel — soul mastery
  { x: 4200, y: 0, z: 1200, zone: 'outer-void' },       // Aurora Spire — light magic
  { x: -1200, y: 0, z: 3500, zone: 'lost-worlds' },     // Deepforge Depths — underground industry
];

const WORLD_CONFIG = [
  // Lost Mechanics Ring (360-600u)
  { name: 'Lost Mech I - Physics Gate', type: 'physics', plt: { profit: 15, love: 10, tax: -2 } },
  { name: 'Lost Mech II - Arena Core', type: 'arena', plt: { profit: 13, love: 8, tax: -3 } },
  { name: 'Lost Mech III - Soul Home', type: 'soulhome', plt: { profit: 9, love: 14, tax: -3 } },
  // Lost Worlds Ring (600-3000u)
  { name: 'Neon Citadel', type: 'combat' },
  { name: 'Shadow Forge', type: 'crafting' },
  { name: 'Crystal Nexus', type: 'trading' },
  { name: 'Void Empire', type: 'exploration' },
  { name: 'Ember Sanctum', type: 'breeding' },
  { name: 'Frost Wilds', type: 'governance' },
  { name: 'Storm Hub', type: 'economy' },
  { name: 'Soul Arena', type: 'building' },
  { name: 'Cosmic Garden', type: 'conversation' },
  { name: 'Phantom Spire', type: 'districts' },
  // New City — CPL clone with LM bible randomization
  { name: 'New City', type: 'cplclone', plt: { profit: 25, love: 25, tax: 0 } },
  // Grand Tower — the central tower
  { name: 'Grand Tower', type: 'grandtower', plt: { profit: 50, love: 50, tax: 50 } },
  // Stormhold Castle — Outer Void fortress
  { name: 'Stormhold Castle', type: 'castle', plt: { profit: 30, love: 10, tax: 40 } },
  // Cosmic Colosseum — Outer Void arena
  { name: 'Cosmic Colosseum', type: 'colosseum', plt: { profit: 40, love: 20, tax: 30 } },
  // Expansion cities
  { name: 'Abyssal Market', type: 'trading', plt: { profit: 35, love: 8, tax: 12 } },
  { name: 'Sunken Archive', type: 'exploration', plt: { profit: 10, love: 20, tax: 5 } },
  { name: 'Radiant Foundry', type: 'crafting', plt: { profit: 28, love: 5, tax: 18 } },
  { name: 'Hollow Court', type: 'governance', plt: { profit: 15, love: 25, tax: 20 } },
  { name: 'Obsidian Spire', type: 'combat', plt: { profit: 22, love: 4, tax: 25 } },
  { name: 'Verdant Coil', type: 'breeding', plt: { profit: 18, love: 22, tax: 8 } },
  { name: 'Solar Spire', type: 'economy', plt: { profit: 40, love: 12, tax: 10 } },
  // === NEW CITIES (Expansion Pack 1) ===
  { name: 'Chrono Bastion', type: 'time', plt: { profit: 32, love: 6, tax: 28 } },
  { name: 'Quantum Foundry', type: 'reality', plt: { profit: 45, love: 3, tax: 35 } },
  { name: 'Stellar Archive', type: 'knowledge', plt: { profit: 12, love: 30, tax: 7 } },
  { name: 'Voidheart Citadel', type: 'soul', plt: { profit: 25, love: 18, tax: 22 } },
  { name: 'Aurora Spire', type: 'light', plt: { profit: 38, love: 9, tax: 19 } },
  { name: 'Deepforge Depths', type: 'industry', plt: { profit: 34, love: 7, tax: 26 } },
];

const NAMES = WORLD_CONFIG.map(w => w.name);
const TYPES = WORLD_CONFIG.map(w => w.type);

const TYPE_COLORS = {
  // Lost Mechanics Archetypes
  physics: 0xaa66ff, gacha: 0xff66cc, evolve: 0x66ff88,
  typeadv: 0xff8844, arena: 0xff3355, idle: 0x00ffaa,
  prestige: 0xffdd00, pantheon: 0x4488ff, soulhome: 0xffaa00,
  persona: 0x00ffcc, economy: 0x00ffaa, achievement: 0xff7722,
  // Original types
  combat: 0xff3355, crafting: 0x66ff88, trading: 0xffdd00, exploration: 0xaa66ff,
  breeding: 0xff66cc, governance: 0xff8844, building: 0x4488ff,
  conversation: 0xffaa00, districts: 0x00ffcc, cplclone: 0x66ffff, grandtower: 0xffcc44,   castle: 0xcc8844, colosseum: 0xff8844
};
const TYPE_QUESTS = {
  // Lost Mechanics Archetypes
  physics: 'Master Momentum Fields — control collision and force',
  gacha: 'Complete a full collection — 100% drop rate achieved',
  evolve: 'Evolve to Apex Form — transcend the base state',
  typeadv: 'Master all 12 types — achieve perfect counter balance',
  arena: 'Defeat the Pantheon Champion — prove your worth',
  idle: 'Achieve 24-hour automation — watch the world build itself',
  prestige: 'Ascend 3 times — reset with bonus multipliers',
  pantheon: 'Gain favor with all 12 Deities — unlock divine powers',
  soulhome: 'Build your perfect sanctuary — customize every corner',
  persona: 'Create a perfect companion — match personality to need',
  economy: 'Trigger a PLT market boom — exceed 200 PLT',
  achievement: 'Complete all 12 Lost Mechanics — unlock the Door',
  // Original types
  combat: 'Defeat the Arena Champion — prove your strength in the Pantheon',
  crafting: 'Forge 3 Legendary Souls — master the Soul Forge',
  trading: 'Accumulate 1000 PLT — become the greatest merchant',
  exploration: 'Discover all 5 hidden beacons — map the unknown',
  breeding: 'Breed a Legendary Soul — combine Profit and Love',
  governance: 'Achieve 90% citizen satisfaction — lead with wisdom',
  building: 'Construct a Mega-Structure — reach building level 10',
  conversation: 'Hold 10 conversations — connect every citizen',
  districts: 'Unlock all 4 districts — achieve total unity',
  cplclone: 'Build a CPL clone city — randomized by the Lost Mechanics Bible',
  grandtower: 'The Grand Tower — ascend 100 floors, forge legendary souls',
  castle: 'Stormhold Castle — conquer the Outer Void fortress, claim its PLT treasury',
  colosseum: 'Cosmic Colosseum — triumph in the arena, earn glory beyond measure'
};
const TYPE_DENIZEN_NAMES = {
  // Lost Mechanics Archetypes
  physics: ['Vector Master','Momentum Keeper','Force Weaver','Collision Sage','Field Architect'],
  gacha: ['Luck Broker','Rarity Seeker','Dragon Hoarder','Wish Fulfiller','Pity Timer'],
  evolve: ['Mutation Sage','Branch Keeper','Ascension Guide','Transcendent One','Life Architect'],
  typeadv: ['Elementalist','Counter Master','Advantage Seeker','Weakness Exploiter','Type Sage'],
  arena: ['Pantheon Warrior','Bone Master','Gladiator','Champion','Protector'],
  idle: ['Idle Sage','Automation Master','Progress Watcher','Offline Duke','Passive Income'],
  prestige: ['Ascension Sage','Rebirth Keeper','Reset Master','Bonus Oracle','Transcendant'],
  pantheon: ['Divine Judge','God Tongue','Heavenly Arbiter','Celestial Knight','Deity Speaker'],
  soulhome: ['Home Keeper','Nest Builder','Family Head','Host','Caretaker'],
  persona: ['Mind Weaver','Dialogue Sage','Personality Architect','Soul Reader','Character Architect'],
  economy: ['Market Sage','Token Master','Ledger Keeper','PLT Scorer','Exchange Artisan'],
  achievement: ['Milestone Keeper','Triumph Bearer','Completionist','Reward Seeker','Honor Guard'],
  // Original types
  combat: ['Blade Master','War Chief','Arena Guard','Berserker','Paladin'],
  crafting: ['Forge Keeper','Artisan','Smith','Runecaster','Alchemist'],
  trading: ['Merchant Lord','Broker','Dealer','Banker','Auctioneer'],
  exploration: ['Pathfinder','Scout','Cartographer','Ranger','Explorer'],
  breeding: ['Breeder','Nurturer','Hatchery Master','Geneticist','Keeper'],
  governance: ['Councilor','Judge','Advisor','Elder','Chancellor'],
  building: ['Architect','Engineer','Builder','Mason','Contractor'],
  conversation: ['Orator','Diplomat','Counselor','Mediator','Liaison'],
  districts: ['Warden','Overseer','Administrator','Coordinator','Director'],
  cplclone: ['City Architect','Neon Weaver','Grid Keeper','District Mind','Clone Master'],
  grandtower: ['Tower Guardian','Forge Master','Soul Keeper','Gate Watcher','Crown Bearer'],
  castle: ['Castle Lord','Keep Warden','Wall Commander','Gate Captain','Iron Sentinel'],
  colosseum: ['Arena Champion','Gladiator Prime','Crowd Master','Sand Lord','Triumph Herald']
};

function seededRandom(seed) {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = ((s << 5) - s + seed.charCodeAt(i)) | 0;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s & 0x7fffffff) / 2147483647; };
}

export function install(Genesis) {
  if (!Genesis) return null;
  if (Genesis.VoidPopulation) return Genesis.VoidPopulation;

  const T = window.THREE;
  if (!T) return null;

  // Low-GPU material fallback: on weak GPUs (maxFragUniforms < 2048, Intel HD,
  // software WebGL) three.js bakes every visible light into shader uniforms —
  // 400+ lights overflow MAX_FRAGMENT_UNIFORM_VECTORS(1024) → shader compile
  // fails → buildings render black/invisible. Unlit MeshBasicMaterial keeps the
  // emissive hue and ALWAYS compiles. Set by index.html boot.
  const __lowGPU = !!(typeof window !== 'undefined' && window.__GENESIS_LOW_GPU);
  function _std(config) {
    // Delegate to the central factory (index.html) so void buildings get the
    // procedural window-facade texture on low GPU, not bare flat color.
    if (typeof window !== 'undefined' && typeof window.__genesisStd === 'function' && window.__genesisStd !== _std) {
      return window.__genesisStd(config);
    }
    if (!__lowGPU) return new T.MeshStandardMaterial(config);
    config = config || {};
    const c = (config.emissive != null) ? config.emissive : (config.color != null ? config.color : 0xffffff);
    return new T.MeshBasicMaterial({
      color: c,
      transparent: !!config.transparent,
      opacity: (config.opacity != null) ? config.opacity : 1,
      side: (config.side != null) ? config.side : T.FrontSide,
      depthWrite: (config.depthWrite !== false),
      wireframe: !!config.wireframe,
      fog: (config.fog !== false)
    });
  }

  // Textured material helper using VoidBuildingTextures when available.
  function _texturedStd(type, color, opts) {
    if (window.VoidBuildingTextures && window.VoidBuildingTextures.materialFor) {
      return window.VoidBuildingTextures.materialFor(type, color, opts);
    }
    return _std(opts);
  }
  // Point-light factory that registers with the LightingManager so the hard cap
  // (8 active point lights) tames the 400+ light scene. On low GPUs lights are
  // decorative-only and get pruned first by capCheck.
  function _mkLight(color, intensity, distance, owner) {
    const l = new T.PointLight(color, intensity, distance);
    const LM = window.Genesis && window.Genesis.LightingManager;
    if (LM && LM.register) {
      LM.register(l, { owner: owner || 'void', decorative: true, priority: 5, cost: 1 });
    }
    return l;
  }

  let scene = null;
  let camera = null;
  let voidCosmosApi = null;
  const worlds = [];
  const worldRoot = new T.Group();
  worldRoot.name = 'void-population';

  let _warzoneCity = null;
  let _obsidianSpire = null;
  let _resonantVeil = null;
  let _solarForge = null;
  let _bioluminescentHive = null;
  let _neonZenith = null;
  let _ironFoundry = null;
  let _aetheriumSkylands = null;
  let _elysianVault = null;
  let _astralSpire = null;
  let _quantumRift = null;
  let _chronosTemple = null;
  let _glacialMatrix = null;
  let _abyssalTrench = null;
  let _hyperionArray = null;
  let _titanGraveyard = null;
  let _riftWarzone = null;
  let _vortexSiege = null;
  let _genesisCitadel = null;
  let _omegaCrucible = null;
  const _allSovereignCities = [];
  window.sovereignCities = _allSovereignCities;

  // Portal connections between worlds
  const PORTALS = [];

  // Initialize void cosmos module if available
  if (typeof installVoidCosmos === 'function') {
    voidCosmosApi = installVoidCosmos(Genesis);
  }

  function flagOn() {
    return typeof window !== 'undefined' && window.__GENESIS_VOID_POPULATION !== false;
  }

  // Get world position from explicit coordinates
  // Respects no-build zone (0-360u): positions < 360u are forbidden
  function getWorldPosition(index, rng) {
    const coords = WORLD_COORDINATES[index] || { x: 0, y: 0, z: 0 };
    const dist = Math.sqrt(coords.x * coords.x + coords.z * coords.z);
    
    // Validate: Position must be outside no-build zone
    if (dist < NO_BUILD_ZONE) {
      console.warn('[VoidPopulation] World ' + index + ' (' + NAMES[index] + ') at distance ' + dist + 
        'u is inside NO-BUILD ZONE (' + NO_BUILD_ZONE + 'u). Using fallback position.');
      // Fallback: place on minimum allowed ring
      const angle = (index / WORLD_COUNT) * Math.PI * 2;
      return new T.Vector3(Math.cos(angle) * NO_BUILD_ZONE * 1.1, coords.y, Math.sin(angle) * NO_BUILD_ZONE * 1.1);
    }
    
    return new T.Vector3(coords.x, coords.y, coords.z);
  }

  function createBeacon(name, type, plt, pos) {
    const color = TYPE_COLORS[type] || 0x66ffff;
    const group = new T.Group();
    group.position.copy(pos);

    // Ground platform — disc showing the world's footprint
    const platGeo = new T.CylinderGeometry(80, 90, 2, 24);
    const platMat = _std({ color: 0x0a0a1a, emissive: color, emissiveIntensity: 0.08, metalness: 0.8, roughness: 0.4 });
    const plat = new T.Mesh(platGeo, platMat);
    plat.position.y = -1;
    plat.receiveShadow = true;
    group.add(plat);

    // Ground glow ring
    const ringGeo = new T.TorusGeometry(85, 0.8, 8, 48);
    const ringMat = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.4 });
    const ring = new T.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.5;
    group.add(ring);

    // Second glow ring
    const ring2Geo = new T.TorusGeometry(95, 0.4, 8, 48);
    const ring2Mat = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.2 });
    const ring2 = new T.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.y = 0.5;
    group.add(ring2);

    // Towering beacon beam
    const beamH = 400;
    const beamGeo = new T.CylinderGeometry(1.5, 1.5, beamH, 6);
    const beamMat = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 });
    const beam = new T.Mesh(beamGeo, beamMat);
    beam.position.y = beamH / 2;
    group.add(beam);

    // Top orb
    const orbGeo = new T.SphereGeometry(8, 16, 12);
    const orbMat = _std({ color, emissive: color, emissiveIntensity: 2.0, transparent: true, opacity: 0.9 });
    const orb = new T.Mesh(orbGeo, orbMat);
    orb.position.y = beamH + 10;
    group.add(orb);

    // Halo ring
    const haloGeo = new T.TorusGeometry(14, 0.5, 8, 32);
    const haloMat = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 });
    const halo = new T.Mesh(haloGeo, haloMat);
    halo.position.y = beamH + 10;
    group.add(halo);

    // Second halo
    const halo2Geo = new T.TorusGeometry(20, 0.3, 8, 32);
    const halo2Mat = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 });
    const halo2 = new T.Mesh(halo2Geo, halo2Mat);
    halo2.position.y = beamH + 10;
    group.add(halo2);

    // Point light — visible from far
    const light = _mkLight(color, 3.0, 200);
    light.position.y = beamH + 10;
    group.add(light);

    // Name label sprite
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name, 512, 90);
    ctx.font = '36px sans-serif';
    ctx.fillStyle = '#aaaacc';
    ctx.fillText(type.toUpperCase() + '  ·  PLT ' + plt.profit + '/' + plt.love + '/' + plt.tax, 512, 170);
    const tex = new T.CanvasTexture(canvas);
    const label = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    label.scale.set(100, 25, 1);
    label.position.y = beamH + 40;
    group.add(label);

    return group;
  }

  function createCitySkeleton(pos, type, rng) {
    // Detailed city silhouette — buildings, roads, grid — always visible
    const group = new T.Group();
    group.position.copy(pos);

    const color = TYPE_COLORS[type] || 0x66ffff;

    // Ground
    const ground = new T.Mesh(
      new T.PlaneGeometry(400, 400),
      _std({ color: 0x080818, roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.5;
    ground.receiveShadow = true;
    group.add(ground);

    // Grid
    const grid = new T.GridHelper(300, 30, color, 0x110022);
    grid.position.y = 0.6;
    grid.material.opacity = 0.12;
    grid.material.transparent = true;
    group.add(grid);

    // Roads — wider, more detailed
    const roadMat = _std({ color: 0x111122, roughness: 0.8 });
    for (let i = -100; i <= 100; i += 16) {
      const r1 = new T.Mesh(new T.BoxGeometry(200, 0.06, 3), roadMat);
      r1.position.set(0, 0.6, i);
      r1.receiveShadow = true;
      group.add(r1);
      const r2 = new T.Mesh(new T.BoxGeometry(3, 0.06, 200), roadMat);
      r2.position.set(i, 0.6, 0);
      r2.receiveShadow = true;
      group.add(r2);
    }

    // Buildings — 4 districts with varying styles
    const districts = [
      { name: 'work', zone: { x: [-90, -10], z: [-90, -10] }, count: 25, minH: 8, maxH: 35, color: 0x00ffff, eColor: 0x0088aa },
      { name: 'home', zone: { x: [10, 90], z: [-90, -10] }, count: 30, minH: 4, maxH: 18, color: 0xff66aa, eColor: 0xaa3366 },
      { name: 'social', zone: { x: [-90, -10], z: [10, 90] }, count: 20, minH: 3, maxH: 12, color: 0xffaa00, eColor: 0xaa7700 },
      { name: 'learn', zone: { x: [10, 90], z: [10, 90] }, count: 18, minH: 6, maxH: 25, color: 0x00ff88, eColor: 0x00aa55 }
    ];

    for (const d of districts) {
      for (let i = 0; i < d.count; i++) {
        const x = d.zone.x[0] + rng() * (d.zone.x[1] - d.zone.x[0]);
        const z = d.zone.z[0] + rng() * (d.zone.z[1] - d.zone.z[0]);
        const h = d.minH + rng() * (d.maxH - d.minH);
        const w = 2 + rng() * 5;
        const d2 = 2 + rng() * 5;
        const bColor = rng() > 0.6 ? d.color : 0x222244;
        const geo = new T.BoxGeometry(w, h, d2);
        const mat = (window.VoidBuildingTextures && window.VoidBuildingTextures.materialFor)
          ? window.VoidBuildingTextures.materialFor('district-' + d.name, bColor, {
              emissive: '#' + d.eColor.toString(16).padStart(6, '0'),
              emissiveIntensity: 0.2,
              roughness: 0.35,
              metalness: 0.35,
              windows: true,
              neonBand: '#' + d.color.toString(16).padStart(6, '0')
            })
          : _std({
              color: bColor, emissive: d.eColor, emissiveIntensity: 0.08,
              metalness: 0.7, roughness: 0.3
            });
        const mesh = new T.Mesh(geo, mat);
        mesh.position.set(x, h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        // Windows on buildings
        if (h > 6) {
          for (let wy = 2; wy < h - 1; wy += 2.5) {
            const wGeo = new T.BoxGeometry(w * 0.7, 0.3, 0.05);
            const wMat = _std({ color: d.color, emissive: d.color, emissiveIntensity: 0.4 });
            const win = new T.Mesh(wGeo, wMat);
            win.position.set(x, wy, z + d2 / 2 + 0.03);
            group.add(win);
          }
        }

        // Cap on tall buildings
        if (h > 15 && rng() > 0.5) {
          const cGeo = new T.BoxGeometry(w + 0.3, 0.3, d2 + 0.3);
          const cMat = _std({ color: d.color, emissive: d.color, emissiveIntensity: 0.5 });
          const cap = new T.Mesh(cGeo, cMat);
          cap.position.set(x, h + 0.15, z);
          group.add(cap);
        }

        // Antenna spire on very tall buildings
        if (h > 25 && rng() > 0.4) {
          const spireH = 3 + rng() * 8;
          const spire = new T.Mesh(
            new T.CylinderGeometry(0.1, 0.3, spireH, 4),
            _std({ color: d.color, emissive: d.color, emissiveIntensity: 0.6 })
          );
          spire.position.set(x, h + spireH / 2, z);
          group.add(spire);
        }
      }

      // District label
      const cx = (d.zone.x[0] + d.zone.x[1]) / 2;
      const cz = (d.zone.z[0] + d.zone.z[1]) / 2;
      const lCanvas = document.createElement('canvas');
      lCanvas.width = 256; lCanvas.height = 64;
      const lctx = lCanvas.getContext('2d');
      lctx.fillStyle = 'rgba(0,0,0,0.7)';
      lctx.fillRect(0, 0, 256, 64);
      lctx.fillStyle = '#' + d.color.toString(16).padStart(6, '0');
      lctx.font = 'bold 28px sans-serif';
      lctx.textAlign = 'center';
      lctx.fillText(d.name.toUpperCase(), 128, 42);
      const lTex = new T.CanvasTexture(lCanvas);
      const lLabel = new T.Mesh(new T.PlaneGeometry(10, 2.5), new T.MeshBasicMaterial({ map: lTex, transparent: true }));
      lLabel.position.set(cx, 30, cz);
      lLabel.rotation.x = -Math.PI / 4;
      group.add(lLabel);
    }

    // Outer ring buildings
    const ringMat = (window.VoidBuildingTextures && window.VoidBuildingTextures.materialFor)
      ? window.VoidBuildingTextures.materialFor('outer-ring', 0x222244, { emissive: '#221133', emissiveIntensity: 0.15, roughness: 0.6, metalness: 0.2, windows: true, neonBand: '#332244' })
      : _std({ color: 0x222244, emissive: 0x110022, emissiveIntensity: 0.1, metalness: 0.6, roughness: 0.4 });
    const ringCounts = [{ r: 120, count: 20, skip: 0.4 }, { r: 160, count: 28, skip: 0.5 }, { r: 200, count: 35, skip: 0.6 }];
    for (const rc of ringCounts) {
      for (let i = 0; i < rc.count; i++) {
        if (rng() < rc.skip) continue;
        const angle = (i / rc.count) * Math.PI * 2 + rng() * 0.3;
        const rr = rc.r + rng() * 15 - 7;
        const x = Math.cos(angle) * rr;
        const z = Math.sin(angle) * rr;
        const h = 4 + rng() * 18;
        const w = 2 + rng() * 5;
        const d2 = 2 + rng() * 5;
        const mesh = new T.Mesh(new T.BoxGeometry(w, h, d2), ringMat);
        mesh.position.set(x, h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
    }

    // POI marker — glowing chevron above the city
    const poiGroup = new T.Group();
    poiGroup.position.set(0, 60, 0);

    // Chevron
    const chevGeo = new T.BufferGeometry();
    const chevVerts = new Float32Array([
      -2, 0, 0,  0, 2, 0,  0, 0, 0,
      0, 0, 0,  0, 2, 0,  2, 0, 0
    ]);
    chevGeo.setAttribute('position', new T.BufferAttribute(chevVerts, 3));
    const chevMat = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: T.DoubleSide });
    const chevron = new T.Mesh(chevGeo, chevMat);
    chevGeo.computeVertexNormals();
    poiGroup.add(chevron);

    // Glow ring
    const poiRingGeo = new T.TorusGeometry(3, 0.2, 8, 16);
    const poiRingMat = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.4 });
    const poiRing = new T.Mesh(poiRingGeo, poiRingMat);
    poiRing.rotation.x = -Math.PI / 2;
    poiGroup.add(poiRing);

    // Point light
    const poiLight = _mkLight(color, 1.0, 30);
    poiGroup.add(poiLight);

    group.add(poiGroup);

    // Per-world atmosphere dome
    const domeGeo = new T.SphereGeometry(250, 16, 12);
    const domeMat = new T.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.03,
      side: T.BackSide,
      depthWrite: false
    });
    const dome = new T.Mesh(domeGeo, domeMat);
    dome.position.y = 50;
    group.add(dome);

    // Ambient particles
    const particleCount = 200;
    const particleGeo = new T.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePos[i] = (rng() - 0.5) * 300;
      particlePos[i + 1] = rng() * 80;
      particlePos[i + 2] = (rng() - 0.5) * 300;
    }
    particleGeo.setAttribute('position', new T.BufferAttribute(particlePos, 3));
    const particleMat = new T.PointsMaterial({
      color: color,
      size: 0.5,
      transparent: true,
      opacity: 0.6,
      depthWrite: false
    });
    const particles = new T.Points(particleGeo, particleMat);
    particles.userData.isAmbientParticles = true;
    group.add(particles);

    return group;
  }

  function createPortal(fromWorld, toWorld, rng) {
    const color = 0x66ffff;
    const group = new T.Group();

    // Portal frame — torus
    const frameGeo = new T.TorusGeometry(6, 0.5, 8, 32);
    const frameMat = _std({ color, emissive: color, emissiveIntensity: 0.5, metalness: 0.8, roughness: 0.2 });
    const frame = new T.Mesh(frameGeo, frameMat);
    frame.rotation.y = Math.PI / 2;
    group.add(frame);

    // Inner glow
    const innerGeo = new T.CircleGeometry(5.5, 32);
    const innerMat = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, side: T.DoubleSide });
    const inner = new T.Mesh(innerGeo, innerMat);
    inner.rotation.y = Math.PI / 2;
    group.add(inner);

    // Label
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#66ffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('→ ' + toWorld.name, 256, 50);
    ctx.font = '24px sans-serif';
    ctx.fillStyle = '#aaaacc';
    ctx.fillText('PORTAL', 256, 90);
    const tex = new T.CanvasTexture(canvas);
    const label = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    label.scale.set(12, 3, 1);
    label.position.y = 8;
    group.add(label);

    // Point light
    const light = _mkLight(color, 1.5, 40);
    group.add(light);

    return group;
  }

  function createQuestBeacon(world, rng) {
    const color = TYPE_COLORS[world.type] || 0x66ffff;
    const group = new T.Group();

    // Quest marker — floating diamond
    const diamondGeo = new T.OctahedronGeometry(2, 0);
    const diamondMat = _std({ color, emissive: color, emissiveIntensity: 1.0, metalness: 0.8, roughness: 0.2 });
    const diamond = new T.Mesh(diamondGeo, diamondMat);
    diamond.position.y = 20;
    diamond.rotation.y = Math.PI / 4;
    group.add(diamond);

    // Glow ring
    const ringGeo = new T.TorusGeometry(3, 0.15, 8, 16);
    const ringMat = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 });
    const ring = new T.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 20;
    group.add(ring);

    // Point light
    const light = _mkLight(color, 0.8, 20);
    light.position.y = 20;
    group.add(light);

    // Quest text sprite
    const questText = TYPE_QUESTS[world.type] || 'Explore this world';
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('QUEST: ' + world.type.toUpperCase(), 256, 40);
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#ffffff';
    // Word wrap quest text
    const words = questText.split(' ');
    let line = '';
    let y = 70;
    for (const word of words) {
      const test = line + word + ' ';
      if (ctx.measureText(test).width > 480) {
        ctx.fillText(line.trim(), 256, y);
        line = word + ' ';
        y += 22;
      } else {
        line = test;
      }
    }
    ctx.fillText(line.trim(), 256, y);
    const tex = new T.CanvasTexture(canvas);
    const label = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    label.scale.set(15, 3.75, 1);
    label.position.y = 28;
    group.add(label);

    return group;
  }

  function createDenizens(pos, type, rng) {
    const group = new T.Group();
    const color = TYPE_COLORS[type] || 0x66ffff;
    const names = TYPE_DENIZEN_NAMES[type] || ['Citizen'];

    for (let i = 0; i < 5; i++) {
      const name = names[i % names.length];
      const dx = (rng() - 0.5) * 60;
      const dz = (rng() - 0.5) * 60;

      const denizen = new T.Group();
      denizen.position.set(dx, 0, dz);

      // Body
      const torso = new T.Mesh(
        new T.BoxGeometry(0.5, 0.7, 0.25),
        _std({ color, emissive: color, emissiveIntensity: 0.1 })
      );
      torso.position.y = 1.0;
      torso.castShadow = true;
      denizen.add(torso);

      // Head
      const head = new T.Mesh(
        new T.SphereGeometry(0.18, 8, 8),
        _std({ color: 0xffddcc })
      );
      head.position.y = 1.55;
      head.castShadow = true;
      denizen.add(head);

      // Eyes
      [-0.06, 0.06].forEach(xo => {
        const eye = new T.Mesh(
          new T.SphereGeometry(0.03, 6, 6),
          _std({ color: 0x222222 })
        );
        eye.position.set(xo, 1.58, 0.15);
        denizen.add(eye);
      });

      // Arms
      [-0.38, 0.38].forEach(xo => {
        const arm = new T.Mesh(
          new T.BoxGeometry(0.12, 0.5, 0.12),
          _std({ color, emissive: color, emissiveIntensity: 0.05 })
        );
        arm.position.set(xo, 0.9, 0);
        arm.castShadow = true;
        denizen.add(arm);
      });

      // Legs
      [-0.12, 0.12].forEach(xo => {
        const leg = new T.Mesh(
          new T.BoxGeometry(0.14, 0.6, 0.14),
          _std({ color: 0x333366 })
        );
        leg.position.set(xo, 0.3, 0);
        leg.castShadow = true;
        denizen.add(leg);
      });

      // Name label
      const nCanvas = document.createElement('canvas');
      nCanvas.width = 256; nCanvas.height = 64;
      const nctx = nCanvas.getContext('2d');
      nctx.fillStyle = 'rgba(0,0,0,0.7)';
      nctx.fillRect(0, 0, 256, 64);
      nctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
      nctx.font = 'bold 20px sans-serif';
      nctx.textAlign = 'center';
      nctx.fillText(name, 128, 40);
      const nTex = new T.CanvasTexture(nCanvas);
      const nSprite = new T.Sprite(new T.SpriteMaterial({ map: nTex, transparent: true }));
      nSprite.position.y = 2.0;
      nSprite.scale.set(2, 0.5, 1);
      denizen.add(nSprite);

      group.add(denizen);
    }

    group.position.copy(pos);
    return group;
  }

  // ====== CPL CLONE CITY — randomized using Lost Mechanics Bible ======
  // Builds a CPL-inspired neon city at (313, 0, 179) with 4 LM-themed districts
  function createCPLCloneCity(pos, rng) {
    const group = new T.Group();
    group.position.copy(pos);

    // LM archetype palette for randomization
    const LM_COLORS = [0xaa66ff, 0xff66cc, 0x66ff88, 0xff8844, 0xff3355, 0x00ffaa, 0xffdd00, 0x4488ff, 0xffaa00, 0x00ffcc, 0x00ffaa, 0xff7722];
    const LM_NAMES = ['physics', 'gacha', 'evolve', 'typeadv', 'arena', 'idle', 'prestige', 'pantheon', 'soulhome', 'persona', 'economy', 'achievement'];
    const accentColor = LM_COLORS[Math.floor(rng() * LM_COLORS.length)];

    // Ground platform
    const ground = new T.Mesh(
      new T.CircleGeometry(150, 32),
      _std({ color: 0x080818, roughness: 0.9, side: T.DoubleSide })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.5;
    ground.receiveShadow = true;
    group.add(ground);

    // Circular ground glow ring
    const glowRing = new T.Mesh(
      new T.RingGeometry(145, 150, 48),
      new T.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0.08, side: T.DoubleSide })
    );
    glowRing.rotation.x = -Math.PI / 2;
    glowRing.position.y = 0.6;
    group.add(glowRing);

    // Road grid — 7x7 like CPL
    const gridSize = 7;
    const spacing = 14;
    const roadMat = _std({ color: 0x0a0a22, roughness: 0.8 });
    for (let i = 0; i < gridSize; i++) {
      const offset = (i - Math.floor(gridSize / 2)) * spacing;
      const r1 = new T.Mesh(new T.BoxGeometry(90, 0.06, 2.5), roadMat);
      r1.position.set(0, 0.6, offset);
      r1.receiveShadow = true;
      group.add(r1);
      const r2 = new T.Mesh(new T.BoxGeometry(2.5, 0.06, 90), roadMat);
      r2.position.set(offset, 0.6, 0);
      r2.receiveShadow = true;
      group.add(r2);
    }

    // 4 districts — each themed by a random LM archetype
    const districts = [];
    const usedTypes = [];
    for (let d = 0; d < 4; d++) {
      let ti;
      do { ti = Math.floor(rng() * LM_NAMES.length); } while (usedTypes.includes(ti));
      usedTypes.push(ti);
      const isTop = d < 2;
      const isLeft = d % 2 === 0;
      districts.push({
        name: LM_NAMES[ti],
        color: LM_COLORS[ti],
        zone: {
          x: isLeft ? [-56, -8] : [8, 56],
          z: isTop ? [-56, -8] : [8, 56]
        },
        count: 12 + Math.floor(rng() * 6),
        minH: 3 + rng() * 5,
        maxH: 10 + rng() * 20,
        emitIntensity: 0.1 + rng() * 0.3
      });
    }

    // Build district buildings
    for (const d of districts) {
      const eColor = d.color;
      for (let i = 0; i < d.count; i++) {
        const x = d.zone.x[0] + rng() * (d.zone.x[1] - d.zone.x[0]);
        const z = d.zone.z[0] + rng() * (d.zone.z[1] - d.zone.z[0]);
        const h = d.minH + rng() * (d.maxH - d.minH);
        const w = 2 + rng() * 4;
        const d2 = 2 + rng() * 4;
        const bColor = rng() > 0.5 ? d.color : 0x222244;

        // Choose shape: box, cylinder, taper, or stack
        const shape = rng();
        let mesh;
        if (shape < 0.15 && h > 10) {
          // Cylinder tower
          mesh = new T.Mesh(
            new T.CylinderGeometry(w * 0.5, w * 0.6, h, 8),
            _std({ color: bColor, emissive: eColor, emissiveIntensity: d.emitIntensity, metalness: 0.7, roughness: 0.3 })
          );
        } else if (shape < 0.30 && h > 12) {
          // Tapered (ziggurat) — 3 tiers
          const taperGroup = new T.Group();
          for (let t = 0; t < 3; t++) {
            const tw = w * (1 - t * 0.2);
            const td = d2 * (1 - t * 0.2);
            const th = h / 3;
            const tier = new T.Mesh(
              new T.BoxGeometry(tw, th, td),
              _std({ color: bColor, emissive: eColor, emissiveIntensity: d.emitIntensity * (1 - t * 0.2), metalness: 0.6, roughness: 0.3 })
            );
            tier.position.y = th / 2 + t * th;
            tier.castShadow = true;
            taperGroup.add(tier);
          }
          mesh = taperGroup;
          mesh.position.set(x, 0, z);
          group.add(mesh);
          continue;
        } else if (shape < 0.45 && h > 7) {
          // Stacked — 2 tiers
          const stackGroup = new T.Group();
          for (let t = 0; t < 2; t++) {
            const tw = w * (1 - t * 0.15);
            const td = d2 * (1 - t * 0.15);
            const th = h / 2;
            const tier = new T.Mesh(
              new T.BoxGeometry(tw, th, td),
              _std({ color: bColor, emissive: eColor, emissiveIntensity: d.emitIntensity, metalness: 0.6, roughness: 0.3 })
            );
            tier.position.y = th / 2 + t * th;
            tier.castShadow = true;
            stackGroup.add(tier);
          }
          mesh = stackGroup;
          mesh.position.set(x, 0, z);
          group.add(mesh);
          continue;
        } else {
          // Default box
          mesh = new T.Mesh(
            new T.BoxGeometry(w, h, d2),
            _std({ color: bColor, emissive: eColor, emissiveIntensity: d.emitIntensity, metalness: 0.7, roughness: 0.3 })
          );
        }
        mesh.position.set(x, h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        // Window glow strips
        if (h > 5) {
          for (let wy = 1.5; wy < h - 1; wy += 2.5) {
            const wGeo = new T.BoxGeometry(w * 0.6, 0.2, 0.05);
            const wMat = _std({ color: eColor, emissive: eColor, emissiveIntensity: 0.6 });
            const win = new T.Mesh(wGeo, wMat);
            win.position.set(x, wy, z + d2 / 2 + 0.03);
            group.add(win);
            const win2 = new T.Mesh(wGeo, wMat);
            win2.position.set(x, wy, z - d2 / 2 - 0.03);
            group.add(win2);
          }
        }

        // Cap on tall buildings
        if (h > 12 && rng() > 0.4) {
          const cGeo = new T.BoxGeometry(w + 0.3, 0.3, d2 + 0.3);
          const cMat = _std({ color: eColor, emissive: eColor, emissiveIntensity: 0.7 });
          const cap = new T.Mesh(cGeo, cMat);
          cap.position.set(x, h + 0.15, z);
          group.add(cap);
        }

        // Antenna spire on very tall buildings
        if (h > 18 && rng() > 0.5) {
          const spireH = 2 + rng() * 6;
          const spire = new T.Mesh(
            new T.CylinderGeometry(0.08, 0.25, spireH, 4),
            _std({ color: eColor, emissive: eColor, emissiveIntensity: 0.8 })
          );
          spire.position.set(x, h + spireH / 2, z);
          group.add(spire);
        }
      }

      // District ground label
      const cx = (d.zone.x[0] + d.zone.x[1]) / 2;
      const cz = (d.zone.z[0] + d.zone.z[1]) / 2;
      const lCanvas = document.createElement('canvas');
      lCanvas.width = 256; lCanvas.height = 64;
      const lctx = lCanvas.getContext('2d');
      lctx.fillStyle = 'rgba(0,0,0,0.7)';
      lctx.fillRect(0, 0, 256, 64);
      lctx.fillStyle = '#' + d.color.toString(16).padStart(6, '0');
      lctx.font = 'bold 24px sans-serif';
      lctx.textAlign = 'center';
      lctx.fillText(d.name.toUpperCase(), 128, 40);
      const lTex = new T.CanvasTexture(lCanvas);
      const lLabel = new T.Mesh(new T.PlaneGeometry(10, 2.5), new T.MeshBasicMaterial({ map: lTex, transparent: true }));
      lLabel.position.set(cx, 25, cz);
      lLabel.rotation.x = -Math.PI / 4;
      group.add(lLabel);
    }

    // Outer ring buildings — 2 rings at 80 and 110 radius
    for (const ringR of [80, 110]) {
      const count = ringR === 80 ? 16 : 22;
      for (let i = 0; i < count; i++) {
        if (rng() > 0.5) continue;
        const angle = (i / count) * Math.PI * 2 + rng() * 0.3;
        const rr = ringR + rng() * 10 - 5;
        const x = Math.cos(angle) * rr;
        const z = Math.sin(angle) * rr;
        const h = 4 + rng() * 14;
        const w = 2 + rng() * 3;
        const ci = Math.floor(rng() * LM_COLORS.length);
        const mesh = new T.Mesh(
          new T.BoxGeometry(w, h, w),
          _std({ color: 0x222244, emissive: LM_COLORS[ci], emissiveIntensity: 0.06, metalness: 0.6, roughness: 0.4 })
        );
        mesh.position.set(x, h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
    }

    // Central beacon beam
    const beamH = 200;
    const beamGeo = new T.CylinderGeometry(1.0, 1.0, beamH, 6);
    const beamMat = new T.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0.2 });
    const beam = new T.Mesh(beamGeo, beamMat);
    beam.position.y = beamH / 2;
    group.add(beam);

    // Top orb
    const orbGeo = new T.SphereGeometry(6, 16, 12);
    const orbMat = _std({ color: accentColor, emissive: accentColor, emissiveIntensity: 2.0, transparent: true, opacity: 0.9 });
    const orb = new T.Mesh(orbGeo, orbMat);
    orb.position.y = beamH + 8;
    group.add(orb);

    // Halo
    const haloGeo = new T.TorusGeometry(10, 0.4, 8, 32);
    const haloMat = new T.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0.5 });
    const halo = new T.Mesh(haloGeo, haloMat);
    halo.position.y = beamH + 8;
    group.add(halo);

    // Point light
    const light = _mkLight(accentColor, 2.0, 150);
    light.position.y = beamH + 8;
    group.add(light);

    // Ambient particles
    const particleCount = 300;
    const particleGeo = new T.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePos[i] = (rng() - 0.5) * 300;
      particlePos[i + 1] = rng() * 100;
      particlePos[i + 2] = (rng() - 0.5) * 300;
    }
    particleGeo.setAttribute('position', new T.BufferAttribute(particlePos, 3));
    const particleMat = new T.PointsMaterial({
      color: accentColor, size: 0.4, transparent: true, opacity: 0.5, depthWrite: false
    });
    const particles = new T.Points(particleGeo, particleMat);
    particles.userData.isAmbientParticles = true;
    group.add(particles);

    // Atmosphere dome
    const domeGeo = new T.SphereGeometry(200, 16, 12);
    const domeMat = new T.MeshBasicMaterial({
      color: accentColor, transparent: true, opacity: 0.02, side: T.BackSide, depthWrite: false
    });
    const dome = new T.Mesh(domeGeo, domeMat);
    dome.position.y = 50;
    group.add(dome);

    return group;
  }

  // ====== GRAND TOWER — the massive central tower ======
  function createGrandTower(pos, rng) {
    const group = new T.Group();
    group.position.copy(pos);
    const color = 0xffcc44;

    // ── HEIGHT FUNCTION (terrain displacement) ──
    function getHeight(x, z) {
      let h = 0;
      h += Math.sin(x * 0.025) * Math.cos(z * 0.025) * 4.0;
      h += Math.sin(x * 0.08) * 1.2;
      h += Math.cos(z * 0.08) * 1.2;
      h += Math.sin(x * 0.15 + z * 0.1) * 0.6;
      return h;
    }

    // ── TERRAIN GROUND (displaced plane) ──
    const terrainGeo = new T.PlaneGeometry(240, 240, 60, 60);
    terrainGeo.rotateX(-Math.PI / 2);
    const tPosAttr = terrainGeo.attributes.position;
    for (let i = 0; i < tPosAttr.count; i++) {
      const x = tPosAttr.getX(i);
      const z = tPosAttr.getZ(i);
      tPosAttr.setY(i, getHeight(x, z));
    }
    tPosAttr.needsUpdate = true;
    terrainGeo.computeVertexNormals();

    // Create vertex colors for depth (dark at low, lighter at high)
    const tColors = new Float32Array(tPosAttr.count * 3);
    for (let i = 0; i < tPosAttr.count; i++) {
      const y = tPosAttr.getY(i);
      const t = (y + 5) / 12; // normalize roughly 0-1
      const base = 0.04 + t * 0.04;
      const accent = t * 0.08;
      tColors[i * 3] = base;
      tColors[i * 3 + 1] = base + accent * 0.3;
      tColors[i * 3 + 2] = base + accent * 0.8;
    }
    terrainGeo.setAttribute('color', new T.BufferAttribute(tColors, 3));

    const terrainMat = _std({
      vertexColors: true,
      emissive: color,
      emissiveIntensity: 0.02,
      metalness: 0.7,
      roughness: 0.4
    });
    const terrainMesh = new T.Mesh(terrainGeo, terrainMat);
    terrainMesh.position.y = -3;
    terrainMesh.receiveShadow = true;
    group.add(terrainMesh);

    // ── WATER POOL (reflective disc at tower base) ──
    const waterGeo = new T.CircleGeometry(30, 48);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = _std({
      color: 0x1a3366,
      emissive: 0x2244aa,
      emissiveIntensity: 0.15,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.7
    });
    const waterMesh = new T.Mesh(waterGeo, waterMat);
    waterMesh.position.y = -2.5;
    waterMesh.receiveShadow = true;
    group.add(waterMesh);

    // Water edge glow ring
    const waterRing = new T.Mesh(
      new T.TorusGeometry(30, 0.5, 8, 48),
      new T.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.3 })
    );
    waterRing.rotation.x = -Math.PI / 2;
    waterRing.position.y = -2.4;
    group.add(waterRing);

    // ── GROUND GLOW RINGS (around terrain edge) ──
    for (let r = 0; r < 3; r++) {
      const ringR = 105 + r * 12;
      const ringOp = 0.4 - r * 0.12;
      const ring = new T.Mesh(
        new T.TorusGeometry(ringR, 0.6 - r * 0.15, 8, 48),
        new T.MeshBasicMaterial({ color, transparent: true, opacity: ringOp })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.5;
      group.add(ring);
    }

    // ── TOWER CORE (500u, varied geometry — not just boxes) ──
    const towerH = 500;
    const towerW = 22;
    const crownY = towerH + 20;

    // --- Base: 3-tier ziggurat (wider at bottom) ---
    for (let t = 0; t < 3; t++) {
      const tw = towerW * (1.4 - t * 0.25);
      const th = 30;
      const ty = t * th + th / 2 + 2;
      const tierMat = _std({
        color: t === 0 ? 0x0f0f2a : 0x161640,
        emissive: color,
        emissiveIntensity: 0.06 + t * 0.02,
        metalness: 0.7,
        roughness: 0.3
      });
      const tier = new T.Mesh(new T.BoxGeometry(tw, th, tw), tierMat);
      tier.position.y = ty;
      tier.castShadow = true;
      tier.receiveShadow = true;
      group.add(tier);

      // Ziggurat glow edge on each tier
      const edge = new T.Mesh(
        new T.TorusGeometry(tw * 0.7, 0.5, 8, 32),
        new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.4 - t * 0.1 })
      );
      edge.rotation.x = -Math.PI / 2;
      edge.position.y = ty + th / 2;
      group.add(edge);

      // Buttresses at base (4 angled supports)
      if (t === 0) {
        for (let b = 0; b < 4; b++) {
          const angle = (b / 4) * Math.PI * 2;
          const buttress = new T.Mesh(
            new T.ConeGeometry(3, 25, 4),
            _std({ color: 0x1a1a3a, emissive: color, emissiveIntensity: 0.1, metalness: 0.7, roughness: 0.3 })
          );
          buttress.position.set(Math.cos(angle) * (tw / 2 + 4), 12, Math.sin(angle) * (tw / 2 + 4));
          buttress.rotation.z = -Math.cos(angle) * 0.3;
          buttress.rotation.x = Math.sin(angle) * 0.3;
          buttress.castShadow = true;
          group.add(buttress);
        }
      }
    }

    // --- Mid-section: alternating cylinder + box floors ---
    const midStart = 92;
    const midEnd = 350;
    const midFloorH = 28;
    const midCount = Math.floor((midEnd - midStart) / midFloorH);
    for (let i = 0; i < midCount; i++) {
      const y = midStart + i * midFloorH + midFloorH / 2;
      const taper = 1 - (i / midCount) * 0.3;
      const fw = towerW * taper;
      const isCyl = i % 3 === 1; // every 3rd floor is a cylinder

      const floorMat = _std({
        color: isCyl ? 0x181838 : 0x1a1a3a,
        emissive: color,
        emissiveIntensity: 0.06 + (i / midCount) * 0.08,
        metalness: 0.7,
        roughness: 0.3
      });

      if (isCyl) {
        // Cylinder floor
        const cyl = new T.Mesh(new T.CylinderGeometry(fw * 0.5, fw * 0.55, midFloorH - 2, 12), floorMat);
        cyl.position.y = y;
        cyl.castShadow = true;
        cyl.receiveShadow = true;
        group.add(cyl);
      } else {
        // Box floor
        const box = new T.Mesh(new T.BoxGeometry(fw, midFloorH - 2, fw), floorMat);
        box.position.y = y;
        box.castShadow = true;
        box.receiveShadow = true;
        group.add(box);
      }

      // Window glow strips — all 4 faces
      for (let wy = 0; wy < 3; wy++) {
        const wGeo = new T.BoxGeometry(fw * 0.5, 0.25, 0.05);
        const wMat = _std({ color, emissive: color, emissiveIntensity: 0.6 });
        const wyPos = y - midFloorH / 2 + 4 + wy * 5;
        // Front/back
        const w1 = new T.Mesh(wGeo, wMat);
        w1.position.set(0, wyPos, fw / 2 + 0.03);
        group.add(w1);
        const w2 = new T.Mesh(wGeo, wMat);
        w2.position.set(0, wyPos, -fw / 2 - 0.03);
        group.add(w2);
        // Sides
        const w3 = new T.Mesh(new T.BoxGeometry(0.05, 0.25, fw * 0.5), wMat);
        w3.position.set(fw / 2 + 0.03, wyPos, 0);
        group.add(w3);
        const w4 = new T.Mesh(new T.BoxGeometry(0.05, 0.25, fw * 0.5), wMat);
        w4.position.set(-fw / 2 - 0.03, wyPos, 0);
        group.add(w4);
      }

      // Separator ring between floors
      const sepRing = new T.Mesh(
        new T.TorusGeometry(fw * 0.6, 0.35, 8, 24),
        new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 })
      );
      sepRing.rotation.x = -Math.PI / 2;
      sepRing.position.y = y + midFloorH / 2;
      group.add(sepRing);
    }

    // --- Observation Deck (wider ring platform at ~250u) ---
    const deckY = 250;
    const deckR = towerW * 0.9;
    const deck = new T.Mesh(
      new T.CylinderGeometry(deckR + 8, deckR + 5, 4, 24),
      _std({ color: 0x1a1a3a, emissive: color, emissiveIntensity: 0.12, metalness: 0.7, roughness: 0.3 })
    );
    deck.position.y = deckY;
    deck.castShadow = true;
    group.add(deck);

    // Deck railing (torus)
    const railing = new T.Mesh(
      new T.TorusGeometry(deckR + 8, 0.6, 8, 32),
      new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 })
    );
    railing.rotation.x = -Math.PI / 2;
    railing.position.y = deckY + 2.5;
    group.add(railing);

    // --- Upper section: tapered spire (cone narrowing to crown) ---
    const spireH = towerH - deckY - 10;
    const spireBase = towerW * 0.6;
    const spire = new T.Mesh(
      new T.ConeGeometry(spireBase, spireH, 8),
      _std({ color: 0x181838, emissive: color, emissiveIntensity: 0.1, metalness: 0.7, roughness: 0.3 })
    );
    spire.position.y = deckY + spireH / 2 + 2;
    spire.castShadow = true;
    group.add(spire);

    // Spire glow ring at base
    const spireRing = new T.Mesh(
      new T.TorusGeometry(spireBase, 0.4, 8, 24),
      new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.45 })
    );
    spireRing.rotation.x = -Math.PI / 2;
    spireRing.position.y = deckY + 2;
    group.add(spireRing);

    // ── CROWN (orb + tilted halos at top) ──
    const orbGeo = new T.SphereGeometry(14, 16, 12);
    const orbMat = _std({ color, emissive: color, emissiveIntensity: 3.0, transparent: true, opacity: 0.95 });
    const orb = new T.Mesh(orbGeo, orbMat);
    orb.position.y = crownY;
    orb.userData.isGrandTowerOrb = true;
    group.add(orb);

    // Inner core (smaller, brighter)
    const coreGeo = new T.SphereGeometry(7, 12, 8);
    const coreMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
    const core = new T.Mesh(coreGeo, coreMat);
    core.position.y = crownY;
    group.add(core);

    // Halo 1 — horizontal
    const halo1 = new T.Mesh(
      new T.TorusGeometry(22, 0.7, 8, 32),
      new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 })
    );
    halo1.position.y = crownY;
    halo1.userData.isHalo1 = true;
    group.add(halo1);

    // Halo 2 — tilted 60° on X
    const halo2 = new T.Mesh(
      new T.TorusGeometry(28, 0.4, 8, 32),
      new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 })
    );
    halo2.position.y = crownY;
    halo2.rotation.x = Math.PI / 3;
    halo2.userData.isHalo2 = true;
    group.add(halo2);

    // Halo 3 — tilted 30° on Z
    const halo3 = new T.Mesh(
      new T.TorusGeometry(34, 0.25, 8, 32),
      new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.2 })
    );
    halo3.position.y = crownY;
    halo3.rotation.z = Math.PI / 6;
    halo3.userData.isHalo3 = true;
    group.add(halo3);

    // Crown point light — bright, visible from far
    const crownLight = _mkLight(color, 6.0, 500);
    crownLight.position.y = crownY;
    group.add(crownLight);

    // Second light lower
    const midLight = _mkLight(color, 2.0, 200);
    midLight.position.y = towerH / 2;
    group.add(midLight);

    // ── BEAM TO SKY (tapered, open-ended) ──
    const beamH = 300;
    const beamGeo = new T.CylinderGeometry(1.5, 5, beamH, 12, 1, true);
    const beamMat = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: T.DoubleSide, depthWrite: false });
    const beam = new T.Mesh(beamGeo, beamMat);
    beam.position.y = crownY + beamH / 2;
    group.add(beam);

    // Beam glow — wider tapered cylinder
    const beamGlowGeo = new T.CylinderGeometry(4, 10, beamH, 12, 1, true);
    const beamGlowMat = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.06, side: T.DoubleSide, depthWrite: false });
    const beamGlow = new T.Mesh(beamGlowGeo, beamGlowMat);
    beamGlow.position.y = crownY + beamH / 2;
    group.add(beamGlow);

    // ── NAME LABEL ──
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = '#ffcc44';
    ctx.font = 'bold 80px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GRAND TOWER', 512, 100);
    ctx.font = '40px sans-serif';
    ctx.fillStyle = '#aaaacc';
    ctx.fillText('50 / 50 / 50 PLT', 512, 170);
    const tex = new T.CanvasTexture(canvas);
    const label = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    label.scale.set(120, 30, 1);
    label.position.y = crownY + 60;
    group.add(label);

    // ── HELPER: add windows, caps, spires to a building ──
    const addBuildingDetails = (bx, bz, b, accent, g) => {
      if (b.h > 10) {
        for (let wy = 4; wy < b.h - 2; wy += 5) {
          const wGeo = new T.BoxGeometry(b.w * 0.5, 0.3, 0.05);
          const wMat = _std({ color: accent, emissive: accent, emissiveIntensity: 0.6 });
          const w1 = new T.Mesh(wGeo, wMat);
          w1.position.set(bx, wy, bz + (b.d || b.w) / 2 + 0.03);
          g.add(w1);
          const w2 = new T.Mesh(wGeo, wMat);
          w2.position.set(bx, wy, bz - (b.d || b.w) / 2 - 0.03);
          g.add(w2);
        }
      }
      if (b.h > 14 && rng() > 0.4) {
        const capGeo = new T.BoxGeometry(b.w + 0.5, 0.4, (b.d || b.w) + 0.5);
        const capMat = _std({ color: accent, emissive: accent, emissiveIntensity: 0.7 });
        const cap = new T.Mesh(capGeo, capMat);
        cap.position.set(bx, b.h + 2.2, bz);
        g.add(cap);
      }
      if (b.h > 30 && rng() > 0.4) {
        const spireH = 4 + rng() * 8;
        const spire = new T.Mesh(
          new T.CylinderGeometry(0.1, 0.35, spireH, 4),
          _std({ color: accent, emissive: accent, emissiveIntensity: 0.8 })
        );
        spire.position.set(bx, b.h + spireH / 2 + 2, bz);
        g.add(spire);
      }
    };

    // ── 4 DISTRICTS around tower (each with own color, taller buildings) ──
    const districts = [
      { name: 'work', angle: 0, accent: 0xff3355, buildings: [
        { name: 'Forge', h: 28, w: 12, d: 10, shape: 'cylinder' },
        { name: 'Market', h: 20, w: 16, d: 12, shape: 'box' },
        { name: 'Barracks', h: 35, w: 10, d: 8, shape: 'box' },
        { name: 'Farm', h: 6, w: 20, d: 18, shape: 'flat' }
      ]},
      { name: 'home', angle: Math.PI / 2, accent: 0xff66aa, buildings: [
        { name: 'Town Hall', h: 40, w: 14, d: 14, shape: 'ziggurat' },
        { name: 'Vault', h: 22, w: 12, d: 12, shape: 'thick' },
        { name: 'Tower', h: 50, w: 8, d: 8, shape: 'spire' },
        { name: 'Residence', h: 18, w: 10, d: 10, shape: 'stacked' }
      ]},
      { name: 'social', angle: Math.PI, accent: 0x00ffcc, buildings: [
        { name: 'Breeding Den', h: 24, w: 14, d: 14, shape: 'dome' },
        { name: 'Monument', h: 45, w: 6, d: 6, shape: 'obelisk' },
        { name: 'Exchange', h: 18, w: 14, d: 14, shape: 'circle' },
        { name: 'Pavilion', h: 14, w: 18, d: 18, shape: 'open' }
      ]},
      { name: 'learn', angle: Math.PI * 1.5, accent: 0x4488ff, buildings: [
        { name: 'Mage Tower', h: 48, w: 10, d: 10, shape: 'crystal' },
        { name: 'Blacksmith', h: 22, w: 12, d: 10, shape: 'chimney' },
        { name: 'Library', h: 30, w: 14, d: 10, shape: 'box' },
        { name: 'Workshop', h: 20, w: 10, d: 10, shape: 'ziggurat' }
      ]}
    ];

    for (const d of districts) {
      const distRadius = 65;
      const cx = Math.cos(d.angle) * distRadius;
      const cz = Math.sin(d.angle) * distRadius;

      for (let bi = 0; bi < d.buildings.length; bi++) {
        const b = d.buildings[bi];
        const bx = cx + (rng() - 0.5) * 35;
        const bz = cz + (rng() - 0.5) * 35;
        const isColored = rng() > 0.4;
        const bColor = isColored ? d.accent : 0x222244;
        const mat = _std({
          color: bColor, emissive: d.accent, emissiveIntensity: isColored ? 0.12 : 0.05, metalness: 0.7, roughness: 0.3
        });

        let mesh;
        if (b.shape === 'cylinder') {
          mesh = new T.Mesh(new T.CylinderGeometry(b.w * 0.4, b.w * 0.5, b.h, 8), mat);
        } else if (b.shape === 'dome') {
          mesh = new T.Mesh(new T.SphereGeometry(b.w * 0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
        } else if (b.shape === 'spire') {
          mesh = new T.Mesh(new T.ConeGeometry(b.w * 0.4, b.h, 6), mat);
        } else if (b.shape === 'obelisk') {
          mesh = new T.Mesh(new T.CylinderGeometry(b.w * 0.15, b.w * 0.35, b.h, 4), mat);
        } else if (b.shape === 'crystal') {
          mesh = new T.Mesh(new T.OctahedronGeometry(b.w * 0.5, 0), mat);
          mesh.scale.y = b.h / b.w;
        } else if (b.shape === 'flat') {
          mesh = new T.Mesh(new T.CylinderGeometry(b.w * 0.5, b.w * 0.5, b.h, 6), mat);
        } else if (b.shape === 'circle') {
          mesh = new T.Mesh(new T.CylinderGeometry(b.w * 0.5, b.w * 0.5, b.h, 16), mat);
        } else if (b.shape === 'thick') {
          mesh = new T.Mesh(new T.BoxGeometry(b.w, b.h, b.d), _std({
            color: 0x333355, emissive: d.accent, emissiveIntensity: 0.1, metalness: 0.8, roughness: 0.2
          }));
        } else if (b.shape === 'ziggurat') {
          // 3-tier tapered building
          const zGroup = new T.Group();
          for (let t = 0; t < 3; t++) {
            const tw = b.w * (1 - t * 0.2);
            const td = b.d * (1 - t * 0.2);
            const th = b.h / 3;
            const tier = new T.Mesh(
              new T.BoxGeometry(tw, th, td),
              _std({ color: bColor, emissive: d.accent, emissiveIntensity: 0.08 + t * 0.03, metalness: 0.6, roughness: 0.3 })
            );
            tier.position.y = th / 2 + t * th;
            tier.castShadow = true;
            zGroup.add(tier);
          }
          mesh = zGroup;
          mesh.position.set(bx, 2, bz);
          mesh.userData.buildingType = b.name;
          mesh.userData.district = d.name;
          mesh.userData.isTowerBuilding = true;
          group.add(mesh);
          // Skip normal positioning
          addBuildingDetails(bx, bz, b, d.accent, group);
          continue;
        } else if (b.shape === 'stacked') {
          // 2-tier building
          const sGroup = new T.Group();
          for (let t = 0; t < 2; t++) {
            const tw = b.w * (1 - t * 0.15);
            const td = b.d * (1 - t * 0.15);
            const th = b.h / 2;
            const tier = new T.Mesh(
              new T.BoxGeometry(tw, th, td),
              _std({ color: bColor, emissive: d.accent, emissiveIntensity: 0.1, metalness: 0.6, roughness: 0.3 })
            );
            tier.position.y = th / 2 + t * th;
            tier.castShadow = true;
            sGroup.add(tier);
          }
          mesh = sGroup;
          mesh.position.set(bx, 2, bz);
          mesh.userData.buildingType = b.name;
          mesh.userData.district = d.name;
          mesh.userData.isTowerBuilding = true;
          group.add(mesh);
          addBuildingDetails(bx, bz, b, d.accent, group);
          continue;
        } else if (b.shape === 'chimney') {
          const chimneyGroup = new T.Group();
          chimneyGroup.add(new T.Mesh(new T.BoxGeometry(b.w, b.h, b.d), mat));
          const chimney = new T.Mesh(
            new T.CylinderGeometry(1.5, 2, 10, 6),
            _std({ color: 0x444466, emissive: d.accent, emissiveIntensity: 0.15 })
          );
          chimney.position.set(b.w * 0.3, b.h / 2 + 5, 0);
          chimneyGroup.add(chimney);
          mesh = chimneyGroup;
          mesh.position.set(bx, 2, bz);
          mesh.userData.buildingType = b.name;
          mesh.userData.district = d.name;
          mesh.userData.isTowerBuilding = true;
          group.add(mesh);
          addBuildingDetails(bx, bz, b, d.accent, group);
          continue;
        } else {
          mesh = new T.Mesh(new T.BoxGeometry(b.w, b.h, b.d), mat);
        }

        mesh.position.set(bx, b.h / 2 + 2, bz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.buildingType = b.name;
        mesh.userData.district = d.name;
        mesh.userData.isTowerBuilding = true;
        group.add(mesh);

        addBuildingDetails(bx, bz, b, d.accent, group);
      }

      // District ground label
      const lCanvas = document.createElement('canvas');
      lCanvas.width = 256; lCanvas.height = 64;
      const lctx = lCanvas.getContext('2d');
      lctx.fillStyle = 'rgba(0,0,0,0.7)';
      lctx.fillRect(0, 0, 256, 64);
      lctx.fillStyle = '#' + d.accent.toString(16).padStart(6, '0');
      lctx.font = 'bold 28px sans-serif';
      lctx.textAlign = 'center';
      lctx.fillText(d.name.toUpperCase(), 128, 42);
      const lTex = new T.CanvasTexture(lCanvas);
      const lLabel = new T.Mesh(new T.PlaneGeometry(10, 2.5), new T.MeshBasicMaterial({ map: lTex, transparent: true }));
      lLabel.position.set(cx, 25, cz);
      lLabel.rotation.x = -Math.PI / 4;
      group.add(lLabel);
    }

    // ── ROAD GRID ──
    const roadMat = _std({ color: 0x0a0a22, roughness: 0.8 });
    for (let i = -80; i <= 80; i += 16) {
      const r1 = new T.Mesh(new T.BoxGeometry(160, 0.06, 2.5), roadMat);
      r1.position.set(0, 0.6, i);
      r1.receiveShadow = true;
      group.add(r1);
      const r2 = new T.Mesh(new T.BoxGeometry(2.5, 0.06, 160), roadMat);
      r2.position.set(i, 0.6, 0);
      r2.receiveShadow = true;
      group.add(r2);
    }

    // ── ATMOSPHERE ──
    // Dome
    const domeGeo = new T.SphereGeometry(180, 16, 12);
    const domeMat = new T.MeshBasicMaterial({
      color, transparent: true, opacity: 0.02, side: T.BackSide, depthWrite: false
    });
    const dome = new T.Mesh(domeGeo, domeMat);
    dome.position.y = 50;
    group.add(dome);

    // Ambient particles
    const particleCount = 400;
    const particleGeo = new T.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePos[i] = (rng() - 0.5) * 250;
      particlePos[i + 1] = rng() * 150;
      particlePos[i + 2] = (rng() - 0.5) * 250;
    }
    particleGeo.setAttribute('position', new T.BufferAttribute(particlePos, 3));
    const particleMat = new T.PointsMaterial({
      color, size: 0.5, transparent: true, opacity: 0.5, depthWrite: false
    });
    const particles = new T.Points(particleGeo, particleMat);
    particles.userData.isAmbientParticles = true;
    group.add(particles);

    return group;
  }

  function createGalaxy(pos) {
    const count = 15000;
    const radius = 120;
    const branches = 4;
    const spin = 1.5;
    const randomness = 0.4;
    const randomnessPower = 2.5;
    const insideColor = 0xffaa44;
    const outsideColor = 0x4488ff;
    const ySpread = 3;

    const geometry = new T.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const radii = new Float32Array(count);
    const angles = new Float32Array(count);

    const colorInside = new T.Color(insideColor);
    const colorOutside = new T.Color(outsideColor);

    for (let i = 0; i < count; i++) {
      const r = Math.pow(Math.random(), 1.6) * radius;
      const branchAngle = (i % branches) / branches * Math.PI * 2;
      const spinAngle = r * spin;
      const randomAngle = Math.random() * Math.PI * 2;
      const scatter = Math.pow(Math.random(), randomnessPower) * randomness * (1 - r / radius);
      const randX = Math.cos(randomAngle) * scatter;
      const randZ = Math.sin(randomAngle) * scatter;
      const randY = (Math.random() - 0.5) * ySpread * (1 - r / radius * 0.5);
      const angle = branchAngle + spinAngle;

      positions[i * 3] = Math.cos(angle) * r + randX;
      positions[i * 3 + 1] = randY;
      positions[i * 3 + 2] = Math.sin(angle) * r + randZ;
      radii[i] = r;
      angles[i] = angle;

      const mix = r / radius;
      const c = colorInside.clone().lerp(colorOutside, mix);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new T.BufferAttribute(colors, 3));

    const material = new T.PointsMaterial({
      size: 1.2, sizeAttenuation: true, depthWrite: false,
      blending: T.AdditiveBlending, vertexColors: true,
      transparent: true, opacity: 0.9
    });

    const points = new T.Points(geometry, material);
    points.userData.isGalaxy = true;
    points.userData.radii = radii;
    points.userData.angles = angles;
    points.userData.count = count;
    points.userData.branches = branches;
    points.userData.spin = spin;
    points.userData.radius = radius;

    const coreGeo = new T.SphereGeometry(8, 16, 16);
    const coreMat = new T.MeshBasicMaterial({ color: 0xffcc66, transparent: true, opacity: 0.9 });
    const core = new T.Mesh(coreGeo, coreMat);
    core.userData.isGalaxyCore = true;

    const group = new T.Group();
    group.userData.isGalaxyGroup = true;
    group.add(points);
    group.add(core);
    group.position.copy(pos);
    group.rotation.x = 0.3;
    group.rotation.z = 0.1;

    return group;
  }

  function createExplodingPlanet(posOffset) {
    const count = 2000;
    const radius = 12;
    const geometry = new T.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const spherePos = new Float32Array(count * 3);
    const explodeDir = new Float32Array(count * 3);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius * (0.8 + Math.random() * 0.2);
      const x = Math.sin(phi) * Math.cos(theta) * r;
      const y = Math.sin(phi) * Math.sin(theta) * r;
      const z = Math.cos(phi) * r;
      spherePos[i * 3] = x;
      spherePos[i * 3 + 1] = y;
      spherePos[i * 3 + 2] = z;
      const angle = Math.random() * Math.PI * 2;
      const elev = Math.random() * Math.PI * 2;
      const dist = 5 + Math.random() * 20;
      explodeDir[i * 3] = Math.cos(angle) * Math.sin(elev) * dist;
      explodeDir[i * 3 + 1] = Math.cos(elev) * dist;
      explodeDir[i * 3 + 2] = Math.sin(angle) * Math.sin(elev) * dist;
      phases[i] = Math.random() * Math.PI * 2;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }

    geometry.setAttribute('position', new T.BufferAttribute(positions, 3));

    const material = new T.PointsMaterial({
      color: 0xff8844, size: 0.8, sizeAttenuation: true,
      blending: T.AdditiveBlending, transparent: true, opacity: 0.9, depthWrite: false
    });

    const points = new T.Points(geometry, material);
    points.userData.isExplodingPlanet = true;
    points.userData.spherePos = spherePos;
    points.userData.explodeDir = explodeDir;
    points.userData.phases = phases;
    points.userData.count = count;

    const coreGeo = new T.SphereGeometry(2, 12, 12);
    const coreMat = new T.MeshBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.8 });
    const core = new T.Mesh(coreGeo, coreMat);
    core.userData.isExplodingCore = true;

    const group = new T.Group();
    group.userData.isExplodingGroup = true;
    group.add(points);
    group.add(core);
    group.position.copy(posOffset);

    return group;
  }

  function createInvertedPyramids(posOffset) {
    const count = 16;
    const geo = new T.ConeGeometry(3, 6, 4);
    const mat = _std({
      color: 0x4488ff, emissive: 0x4488ff, emissiveIntensity: 0.3,
      transparent: true, opacity: 0.7, metalness: 0.3, roughness: 0.4
    });
    const mesh = new T.InstancedMesh(geo, mat, count);
    const dummy = new T.Object3D();
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const ringR = 20 + Math.random() * 15;
      const yOff = 280 + Math.random() * 40;
      dummy.position.set(Math.cos(angle) * ringR, yOff, Math.sin(angle) * ringR);
      dummy.rotation.x = Math.PI;
      dummy.rotation.z = Math.random() * Math.PI;
      dummy.scale.setScalar(0.6 + Math.random() * 0.8);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.userData.isInvertedPyramids = true;
    mesh.userData.pyramidCount = count;
    mesh.position.copy(posOffset);
    return mesh;
  }

  function createSoulBoids(posOffset) {
    const count = 60;
    const geometry = new T.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const boids = [];

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 120;
      const z = (Math.random() - 0.5) * 120;
      const y = 5 + Math.random() * 60;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      boids.push({
        pos: new T.Vector3(x, y, z),
        vel: new T.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 2),
        target: new T.Vector3((Math.random() - 0.5) * 100, 10 + Math.random() * 50, (Math.random() - 0.5) * 100),
        timer: Math.random() * 5
      });
    }

    geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
    const material = new T.PointsMaterial({
      color: 0x66ffff, size: 0.8, sizeAttenuation: true,
      blending: T.AdditiveBlending, transparent: true, opacity: 0.7, depthWrite: false
    });
    const points = new T.Points(geometry, material);
    points.userData.isSoulBoids = true;
    points.userData.boids = boids;
    points.position.copy(posOffset);
    return points;
  }

  function createCastle(pos, rng) {
    const g = new T.Group();
    g.position.copy(pos);

    const stoneMat = _std({ color: 0x665544, roughness: 0.8, metalness: 0.2 });
    const roofMat = _std({ color: 0x884422, roughness: 0.9, metalness: 0.1 });
    const glowMat = _std({ color: 0xffaa44, emissive: 0xffaa44, emissiveIntensity: 0.3 });
    const windowMat = _std({ color: 0xffdd88, emissive: 0xff8800, emissiveIntensity: 0.5 });

    const W = 70;
    const wallH = 25;
    const wallT = 3;

    // ── Outer Curtain Wall ──
    const walls = [
      { x: 0, z: W, w: W*2, d: wallT },
      { x: 0, z: -W, w: W*2, d: wallT },
      { x: W, z: 0, w: wallT, d: W*2 },
      { x: -W, z: 0, w: wallT, d: W*2 },
    ];
    for (const wp of walls) {
      const wall = new T.Mesh(new T.BoxGeometry(wp.w, wallH, wp.d), stoneMat);
      wall.position.set(wp.x, wallH/2, wp.z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      g.add(wall);
      const bc = Math.floor(wp.w / 5);
      for (let i = 0; i < bc; i++) {
        if (i % 2 === 0) continue;
        const b = new T.Mesh(new T.BoxGeometry(2.5, 3, wp.d * 0.7), stoneMat);
        b.position.set(wp.x + (i / bc - 0.5) * wp.w, wallH + 1.5, wp.z);
        g.add(b);
      }
    }

    // ── Corner Towers ──
    const corners = [{ x: W, z: W }, { x: W, z: -W }, { x: -W, z: W }, { x: -W, z: -W }];
    for (const c of corners) {
      const th = wallH + 12;
      const tr = 7;
      const tower = new T.Mesh(new T.CylinderGeometry(tr * 0.6, tr, th, 10), stoneMat);
      tower.position.set(c.x, th/2, c.z);
      tower.castShadow = true;
      g.add(tower);
      const roof = new T.Mesh(new T.ConeGeometry(tr * 0.8, 8, 10), roofMat);
      roof.position.set(c.x, th + 4, c.z);
      roof.castShadow = true;
      g.add(roof);
      const slit = new T.Mesh(new T.BoxGeometry(0.4, 2.5, 0.3), windowMat);
      slit.position.set(c.x + tr * 0.6, th * 0.5, c.z);
      g.add(slit);
      const tip = new T.Mesh(new T.SphereGeometry(0.4, 6, 6), glowMat);
      tip.position.set(c.x, th + 8, c.z);
      g.add(tip);
    }

    // ── Central Keep ──
    const kw = 28, kd = 22, kh = 35;
    const keep = new T.Mesh(new T.BoxGeometry(kw, kh, kd), stoneMat);
    keep.position.set(0, kh/2, 0);
    keep.castShadow = true;
    keep.receiveShadow = true;
    g.add(keep);

    // Keep upper tier
    const uw = kw * 0.7, ud = kd * 0.7, uh = 12;
    const upper = new T.Mesh(new T.BoxGeometry(uw, uh, ud), _std({ color: 0x776655, roughness: 0.7 }));
    upper.position.set(0, kh + uh/2, 0);
    upper.castShadow = true;
    g.add(upper);

    // Keep roof
    const kRoof = new T.Mesh(new T.ConeGeometry(uw * 0.5, 10, 4), roofMat);
    kRoof.position.set(0, kh + uh + 5, 0);
    g.add(kRoof);

    // Keep windows
    for (let wy = 5; wy < kh; wy += 7) {
      for (let side = -1; side <= 1; side += 2) {
        const ww = new T.Mesh(new T.BoxGeometry(1.5, 3, 0.4), windowMat);
        ww.position.set(kw/2 * side + 0.2, wy, 0);
        g.add(ww);
      }
    }

    // Keep crown beacon
    const crown = new T.Mesh(new T.SphereGeometry(2, 12, 12), _std({
      color: 0xffaa44, emissive: 0xffaa44, emissiveIntensity: 1.5
    }));
    crown.position.set(0, kh + uh + 11, 0);
    crown.userData.isCastleCrown = true;
    g.add(crown);

    // Crown beam
    const beam = new T.Mesh(
      new T.CylinderGeometry(0.4, 2.5, 70, 8, 1, true),
      new T.MeshBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.12, side: T.DoubleSide, depthWrite: false })
    );
    beam.position.set(0, kh + uh + 11 + 35, 0);
    beam.userData.isCastleBeam = true;
    g.add(beam);

    // ── Gatehouse ──
    for (let side = -1; side <= 1; side += 2) {
      const gt = new T.Mesh(new T.CylinderGeometry(3.5, 4.5, wallH + 4, 8), stoneMat);
      gt.position.set(side * 8, (wallH + 4)/2, W - 1);
      g.add(gt);
      const gr = new T.Mesh(new T.ConeGeometry(3.5, 5, 8), roofMat);
      gr.position.set(side * 8, wallH + 6.5, W - 1);
      g.add(gr);
    }
    const arch = new T.Mesh(new T.TorusGeometry(5, 1.2, 6, 10, Math.PI), stoneMat);
    arch.rotation.x = Math.PI / 2;
    arch.position.set(0, 5, W);
    g.add(arch);

    // ── Inner courtyard buildings ──
    for (let i = 0; i < 6; i++) {
      const bh = 7 + rng() * 6;
      const bw = 5 + rng() * 4;
      const b = new T.Mesh(new T.BoxGeometry(bw, bh, bw), stoneMat);
      b.position.set((rng() - 0.5) * 50, bh/2, (rng() - 0.5) * 50);
      b.castShadow = true;
      g.add(b);
      const w = new T.Mesh(new T.BoxGeometry(0.8, 1.2, 0.2), windowMat);
      w.position.set(b.position.x + bw/2 + 0.1, b.position.y, b.position.z);
      g.add(w);
    }

    // ── Ground platform ──
    const ground = new T.Mesh(
      new T.CircleGeometry(90, 32),
      _std({ color: 0x443322, roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    g.add(ground);

    // ── Torchlight particles ──
    const pc = 80;
    const pg = new T.BufferGeometry();
    const pp = new Float32Array(pc * 3);
    for (let i = 0; i < pc * 3; i += 3) {
      const a = rng() * Math.PI * 2;
      const r = rng() * 80;
      pp[i] = Math.cos(a) * r;
      pp[i + 1] = rng() * 45;
      pp[i + 2] = Math.sin(a) * r;
    }
    pg.setAttribute('position', new T.BufferAttribute(pp, 3));
    const pm = new T.PointsMaterial({ color: 0xff8844, size: 0.4, transparent: true, opacity: 0.4, depthWrite: false });
    const particles = new T.Points(pg, pm);
    particles.userData.isCastleParticles = true;
    g.add(particles);

    return g;
  }

  function createColosseum(pos, rng) {
    const g = new T.Group();
    g.position.copy(pos);

    const outerRadius = 40;
    const innerRadius = 25;
    const height = 20;
    const tiers = 5;
    const archCount = 32;

    const stoneMat = _std({ color: 0xccbb99, roughness: 0.7, metalness: 0.1 });
    const darkStoneMat = _std({ color: 0x887766, roughness: 0.8, metalness: 0.05 });
    const floorMat = _std({ color: 0x554433, roughness: 0.9 });
    const marbleMat = _std({ color: 0xeeddcc, roughness: 0.4, metalness: 0.2, emissive: 0x443322, emissiveIntensity: 0.05 });
    const torchMat = _std({ color: 0xff6633, emissive: 0xff4400, emissiveIntensity: 2.0 });

    // 1. Arena floor
    const floor = new T.Mesh(new T.CircleGeometry(innerRadius - 0.5, 64), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.1;
    floor.receiveShadow = true;
    g.add(floor);

    // 2. Inner wall
    const innerWall = new T.Mesh(
      new T.CylinderGeometry(innerRadius, innerRadius, 1.5, 64, 1, true),
      _std({ color: 0xaa9988, roughness: 0.8, side: T.DoubleSide })
    );
    innerWall.position.y = 0.75;
    innerWall.castShadow = true;
    g.add(innerWall);

    // 3. Seating tiers
    for (let t = 0; t < tiers; t++) {
      const frac = (t + 1) / tiers;
      const radius = innerRadius + frac * (outerRadius - innerRadius) * 0.7;
      const yBase = 1.5 + t * (height / tiers) * 0.8;
      const stepHeight = height / tiers * 0.6;

      const step = new T.Mesh(new T.RingGeometry(radius - 0.6, radius + 0.6, 64), stoneMat);
      step.rotation.x = -Math.PI / 2;
      step.position.y = yBase;
      step.receiveShadow = true;
      g.add(step);

      const riser = new T.Mesh(new T.CylinderGeometry(radius + 0.6, radius + 0.6, stepHeight, 64, 1, true), darkStoneMat);
      riser.position.y = yBase + stepHeight / 2;
      riser.castShadow = true;
      g.add(riser);

      const seat = new T.Mesh(new T.TorusGeometry(radius, 0.3, 8, 64), marbleMat);
      seat.position.y = yBase + 0.2;
      seat.rotation.x = Math.PI / 2;
      seat.scale.set(1, 1, 0.5);
      g.add(seat);
    }

    // 4. Outer wall with arches
    const wallRadius = outerRadius;
    const wallHeight = height;
    const pillarWidth = 0.8;
    const archWidth = 2.0;

    for (let i = 0; i < archCount; i++) {
      const angle = (i / archCount) * Math.PI * 2;
      const midAngle = (angle + ((i + 0.5) / archCount) * Math.PI * 2) / 2;

      const pillar = new T.Mesh(new T.BoxGeometry(pillarWidth, wallHeight, pillarWidth), stoneMat);
      pillar.position.set(Math.cos(angle) * wallRadius, wallHeight / 2, Math.sin(angle) * wallRadius);
      pillar.castShadow = true;
      g.add(pillar);

      const arch = new T.Mesh(new T.TorusGeometry(archWidth / 2, 0.5, 8, 8, Math.PI), marbleMat);
      arch.position.set(Math.cos(midAngle) * wallRadius, wallHeight - 2, Math.sin(midAngle) * wallRadius);
      arch.rotation.y = -midAngle;
      arch.rotation.x = Math.PI / 2;
      arch.scale.set(1, 1, 1.5);
      arch.castShadow = true;
      g.add(arch);

      const panel = new T.Mesh(
        new T.PlaneGeometry(archWidth * 0.8, 3),
        _std({ color: 0xbbaa99, roughness: 0.8, side: T.DoubleSide })
      );
      panel.position.set(Math.cos(midAngle) * (wallRadius + 0.1), wallHeight - 2.5, Math.sin(midAngle) * (wallRadius + 0.1));
      panel.rotation.y = -midAngle;
      g.add(panel);
    }

    // 5. Upper cornice
    const cornice = new T.Mesh(new T.TorusGeometry(wallRadius + 0.5, 0.6, 8, 64), marbleMat);
    cornice.position.y = wallHeight + 0.2;
    cornice.rotation.x = Math.PI / 2;
    cornice.scale.set(1, 1, 0.8);
    cornice.castShadow = true;
    g.add(cornice);

    // 6. Inner columns
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const col = new T.Mesh(new T.CylinderGeometry(0.4, 0.5, 4, 8), marbleMat);
      col.position.set(Math.cos(angle) * (innerRadius + 0.5), 2, Math.sin(angle) * (innerRadius + 0.5));
      col.castShadow = true;
      g.add(col);

      const cap = new T.Mesh(new T.CylinderGeometry(0.6, 0.4, 0.3, 8), marbleMat);
      cap.position.set(Math.cos(angle) * (innerRadius + 0.5), 4.2, Math.sin(angle) * (innerRadius + 0.5));
      cap.castShadow = true;
      g.add(cap);
    }

    // 7. Giant entrance arch
    const entranceAngle = 0;
    const entranceHeight = wallHeight * 1.3;
    for (let side = -1; side <= 1; side += 2) {
      const ep = new T.Mesh(new T.BoxGeometry(1.5, entranceHeight, 1.5), marbleMat);
      ep.position.set(Math.cos(entranceAngle + side * 0.15) * wallRadius, entranceHeight / 2, Math.sin(entranceAngle + side * 0.15) * wallRadius);
      ep.castShadow = true;
      g.add(ep);
    }
    const archTop = new T.Mesh(new T.BoxGeometry(4, 1.5, 1.5), marbleMat);
    archTop.position.set(Math.cos(entranceAngle) * wallRadius, entranceHeight, Math.sin(entranceAngle) * wallRadius);
    archTop.castShadow = true;
    g.add(archTop);

    // 8. Torches
    for (let i = 0; i < archCount; i++) {
      const angle = (i / archCount) * Math.PI * 2;
      const torch = new T.Mesh(new T.SphereGeometry(0.3, 6, 6), torchMat);
      torch.position.set(Math.cos(angle) * (wallRadius + 0.8), wallHeight * 0.9, Math.sin(angle) * (wallRadius + 0.8));
      torch.userData = { torchPhase: i * 1.2 };
      g.add(torch);
    }

    // 9. Ground disc
    const groundDisc = new T.Mesh(
      new T.CircleGeometry(outerRadius + 5, 64),
      _std({ color: 0x2a2a3a, roughness: 0.9 })
    );
    groundDisc.rotation.x = -Math.PI / 2;
    groundDisc.position.y = -0.5;
    groundDisc.receiveShadow = true;
    g.add(groundDisc);

    // 10. Floating embers
    const ec = 200;
    const eg = new T.BufferGeometry();
    const ep2 = new Float32Array(ec * 3);
    for (let i = 0; i < ec * 3; i += 3) {
      const a = rng() * Math.PI * 2;
      const r = rng() * outerRadius;
      ep2[i] = Math.cos(a) * r;
      ep2[i + 1] = rng() * height * 1.5;
      ep2[i + 2] = Math.sin(a) * r;
    }
    eg.setAttribute('position', new T.BufferAttribute(ep2, 3));
    const em = new T.PointsMaterial({ color: 0xff8844, size: 0.2, transparent: true, opacity: 0.3, blending: T.AdditiveBlending, depthWrite: false });
    const embers = new T.Points(eg, em);
    embers.userData.isColosseumEmbers = true;
    g.add(embers);

    return g;
  }

  // ====== WAR FLEET — ships fighting around CPL perimeter ======
  const WAR_FLEET = [];
  const LASER_BOLTS = [];
  const EXPLOSIONS = [];
  const FLEET_RADIUS_MIN = 380;
  const FLEET_RADIUS_MAX = 520;

  // Selection system state
  const SELECTED_SHIPS = new Set();
  let _selPointerDown = false;
  let _selStartX = 0, _selStartY = 0;
  let _selDragged = false;
  let _selRectEl = null;

  // Selection ring (shared geometry + material)
  const _selRingGeo = new T.TorusGeometry(1.8, 0.08, 8, 24);
  const _selRingMat = new T.MeshBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false });

  function _addSelRing(ship) {
    if (ship.userData.selRing) return;
    const ring = new T.Mesh(_selRingGeo, _selRingMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.5;
    ship.add(ring);
    ship.userData.selRing = ring;
  }

  function _removeSelRing(ship) {
    const ring = ship.userData.selRing;
    if (ring) { ship.remove(ring); ship.userData.selRing = null; }
  }

  function _clearSelection() {
    for (const ship of SELECTED_SHIPS) _removeSelRing(ship);
    SELECTED_SHIPS.clear();
  }

  function createWarship(faction, rng) {
    const g = new T.Group();

    const isImperium = faction === 'imperium';
    const bodyColor = isImperium ? 0x8844aa : 0x4488ff;
    const accentColor = isImperium ? 0xff3355 : 0xffcc44;
    const emissiveColor = isImperium ? 0x440066 : 0x004488;

    const bodyMat = _std({ color: bodyColor, emissive: emissiveColor, emissiveIntensity: 0.3, metalness: 0.6, roughness: 0.3 });
    const accentMat = _std({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.1, metalness: 0.4, roughness: 0.5 });
    const cockpitMat = _std({ color: 0x88ddff, emissive: 0x00aaff, emissiveIntensity: 0.5, transparent: true, opacity: 0.7 });

    // Fuselage
    if (isImperium) {
      // Void Imperium: angular dart shape
      const hull = new T.Mesh(new T.ConeGeometry(1.2, 3.5, 6), bodyMat);
      hull.rotation.x = Math.PI / 2;
      hull.position.y = 0;
      g.add(hull);

      // Wing struts (angled down)
      for (let side = -1; side <= 1; side += 2) {
        const wing = new T.Mesh(new T.BoxGeometry(2.2, 0.08, 0.6), accentMat);
        wing.position.set(side * 1.4, -0.2, 0.2);
        wing.rotation.z = side * 0.3;
        wing.rotation.x = 0.1;
        g.add(wing);

        // Wing tip spikes
        const tip = new T.Mesh(new T.ConeGeometry(0.1, 0.6, 4), accentMat);
        tip.position.set(side * 2.6, -0.2, 0.2);
        tip.rotation.z = side * 0.5;
        g.add(tip);
      }
    } else {
      // Solar Fleet: rounded, sleek
      const hull = new T.Mesh(new T.CylinderGeometry(0.3, 0.8, 3, 8), bodyMat);
      hull.rotation.x = Math.PI / 2;
      g.add(hull);

      // Swept wings
      for (let side = -1; side <= 1; side += 2) {
        const wing = new T.Mesh(new T.BoxGeometry(2.0, 0.06, 0.8), accentMat);
        wing.position.set(side * 1.2, 0, 0.3);
        wing.rotation.y = side * 0.2;
        wing.rotation.x = 0.2;
        g.add(wing);
      }

      // Tail fin
      const fin = new T.Mesh(new T.BoxGeometry(0.06, 1.0, 0.5), accentMat);
      fin.position.set(0, 0.5, -1.2);
      g.add(fin);
    }

    // Cockpit
    const cockpit = new T.Mesh(new T.SphereGeometry(0.25, 6, 6), cockpitMat);
    cockpit.position.set(0, 0.15, 1.2);
    g.add(cockpit);

    // Engine glow
    const engineMat = _std({
      color: isImperium ? 0xff4400 : 0x00aaff,
      emissive: isImperium ? 0xff2200 : 0x0088ff,
      emissiveIntensity: 2.0
    });
    for (let side = -1; side <= 1; side += 2) {
      const engine = new T.Mesh(new T.SphereGeometry(0.2, 6, 6), engineMat);
      engine.position.set(side * 0.3, 0, -1.8);
      g.add(engine);
    }

    // Orbit state
    const angle = rng() * Math.PI * 2;
    const radius = FLEET_RADIUS_MIN + rng() * (FLEET_RADIUS_MAX - FLEET_RADIUS_MIN);
    const heightOffset = (rng() - 0.5) * 80;

    // Targeting system: SC2 4-tier auto-acquire (Threat->ATP->Weapon->Closest)
    const scanRange = 50 + rng() * 20;
    g.userData = {
      faction,
      state: 'patrol',
      target: null,
      orbitAngle: angle,
      orbitRadius: radius,
      orbitHeight: heightOffset,
      orbitSpeed: (0.1 + rng() * 0.15) * (isImperium ? 1 : -1),
      speed: 0.5 + rng() * 1.0,
      hp: 5 + Math.floor(rng() * 3),
      maxHp: 5 + Math.floor(rng() * 3),
      fireCooldown: 0,
      fireInterval: 1.5 + rng() * 1.5,
      isWarship: true,
      respawnTimer: 0,
      // SC2 4-tier targeting
      scanRange,
      weaponRange: Math.max(15, scanRange - 20),
      atp: 20,
      isThreat: true,
      acquireTarget: null,
      acquireTimer: Math.random() * 2,
      acquireInterval: 0.5 + rng() * 0.5,
      // WC3 leash/chase
      leashRange: 80 + rng() * 40,
      returnTimer: 0,
      homePos: null
    };

    return g;
  }

  function spawnFleet(scene, rng) {
    const factionSize = 7;
    const fleetGroup = new T.Group();
    fleetGroup.name = 'war-fleet';

    for (let i = 0; i < factionSize; i++) {
      const imperium = createWarship('imperium', rng);
      const solar = createWarship('solar', rng);
      WAR_FLEET.push(imperium);
      WAR_FLEET.push(solar);
      fleetGroup.add(imperium);
      fleetGroup.add(solar);
    }

    scene.add(fleetGroup);
    return fleetGroup;
  }

  // SC2 4-tier auto-acquire: Threat -> ATP -> Weapon Pref -> Closest
  function acquireTarget(ship, enemies) {
    const shipPos = ship.position;
    const scanRange = ship.userData.scanRange;
    let bestTarget = null;
    let bestScore = -Infinity;

    for (const enemy of enemies) {
      if (enemy.userData.hp <= 0) continue;
      if (!enemy.userData.isThreat) continue;
      const dist = shipPos.distanceTo(enemy.position);
      if (dist > scanRange) continue;
      const atp = enemy.userData.atp || 20;
      const score = atp * 10000 + (scanRange - dist);
      if (score > bestScore) {
        bestScore = score;
        bestTarget = enemy;
      }
    }
    return bestTarget;
  }

  // WC3-style leash check: returns true if ship should give up chase
  function checkLeash(ship, dt) {
    const ud = ship.userData;
    if (!ud.homePos) return false;
    const distFromHome = ship.position.distanceTo(ud.homePos);
    if (distFromHome > ud.leashRange) {
      ud.returnTimer += dt;
      return ud.returnTimer > 5;
    }
    ud.returnTimer = Math.max(0, ud.returnTimer - dt * 2);
    return false;
  }

  function fireLaser(origin, targetShip) {
    const start = origin.position.clone();
    const dir = new T.Vector3().subVectors(targetShip.position, start);
    const len = dir.length();
    if (len < 1) return;
    dir.normalize();

    const boltMat = _std({
      color: origin.userData.faction === 'imperium' ? 0xff2244 : 0x44ddff,
      emissive: origin.userData.faction === 'imperium' ? 0xff0044 : 0x00aaff,
      emissiveIntensity: 3.0
    });
    const bolt = new T.Mesh(new T.SphereGeometry(0.15, 4, 4), boltMat);

    const startPos = start.clone().add(dir.clone().multiplyScalar(2));
    bolt.position.copy(startPos);

    bolt.userData = {
      origin,
      target: targetShip,
      damage: 1,
      speed: len * 2, // bolt travel speed proportional to distance
      faction: origin.userData.faction
    };

    const fleetGroup = origin.parent;
    if (fleetGroup) fleetGroup.add(bolt);

    LASER_BOLTS.push(bolt);
  }

  function spawnExplosion(position, parent) {
    const count = 30;
    const geo = new T.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 0.5 + Math.random() * 1.5;
      pos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      pos[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r;
      pos[i * 3 + 2] = Math.cos(phi) * r;
      colors[i * 3] = 0.8 + Math.random() * 0.2;
      colors[i * 3 + 1] = 0.3 + Math.random() * 0.3;
      colors[i * 3 + 2] = 0.1;
    }
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('color', new T.BufferAttribute(colors, 3));

    const mat = new T.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: T.AdditiveBlending,
      depthWrite: false
    });
    const points = new T.Points(geo, mat);
    points.position.copy(position);
    points.userData = { lifetime: 1.5, elapsed: 0, isExplosion: true };
    if (parent) parent.add(points);
    EXPLOSIONS.push(points);
  }

  function fleetTick(dt) {
    if (WAR_FLEET.length === 0) return;

    // Separate factions
    const imperium = [];
    const solar = [];
    for (const ship of WAR_FLEET) {
      if (ship.userData.faction === 'imperium') imperium.push(ship);
      else solar.push(ship);
    }

    for (const ship of WAR_FLEET) {
      const ud = ship.userData;
      const enemies = ud.faction === 'imperium' ? solar : imperium;

      // Dead — remove from selection, respawn
      if (ud.hp <= 0) {
        if (SELECTED_SHIPS.has(ship)) { SELECTED_SHIPS.delete(ship); _removeSelRing(ship); }
        ud.respawnTimer -= dt;
        ship.visible = false;
        if (ud.respawnTimer <= 0) {
          const rng2 = seededRandom('fleet-respawn-' + Date.now() + Math.random());
          ud.hp = ud.maxHp;
          ud.state = 'patrol';
          ud.acquireTarget = null;
          ud.acquireTimer = rng2() * 2;
          ud.returnTimer = 0;
          ud.homePos = null;
          ud.orbitAngle = rng2() * Math.PI * 2;
          ud.orbitRadius = FLEET_RADIUS_MIN + rng2() * (FLEET_RADIUS_MAX - FLEET_RADIUS_MIN);
          ud.orbitHeight = (rng2() - 0.5) * 80;
          ud.fireCooldown = 0;
          ship.visible = true;
        }
        continue;
      }

      // Advance orbit angle
      ud.orbitAngle += ud.orbitSpeed * dt;
      const orbitX = Math.cos(ud.orbitAngle) * ud.orbitRadius;
      const orbitZ = Math.sin(ud.orbitAngle) * ud.orbitRadius;
      const orbitPos = new T.Vector3(orbitX, ud.orbitHeight, orbitZ);

      if (ud.state === 'patrol') {
        ship.position.copy(orbitPos);
        const lookTarget = new T.Vector3(-Math.sin(ud.orbitAngle) * ud.orbitRadius, ud.orbitHeight, Math.cos(ud.orbitAngle) * ud.orbitRadius);
        ship.lookAt(lookTarget);
        ud.acquireTimer -= dt;
        if (ud.acquireTimer <= 0) {
          ud.acquireTimer = ud.acquireInterval;
          const target = acquireTarget(ship, enemies);
          if (target) {
            ud.state = 'chase';
            ud.acquireTarget = target;
            ud.homePos = orbitPos.clone();
            ud.returnTimer = 0;
          }
        }
      } else if (ud.state === 'chase') {
        const target = ud.acquireTarget;
        const targetDead = !target || target.userData.hp <= 0;
        const leashed = checkLeash(ship, dt);
        if (targetDead || leashed) {
          ud.state = 'return';
          ud.acquireTarget = null;
          ud.returnTimer = 5;
        } else {
          const targetPos = target.position;
          const dir = new T.Vector3().subVectors(targetPos, ship.position);
          const dist = dir.length();
          if (dist > 0.5) {
            dir.normalize();
            ship.position.add(dir.clone().multiplyScalar(ud.speed * dt));
          }
          ship.lookAt(targetPos);
          ud.fireCooldown -= dt;
          if (dist <= ud.weaponRange && ud.fireCooldown <= 0) {
            ud.fireCooldown = ud.fireInterval;
            fireLaser(ship, target);
          }
          // Re-evaluate for higher priority targets
          ud.acquireTimer -= dt;
          if (ud.acquireTimer <= 0) {
            ud.acquireTimer = ud.acquireInterval;
            const better = acquireTarget(ship, enemies);
            if (better && better !== target) {
              ud.acquireTarget = better;
              ud.homePos = ship.position.clone();
              ud.returnTimer = 0;
            }
          }
        }
      } else if (ud.state === 'return') {
        ud.returnTimer -= dt;
        const dir = new T.Vector3().subVectors(orbitPos, ship.position);
        const dist = dir.length();
        if (dist < 2 || ud.returnTimer <= 0) {
          ud.state = 'patrol';
          ud.homePos = null;
          ud.acquireTarget = null;
          ud.returnTimer = 0;
          ud.acquireTimer = 1;
        } else {
          dir.normalize();
          ship.position.add(dir.clone().multiplyScalar(ud.speed * dt * 1.5));
          ship.lookAt(orbitPos);
        }
      } else if (ud.state === 'cmd_move') {
        const target = ud.moveTarget;
        if (!target) { _advanceCommandQueue(ship); }
        else {
          const dir = new T.Vector3().subVectors(target, ship.position);
          const dist = dir.length();
          if (dist < 3) { _advanceCommandQueue(ship); }
          else {
            dir.normalize();
            ship.position.add(dir.clone().multiplyScalar(ud.speed * dt));
            ship.lookAt(target);
          }
        }
        // Defensive: fight threats in range while moving (SC2 Move behavior)
        ud.acquireTimer -= dt;
        if (ud.acquireTimer <= 0) {
          ud.acquireTimer = ud.acquireInterval;
          const threat = acquireTarget(ship, enemies);
          if (threat && ship.position.distanceTo(threat.position) <= ud.weaponRange) {
            ud.fireCooldown -= dt;
            if (ud.fireCooldown <= 0) { ud.fireCooldown = ud.fireInterval; fireLaser(ship, threat); }
          }
        }
      } else if (ud.state === 'cmd_attack') {
        const target = ud.attackTarget;
        if (!target || target.userData.hp <= 0) { _advanceCommandQueue(ship); }
        else {
          const targetPos = target.position;
          const dir = new T.Vector3().subVectors(targetPos, ship.position);
          const dist = dir.length();
          if (dist > 0.5) {
            dir.normalize();
            ship.position.add(dir.clone().multiplyScalar(ud.speed * dt));
          }
          ship.lookAt(targetPos);
          ud.fireCooldown -= dt;
          if (dist <= ud.weaponRange && ud.fireCooldown <= 0) {
            ud.fireCooldown = ud.fireInterval;
            fireLaser(ship, target);
          }
        }
      } else if (ud.state === 'cmd_stop') {
        // Do nothing — ship stays in place
        ship.lookAt(new T.Vector3().addVectors(ship.position, new T.Vector3(0, 0, -1)));
        ud.fireCooldown -= dt;
        if (ud.fireCooldown <= 0 && enemies.length > 0) {
          const threat = acquireTarget(ship, enemies);
          if (threat && ship.position.distanceTo(threat.position) <= ud.weaponRange) {
            ud.fireCooldown = ud.fireInterval;
            fireLaser(ship, threat);
          }
        }
      } else if (ud.state === 'cmd_hold') {
        // Hold position — attack enemies in range, do not chase
        const threat = acquireTarget(ship, enemies);
        if (threat && ship.position.distanceTo(threat.position) <= ud.weaponRange) {
          ship.lookAt(threat.position);
          ud.fireCooldown -= dt;
          if (ud.fireCooldown <= 0) { ud.fireCooldown = ud.fireInterval; fireLaser(ship, threat); }
        }
      }
    }

    // Rotate + pulse selection rings
    const _ringPulse = 0.6 + Math.sin(Date.now() * 0.004) * 0.3;
    _selRingMat.opacity = _ringPulse;
    for (const ship of SELECTED_SHIPS) {
      const ring = ship.userData.selRing;
      if (ring) ring.rotation.z += dt * 1.5;
    }

    // Update laser bolts (homing)
    for (let i = LASER_BOLTS.length - 1; i >= 0; i--) {
      const bolt = LASER_BOLTS[i];
      const ud = bolt.userData;
      const target = ud.target;
      if (!target) { LASER_BOLTS.splice(i, 1); const p = bolt.parent; if (p) p.remove(bolt); continue; }
      const dir = new T.Vector3().subVectors(target.position, bolt.position);
      const dist = dir.length();
      if (dist < 0.8) {
        // Hit — deal damage
        if (target.userData.hp !== undefined) {
          target.userData.hp -= ud.damage;
          spawnExplosion(target.position.clone(), target.parent);
        }
        LASER_BOLTS.splice(i, 1);
        const p = bolt.parent;
        if (p) p.remove(bolt);
      } else {
        dir.normalize();
        bolt.position.add(dir.clone().multiplyScalar(ud.speed * dt));
      }
    }

    // Update explosions (fade out)
    for (let i = EXPLOSIONS.length - 1; i >= 0; i--) {
      const exp = EXPLOSIONS[i];
      exp.userData.elapsed += dt;
      const life = exp.userData.lifetime;
      if (exp.userData.elapsed >= life) {
        EXPLOSIONS.splice(i, 1);
        const p = exp.parent;
        if (p) p.remove(exp);
      } else {
        exp.material.opacity = 1 - exp.userData.elapsed / life;
      }
    }
  }

  // ====== COMMAND SYSTEM (SC2-style) ======

  const CMD = { MOVE: 'MOVE', ATTACK: 'ATTACK', ATTACK_MOVE: 'ATTACK_MOVE', STOP: 'STOP', HOLD: 'HOLD', PATROL: 'PATROL', FOLLOW: 'FOLLOW' };
  const CMD_POLICY = { REPLACE: 'REPLACE', QUEUE: 'QUEUE' };

  function _shipToScreen(ship) {
    const vec = new T.Vector3();
    ship.getWorldPosition(vec);
    vec.project(camera);
    return { x: (vec.x * 0.5 + 0.5) * window.innerWidth, y: (-vec.y * 0.5 + 0.5) * window.innerHeight };
  }

  function _issueCommand(ship, cmd) {
    const ud = ship.userData;
    if (!ud.commandQueue) ud.commandQueue = [];
    if (cmd.policy === CMD_POLICY.REPLACE) ud.commandQueue.length = 0;
    ud.commandQueue.push(cmd);
    if (ud.commandQueue.length === 1) _activateCommand(ship, cmd);
  }

  function _activateCommand(ship, cmd) {
    const ud = ship.userData;
    switch (cmd.type) {
      case CMD.MOVE:
        ud.state = 'cmd_move';
        ud.moveTarget = cmd.targetPos;
        break;
      case CMD.ATTACK:
        ud.state = 'cmd_attack';
        ud.attackTarget = cmd.target;
        break;
      case CMD.ATTACK_MOVE:
        ud.state = 'cmd_attack_move';
        ud.moveTarget = cmd.targetPos;
        break;
      case CMD.STOP:
        ud.state = 'cmd_stop';
        break;
      case CMD.HOLD:
        ud.state = 'cmd_hold';
        break;
    }
  }

  function _advanceCommandQueue(ship) {
    const q = ship.userData.commandQueue;
    if (!q || q.length === 0) return;
    q.shift();
    if (q.length > 0) _activateCommand(ship, q[0]);
    else {
      ship.userData.state = 'patrol';
      ship.userData.acquireTarget = null;
    }
  }

  // Selection event handlers — routed through RTSInputRouter (single input path)
  function _cmdPointerDown(e) {
    // No-op: the unified input router owns drag tracking. Kept for compatibility.
  }

  function _cmdPointerMove(e) {
    // No-op: the unified input router owns the drag box.
  }

  function _cmdPointerUp(e) {
    // No-op: split into _cmdBoxSelect + _cmdSingleClick below (router dispatched).
  }

  // Box-select warships inside the drag rectangle (called by router's box selector)
  function _cmdBoxSelect(ctx) {
    if (!camera) return;
    const rect = ctx.rect;
    if (!ctx.shiftKey) _clearSelection();
    for (const ship of WAR_FLEET) {
      const sp = _shipToScreen(ship);
      if (sp.x >= rect.left && sp.x <= rect.right && sp.y >= rect.top && sp.y <= rect.bottom) {
        if (ctx.shiftKey && SELECTED_SHIPS.has(ship)) { SELECTED_SHIPS.delete(ship); _removeSelRing(ship); }
        else { SELECTED_SHIPS.add(ship); _addSelRing(ship); }
      }
    }
  }

  // Single click — towers/barracks + warship select (called by router left-click)
  function _cmdSingleClick(ctx) {
    if (!camera || !worldRoot) return;
    const e = ctx.e;
    // Barracks / tower click via router-provided hits
    const hits = ctx.hits || [];
    for (const hit of hits) {
      let obj = hit.object;
      while (obj) {
        if (obj.userData && obj.userData.isTowerBuilding) return true;
        if (obj.userData && obj.userData.isBarracks) {
          _buildProductionPanel(obj.userData.worldIndex);
          return true;
        }
        obj = obj.parent;
      }
    }
    // Single click — select warship
    if (!ctx.shiftKey) _clearSelection();
    let hitShip = null;
    for (const hit of hits) {
      let obj = hit.object;
      while (obj) {
        if (obj.userData && obj.userData.isWarship && obj.userData.hp > 0) { hitShip = obj; break; }
        obj = obj.parent;
      }
      if (hitShip) break;
    }
    if (hitShip) { SELECTED_SHIPS.add(hitShip); _addSelRing(hitShip); }
    return false;
  }

  function _cmdContextMenu(e) {
    // No-op: moved to _cmdRightClick (router dispatched).
  }

  // Right-click — rally point or warship commands (called by router right-click)
  function _cmdRightClick(ctx) {
    if (!camera || !scene) return false;
    const e = ctx.e;

    // If barracks panel is active, set rally point
    if (_activeBarracksIdx >= 0) {
      if (ctx.point) {
        _setRallyPoint(_activeBarracksIdx, ctx.point);
        _closeProductionPanel();
      }
      return true;
    }

    if (SELECTED_SHIPS.size === 0) return false;
    let hitEnemy = null;
    const hits = ctx.hits || [];
    for (const hit of hits) {
      let obj = hit.object;
      while (obj) {
        if (obj.userData && obj.userData.isWarship && obj.userData.hp > 0 && !SELECTED_SHIPS.has(obj)) { hitEnemy = obj; break; }
        obj = obj.parent;
      }
      if (hitEnemy) break;
    }
    const policy = e.shiftKey ? CMD_POLICY.QUEUE : CMD_POLICY.REPLACE;
    if (hitEnemy) {
      for (const ship of SELECTED_SHIPS) _issueCommand(ship, { type: CMD.ATTACK, target: hitEnemy, policy });
    } else if (ctx.point) {
      for (const ship of SELECTED_SHIPS) _issueCommand(ship, { type: CMD.MOVE, targetPos: ctx.point.clone(), policy });
    }
    return true;
  }

  // ====== END COMMAND SYSTEM ======

  // ====== UNIT PRODUCTION SYSTEM — Barracks + Training Queues + Rally Point ======

  const UNIT_DEFS = [
    { id: 'scout', name: 'Scout', trainTime: 5, cost: { profit: 15, love: 5, tax: 2 }, hp: 3, maxHp: 3, speed: 1.5, scanRange: 70, weaponRange: 20, atp: 5, isThreat: false, fireInterval: 2.0, color: 0x44ddff },
    { id: 'fighter', name: 'Fighter', trainTime: 10, cost: { profit: 30, love: 10, tax: 5 }, hp: 6, maxHp: 6, speed: 1.0, scanRange: 55, weaponRange: 35, atp: 20, isThreat: true, fireInterval: 1.5, color: 0xff3355 },
    { id: 'cruiser', name: 'Cruiser', trainTime: 20, cost: { profit: 60, love: 15, tax: 10 }, hp: 12, maxHp: 12, speed: 0.7, scanRange: 60, weaponRange: 40, atp: 35, isThreat: true, fireInterval: 1.2, color: 0xff8844 },
    { id: 'carrier', name: 'Carrier', trainTime: 35, cost: { profit: 120, love: 25, tax: 20 }, hp: 22, maxHp: 22, speed: 0.4, scanRange: 80, weaponRange: 50, atp: 55, isThreat: true, fireInterval: 1.0, color: 0xaa66ff }
  ];

  let _activeBarracksIdx = -1;
  let _prodPanel = null;

  // Per-world PLT tracking (pooled from beacon PLT)
  const _worldResources = {};

  function _ensureWorldResource(wi) {
    if (!_worldResources[wi]) {
      const cfg = WORLD_CONFIG[wi];
      const plt = cfg && cfg.plt ? cfg.plt : { profit: 50, love: 50, tax: 50 };
      _worldResources[wi] = { profit: plt.profit * 2, love: plt.love * 2, tax: plt.tax * 2 };
    }
  }

  function _canAfford(wi, cost) {
    const r = _worldResources[wi];
    if (!r) return false;
    return r.profit >= cost.profit && r.love >= cost.love && r.tax >= cost.tax;
  }

  function _spendResources(wi, cost) {
    const r = _worldResources[wi];
    if (!r) return false;
    if (!_canAfford(wi, cost)) return false;
    r.profit -= cost.profit;
    r.love -= cost.love;
    r.tax -= cost.tax;
    return true;
  }

  function _createBarracks(pos, wi, rng) {
    const g = new T.Group();
    g.position.copy(pos);
    const color = TYPE_COLORS[TYPES[wi]] || 0x66ffff;
    const accent = new T.Color(color);

    // Main body
    const bodyMat = _std({ color: 0x1a1a3a, emissive: color, emissiveIntensity: 0.08, metalness: 0.7, roughness: 0.3 });
    const body = new T.Mesh(new T.BoxGeometry(16, 8, 12), bodyMat);
    body.position.y = 4;
    body.castShadow = true;
    g.add(body);

    // Roof
    const roofMat = _std({ color: 0x2a2a4a, emissive: color, emissiveIntensity: 0.05, metalness: 0.6, roughness: 0.4 });
    const roof = new T.Mesh(new T.ConeGeometry(9, 4, 4), roofMat);
    roof.position.y = 10;
    roof.castShadow = true;
    g.add(roof);

    // Door glow
    const doorMat = _std({ color, emissive: color, emissiveIntensity: 0.5 });
    const door = new T.Mesh(new T.BoxGeometry(2, 3, 0.2), doorMat);
    door.position.set(0, 1.5, 6.1);
    g.add(door);

    // Pole + flag
    const pole = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 6, 4), new T.MeshBasicMaterial({ color: 0xaaaaaa }));
    pole.position.y = 12;
    g.add(pole);
    const flagMat = new T.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.7, side: T.DoubleSide });
    const flag = new T.Mesh(new T.PlaneGeometry(2, 1.0), flagMat);
    flag.position.set(1, 15, 0);
    g.add(flag);

    // Label sprite
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('BARRACKS', 128, 30);
    ctx.fillStyle = '#666688'; ctx.font = '11px sans-serif';
    ctx.fillText('Click to open production', 128, 50);
    const tex = new T.CanvasTexture(canvas);
    const label = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    label.scale.set(10, 2.5, 1);
    label.position.y = 20;
    g.add(label);

    g.userData.isBarracks = true;
    g.userData.worldIndex = wi;
    return g;
  }

  function _createTrainedShipMesh(typeDef, wi) {
    const color = typeDef.color;
    const g = new T.Group();

    const bodyMat = _std({ color: 0x1a1a3a, emissive: color, emissiveIntensity: 0.2, metalness: 0.6, roughness: 0.3 });
    const accentMat = _std({ color, emissive: color, emissiveIntensity: 0.1, metalness: 0.4, roughness: 0.5 });
    const cockpitMat = _std({ color: 0x88ddff, emissive: 0x00aaff, emissiveIntensity: 0.5, transparent: true, opacity: 0.7 });

    if (typeDef.id === 'scout') {
      // Small, fast, angular
      const hull = new T.Mesh(new T.ConeGeometry(0.6, 2.5, 6), bodyMat);
      hull.rotation.x = Math.PI / 2; g.add(hull);
      for (let s = -1; s <= 1; s += 2) {
        const w = new T.Mesh(new T.BoxGeometry(1.5, 0.06, 0.4), accentMat);
        w.position.set(s * 1.0, -0.15, 0.2); g.add(w);
      }
    } else if (typeDef.id === 'fighter') {
      const hull = new T.Mesh(new T.ConeGeometry(0.8, 3.0, 6), bodyMat);
      hull.rotation.x = Math.PI / 2; g.add(hull);
      for (let s = -1; s <= 1; s += 2) {
        const w = new T.Mesh(new T.BoxGeometry(2.0, 0.08, 0.5), accentMat);
        w.position.set(s * 1.2, -0.2, 0.3); w.rotation.z = s * 0.3; g.add(w);
        const t = new T.Mesh(new T.ConeGeometry(0.08, 0.5, 4), accentMat);
        t.position.set(s * 2.2, -0.2, 0.3); g.add(t);
      }
    } else if (typeDef.id === 'cruiser') {
      const hull = new T.Mesh(new T.CylinderGeometry(0.4, 1.0, 4, 8), bodyMat);
      hull.rotation.x = Math.PI / 2; g.add(hull);
      for (let s = -1; s <= 1; s += 2) {
        const w = new T.Mesh(new T.BoxGeometry(2.5, 0.1, 1.0), accentMat);
        w.position.set(s * 1.5, 0, 0.5); w.rotation.y = s * 0.15; g.add(w);
      }
      const fin = new T.Mesh(new T.BoxGeometry(0.08, 1.2, 0.6), accentMat);
      fin.position.set(0, 0.6, -2.0); g.add(fin);
    } else if (typeDef.id === 'carrier') {
      const hull = new T.Mesh(new T.CylinderGeometry(0.5, 1.5, 5, 8), bodyMat);
      hull.rotation.x = Math.PI / 2; g.add(hull);
      for (let s = -1; s <= 1; s += 2) {
        const w = new T.Mesh(new T.BoxGeometry(3.0, 0.12, 1.2), accentMat);
        w.position.set(s * 1.8, 0, 0.6); w.rotation.y = s * 0.1; g.add(w);
        const e = new T.Mesh(new T.SphereGeometry(0.15, 6, 6), accentMat);
        e.position.set(s * 2.8, 0, 0.6); g.add(e);
      }
      const tower = new T.Mesh(new T.BoxGeometry(0.5, 1.5, 0.5), accentMat);
      tower.position.set(0, 0.8, 1.0); g.add(tower);
    }

    // Cockpit
    const cockpit = new T.Mesh(new T.SphereGeometry(0.2, 6, 6), cockpitMat);
    cockpit.position.set(0, 0.1, 1.0);
    g.add(cockpit);

    // Engine glow
    const engineMat = _std({ color, emissive: color, emissiveIntensity: 2.0 });
    for (let s = -1; s <= 1; s += 2) {
      const e = new T.Mesh(new T.SphereGeometry(0.15, 6, 6), engineMat);
      e.position.set(s * 0.25, 0, -1.5);
      g.add(e);
    }

    // Ship userData with full targeting/combat stats
    g.userData = {
      faction: 'player', state: 'patrol', target: null,
      orbitAngle: 0, orbitRadius: 380 + Math.random() * 140, orbitHeight: (Math.random() - 0.5) * 80,
      orbitSpeed: (0.1 + Math.random() * 0.15),
      speed: typeDef.speed, hp: typeDef.hp, maxHp: typeDef.maxHp,
      fireCooldown: 0, fireInterval: typeDef.fireInterval,
      isWarship: true, respawnTimer: 0,
      scanRange: typeDef.scanRange, weaponRange: typeDef.weaponRange,
      atp: typeDef.atp, isThreat: typeDef.isThreat,
      acquireTarget: null, acquireTimer: Math.random() * 2,
      acquireInterval: 0.5 + Math.random() * 0.5,
      leashRange: 120, returnTimer: 0, homePos: null,
      productionWorld: wi,
      commandQueue: []
    };

    return g;
  }

  function _spawnTrainedUnit(wi, typeDef) {
    const name = NAMES[wi] || 'World ' + wi;
    const pos = WORLD_COORDINATES[wi] ? new T.Vector3(WORLD_COORDINATES[wi].x, WORLD_COORDINATES[wi].y, WORLD_COORDINATES[wi].z) : new T.Vector3(0, 0, 0);
    const ship = _createTrainedShipMesh(typeDef, wi);

    // Place near the world position
    const offsetAngle = Math.random() * Math.PI * 2;
    const offsetDist = 30 + Math.random() * 20;
    ship.position.set(pos.x + Math.cos(offsetAngle) * offsetDist, pos.y + 0.5, pos.z + Math.sin(offsetAngle) * offsetDist);

    // Add to scene
    scene.add(ship);
    WAR_FLEET.push(ship);

    // Spawn animation: scale from 0 to 1
    ship.scale.set(0.01, 0.01, 0.01);
    ship.userData._spawning = true;
    ship.userData._spawnTimer = 0.5;

    // Move to rally point if set
    const wData = worlds[wi];
    if (wData && wData._rallyPoint && wData._rallyMarker) {
      const rp = wData._rallyPoint;
      ship.userData.state = 'cmd_move';
      ship.userData.moveTarget = rp.clone();
      ship.userData.commandQueue = [{ type: CMD.MOVE, targetPos: rp.clone(), policy: CMD_POLICY.REPLACE }];
      ship.userData.returnTimer = 0;
    }

    console.log('[Production] ' + typeDef.name + ' spawned at ' + name + ' (' + Math.round(pos.length()) + 'u)');
    return ship;
  }

  function _setRallyPoint(wi, pos) {
    const wData = worlds[wi];
    if (!wData) return;
    wData._rallyPoint = pos.clone();

    // Remove old marker
    if (wData._rallyMarker) {
      scene.remove(wData._rallyMarker);
      wData._rallyMarker = null;
    }

    // Create rally marker: glowing flag/chevron
    const color = TYPE_COLORS[TYPES[wi]] || 0x66ffff;
    const g = new T.Group();
    g.position.copy(pos);

    const pole = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 4, 4), new T.MeshBasicMaterial({ color: 0xffffff }));
    pole.position.y = 2;
    g.add(pole);

    const flagMat = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: T.DoubleSide });
    const flag = new T.Mesh(new T.PlaneGeometry(1.5, 1.0), flagMat);
    flag.position.set(0.8, 4, 0);
    g.add(flag);

    const ring = new T.Mesh(new T.TorusGeometry(3, 0.15, 8, 16), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.2;
    g.add(ring);

    g.userData.isRallyMarker = true;
    g.userData.worldIndex = wi;
    scene.add(g);
    wData._rallyMarker = g;

    console.log('[Production] Rally point set for ' + (NAMES[wi] || 'World ' + wi) + ' at ' + Math.round(pos.x) + ', ' + Math.round(pos.z));
  }

  function _buildProductionPanel(wi) {
    // Remove old panel
    if (_prodPanel) { _prodPanel.remove(); _prodPanel = null; }

    const wData = worlds[wi];
    if (!wData) return;
    _activeBarracksIdx = wi;
    _ensureWorldResource(wi);
    const res = _worldResources[wi];
    const color = TYPE_COLORS[TYPES[wi]] || 0x66ffff;
    const colorHex = '#' + color.toString(16).padStart(6, '0');

    const panel = document.createElement('div');
    panel.id = 'production-panel';
    panel.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);width:480px;background:rgba(5,5,20,0.95);border:1px solid ' + colorHex + '44;border-radius:12px;padding:16px;z-index:40;font-family:monospace;pointer-events:auto;';

    let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">';
    html += '<span style="color:' + colorHex + ';font-size:14px;font-weight:bold;">' + (NAMES[wi] || 'World ' + wi) + ' — BARRACKS</span>';
    html += '<div style="font-size:11px;color:#888;">P: <span style="color:#88ff88;">' + res.profit + '</span> L: <span style="color:#ff88cc;">' + res.love + '</span> T: <span style="color:#ffcc44;">' + res.tax + '</span></div>';
    html += '<span onclick="window.__closeProduction()" style="cursor:pointer;color:#ff4444;font-size:16px;">✕</span>';
    html += '</div>';

    // Queue display
    const queue = wData._productionQueue || [];
    if (queue.length > 0) {
      html += '<div style="font-size:10px;color:#aaa;margin-bottom:6px;">Training Queue:</div>';
      for (let qi = 0; qi < queue.length; qi++) {
        const q = queue[qi];
        const qColor = '#' + q.color.toString(16).padStart(6, '0');
        const timeLeft = Math.max(0, q.remaining).toFixed(1);
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;background:rgba(255,255,255,0.04);border-radius:4px;margin-bottom:3px;">';
        html += '<span style="color:' + qColor + ';font-size:12px;">' + q.name + '</span>';
        html += '<span style="color:#666;font-size:11px;">' + timeLeft + 's</span>';
        html += '<span onclick="window.__cancelProduction(' + wi + ',' + qi + ')" style="cursor:pointer;color:#ff4444;font-size:12px;">✕</span>';
        html += '</div>';
      }
    }

    // Trainable units
    html += '<div style="font-size:10px;color:#aaa;margin:8px 0 4px;">Train Units:</div>';
    html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
    for (const u of UNIT_DEFS) {
      const uColor = '#' + u.color.toString(16).padStart(6, '0');
      const canAfford = _canAfford(wi, u.cost);
      const disabled = !canAfford ? 'opacity:0.4;pointer-events:none;' : '';
      html += '<div onclick="window.__trainUnit(' + wi + ',\'' + u.id + '\')" style="cursor:pointer;padding:6px 10px;background:rgba(255,255,255,0.06);border:1px solid ' + uColor + '44;border-radius:6px;' + disabled + '">';
      html += '<div style="color:' + uColor + ';font-size:12px;font-weight:bold;">' + u.name + '</div>';
      html += '<div style="font-size:9px;color:#888;">' + u.trainTime + 's · P' + u.cost.profit + ' L' + u.cost.love + ' T' + u.cost.tax + '</div>';
      html += '</div>';
    }
    html += '</div>';

    // Rally point info
    const hasRally = wData._rallyPoint ? 'Set at ' + Math.round(wData._rallyPoint.x) + ',' + Math.round(wData._rallyPoint.z) : 'Right-click on ground to set';
    html += '<div style="font-size:10px;color:#666;margin-top:8px;">Rally: ' + hasRally + '</div>';
    html += '<div style="font-size:9px;color:#444;margin-top:4px;text-align:center;">Right-click on ground to set rally point</div>';

    panel.innerHTML = html;
    document.body.appendChild(panel);
    _prodPanel = panel;

    // Wire close
    window.__closeProduction = () => {
      _closeProductionPanel();
    };

    // Wire train
    window.__trainUnit = (idx, unitId) => {
      const def = UNIT_DEFS.find(u => u.id === unitId);
      if (!def) return;
      _ensureWorldResource(idx);
      if (!_canAfford(idx, def.cost)) { console.log('[Production] Cannot afford ' + def.name); return; }
      _spendResources(idx, def.cost);

      const wd = worlds[idx];
      if (!wd._productionQueue) wd._productionQueue = [];
      wd._productionQueue.push({ id: def.id, name: def.name, color: def.color, remaining: def.trainTime, totalTime: def.trainTime, typeDef: def });
      console.log('[Production] Queued ' + def.name + ' at ' + (NAMES[idx] || 'World ' + idx));
      _buildProductionPanel(idx); // refresh
    };

    // Wire cancel
    window.__cancelProduction = (idx, slotIdx) => {
      const wd = worlds[idx];
      if (!wd || !wd._productionQueue) return;
      wd._productionQueue.splice(slotIdx, 1);
      _buildProductionPanel(idx);
    };
  }

  function _closeProductionPanel() {
    if (_prodPanel) { _prodPanel.remove(); _prodPanel = null; }
    _activeBarracksIdx = -1;
  }

  function populate(opts) {
    opts = opts || {};
    scene = opts.scene || null;
    camera = opts.camera || null;
    if (!flagOn()) return { built: false, reason: 'flag-off' };
    if (!T || !scene) return { built: false, reason: 'no-THREE/scene' };

    // Wire building click handler once
    if (!window.__towerBuildingClickWired) {
      window.__towerBuildingClickWired = true;
      const _ray = new T.Raycaster();
      const _ptr = new T.Vector2();
      window.addEventListener('pointerdown', (ev) => {
        if (!camera || !worldRoot) return;
        const rect = ev.target.getBoundingClientRect();
        _ptr.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        _ptr.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
        _ray.setFromCamera(_ptr, camera);
        const hits = _ray.intersectObjects(worldRoot.children, true);
        for (const hit of hits) {
          let obj = hit.object;
          while (obj) {
            if (obj.userData && obj.userData.isTowerBuilding) {
              const type = obj.userData.buildingType;
              const dist = obj.userData.district;
              const name = type;
              if (window.Genesis && window.Genesis.EventBridge) {
                window.Genesis.EventBridge.emit('building:click', { type, district: dist, name });
              }
              if (window.Genesis && window.Genesis.PLT && typeof window.Genesis.PLT.record === 'function') {
                window.Genesis.PLT.record('building.click.' + type.toLowerCase(), { profit: 0.5, love: 0.3, tax: 0.1 }, { actor: 'player', building: type });
              }
              console.log('[Tower] Clicked', type);
              break;
            }
            obj = obj.parent;
          }
        }
      }, { passive: true });
    }

    // Wire Farm passive income mechanic (GT-P13)
    if (!window.__farmMechanicWired) {
      window.__farmMechanicWired = true;
      const RP = window.Genesis && window.Genesis.ResourcePool;
      if (RP) {
        RP.ensure('grand-tower-farm', 100, 2);
        console.log('[Farm] Pool ensured: max=100, regen=2/tick');
      }
      const EB = window.Genesis && window.Genesis.EventBridge;
      if (EB) {
        EB.registerTrigger({
          when: 'building:click',
          condition: (p) => p && p.type === 'Farm',
          action: () => {
            if (!RP) return;
            if (RP.spend('grand-tower-farm', 10)) {
              RP.regen('grand-tower-farm');
              RP.addPLT('grand-tower-farm', 5, 2, 1);
              window.__farmLastClickTime = Date.now();
              const stats = RP.get('grand-tower-farm');
              console.log('[Farm] Tended! +5 Profit, +2 Love, +1 Tax | Energy: ' + stats.energy + '/' + stats.max + ' | PLT: P' + stats.profit + ' L' + stats.love + ' T' + stats.tax);
            } else {
              console.log('[Farm] Too tired! Energy depleted — wait for regen.');
            }
          }
        });
        console.log('[Farm] EventBridge trigger registered.');
      }
    }

    // Wire Market trading mechanic (GT-P14)
    if (!window.__marketMechanicWired) {
      window.__marketMechanicWired = true;
      const RP = window.Genesis && window.Genesis.ResourcePool;
      if (RP) {
        RP.ensure('grand-tower-market', 100, 3);
        RP.addItem('grand-tower-market', 'profit', 5);
        RP.addItem('grand-tower-market', 'love', 5);
        RP.addItem('grand-tower-market', 'tax', 5);
        console.log('[Market] Pool + stock seeded.');
      }
      const EB = window.Genesis && window.Genesis.EventBridge;
      if (EB) {
        EB.registerTrigger({
          when: 'building:click',
          condition: (p) => p && p.type === 'Market',
          action: () => {
            if (!RP) return;
            if (RP.spend('grand-tower-market', 15)) {
              const roll = Math.random();
              let profit = 0, love = 0, tax = 0, quality = 'common';
              if (roll < 0.2) {
                profit = 12; love = 4; tax = 0; quality = 'rare';
              } else if (roll < 0.7) {
                profit = 5; love = 3; tax = 1; quality = 'common';
              } else {
                profit = 3; love = 1; tax = 3; quality = 'poor';
              }
              RP.addPLT('grand-tower-market', profit, love, tax);
              window.__marketLastTrade = { time: Date.now(), quality, profit, love, tax };
              const stats = RP.get('grand-tower-market');
              console.log('[Market] ' + quality.toUpperCase() + ' trade! +' + profit + ' Profit, +' + love + ' Love, +' + tax + ' Tax | Energy: ' + stats.energy + '/' + stats.max);
            } else {
              console.log('[Market] Not enough energy — wait for regen.');
            }
          }
        });
        console.log('[Market] EventBridge trigger registered.');
      }
    }

    // Wire Barracks combat mechanic (GT-P15)
    if (!window.__barracksMechanicWired) {
      window.__barracksMechanicWired = true;
      const RP = window.Genesis && window.Genesis.ResourcePool;
      if (RP) RP.ensure('grand-tower-barracks', 100, 2);
      const EB = window.Genesis && window.Genesis.EventBridge;
      if (EB) {
        EB.registerTrigger({
          when: 'building:click',
          condition: (p) => p && p.type === 'Barracks',
          action: () => {
            if (!RP) return;
            if (RP.spend('grand-tower-barracks', 20)) {
              const hit = Math.random();
              let profit = 0, love = 0, tax = 0, result = 'miss';
              if (hit < 0.2) {
                profit = 15; love = 5; tax = 2; result = 'critical';
              } else if (hit < 0.65) {
                profit = 8; love = 3; tax = 4; result = 'hit';
              } else {
                profit = 0; love = 1; tax = 5; result = 'blocked';
              }
              RP.addPLT('grand-tower-barracks', profit, love, tax);
              RP.regen('grand-tower-barracks');
              window.__barracksLastCombat = { time: Date.now(), result, profit, love, tax };
              const stats = RP.get('grand-tower-barracks');
              console.log('[Barracks] ' + result.toUpperCase() + '! +' + profit + 'P +' + love + 'L -' + tax + 'T | Energy: ' + stats.energy + '/' + stats.max);
            } else {
              console.log('[Barracks] Too exhausted to train!');
            }
          }
        });
        console.log('[Barracks] Combat trigger registered.');
      }
    }

    // Wire command system through the unified input router (single input path)
    if (!window.__cmdSystemWired && window.RTSInputRouter) {
      window.__cmdSystemWired = true;
      window.RTSInputRouter.registerBoxSelector(_cmdBoxSelect);
      window.RTSInputRouter.registerLeftClick(40, _cmdSingleClick);
      window.RTSInputRouter.registerRightClick(40, _cmdRightClick);
      console.log('[CommandSystem] Warship selection + commands registered via input router.');
    }

    // Clean previous
    if (worldRoot.parent) worldRoot.parent.remove(worldRoot);
    worlds.length = 0;
    PORTALS.length = 0;

    const rng = seededRandom('void-population-genesis');

    for (let i = 0; i < WORLD_COUNT; i++) {
      const name = NAMES[i];
      const type = TYPES[i];
      // Use explicit PLT from WORLD_CONFIG if defined, otherwise generate random
      const config = WORLD_CONFIG[i] || {};
      const plt = config.plt || { profit: 20 + Math.floor(rng() * 60), love: 20 + Math.floor(rng() * 60), tax: 10 + Math.floor(rng() * 40) };
      const pos = getWorldPosition(i, rng);

      // Create beacon — ALWAYS visible
      const beacon = createBeacon(name, type, plt, pos);
      worldRoot.add(beacon);

      // Create city skeleton — detailed buildings visible from far
      let city;
      if (type === 'cplclone') {
        city = createCPLCloneCity(pos, rng);
      } else if (type === 'grandtower') {
        city = createGrandTower(pos, rng);
        const galaxy = createGalaxy(new T.Vector3(0, 500, 0));
        city.add(galaxy);
        const planet = createExplodingPlanet(new T.Vector3(70, 300, 0));
        planet.userData.orbitSpeed = 0.15;
        city.add(planet);
        const pyramids = createInvertedPyramids(new T.Vector3(0, 0, 0));
        pyramids.userData.rotateSpeed = 0.08;
        city.add(pyramids);
        const boids = createSoulBoids(new T.Vector3(0, 0, 0));
        city.add(boids);
      } else if (type === 'castle') {
        city = createCastle(pos, rng);
      } else if (type === 'colosseum') {
        city = createColosseum(pos, rng);
      } else if (window.VoidCityGenerator) {
        // Use extended AoE-style city generator if available
        city = window.VoidCityGenerator.generateCity({
          pos: pos,
          type: type,
          seed: i * 1000 + 12345,
          radius: 160,
          buildingCount: 90,
          faction: (type === 'grandtower' || type === 'cplclone') ? 'voidCovenant' : 'imperium',
        });
        console.log('[VoidPopulation] Using VoidCityGenerator for', type, 'at', pos.x, pos.z);
      } else {
        city = createCitySkeleton(pos, type, rng);
      }
      worldRoot.add(city);

      // Create barracks production building (offset from city center)
      const barOffsetDir = new T.Vector3(-pos.x, 0, -pos.z).normalize();
      const barPos = pos.clone().add(barOffsetDir.clone().multiplyScalar(130));
      barPos.y = pos.y;
      const barracks = _createBarracks(barPos, i, rng);
      worldRoot.add(barracks);

      // Create quest beacon
      const questBeacon = createQuestBeacon({ type }, rng);
      questBeacon.position.copy(pos);
      worldRoot.add(questBeacon);

      // Create denizens
      const denizens = createDenizens(pos, type, rng);
      worldRoot.add(denizens);

      // Try to create full Realm if available
      let realm = null;
      const RealmWorld = Genesis.RealmWorld;
      if (RealmWorld && RealmWorld.Realm) {
        try {
          realm = new RealmWorld.Realm({
            id: 'void-' + i + '-' + name.toLowerCase().replace(/\s/g, '-'),
            config: { id: 'void-' + i, seed: 'void-' + i + '-' + name, name, type, plt, palette: { fog: 0x050510 } },
            THREE: T,
            scene: worldRoot,
            lazyUI: true
          });
          realm.init().then(() => {
            realm.root.position.copy(pos);
            realm.root.visible = false;
            worldRoot.add(realm.root);
          }).catch(e => console.warn('[VoidPopulation] Realm init failed for', name, e));
        } catch (e) {
          console.warn('[VoidPopulation] Realm create failed for', name, e);
        }
      }

      worlds.push({ realm, beacon, city, questBeacon, denizens, name, type, plt, position: pos, active: false, _productionQueue: [], _rallyPoint: null, _rallyMarker: null });
    }

    // Create portal connections — each world connects to 2 others
    for (let i = 0; i < WORLD_COUNT; i++) {
      const from = worlds[i];
      const toIndex = (i + 1) % WORLD_COUNT;
      const to = worlds[toIndex];
      const portal = createPortal(from, to, rng);
      // Position portal at edge of from world
      const dir = new T.Vector3().subVectors(to.position, from.position).normalize();
      portal.position.copy(from.position).add(dir.multiplyScalar(100));
      portal.lookAt(to.position);
      worldRoot.add(portal);
      PORTALS.push({ from: i, to: toIndex, mesh: portal });
    }

    scene.add(worldRoot);

    // Populate void cosmos (starfield, nebulae, suns, planets, moons, sky dome)
    if (voidCosmosApi && voidCosmosApi.populateCosmos) {
      const worldPositions = worlds.map(w => w.position);
      voidCosmosApi.populateCosmos(worldPositions, scene);
    }

    // Spawn war fleet — SC2 4-tier auto-acquire + WC3 leash/chase
    spawnFleet(scene, rng);

    // Build travel panel for easy navigation
    buildTravelPanel();

    // Spawn sovereign cities (20 Realms — Lego snap-on pattern)
    const _sovereignCityDefs = [
      { fn: 'spawnWarzoneCity',        ref: '_warzoneCity',        opts: { offsetX: 900, offsetZ: 300 },      name: 'Shattered Front' },
      { fn: 'spawnObsidianSpire',      ref: '_obsidianSpire',      opts: { offsetX: 400, offsetZ: 0 },        name: 'Obsidian Spire' },
      { fn: 'spawnResonantVeil',       ref: '_resonantVeil',       opts: { offsetX: -600, offsetZ: 400 },     name: 'Resonant Veil' },
      { fn: 'spawnSolarForge',         ref: '_solarForge',         opts: { offsetX: -900, offsetZ: -300 },    name: 'Solar Forge' },
      { fn: 'spawnBioluminescentHive', ref: '_bioluminescentHive', opts: { offsetX: 1200, offsetZ: -500 },    name: 'Bioluminescent Hive' },
      { fn: 'spawnNeonZenith',         ref: '_neonZenith',         opts: { offsetX: 600, offsetZ: -800 },     name: 'Neon Zenith' },
      { fn: 'spawnIronFoundry',        ref: '_ironFoundry',        opts: { offsetX: -800, offsetZ: -600 },    name: 'Iron Foundry' },
      { fn: 'spawnAetheriumSkylands',  ref: '_aetheriumSkylands',  opts: { offsetX: 1500, offsetZ: 0 },       name: 'Aetherium Skylands' },
      { fn: 'spawnElysianVault',       ref: '_elysianVault',       opts: { offsetX: 1000, offsetZ: -1200 },   name: 'Elysian Vault' },
      { fn: 'spawnAstralSpire',        ref: '_astralSpire',        opts: { offsetX: 0, offsetZ: 1200 },       name: 'Astral Spire' },
      { fn: 'spawnQuantumRift',        ref: '_quantumRift',        opts: { offsetX: -1200, offsetZ: -1200 },  name: 'Quantum Rift' },
      { fn: 'spawnChronosTemple',      ref: '_chronosTemple',      opts: { offsetX: 300, offsetZ: -1500 },    name: 'Chronos Temple' },
      { fn: 'spawnGlacialMatrix',      ref: '_glacialMatrix',      opts: { offsetX: -1500, offsetZ: 300 },    name: 'Glacial Matrix' },
      { fn: 'spawnAbyssalTrench',      ref: '_abyssalTrench',      opts: { offsetX: 0, offsetZ: -1800 },      name: 'Abyssal Trench' },
      { fn: 'spawnHyperionArray',      ref: '_hyperionArray',      opts: { offsetX: -1000, offsetZ: 1500 },   name: 'Hyperion Array' },
      { fn: 'spawnTitanGraveyard',     ref: '_titanGraveyard',     opts: { offsetX: 1800, offsetZ: 600 },     name: 'Titan Graveyard' },
      { fn: 'spawnRiftWarzone',        ref: '_riftWarzone',        opts: { offsetX: 800, offsetZ: 1000 },     name: 'Rift Warzone' },
      { fn: 'spawnVortexSiege',        ref: '_vortexSiege',        opts: { offsetX: -1600, offsetZ: -800 },   name: 'Vortex Siege' },
      { fn: 'spawnGenesisCitadel',     ref: '_genesisCitadel',     opts: { offsetX: 0, offsetZ: -2200 },      name: 'Genesis Citadel' },
      { fn: 'spawnOmegaCrucible',      ref: '_omegaCrucible',      opts: { offsetX: 2000, offsetZ: 0 },       name: 'Omega Crucible' },
      { fn: 'spawnSovereignMarketplace', ref: '_sovereignMarketplace', opts: { offsetX: -400, offsetZ: -900 }, name: 'Sovereign Marketplace' },
    ];

    let _spawnedCount = 0;
    for (const def of _sovereignCityDefs) {
      if (typeof window[def.fn] === 'function') {
        try {
          const cityGroup = window[def.fn](scene, def.opts);
          _allSovereignCities.push(cityGroup);
          _spawnedCount++;
          // Register with Engine Optimizer for LOD management
          if (window.EngineOptimizer && cityGroup && cityGroup.position) {
            window.EngineOptimizer.registerCity(cityGroup, cityGroup.position);
          }
        } catch (e) { console.warn('[VoidPopulation] ' + def.name + ' spawn failed:', e && e.message); }
      }
    }
    if (_spawnedCount > 0) console.log('[VoidPopulation] Spawned', _spawnedCount, 'Sovereign Void Realms');

    // Install Master Art Pass V2 & Omnibus (Atmosphere, SSAO, Galactic Overlay, Sound Drone)
    if (window.GodforgeArtPassV2) {
      try { window.GodforgeArtPassV2.install(scene); } catch(e) { console.warn('[VoidPopulation] ArtPassV2 install failed:', e && e.message); }
    }
    if (window.GodforgeArtPassOmnibus) {
      try { window.GodforgeArtPassOmnibus.install(scene); } catch(e) { console.warn('[VoidPopulation] ArtPassOmnibus install failed:', e && e.message); }
    }
    if (window.StoryQuestSystem) {
      try { window.StoryQuestSystem.install(); } catch(e) { console.warn('[VoidPopulation] StoryQuestSystem install failed:', e && e.message); }
    }
    if (window.GodPowersEngine) {
      try { window.GodPowersEngine.install(scene); } catch(e) { console.warn('[VoidPopulation] GodPowersEngine install failed:', e && e.message); }
    }
    if (window.StarCraftAsymmetricEngine) {
      try { window.StarCraftAsymmetricEngine.install(scene); } catch(e) { console.warn('[VoidPopulation] StarCraftAsymmetricEngine install failed:', e && e.message); }
    }
    if (window.RTSEngineCore) {
      try { window.RTSEngineCore.install(scene); } catch(e) { console.warn('[VoidPopulation] RTSEngineCore install failed:', e && e.message); }
    }
    if (window.RTSNavGrid) {
      try { window.RTSNavGrid.install({ cellSize: 5 }); } catch(e) { console.warn('[VoidPopulation] RTSNavGrid install failed:', e && e.message); }
    }
    if (window.RTSInputRouter) {
      try { window.RTSInputRouter.install({ scene: scene, camera: camera }); } catch(e) { console.warn('[VoidPopulation] RTSInputRouter install failed:', e && e.message); }
    }
    if (window.RTSUICore) {
      try { window.RTSUICore.install(); } catch(e) { console.warn('[VoidPopulation] RTSUICore install failed:', e && e.message); }
    }
    
    // RTS-1 + RTS-2: Unified Selection + Order Generator (replaces fragmented handler war)
    if (window.RTSBridge) {
      try { window.RTSBridge.install({ scene: scene, camera: camera }); } catch(e) { console.warn('[VoidPopulation] RTSBridge install failed:', e && e.message); }
    }
    // RTS-5: Production Palette — bottom bar with build icons
    if (window.RTSProductionPalette) {
      try {
        window.RTSProductionPalette._ents = window.RTSEngineCore?.ENTITIES;
        window.RTSProductionPalette._scene = scene;
        window.RTSProductionPalette.install();
      } catch(e) { console.warn('[VoidPopulation] RTSProductionPalette install failed:', e && e.message); }
    }
    // RTS-7: Fog of War — create THE instance (engine-core, minimap, ai-brain all read window.RTSFogOfWarInstance)
    if (window.RTSFogOfWar && !window.RTSFogOfWarInstance) {
      try {
        const fogInstance = new window.RTSFogOfWar({ scene: scene, entities: window.RTSEngineCore?.ENTITIES });
        fogInstance.install();
        window.RTSFogOfWarInstance = fogInstance;
      } catch(e) { console.warn('[VoidPopulation] RTSFogOfWar install failed:', e && e.message); }
    }
    // RTS-6: Minimap — bottom-right canvas with terrain/fog/entities
    if (window.RTSMinimap) {
      try {
        window.__rtsMinimap = new window.RTSMinimap({ scene, camera, entities: window.RTSEngineCore?.ENTITIES });
        window.__rtsMinimap.install();
      } catch(e) { console.warn('[VoidPopulation] RTSMinimap install failed:', e && e.message); }
    }
    
    if (window.RTSEconomySystem) {
      try { window.RTSEconomySystem.install(scene); } catch(e) { console.warn('[VoidPopulation] RTSEconomySystem install failed:', e && e.message); }
    }
    
    if (window.RTSUIEngine) {
      try { window.RTSUIEngine.install(scene, camera); } catch(e) { console.warn('[VoidPopulation] RTSUIEngine install failed:', e && e.message); }
    }
    if (window.RTSBaseBuilder) {
      try { window.RTSBaseBuilder.install({ scene: scene, camera: camera }); } catch(e) { console.warn('[VoidPopulation] RTSBaseBuilder install failed:', e && e.message); }
    }
    if (window.RTSProductionSystem) {
      try { window.RTSProductionSystem.install(scene); } catch(e) { console.warn('[VoidPopulation] RTSProductionSystem install failed:', e && e.message); }
    }

    // Phase 5: Register Grand Tower as a town hall (harvest drop-off point)
    // and mark enemy bases in the nav grid. Wire into VoidRTSBuildings for garrison/production.
    if (window.RTSEngineCore && window.VoidRTSBuildings) {
      for (let i = 0; i < worlds.length; i++) {
        const w = worlds[i];
        if (!w || !w.city) continue;
        const wt = TYPES[i] || w.type;
        const faction = (wt === 'grandtower' || wt === 'cplclone') ? 'voidCovenant' : 'imperium';
        // Register city center as building
        let ent = window.RTSEngineCore.registerEntity(w.city, 'building', faction, 5000, 45);
        let rtsBuilding = null;
        if (ent) {
          // Grand Tower + New City = player town halls (harvest drop-off)
          if (wt === 'grandtower' || wt === 'cplclone') {
            ent.isTownHall = true;
            // Create AoE-style townCenter for production/garrison
            rtsBuilding = window.VoidRTSBuildings.registerVoidBuilding(w.city, 'townCenter', faction, { hp: 5000, garrisonMax: 10, productionMax: 5 });
            ent.rtsBuildingId = rtsBuilding.id;
          }
          if (wt === 'grandtower') {
            ent.isGrandTower = true;
          }
          // Mark nav grid for this building
          if (window.RTSNavGrid) {
            window.RTSNavGrid.blockCircle(w.position.x, w.position.z, 50, true);
          }
        }
        // Register any tower buildings inside the city group as barracks or towers
        if (rtsBuilding && w.group) {
          const bList = window.VoidRTSBuildings.registerCityGroup(w.group, wt, faction);
          console.log(`[VoidPopulation] Registered ${bList.length} AoE-style buildings in ${wt} world.`);
        }
      }
      console.log('[VoidPopulation] Registered Grand Tower + city centers with AoE-style RTS extensions.');
    }

    // Prime fog masks now that town halls exist (prevents first-frame all-hidden)
    if (window.RTSFogOfWarInstance) {
      try {
        window.RTSFogOfWarInstance.tick(0.05);
        window.RTSFogOfWarInstance.reveal(0, -104, 401, 140); // PLAYER_HOME start area
      } catch(e) { /* best-effort prime */ }
    }
    
    if (window.DivineTerrainSculptor) {
      try { window.DivineTerrainSculptor.install(scene, camera); } catch(e) { console.warn('[VoidPopulation] DivineTerrainSculptor install failed:', e && e.message); }
    }
    
    if (window.RTSAIDirector) {
      try { window.RTSAIDirector.install(scene); } catch(e) { console.warn('[VoidPopulation] RTSAIDirector install failed:', e && e.message); }
    }
    if (window.AdvancedNPCEngine) {
      try { window.AdvancedNPCEngine.install(scene); } catch(e) { console.warn('[VoidPopulation] AdvancedNPCEngine install failed:', e && e.message); }
    }
    // RTS War Command — must load AFTER both AIDirector + NPCEngine are installed
    if (window.RTSWarCommand && typeof window.RTSWarCommand.install === 'function') {
      try { window.RTSWarCommand.install(scene); } catch(e) { if (typeof console !== 'undefined') console.warn('[VoidPopulation] RTSWarCommand install failed:', e && e.message); }
    }

    // Install RTS Subsystem & AI Faction Commanders
    if (window.RTSSubsystem && camera) {
      try { window.RTSSubsystem.install(camera, scene); } catch(e) { console.warn('[VoidPopulation] RTS install failed:', e && e.message); }
    }
    if (window.RTSAIFaction) {
      try { window.RTSAIFaction.install(scene); } catch(e) { console.warn('[VoidPopulation] RTSAIFaction install failed:', e && e.message); }
    }

    // RTS AI Brain — fog-limited strategic/tactical AI (imperium + bioHive)
    if (window.RTSAIBrain && !window.RTSAIBrainInstance) {
      try {
        window.RTSAIBrainInstance = new window.RTSAIBrain({
          entities: window.RTSEngineCore?.ENTITIES,
          fog: window.RTSFogOfWarInstance,
          playerIndex: 1
        });
        window.RTSAIBrainInstance.install();
      } catch(e) { console.warn('[VoidPopulation] RTSAIBrain install failed:', e && e.message); }
    }

    // Install Terminal Sanctum in Central Pyramid (0,0,0)
    if (window.TerminalSanctum) {
      try { window.TerminalSanctum.install(scene); } catch(e) { console.warn('[VoidPopulation] TerminalSanctum install failed:', e && e.message); }
    }

    // Register sovereign city centers as town halls (harvest drop-off points)
    // Wire into VoidRTSBuildings for AoE-style garrison/production.
    if (window.RTSEngineCore && window.VoidRTSBuildings && _allSovereignCities && _allSovereignCities.length) {
      _allSovereignCities.forEach((city) => {
        if (!city) return;
        let faction = 'neutral';
        let isEnemyBase = false;

        // Correctly assign factions based on home base coordinates
        if (Math.abs(city.position.x - 1200) < 10 && Math.abs(city.position.z - (-500)) < 10) {
          faction = 'bioHive';
          isEnemyBase = true;
        } else if (Math.abs(city.position.x - (-800)) < 10 && Math.abs(city.position.z - (-600)) < 10) {
          faction = 'imperium';
          isEnemyBase = true;
        } else if (Math.abs(city.position.x - 900) < 10 && Math.abs(city.position.z - 300) < 10) {
          faction = 'imperium'; // Shattered Front is imperium
        } else {
          faction = 'neutral';
        }

        const ent = window.RTSEngineCore.registerEntity(city, 'building', faction, 4000, 30);
        let rtsBuilding = null;
        if (ent) {
          ent.isTownHall = true;
          // Create AoE townCenter for production/garrison
          rtsBuilding = window.VoidRTSBuildings.registerVoidBuilding(city, 'townCenter', faction, { hp: 4000, garrisonMax: 8, productionMax: 4 });
          ent.rtsBuildingId = rtsBuilding.id;
          if (isEnemyBase) {
            ent.isEnemyBase = true;
            console.log(`[VoidPopulation] Registered enemy command center for ${faction} with AoE RTS at ${city.position.x}, ${city.position.z}`);
          }
        }
        // Wire any tower buildings inside this city group
        if (rtsBuilding && city.group) {
          const bList = window.VoidRTSBuildings.registerCityGroup(city.group, faction, faction);
          console.log(`[VoidPopulation] Registered ${bList.length} AoE-style buildings in ${faction} city.`);
        }
      });
      console.log('[VoidPopulation] Registered ' + _allSovereignCities.length + ' sovereign city centers with AoE RTS extensions.');
    }

    console.log('[VoidPopulation] Spawned', WORLD_COUNT, 'Lost Worlds + war fleet at distances', MIN_DIST, '-', MAX_DIST, 'units');
    return { built: true, worlds: worlds.length };
  }

  function tick(dt) {
    if (!camera) return;

    // Throttled passive income: regen all ResourcePools once per second
    if (!window.__lastRegenTick || Date.now() - window.__lastRegenTick > 1000) {
      window.__lastRegenTick = Date.now();
      const RP = window.Genesis && window.Genesis.ResourcePool;
      if (RP) {
        RP.regenAll();
        const farm = RP.get('grand-tower-farm');
        if (farm) {
          if (farm.energy > 50) RP.addPLT('grand-tower-farm', 1, 0, 0);
        }
        const market = RP.get('grand-tower-market');
        if (market && market.energy > 60) {
          RP.addPLT('grand-tower-market', 2, 1, 0);
        }
        const barracks = RP.get('grand-tower-barracks');
        if (barracks && barracks.energy > 70) {
          RP.addPLT('grand-tower-barracks', 1, 0, 1);
        }
      }
    }

    const camPos = camera.position;

    for (const w of worlds) {
      const dx = camPos.x - w.position.x;
      const dy = camPos.y - w.position.y;
      const dz = camPos.z - w.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Show/hide full Realm city when close
      if (w.realm && w.realm.root) {
        if (!w.active && dist < WAKE_RADIUS) {
          w.realm.root.visible = true;
          w.realm.enter();
          w.active = true;
        } else if (w.active && dist > SLEEP_RADIUS) {
          w.realm.root.visible = false;
          w.realm.exit();
          w.active = false;
        }
        if (w.active) w.realm.update(dt);
      }

      // Pulse the orb when close
      if (w.beacon) {
        const orb = w.beacon.children[4]; // orb mesh
        if (orb) {
          const pulse = 1.0 + Math.sin(Date.now() * 0.003 + w.position.x) * 0.15;
          orb.scale.setScalar(pulse);
        }
      }

      // Pulse Grand Tower orb + halos
      if (w.city && w.type === 'grandtower') {
        w.city.children.forEach(child => {
          if (child.userData && child.userData.isGrandTowerOrb) {
            const t = Date.now() * 0.002;
            child.scale.setScalar(1.0 + Math.sin(t) * 0.2);
            child.material.emissiveIntensity = 2.5 + Math.sin(t * 1.5) * 1.0;
          }
          // Animate water opacity
          if (child.material && child.material.metalness > 0.8 && child.geometry && child.geometry.type === 'CircleGeometry') {
            child.material.opacity = 0.6 + Math.sin(Date.now() * 0.001) * 0.1;
          }
          // Rotate tilted halos
          if (child.userData && child.userData.isHalo1) child.rotation.y += dt * 0.08;
          if (child.userData && child.userData.isHalo2) child.rotation.y += dt * 0.15;
          if (child.userData && child.userData.isHalo3) child.rotation.y -= dt * 0.1;
          // Galaxy differential rotation
          if (child.userData && child.userData.isGalaxy) {
            const posArr = child.geometry.attributes.position.array;
            const radii = child.userData.radii;
            const angles = child.userData.angles;
            const count = child.userData.count;
            const t = Date.now() * 0.00005;
            for (let i = 0; i < count; i++) {
              const r = radii[i];
              const speed = 1 / (0.3 + r * 0.02);
              const newAngle = angles[i] + t * speed;
              posArr[i * 3] = Math.cos(newAngle) * r;
              posArr[i * 3 + 2] = Math.sin(newAngle) * r;
            }
            child.geometry.attributes.position.needsUpdate = true;
          }
          // Galaxy core pulse
          if (child.userData && child.userData.isGalaxyCore) {
            const p = 1.0 + Math.sin(Date.now() * 0.003) * 0.15;
            child.scale.setScalar(p);
          }
          // Exploding planet orbit + cycle
          if (child.userData && child.userData.isExplodingGroup) {
            child.rotation.y += dt * (child.userData.orbitSpeed || 0.15);
          }
          if (child.userData && child.userData.isExplodingPlanet) {
            const posArr = child.geometry.attributes.position.array;
            const sp = child.userData.spherePos;
            const ed = child.userData.explodeDir;
            const ph = child.userData.phases;
            const cn = child.userData.count;
            const t = Date.now() * 0.001;
            for (let i = 0; i < cn; i++) {
              const cycle = Math.sin(t * 0.5 + ph[i]);
              const mix = cycle * 0.5 + 0.5;
              posArr[i * 3] = sp[i * 3] + ed[i * 3] * mix;
              posArr[i * 3 + 1] = sp[i * 3 + 1] + ed[i * 3 + 1] * mix;
              posArr[i * 3 + 2] = sp[i * 3 + 2] + ed[i * 3 + 2] * mix;
            }
            child.geometry.attributes.position.needsUpdate = true;
          }
          if (child.userData && child.userData.isExplodingCore) {
            const p = 1.0 + Math.sin(Date.now() * 0.005) * 0.2;
            child.scale.setScalar(p);
          }
          // Inverted pyramids rotation
          if (child.userData && child.userData.isInvertedPyramids) {
            child.rotation.y += dt * (child.userData.rotateSpeed || 0.08);
          }
          // Soul boids flocking
          if (child.userData && child.userData.isSoulBoids) {
            const posArr = child.geometry.attributes.position.array;
            const boids = child.userData.boids;
            const targetChangeSpeed = 3;
            for (let i = 0; i < boids.length; i++) {
              const b = boids[i];
              b.timer -= dt;
              if (b.timer <= 0) {
                b.target.set(
                  (Math.random() - 0.5) * 100,
                  10 + Math.random() * 50,
                  (Math.random() - 0.5) * 100
                );
                b.timer = 3 + Math.random() * targetChangeSpeed;
              }
              const steer = new T.Vector3().subVectors(b.target, b.pos).normalize().multiplyScalar(0.5);
              b.vel.add(steer);
              b.vel.x += (Math.random() - 0.5) * 0.1;
              b.vel.z += (Math.random() - 0.5) * 0.1;
              b.vel.clampLength(0, 2);
              b.pos.add(b.vel.clone().multiplyScalar(dt));
              posArr[i * 3] = b.pos.x;
              posArr[i * 3 + 1] = b.pos.y;
              posArr[i * 3 + 2] = b.pos.z;
            }
            child.geometry.attributes.position.needsUpdate = true;
          }
          // Farm click glow feedback
          if (window.__farmLastClickTime && child.userData && child.userData.buildingType === 'Farm' && child.isMesh && child.material) {
            const elapsed = Date.now() - window.__farmLastClickTime;
            if (elapsed < 1500) {
              const decay = 1 - elapsed / 1500;
              child.material.emissiveIntensity = 0.12 + Math.sin(elapsed * 0.02) * 0.5 * decay;
            } else {
              child.material.emissiveIntensity = 0.12;
            }
          }
          // Market trade glow feedback
          if (window.__marketLastTrade && child.userData && child.userData.buildingType === 'Market' && child.isMesh && child.material) {
            const elapsed = Date.now() - window.__marketLastTrade.time;
            if (elapsed < 1500) {
              const decay = 1 - elapsed / 1500;
              const isRare = window.__marketLastTrade.quality === 'rare';
              child.material.color.setHex(isRare ? 0xffdd44 : window.__marketLastTrade.quality === 'poor' ? 0xff4444 : 0x44ff88);
              child.material.emissiveIntensity = 0.5 + Math.sin(elapsed * 0.025) * 0.4 * decay;
            } else {
              child.material.color.setHex(0x222244);
              child.material.emissiveIntensity = 0.12;
            }
          }
          // Barracks combat glow feedback
          if (window.__barracksLastCombat && child.userData && child.userData.buildingType === 'Barracks' && child.isMesh && child.material) {
            const elapsed = Date.now() - window.__barracksLastCombat.time;
            if (elapsed < 1200) {
              const decay = 1 - elapsed / 1200;
              const isCrit = window.__barracksLastCombat.result === 'critical';
              child.material.color.setHex(isCrit ? 0xffaa00 : window.__barracksLastCombat.result === 'blocked' ? 0x4444ff : 0xff3355);
              child.material.emissiveIntensity = 0.6 + Math.sin(elapsed * 0.03) * 0.5 * decay;
            } else {
              child.material.color.setHex(0x222244);
              child.material.emissiveIntensity = 0.12;
            }
          }
        });
      }

      // Animate quest beacon diamond
      if (w.questBeacon) {
        const diamond = w.questBeacon.children[0]; // diamond mesh
        if (diamond) {
          diamond.rotation.y += dt * 0.5;
          diamond.position.y = 20 + Math.sin(Date.now() * 0.002 + w.position.z) * 2;
        }
      }

      // Castle animations
      if (w.city && w.type === 'castle') {
        w.city.children.forEach(child => {
          if (child.userData && child.userData.isCastleCrown) {
            const p = 1.0 + Math.sin(Date.now() * 0.003) * 0.15;
            child.scale.setScalar(p);
            child.material.emissiveIntensity = 1.5 + Math.sin(Date.now() * 0.002) * 0.5;
          }
          if (child.userData && child.userData.isCastleBeam) {
            child.rotation.y += dt * 0.1;
          }
          if (child.userData && child.userData.isCastleParticles) {
            const pos = child.geometry.attributes.position.array;
            for (let i = 1; i < pos.length; i += 3) {
              pos[i] += dt * 0.3;
              if (pos[i] > 45) pos[i] = 0;
            }
            child.geometry.attributes.position.needsUpdate = true;
          }
        });
      }

      // Colosseum animations
      if (w.city && w.type === 'colosseum') {
        w.city.children.forEach(child => {
          if (child.userData && child.userData.torchPhase !== undefined && child.isMesh && child.material) {
            const t = Date.now() * 0.002 + child.userData.torchPhase;
            child.material.emissiveIntensity = 1.5 + Math.sin(t) * 0.8;
          }
          if (child.userData && child.userData.isColosseumEmbers) {
            const pos = child.geometry.attributes.position.array;
            for (let i = 1; i < pos.length; i += 3) {
              pos[i] += dt * 0.5;
              if (pos[i] > 30) pos[i] = 0;
            }
            child.geometry.attributes.position.needsUpdate = true;
          }
        });
      }

      // Animate ambient particles
      if (w.city) {
        w.city.children.forEach(child => {
          if (child.userData && child.userData.isAmbientParticles) {
            const positions = child.geometry.attributes.position.array;
            for (let i = 1; i < positions.length; i += 3) {
              positions[i] += dt * 0.5;
              if (positions[i] > 80) positions[i] = 0;
            }
            child.geometry.attributes.position.needsUpdate = true;
          }
        });
      }
    }

    // Production tick — process training queues, spawn completed units
    for (const w of worlds) {
      if (!w._productionQueue || w._productionQueue.length === 0) continue;
      const first = w._productionQueue[0];
      first.remaining -= dt;
      if (first.remaining <= 0) {
        w._productionQueue.shift();
        const wi = worlds.indexOf(w);
        _spawnTrainedUnit(wi, first.typeDef);
        // Refresh panel if open
        if (_prodPanel && _activeBarracksIdx === wi) _buildProductionPanel(wi);
      }
    }

    // Animate spawning ships (scale up from 0)
    for (const ship of WAR_FLEET) {
      if (ship.userData && ship.userData._spawning) {
        ship.userData._spawnTimer -= dt;
        const t = 1 - Math.max(0, ship.userData._spawnTimer) / 0.5;
        const s = 0.01 + t * 0.99;
        ship.scale.set(s, s, s);
        if (ship.userData._spawnTimer <= 0) {
          ship.userData._spawning = false;
          ship.scale.set(1, 1, 1);
        }
      }
    }

    // Fleet tick — SC2 4-tier targeting, WC3 leash, lasers, explosions, death/respawn
    fleetTick(dt);

    // Animate portal frames
    for (const p of PORTALS) {
      if (p.mesh && p.mesh.children[0]) {
        p.mesh.children[0].rotation.z += dt * 0.3; // rotate frame
      }
    }

    // Animate void cosmos
    if (voidCosmosApi && voidCosmosApi.tickCosmos) {
      voidCosmosApi.tickCosmos(dt);
    }

    // Update all Sovereign Void Realms
    const _tickTime = performance.now() / 1000;
    for (const cityGroup of _allSovereignCities) {
      if (cityGroup && cityGroup.userData && cityGroup.userData.update) {
        try { cityGroup.userData.update(_tickTime, dt); } catch(e) { /* silent */ }
      }
    }

    // Engine Optimizer LOD + GPU safeguard tick
    if (window.EngineOptimizer && camera) {
      window.EngineOptimizer.tick(camera.position);
    }

    // Tick Master Art Pass V2 (Hover traffic animation)
    if (window.GodforgeArtPassV2 && window.GodforgeArtPassV2.tick) {
      window.GodforgeArtPassV2.tick(dt);
    }
    if (window.StarCraftAsymmetricEngine && window.StarCraftAsymmetricEngine.tick) {
      window.StarCraftAsymmetricEngine.tick(dt);
    }
    // RTS-1 + RTS-2 + RTS-3: order executor first (so engine-core sees fresh
    // targets this frame), then selection rings
    if (window.RTSBridge && window.RTSBridge.tick) {
      window.RTSBridge.tick(dt);
    }
    // Fog of war refreshes before engine-core so applyFogVisibility uses fresh masks
    if (window.RTSFogOfWarInstance && window.RTSFogOfWarInstance.tick) {
      window.RTSFogOfWarInstance.tick(dt);
    }
    if (window.RTSEngineCore && window.RTSEngineCore.tick) {
      window.RTSEngineCore.tick(dt);
    }
    
    if (window.RTSEconomySystem && window.RTSEconomySystem.tick) {
      window.RTSEconomySystem.tick(dt);
    }
    
    if (window.RTSUIEngine && window.RTSUIEngine.tick) {
      window.RTSUIEngine.tick(dt);
    }
    if (window.RTSUICore && window.RTSUICore.tick) {
      window.RTSUICore.tick(dt);
    }
    if (window.RTSBaseBuilder && window.RTSBaseBuilder.tick) {
      window.RTSBaseBuilder.tick(dt);
    }
    if (window.RTSProductionSystem && window.RTSProductionSystem.tick) {
      window.RTSProductionSystem.tick(dt);
    }
    if (window.RTSGameState && window.RTSGameState.tick) {
      window.RTSGameState.tick();
    }
    if (window.GodPowersEngine && window.GodPowersEngine.tick) {
      window.GodPowersEngine.tick(dt);
    }
    // RTS-5 + RTS-6: minimap and palette ticks (after all entities move)
    if (window.__rtsMinimap && window.__rtsMinimap.tick) window.__rtsMinimap.tick(dt);
    if (window.RTSProductionPalette && window.RTSProductionPalette.tick) window.RTSProductionPalette.tick(dt);
    if (window.AdvancedNPCEngine && window.AdvancedNPCEngine.tick) {
      window.AdvancedNPCEngine.tick(dt);
    }
    
    if (window.RTSAIDirector && window.RTSAIDirector.tick) {
      window.RTSAIDirector.tick(dt);
    }
    if (window.RTSWarCommand && window.RTSWarCommand.tick) {
      window.RTSWarCommand.tick(dt);
    }

    // Tick RTS Subsystem & AI Factions
    if (window.RTSSubsystem && window.RTSSubsystem.tick) {
      window.RTSSubsystem.tick(dt);
    }
    if (window.RTSAIFaction && window.RTSAIFaction.tick) {
      window.RTSAIFaction.tick(dt);
    }
    if (window.RTSAIBrainInstance && window.RTSAIBrainInstance.tick) {
      window.RTSAIBrainInstance.tick(dt);
    }
  }

  function dispose() {
    // Dispose all sovereign cities
    for (const cityGroup of _allSovereignCities) {
      if (cityGroup && cityGroup.parent) cityGroup.parent.remove(cityGroup);
    }
    _allSovereignCities.length = 0;
    _warzoneCity = null;

    if (worldRoot.parent) worldRoot.parent.remove(worldRoot);
    if (voidCosmosApi && voidCosmosApi.disposeCosmos) {
      voidCosmosApi.disposeCosmos();
    }
    worlds.length = 0;
    PORTALS.length = 0;
  }

  function jumpToWorld(index) {
    const w = worlds[index];
    if (!w) return;
    const pos = w.position;
    // Try PlayerCam first
    const PlayerCam = (typeof window !== 'undefined' && window.Genesis && window.Genesis.PlayerCam);
    if (PlayerCam && PlayerCam.teleportTo) {
      PlayerCam.teleportTo({ x: pos.x, y: pos.y + 5, z: pos.z });
      return;
    }
    // Fallback: move camera directly
    const cam = camera;
    if (cam) {
      cam.position.set(pos.x + 30, pos.y + 20, pos.z + 30);
      cam.lookAt(pos.x, pos.y, pos.z);
    }
  }

  function buildTravelPanel() {
    if (document.getElementById('void-travel-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'void-travel-panel';
    panel.style.cssText = 'position:fixed;top:72px;right:20px;width:264px;background:rgba(6,10,22,0.88);border:1px solid rgba(102,255,255,0.22);border-radius:16px;padding:16px;z-index:35;font-family:Outfit,system-ui,sans-serif;pointer-events:auto;max-height:calc(100vh - 340px);overflow-y:auto;box-shadow:0 12px 40px rgba(0,0,0,0.55),0 0 24px rgba(80,200,255,0.08);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);scrollbar-width:thin;scrollbar-color:rgba(102,255,255,0.35) transparent;';

    // Grand Tower — highlighted first
    let html = '<div style="font-size:12px;color:#ffcc44;text-transform:uppercase;letter-spacing:3px;margin-bottom:10px;text-align:center;font-weight:700;">🏰 GRAND TOWER</div>';
    const towerWorld = worlds.find(w => w.type === 'grandtower');
    if (towerWorld) {
      const towerIdx = worlds.indexOf(towerWorld);
      const dist = Math.round(towerWorld.position.length());
      html += '<div onclick="window.__voidJump(' + towerIdx + ')" style="padding:10px 12px;margin-bottom:10px;background:linear-gradient(135deg,rgba(255,204,68,0.16),rgba(255,204,68,0.05));border:1px solid rgba(255,204,68,0.55);border-radius:10px;cursor:pointer;font-size:13px;color:#fff;display:flex;justify-content:space-between;align-items:center;transition:all 0.2s;font-weight:700;box-shadow:0 2px 12px rgba(255,204,68,0.12);" onmouseover="this.style.background=\'linear-gradient(135deg,rgba(255,204,68,0.3),rgba(255,204,68,0.1))\'" onmouseout="this.style.background=\'linear-gradient(135deg,rgba(255,204,68,0.16),rgba(255,204,68,0.05))\'">';
      html += '<span style="color:#ffcc44;">🏰 Grand Tower</span>';
      html += '<span style="font-size:11px;color:#ffcc44cc;font-weight:600;">' + dist + 'u</span>';
      html += '</div>';
    }

    // Separator
    html += '<div style="border-top:1px solid rgba(255,255,255,0.12);margin:10px 0;"></div>';
    html += '<div style="font-size:11px;color:#ff88cc;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px;text-align:center;font-weight:700;">🏛️ Sovereign Realms</div>';

    const sovereignRealms = [
      { name: 'Shattered Front', x: 900, y: 0, z: 300, color: '#ff4444' },
      { name: 'Obsidian Spire', x: 400, y: 0, z: 0, color: '#ff6600' },
      { name: 'Resonant Veil', x: -600, y: 0, z: 400, color: '#00ffcc' },
      { name: 'Solar Forge', x: -900, y: 0, z: -300, color: '#ffaa00' },
      { name: 'Bioluminescent Hive', x: 1200, y: 0, z: -500, color: '#00ff88' },
      { name: 'Neon Zenith', x: 600, y: 0, z: -800, color: '#ff00ff' },
      { name: 'Iron Foundry', x: -800, y: 0, z: -600, color: '#ff6600' },
      { name: 'Aetherium Skylands', x: 1500, y: 0, z: 0, color: '#4488ff' },
      { name: 'Elysian Vault', x: 1000, y: 0, z: -1200, color: '#ffdd44' },
      { name: 'Astral Spire', x: 0, y: 0, z: 1200, color: '#00ffcc' },
      { name: 'Quantum Rift', x: -1200, y: 0, z: -1200, color: '#8800ff' },
      { name: 'Chronos Temple', x: 300, y: 0, z: -1500, color: '#ffdd88' },
      { name: 'Glacial Matrix', x: -1500, y: 0, z: 300, color: '#aaddff' },
      { name: 'Abyssal Trench', x: 0, y: -40, z: -1800, color: '#00ff66' },
      { name: 'Hyperion Array', x: -1000, y: 0, z: 1500, color: '#ffff00' },
      { name: 'Titan Graveyard', x: 1800, y: 0, z: 600, color: '#ff8800' },
      { name: 'Rift Warzone', x: 800, y: 0, z: 1000, color: '#4488ff' },
      { name: 'Vortex Siege', x: -1600, y: 0, z: -800, color: '#cc4444' },
      { name: 'Genesis Citadel', x: 0, y: 0, z: -2200, color: '#ffcc44' },
      { name: 'Omega Crucible', x: 2000, y: 0, z: 0, color: '#44aaff' },
      { name: 'Sovereign Marketplace', x: -400, y: 0, z: -900, color: '#ffd700' }
    ];

    for (let i = 0; i < sovereignRealms.length; i++) {
      const r = sovereignRealms[i];
      const dist = Math.round(Math.sqrt(r.x*r.x + r.z*r.z));
      html += '<div onclick="window.__voidJumpPos(' + r.x + ',' + (r.y+20) + ',' + r.z + ')" style="padding:8px 10px;margin-bottom:5px;background:rgba(255,255,255,0.05);border:1px solid ' + r.color + '55;border-radius:8px;cursor:pointer;font-size:12.5px;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:8px;transition:all 0.2s;line-height:1.3;" onmouseover="this.style.background=\'rgba(255,255,255,0.14)\';this.style.borderColor=\'' + r.color + '\'" onmouseout="this.style.background=\'rgba(255,255,255,0.05)\';this.style.borderColor=\'' + r.color + '55\'">';
      html += '<span style="color:' + r.color + ';font-weight:600;white-space:normal;flex:1;min-width:0;overflow-wrap:break-word;">' + r.name + '</span>';
      html += '<span style="font-size:10.5px;color:#99aabb;flex-shrink:0;">' + dist + 'u</span>';
      html += '</div>';
    }

    // Separator
    html += '<div style="border-top:1px solid rgba(255,255,255,0.12);margin:10px 0;"></div>';
    html += '<div style="font-size:11px;color:#66ffff;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px;text-align:center;font-weight:700;">⚡ Lost Worlds</div>';

    for (let i = 0; i < worlds.length; i++) {
      const w = worlds[i];
      if (w.type === 'grandtower') continue; // skip tower, already shown above
      const color = '#' + (TYPE_COLORS[w.type] || 0x66ffff).toString(16).padStart(6, '0');
      const dist = Math.round(w.position.length());
      html += '<div onclick="window.__voidJump(' + i + ')" style="padding:7px 10px;margin-bottom:5px;background:rgba(255,255,255,0.04);border:1px solid ' + color + '44;border-radius:8px;cursor:pointer;font-size:12px;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:8px;transition:all 0.2s;line-height:1.3;" onmouseover="this.style.background=\'rgba(255,255,255,0.12)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.04)\'">';
      html += '<span style="color:' + color + ';white-space:normal;flex:1;min-width:0;overflow-wrap:break-word;">' + w.name + '</span>';
      html += '<span style="font-size:10px;color:#778899;flex-shrink:0;">' + dist + 'u</span>';
      html += '</div>';
    }
    html += '<div style="font-size:10px;color:#8899aa;text-align:center;margin-top:10px;letter-spacing:1px;">Click a realm or world to jump</div>';
    panel.innerHTML = html;
    document.body.appendChild(panel);
    // Wire jump functions
    if (typeof window !== 'undefined') {
      window.__voidJump = (i) => jumpToWorld(i);
      window.__voidJumpPos = (x, y, z) => {
        const PlayerCam = window.Genesis && window.Genesis.PlayerCam;
        if (PlayerCam && PlayerCam.teleportTo) {
          PlayerCam.teleportTo({ x, y, z });
        } else if (camera) {
          camera.position.set(x + 40, y + 25, z + 40);
          camera.lookAt(x, y, z);
        }
      };
    }
  }

  const api = {
    populate,
    tick,
    dispose,
    jumpToWorld,
    buildTravelPanel,
    worlds: () => worlds.map(w => ({ name: w.name, type: w.type, plt: w.plt, position: { x: w.position.x, y: w.position.y, z: w.position.z }, active: w.active })),
    summary: () => ({
      enabled: flagOn(),
      worldCount: worlds.length,
      activeWorlds: worlds.filter(w => w.active).length,
      portals: PORTALS.length
    })
  };

  Genesis.VoidPopulation = api;

  if (Genesis.EngineScheduler && typeof Genesis.EngineScheduler.defineTick === 'function') {
    Genesis.EngineScheduler.defineTick('void-population', (dt) => tick(dt), () => flagOn());
  }

  return api;
}

export default { install };
