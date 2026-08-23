# VOID EXPLORATION — Complete Journal

## Project Identity

- **Repo:** `C:\Users\uncom\Desktop\buyasoul-cpl-fresh`
- **GitHub:** `https://github.com/buyasoul-ai/buyasoul-cpl.git` (branch: `publish`)
- **GitHub Pages (3D world):** `https://buyasoul-ai.github.io/buyasoul-cpl/`
- **Local server (2D map + API):** `http://localhost:3458/`
- **Dead ports:** 3456 stuck (can't kill, access denied); 3457 squatted by `host/genesis-host.cjs` (GSK/MCP bridge — serves no static files). Use 3458.
- **Stack:** Three.js (r128 importmap), vanilla JS, Node.js http server

---

## File Map

| File | Role | Where it runs |
|------|------|---------------|
| `index.html` | 3D Mystical Library | GitHub Pages (DO NOT EDIT) |
| `src/genesis/void-population.js` | **3D world builder** — 14 worlds at explicit coords | GitHub Pages |
| `void-map.html` | **2D map canvas** — interactive coords + task markers | Local server |
| `void-tasks-live.json` | **Server task store** — persisted via API | Local server |
| `server.js` | HTTP server + REST API (`/api/tasks`) | Local server |
| `LOST-MECHANICS-BIBLE.md` | **The Bible** — 12 archetypes with colors, quests, denizens | doc |
| `VOID-COORDINATES.md` | Coordinate reference | doc |
| `AGENTS.md` | Agent workflow guide (process tasks → build → push) | doc |
| `src/genesis/void-cosmos.js` | Sky dome, stars, nebulae | GitHub Pages |
| `FOUNDATION.md` | Base render pipeline lock | doc |
| `DIRECTIVE-C4.1.md` | Interaction layer directive | doc |
| `GRAPHICS-BASE-MODEL.md` | Graphics tuning reference | doc |
| `SUMMARY.md` | Underworld/shaft build summary | doc |

---

## Coordinate System

### Zones

| Range | Zone | Rules |
|-------|------|-------|
| 0–360u | **NO-BUILD ZONE (CPL Territory)** | ABSOLUTELY NOTHING. Origin city only. |
| 360–600u | **Lost Mechanics Ring** | 3 LM cities + New City |
| 600–3000u | **Lost Worlds Ring** | 10 Worlds (Neon Citadel through Phantom Spire) |
| 3000–5000u | Outer Void | OK for subtle/dark elements |
| 5000–8000u | Deep Void | Good for bright/large structures |
| 8000u+ | Far Void | Any scale, won't affect city |

### All 14 Placed Coordinates

```
# Lost Mechanics Ring (360–600u)
LM I:   (-490,   0,   59)   494u   Physics Gate
LM II:  (-360,   0,  -21)   361u   Arena Core
LM III: (-218,   0, -288)   361u   Soul Home
 13:    ( 313,   0,  179)   361u   New City (CPL clone)

# Lost Worlds Ring (600–3000u)
  0:   ( 2090,  39.6,  221)  2102u   Neon Citadel    — combat
  1:   ( 2301,  19.1,  632)  2386u   Shadow Forge     — crafting
  2:   (  400,   0,    400)   566u   Crystal Nexus    — trading
  3:   (  -23, -27.3, 1409)  1409u   Void Empire      — exploration
  4:   ( -976, -22.6,  510)  1101u   Ember Sanctum    — breeding
  5:   ( -589,   0,   -118)   601u   Frost Wilds      — governance
  6:   (-2211, -14.1, -567)  2282u   Storm Hub        — economy
  7:   (-1048,  -8.8,-2792)  2982u   Soul Arena       — building
  8:   ( 1553,  17.3,-2135)  2640u   Cosmic Garden    — conversation
  9:   ( 1152,  32.5, -561)  1282u   Phantom Spire    — districts
```

### Axis Convention
- **X** = horizontal (positive = right / East)
- **Y** = height (ground = 0)
- **Z** = depth (positive = forward / North / away from city)
- Pitch: `atan2(z, x)` → degrees clockwise from +X axis

---

## Lost Mechanics Archetypes (The Bible)

See `LOST-MECHANICS-BIBLE.md` for the complete reference. Quick summary:

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

---

## 2D Map (void-map.html) — How It Works

### What It Does
- Renders a 2D top-down canvas view of the entire void coordinate system
- Shows builtins (CPL City, Pyramidion), all 14 worlds, and user task markers
- Draws grid lines every 500u, concentric rings (360, 500, 1000, 2000, 3000, 5000, 8000)
- Displays direction labels (N/S/E/W) and mouse crosshair with live coordinates

### Interaction
- **Click empty space** → direct opens task editor with coordinates pre-filled
- **Click a marker** → selects it, highlights in sidebar
- **Double-click user marker** → starts drag mode (move marker)
- **Scroll wheel** → zoom in/out

### Fixes Applied (Jul 2026)
1. **`editorOpenFromClick()` bug** — was passing fake marker with new ID → save silently failed. Fixed: calls `editorOpen(null)` then fills coords.
2. **Click empty space now opens editor** — was just updating coord display, now opens editor directly.
3. **Server sync added** — after save/delete/clear/import/drag, markers POST to `/api/tasks` → persisted to `void-tasks-live.json`.
4. **Server load on init** — on page load, fetches tasks from server and merges into local markers.

### Data Storage
- **Browser localStorage:** `void-map-markers` key — immediate local persistence
- **Server JSON:** `void-tasks-live.json` — cross-session persistence via API
- Both synced: save → localStorage + POST /api/tasks | load → localStorage + GET /api/tasks

---

## 3D World (void-population.js) — How It Works

### Architecture
- ES module, installed via `Genesis.VoidPopulation`
- Creates 14 world positions (index 0–13) using `WORLD_COORDINATES` array
- Flag-gated by `window.__GENESIS_VOID_POPULATION` (default ON)

### No-Build Zone Validation
```js
function getWorldPosition(index, rng) {
  const coords = WORLD_COORDINATES[index];
  const dist = Math.sqrt(x² + z²);
  if (dist < 360) → fallback to 360*1.1u ring
}
```

### What Each World Gets
1. **Beacon** — ground platform + glow ring + pillar + orb (always visible)
2. **City skeleton** — standard for worlds 0–12, `createCPLCloneCity` for world 13 (New City)
3. **Quest beacon** — floating quest text marker
4. **Denizens** — 3 NPCs with colored bodies, eyes, name labels
5. **Portal connections** — each world connects to next via portal beams
6. **(optional) RealmWorld.Realm** — full procedural realm if available

### CPL Clone City (New City at index 13)
- 4 districts, each themed by a random LM archetype (from the 12)
- 7x7 road grid (CPL-style grid layout)
- Procedural buildings in 4 shapes: box, cylinder, tapered ziggurat, stacked
- Window glow strips, caps, antenna spires on tall buildings
- 2 outer rings of support buildings (80u, 110u radius)
- Central beacon beam with orb, halo, point light (cyan accent)
- Ambient particles + atmosphere dome

### Coordinate Source
All coordinates in `WORLD_COORDINATES` match the `WORLDS` array in `void-map.html`.
They are NOT random — they are the explicit planned positions from VOID-COORDINATES.md.

---

## Server API

### Base: `http://localhost:3458/`

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| GET | `/api/tasks` | — | `marker[]` |
| POST | `/api/tasks` | `{ tasks: marker[] }` | `{ ok, count }` |
| DELETE | `/api/tasks` | — | `{ ok }` |
| GET | `/` | — | `void-map.html` |
| GET | `/*.html` | — | static file |

### Task/Marker Schema
```json
{
  "id": 100,
  "name": "task name",
  "desc": "description",
  "x": 313,
  "y": 0,
  "z": 179,
  "color": "#66ffff"
}
```

---

## Rules (Do Not Loop)

1. **NEVER touch CPL code** — `index.html`, city scene, lights, fog, sky, bloom
2. **NEVER place anything inside 0–360u** (no-build zone)
3. **Always check the map** (`http://localhost:3458/`) before placing new content
4. **Coordinates must match** between `void-map.html` WORLDS and `void-population.js` WORLD_COORDINATES
5. **3D world = GitHub Pages** — changes to `void-population.js` need commit + push to `origin/publish`
6. **2D map = local server** — `void-map.html` runs on `localhost:3458` via `node server.js`
7. **Lost Mechanics cities** are indices 0–2 (the bible types)
8. **Lost Worlds** are indices 3–12 (the 10 original types)
9. **New City** is index 13 (CPL clone, LM bible randomized)
10. **New content** must be at ≥ 360u from origin
11. **All placed content** must be documented in this journal

---

## THE WORKFLOW (Process a Task from Map to Live)

**Step 1:** User clicks task on map at `http://localhost:3458/` → saves to `void-tasks-live.json`

**Step 2:** Agent reads `void-tasks-live.json` — understands name, position, description. **Verifies position is outside 0–360u no-build zone.**

**Step 3:** Agent confirms understanding with user before building.

**Step 4:** Agent builds. For a new world:
- Increment `WORLD_COUNT`, add position to `WORLD_COORDINATES`
- Add config to `WORLD_CONFIG`, type to `TYPES`, color to `TYPE_COLORS`, quest to `TYPE_QUESTS`, denizen names to `TYPE_DENIZEN_NAMES`
- If custom builder needed, add function before `populate` + conditional in populate loop
- Update `void-population.js`

**Step 5:** Update `void-map.html` — add to `WORLDS` array + `TYPE_COLORS`

**Step 6:** Commit and push:
```
git add src/genesis/void-population.js void-map.html
git commit -m "Describe what was built and where"
git push origin publish
```

**Step 7:** Verify — 3D world at `https://buyasoul-ai.github.io/buyasoul-cpl/` updates in ~1-2 min. 2D map at `http://localhost:3458/` updates immediately.

---

## Task History (Live)

| Name | Position | Description | Status |
|------|----------|-------------|--------|
| new city | (313, 0, 179) ~361u | clone of CPL randomized using LM bible | ✅ BUILT & PUSHED |

---

*Last updated: 2026-07-27 · See also: AGENTS.md, LOST-MECHANICS-BIBLE.md*
