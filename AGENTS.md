# AGENTS.md — buyasoul-cpl-fresh

## Project
- **Repo:** `C:\Users\uncom\Desktop\buyasoul-cpl-fresh`
- **GitHub:** `https://github.com/buyasoul-ai/buyasoul-cpl.git` (branch: `publish`)
- **GitHub Pages (3D world):** `https://buyasoul-ai.github.io/buyasoul-cpl/`
- **Mirror (dual-home):** `uncommonpope-png/WORKBENCH` → `cpl/world/` — snapshot of this repo's `publish` branch. After every push to origin, mirror the same tree into WORKBENCH master. The WORKBENCH `cpl/` host-bridge files (genesis-host.cjs etc.) are a separate service and must not be replaced.
- **Local server (2D map + API):** `http://localhost:3458/`
- **Stack:** Three.js r160, vanilla JS, Node.js http
- **Modules:** 148 files in `src/genesis/` (24 worlds, 21 sovereign cities, RTS modules incl. fog/subsystem/AI brain, city clock, daily life loop)

---

## CRITICAL RULES
1. **NEVER place anything inside 0–360u** (NO-BUILD ZONE / CPL Territory)
2. **NEVER touch `index.html` city rendering code** (the CPL city scene, lights, fog, sky, bloom, shaders). Adding `<script>` tags for new modules, HUD elements, and THREE global load is allowed and required.
3. Lost Mechanics ring = 360–600u, Lost Worlds ring = 600–3000u
4. Coordinates must match between `void-map.html` WORLDS and `void-population.js` WORLD_COORDINATES
5. Always check the map at `http://localhost:3458/` before placing new content
6. **3D world = GitHub Pages** — changes to `void-population.js` must be committed and pushed to `origin/publish`
7. **2D map = local server** — `void-map.html` runs on `http://localhost:3458/` via `node server.js`
8. Old port 3456 has a stuck process (can't kill) and 3457 is squatted by `host/genesis-host.cjs` (GSK/MCP bridge — serves no static files). Always use 3458.
9. When the user says they can't see the 3D world, they mean GitHub Pages — push changes live

---

## Coordinate System
| Range | Zone | Content |
|-------|------|---------|
| 0–360u | NO-BUILD | ABSOLUTELY NOTHING |
| 360–600u | Lost Mechanics Ring | 3 LM cities + New City (CPL clone) + Grand Tower |
| 600–3000u | Lost Worlds Ring | 10 original worlds + 4 expansion cities |
| 3000–5000u | Outer Void | Stormhold Castle, Cosmic Colosseum, Obsidian Spire, Verdant Coil, Solar Spire |
| 5000–8000u | Deep Void | Subtle/dark elements |
| 8000u+ | Far Void | Any scale |

## All 24 Coordinates
```
# Lost Mechanics Ring (360–600u)
LM I:   Physics Gate   (-490,   0,   59)   494u — physics
LM II:  Arena Core     (-360,   0,  -21)   361u — arena
LM III: Soul Home      (-218,   0, -288)   361u — soulhome
New:    New City       ( 313,   0,  179)   361u — cplclone (LM bible randomized)
GT:     Grand Tower    (-104,   0,  401)   414u — cosmic nexus

# Lost Worlds Ring (600–3000u)
 0: Neon Citadel    ( 2090,  39.6,  221)  2102u — combat
 1: Shadow Forge    ( 2301,  19.1,  632)  2386u — crafting
 2: Crystal Nexus   (  400,   0,    400)   566u — trading/refactored
 3: Void Empire     (  -23, -27.3, 1409)  1409u — exploration
 4: Ember Sanctum   ( -976, -22.6,  510)  1101u — breeding
 5: Frost Wilds     ( -589,   0,   -118)   601u — governance/PLT Engine
 6: Storm Hub       (-2211, -14.1, -567)  2282u — economy
 7: Soul Arena      (-1048,  -8.8,-2792)  2982u — building
 8: Cosmic Garden   ( 1553,  17.3,-2135)  2640u — conversation
 9: Phantom Spire   ( 1152,  32.5, -561)  1282u — districts
Expansion: Abyssal Market    ( 2200,  12.5,  1800)  2846u — trade
Expansion: Sunken Archive    (-1800,  -6.2,  2100)  2772u — knowledge
Expansion: Radiant Foundry   ( 2600,   8.0, -1200)  2872u — industry
Expansion: Hollow Court      (-1500,   4.5, -2300)  2758u — governance

# Outer Void (3000–5000u)
SC: Stormhold Castle   ( 3800,   0,    0)  3800u — military
CC: Cosmic Colosseum  (    0,   0,-4000)  4000u — arena
OS: Obsidian Spire    ( 3100,   0,  900)  3208u — military
VC: Verdant Coil      (-2600,   0, -900)  2758u — bio-lab
SS: Solar Spire       (    0,   0, 4200)  4200u — energy
```
```

---

## Lost Mechanics Archetypes (12-Type Bible)

| Type | Color | Quest |
|------|-------|-------|
| physics | `#aa66ff` | Master Momentum Fields |
| gacha | `#ff66cc` | Complete a full collection |
| evolve | `#66ff88` | Evolve to Apex Form |
| typeadv | `#ff8844` | Master all 12 types |
| arena | `#ff3355` | Defeat the Pantheon Champion |
| idle | `#00ffaa` | 24-hour automation |
| prestige | `#ffdd00` | Ascend 3 times |
| pantheon | `#4488ff` | Gain favor with all 12 Deities |
| soulhome | `#ffaa00` | Build perfect sanctuary |
| persona | `#00ffcc` | Create a perfect companion |
| economy | `#00ffaa` | Trigger PLT market boom |
| achievement | `#ff7722` | Complete all 12 Lost Mechanics |

Denizen names per type: see `void-population.js` lines 96–119

---

## File Map
| File | Role | Where it runs |
|------|------|---------------|
| `index.html` | 3D Mystical Library — main page | GitHub Pages (DO NOT EDIT city code) |
| `src/genesis/void-population.js` | 3D world builder — 24 worlds + 21 sovereign cities | GitHub Pages |
| `void-map.html` | Interactive 2D coordinate map + task editor | Local server |
| `void-tasks-live.json` | Server-persisted task store | Local server |
| `server.js` | HTTP server with `/api/tasks` GET/POST/DELETE | Local server |
| `src/genesis/*.js` (148 files) | Genesis engine modules | GitHub Pages / Local server |
| `VOID-COORDINATES.md` | Coordinate reference | doc |
| `VOID-EXPLORATION.md` | Full journal with everything | doc |
| `LOST-MECHANICS-BIBLE.md` | 12 archetypes + 50 RTS mechanics soul notes | doc |
| `HANDOFF-SOVEREIGN-CITIES.md` | Sovereign cities integration guide | doc |
| `SUMMARY.md` | Underworld/shaft build summary | doc |
| `AGENTS.md` | This file — agent workflow guide | doc |

## Sovereign Void Realms (21 Cities — Lego Snap-On Pattern)

**Architecture:** Data-driven spawn system in `void-population.js`. The `_sovereignCityDefs` array (21 entries) maps `window.spawn<Name>(scene, opts)` → `THREE.Group` with `userData.update(time, dt)`. The spawn loop checks `typeof window[def.fn] === 'function'` — guarded, additive, safe. Each city is a standalone `.js` file loaded via `<script>` tag in `index.html` (lines 998–1058).

**Cities (in order of spawn):** Shattered Front, Obsidian Spire, Resonant Veil, Solar Forge, Bioluminescent Hive, Neon Zenith, Iron Foundry, Aetherium Skylands, Elysian Vault, Astral Spire, Quantum Rift, Chronos Temple, Glacial Matrix, Abyssal Trench, Hyperion Array, Titan Graveyard, Rift Warzone, Vortex Siege, Genesis Citadel, Omega Crucible, Sovereign Marketplace.

**Integration pattern (per city):**
1. Script tag in `index.html` (before `void-population.js` module import)
2. `void-population.js` checks `typeof window[def.fn] === 'function'`
3. Calls `window[def.fn](scene, opts)` → stores result in `_allSovereignCities`
4. Tick loop calls `cityGroup.userData.update(time, dt)` per frame
5. Dispose removes all cities from scene

**THREE global:** `index.html` loads `three@0.160.0` as both ES module (importmap) and classic script (`three.min.js` + `window.THREE = THREE`) so sovereign city files can use `THREE` from global scope.

## RTS / Age of Empires II Integration (Live on `d43ebbb`)

**15 RTS modules** loaded as classic `<script>` tags in `index.html`: `rts-engine-core`, `rts-fog-of-war`, `rts-economy-system`, `rts-farm-system`, `rts-base-builder`, `rts-order-executor`, `rts-nav-grid`, `rts-input-router`, `rts-ui-engine`, `rts-game-state`, `rts-production-system`, `rts-ai-director`, `rts-war-command`, `rts-subsystem`, `rts-ai-brain`. Plus `starcraft-asymmetric-factions.js`.

**Disabled (do not enable):** `rts-ai-faction.js` — spawns autonomous commanders that conflict with `RTSAIDirector` + `RTSAIBrain`.

**RTS tick integration in `void-population.js`:** Sovereign city centers registered as town halls with `VoidRTSBuildings`. `RTSEngineCore.tick(dt)` called in the main tick loop (bridge before engine order). Fog of war (`window.RTSFogOfWarInstance`, player 0 = voidCovenant vision), economy system, base builder wired. `RTSAIBrainInstance` (imperium + bioHive, fog-limited zero-cheat AI) installed with `{ entities, fog: window.RTSFogOfWarInstance, playerIndex: 1 }` and ticked after war-command.

**AoE II mechanics study:** Complete (50 mechanics soul notes in `LOST-MECHANICS-BIBLE.md`). Covers SC2 lockstep sim, WC3 trigger system (E-C-A), AoE2 3-tier pathfinding, damage pipelines, unit commands, formations, etc.

## City Clock + Daily Life Loop (Uncommitted)

- `city-clock.js` — 24h day/night cycle, drives hemi light intensity (mood bridge owns hue)
- `daily-life-loop.js` — NPC professions + home/work/social anchors
- `#gsk-city-clock-chip` HUD element in `index.html` (phase-aware: day/dawn/dusk/night)
- `window.__genesisLights` exposes hemi/sun for clock control

**Workflow addition for sovereign cities:**
1. User places a task on 2D map → saves to `void-tasks-live.json`
2. Agent reads task, verifies position is outside 0–360u no-build zone
3. Agent confirms understanding with user
4. Agent builds city file → adds script tag to `index.html`
5. Agent adds entry to `_sovereignCityDefs` array in `void-population.js`
6. Commit + push to `origin/publish` → GitHub Pages rebuilds in ~1-2 min
7. Verify on live site + 2D map

---

## THE WORKFLOW (process a task from map to live)

This is the exact process used to build the New City. Follow it every time.

### Step 1: User places a task on the 2D map
- User opens `http://localhost:3458/` in their browser
- Clicks on the map → editor opens with coordinates pre-filled
- Fills in name + description → clicks Save
- Task is saved to `void-tasks-live.json` via `POST /api/tasks`

### Step 2: Agent reads the task
- Read `void-tasks-live.json` (or `curl.exe http://localhost:3458/api/tasks`)
- Understand the name, position (x, y, z), and description
- **Verify the position is outside 0–360u no-build zone**
- Example: `(313, 0, 179)` → dist = sqrt(313² + 179²) ≈ 361u ✅

### Step 3: Agent confirms understanding with user
- State the task name, position, and what the user wants
- Get confirmation before building

### Step 4: Agent builds into void-population.js
- **If it's a new world** (not replacing an existing one):
  1. Increment `WORLD_COUNT` (line 10)
  2. Add position to `WORLD_COORDINATES` (around line 37)
  3. Add config to `WORLD_CONFIG` (around line 54)
  4. Add type to `TYPES` array (around line 57)
  5. Add type color to `TYPE_COLORS` (around line 59)
  6. Add type quest to `TYPE_QUESTS` (around line 70)
  7. Add denizen names to `TYPE_DENIZEN_NAMES` (around line 95)
  8. If it needs a custom builder (like `createCPLCloneCity`), add the function before `populate`
  9. In the populate loop (around line 955), add a conditional: `type === 'cplclone' ? createCPLCloneCity(pos, rng) : createCitySkeleton(pos, type, rng)`
- **If it replaces or modifies an existing world**: update the relevant entry in WORLD_COORDINATES and WORLD_CONFIG

### Step 5: Update the 2D map (void-map.html)
- Add the new world to the `WORLDS` array (around line 141) with its type, position, distance, angle
- Add the type color to `TYPE_COLORS` (around line 143)
- This ensures the marker appears on the 2D map

### Step 6: Commit and push to GitHub Pages
```bash
git add src/genesis/void-population.js void-map.html
git commit -m "Describe what was built and where"
git push origin publish
```
- Only `void-population.js` and `void-map.html` are needed for the live site
- The 3D world updates on GitHub Pages after ~1-2 minutes
- The 2D map updates immediately on the local server (restart if needed)

### Step 7: Verify the deployment
- The 3D world at `https://buyasoul-ai.github.io/buyasoul-cpl/` should have the new content
- The 2D map at `http://localhost:3458/` should show the new marker
- Tell the user it's live

---

## CPL Clone City Template (created following this workflow)

When the user asks for a "CPL clone randomized by LM bible":

1. Add a `createCPLCloneCity(pos, rng)` function — builds a CPL-inspired city with:
   - 4 districts each themed by a random LM archetype (physics, gacha, evolve, etc.)
   - 7x7 road grid (like CPL)
   - Procedural buildings in 4 shapes: box, cylinder, tapered ziggurat, stacked
   - Window glow strips, caps, antenna spires
   - 2 outer rings of support buildings
   - Central beacon beam with orb, halo, point light
   - Ambient particles + atmosphere dome
2. Add it as world #14 (index 13) in the populate loop

---

## How the Map + Task System Works
- **Open** `http://localhost:3458/` → click on map → editor opens with coords pre-filled
- **Save** → syncs to `void-tasks-live.json` via `POST /api/tasks`
- **Read tasks** → check `void-tasks-live.json` or `GET /api/tasks`
- **Data flow:** save → localStorage + POST /api/tasks | load → localStorage + GET /api/tasks
- **Agent reads** `void-tasks-live.json` directly or via the API

---

## Current Tasks (from void-tasks-live.json)
- **new city** at (313, 0, 179) ~361u — clone of CPL randomized using LM bible ✅ BUILT + PUSHED
- **RTS AoE II integration** — 13 modules wired, 2 commented out (rts-subsystem, rts-ai-faction). Push uncommitted index.html changes (city clock HUD, THREE global, sovereign city script tags, RTS farm tick, syntax fixes). Verify all 21 sovereign cities spawn on live site.
- **City Clock + Daily Life Loop** — uncommitted. Needs push + verify on GitHub Pages.
- **True Goal Plan** — ✅ Written: `CPL-TRUE-GOAL.md`. 6 phases: Stabilize (push/commit), Fix telemetry bug (`window.sovereignCities` → expose `_allSovereignCities`), Enable RTS Subsystem + AI Faction, Complete AoE II RTS integration (fog of war, economy, base building, unit commands, formations), City Clock + Daily Life Loop, Verification on live site.
