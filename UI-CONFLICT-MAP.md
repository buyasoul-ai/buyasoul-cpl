# CPL UI Conflict Map — All UI Systems, What They Do, Where They Clash

> Status: Compiled 2026-08-22
> Scope: RTS + CPL HUD + Genesis overlay DOM systems
> Goal: One canonical document of every UI element, event handler, and conflict point

---

## 1. UI SYSTEM INVENTORY (37 DOM-creating files)

### 1.1 RTS UI Stack (11 files, 5 layers)

| File | DOM Created | zIndex | Purpose | Priority |
|------|------------|--------|---------|----------|
| `rts-input-router.js:78` | `#rts-router-box` | 9000 | Unified drag-box + raycast point | Input (router) |
| `rts-selection.js:457` | `#rts-drag-box` | 9998 | Drag-box selection visual | Selection |
| `rts-subsystem.js:103,535` | `#rts-selection-box` + `#rts-hud` | 9000/8999 | SC2-style drag select + selection HUD | Subsystem (old) |
| `rts-ui-core.js:28` | `#rts-economy-hud` + hidden `#plt-value` | 100 | PLT resource economy HUD (top-center) | UI Core |
| `rts-production-palette.js:102,127` | `#rts-prod-bar` + `#rts-prod-info` | 105 | Bottom production bar (15 slots) | Production |
| `rts-base-builder.js:85` | `#rts-build-menu` | 110 | Build menu (top-right, 6 buttons) | Building |
| `rts-war-command.js:31,44` | `#rts-war-alert` + `#rts-war-arrow` | 120/119 | Wave alert banner + compass arrow | War Events |
| `rts-game-state.js:37` | `#rts-gameover-overlay` | 99999 | Full-screen win/lose overlay | Game State |
| `rts-minimap.js:78,94` | 256px `<canvas>` | ? | Minimap with fog overlay | Info |
| `rts-order-generator.js` | No DOM (registers handlers) | — | Order generation (move/attack/build) | Input |
| `rts-ui-engine.js` | Health bar DOM (inline) | ? | Health bars + NPC glue | UI Layer |

### 1.2 CPL / Hub HUD (pre-existing in index.html + some scripts)

| Element | File | Position | zIndex | Purpose |
|---------|------|----------|--------|---------|
| `#intro-overlay` | index.html:16073 | center-fullscreen | 1000+ | Boot screen (enter button) |
| `#loader-overlay` | index.html:15921 | center | high | Loader bar during boot |
| `#nav-hud` | index.html:15883 | bottom | ? | Compass + nav buttons (SCRIBE/MARKET/BUILD/etc.) |
| `#genesis-pill` | index.html:16007 | top-right | ? | Boot/telemetry diagnostics |
| `#scroll-loader` | index.html:16114 | center | high | Guided flight overlay |
| `#objective` | index.html:16105 | top | ? | Current objective text |
| `#gsk-city-clock-chip` | index.html:779 | bottom-left-ish | ? | Day/night phase indicator |

### 1.3 Godforge / Genesis UI (5 files)

| File | DOM Created | zIndex | Purpose |
|------|------------|--------|---------|
| `god-powers-toolbar.js:21` | `#godforge-god-powers-bar` | ? | God powers toolbar |
| `godforge-ui-dashboard.js:337` | `#gf-dashboard-overlay` + many IDs | ? | Analytics dashboard with widgets |
| `godforge-art-pass-v2.js:46` | `<canvas>` | — | Art pass effects canvas |
| `void-building-panel.js:29` | `#void-building-panel` (inline) | ? | Building inspection panel |
| `story-quest-system.js:60` | `#story-quest-modal` | ? | Quest dialogue modal |

### 1.4 Canvas-Only Systems (no HTML, pure WebGL overlays)

| File | Canvas Purpose |
|------|----------------|
| `procedural-art-engine.js` | Procedural art rendering |
| `soul-multiverse-visualizer.js` | Multiverse visualization |
| `void-cosmos.js` | Cosmic background |
| `void-building-textures.js` | Texture atlasing |
| `bifrost-pyramids.js` | Pyramid rendering |
| `realm-world.js` | Realm combat canvas |
| `rts-farm-system.js:23` | Farm visualization canvas |
| `godforge-art-pass-v3-omnibus.js` | Omnibus art pass |
| `terminal-sanctum.js:34` | Terminal UI canvas |
| `multiverse-hub.js:17,38` | Multiverse hub canvas |
| `multiverse-world.js:27` | Multiverse world canvas |

---

## 2. CRITICAL CLASHES

### C1: Three Competing Selection Systems

| System | Source of Truth | Faction String | Units Tracked | Status |
|--------|----------------|----------------|---------------|--------|
| **rts-subsystem.js** | `allUnits[]` (local array, line 34) | `'player'` (line 162, 636, 653, 706) | Units registered via `registerUnit()` (line 701), flagged with `mesh._rtsUnit` | **ENABLED** (script tag active) |
| **rts-selection.js** | `RTSSelection.ids = Set()` (line 37) | `'player'` (line 99, 131) | Reads from `RTSEngineCore.ENTITIES` by entityId | Loaded but **install() never called** in void-population.js |
| **rts-ui-core.js** | `UI_STATE.selection = Set()` (line 7) | Not faction-specific | Selection state only, no unit logic | **INSTALLED** (line 3990-3991) |

**CLASH**: subsystem uses `faction === 'player'` but RTSEngineCore entities use `faction: 'voidCovenant'`. This means:
- Box selection in subsystem only selects units with `faction === 'player'` — **zero units match** since AdvancedNPCEngine registers with `'voidCovenant'`
- The selection HUD (`#rts-hud` at zIndex 8999) overlaps with the production palette (`#rts-prod-bar` at zIndex 105) at screen bottom
- rts-selection.js's `RTSSelection` class is never installed/used — dead code

### C2: Two Production Systems

| System | Unit Source | Register Method | Faction Used | Output |
|--------|------------|-----------------|--------------|--------|
| **rts-subsystem.js** (UNIT_DEFS) | Local `allUnits[]`, `registerUnit()` | Never calls RTSEngineCore.registerEntity | `'player'` | Units exist only in subsystem's local array |
| **rts-production-palette.js** | Calls `RTSEngineCore.registerEntity()` (line 296) | Direct RTSEngineCore registration | `building.faction` (voidCovenant/imperium) | Units exist in engine core, fog-affected |

**CLASH**: Two separate unit pools. Subsystem units are invisible to RTSEngineCore (and vice versa). No shared unit registry. Production palette units get fog visibility; subsystem units don't.

### C3: Three Drag-Box Overlays

| Element | File | zIndex | Created By | Active? |
|---------|------|--------|------------|---------|
| `#rts-router-box` | rts-input-router.js:78 | 9000 | InputRouter.ensureBoxEl() | Yes (router handles all drags) |
| `#rts-selection-box` | rts-subsystem.js:103 | 9000 | Subystem.createSelectionBoxOverlay() | Yes (subsystem registers as boxSelector) |
| `#rts-drag-box` | rts-selection.js:457 | 9998 | RTSSelection._createDragBoxEl() | Yes (if installed) |

**CLASH**: All three at zIndex 9000+ compete for the same screen space. The input router's box (priority-based) calls registered boxSelectors including subsystem's. Selection.js's box is never cleaned up.

### C4: Two AI Systems — No Shared State

| System | Units | Economy | Combat | Faction | Position |
|--------|-------|---------|--------|---------|----------|
| **rts-ai-director.js** | `spawnAIUnit()` → RTSEngineCore entities | `_resRate=18/s` per faction | Uses RTSEngineCore.tickEntities | `bioHive`/`imperium` | (400,-300) + (-400,-300) |
| **rts-ai-faction.js** | `spawnCombatUnit()` → local `unit` objects in FactionCommander | `{profit:500, love:100}` per commander | Manual in commander.tick() | `imperium`/`voidCovenant` | (900,300) + (-1600,-800) |

**CLASH**: Completely separate units, economies, and combat loops. Both ticked from void-population.js tick function (lines 3999-4011) but they don't see each other's units. Director's units are in RTSEngineCore ENTITIES + fog system; Faction units are only in commander.group (not in fog, not in engine core).

### C5: Double-Tick Landmines (from HANDOFF-GHOST-HAMMER T2-12)

In the **animate() loop** (index.html:15550-15573) AND in **void-population.tick()** (lines 3943-4015):

| System | Animated loop tick | void-population tick | Conflict |
|--------|-------------------|--------------------|----------|
| RTSBridge | 15551 | 3959 | Double-tick |
| RTSEngineCore | 15555 | 3966 | Double-tick |
| RTSFogOfWarInstance | 15559 | 3963 | Double-tick |
| RTSSubsystem | — | 4007 | Tick only in void-pop |
| RTSAIFaction | — | 4010 | Tick only in void-pop |
| RTSAIDirector | — | 3999 | Tick only in void-pop |

**CLASH**: RTSEngineCore.tick() is called twice per frame (once directly, once via EngineScheduler→void-population). The `applyFogVisibility()` runs twice, and `tickEntities()` runs twice — all unit movement/combat is simulated at 2× speed.

### C6: Faction String Chaos (HANDOFF-GHOST-HAMMER T2-14)

```
rts-subsystem.js → 'player'           (line 162, 636, 653, 706)
rts-selection.js → 'player'           (line 99, 131)
rts-order-generator.js → 'player'      (line 337, 392, 424)
rts-ui-core.js → 'voidCovenant'        (hardcoded in comments)
rts-engine-core.js → 'voidCovenant'    (PLAYER_FACTIONS[0] in fog, line 33)
rts-ai-director.js → 'voidCovenant'    (line 38 PLAYER_FACTION)
rts-ai-faction.js → 'voidCovenant'     (line 38)
AdvancedNPCEngine → 'voidCovenant'     (line 106, 119)
RTSAINBrain.js → 'voidCovenant'        (line 29)
```

**CLASH**: `'player'` is used by 3 systems that never see actual units (since units are registered as `'voidCovenant'`). The subsystem's unit creation (`spawnUnit`) defaults to `'player'`, but it's never called for the units registered by AdvancedNPCEngine or RTSAIDirector (those use the engine core directly).

### C7: Input Router Priority War

Handlers registered with RTSInputRouter (priority = higher runs first):

| System | Handler Type | Priority | Handler |
|--------|-------------|----------|---------|
| rts-input-router.js | (internal) | — | onPointerDown/Move/Up |
| rts-bridge.js | leftClick | 10 | handleLeftClick |
| rts-bridge.js | rightClick | 10 | handleRightClick |
| god-powers-toolbar.js | leftClick | 5 | (god powers) |
| divine-terrain-sculptor.js | rightClick | 0 | (terrain sculpt) |
| rts-subsystem.js | boxSelector | — | (drag selection) |
| rts-subsystem.js | rightClick | 50 | (formation move/attack) |
| rts-subsystem.js | keyHandler | 50 | (A/S/H/P hotkeys) |
| advanced-npc-engine.js | rightClick | 60 | (NPC interaction) |
| advanced-npc-engine.js | leftClick | 60 | (NPC selection) |

**CLASH**: Priority 60 (NPC) overrides priority 50 (subsystem) overrides priority 10 (bridge). NPC selection catches clicks on any entity with `userData.entityId` — but RTS subsystem units have `mesh._rtsUnit`, not `userData.entityId`. However, AdvancedNPCEngine also registers entities with RTSEngineCore (which sets `mesh.userData.entityId`), creating a conflict where NPC handlers fire on RTS units.

### C8: HUD Position Overlap

```posiition: fixed z indexes on screen
┌─────────────────────────────────────────────────┐
│  Top-center: rts-war-alert (z:120)              │
│               rts-economy-hud (z:100)          │
├─────────────────────────────────────────────────┤
│  Bottom-center: rts-hud (z:8999)                │
│                 rts-prod-bar (z:105)            │
├────────────┬────────────────────────────────────┤
│ Left       │ Right: rts-build-menu (top:96px)   │
│            │       minimap (bottom-right)       │
└────────────┴────────────────────────────────────┘
```

The subsystem HUD (`rts-hud` at bottom-center, z:8999) renders selected unit info on top of the production palette (`rts-prod-bar` at bottom-center, z:105). Since z:8999 > z:105, the selection HUD covers the production bar.

### C9: Game State Nullifies AI (T1-6 race)

```js
// rts-game-state.js:35
if (window.RTSAIDirector) window.RTSAIDirector.tick = () => {};
```

This runs inside `createGameOverScreen()`. If `RTSGameState.tick()` fires before Grand Tower is registered (the false-defeat race), it:
1. Shows the defeat overlay
2. Nullifies RTSAIDirector.tick (no more unit spawning)
3. Combat/economy keep running behind the overlay

### C10: Three Resource Write Targets

| Writer | Target DOM | What writes |
|--------|-----------|-------------|
| `rts-economy-system.js:17-19` | `#plt-value` | `RESOURCES.profit` when `addResource('profit', ...)` |
| `rts-ui-core.js:108-109` | `#plt-value` | Overwrites with `Math.floor(r.profit)` on scheduleHUDUpdate |
| `index.html` (inline) | `#genesis-metrics` or custom | Genesis telemetry |

**CLASH**: Two systems write to `#plt-value` — direct mutation (economy system) and scheduled update (UI core). Race condition if both fire.

---

## 3. Priority Fix List

| Priority | Fix | Files | Impact |
|----------|-----|-------|--------|
| **P0** | Fix `RTSGameState.tick` false-defeat race | rts-game-state.js | Prevents instant game-over overlay on boot |
| **P0** | Remove double-tick in animate() loop | index.html:15550-15573 | Units move at 1× not 2× |
| **P1** | Merge `faction: 'player'` → `'voidCovenant'` everywhere | rts-subsystem.js, rts-selection.js, rts-order-generator.js | Selection/combat actually works |
| **P1** | Unify selection: pick ONE system | rts-subsystem.js or rts-selection.js | No selection chaos |
| **P1** | Remove `#rts-hud` (subsystem) bottom-center HUD, merge into `#rts-economy-hud` | rts-subsystem.js:535, rts-ui-core.js | No bottom-center HUD conflict |
| **P1** | Wire `RTSSelection` install in void-population.js | void-population.js | Selection.js is currently dead code |
| **P2** | Unify AI: have RTSAIFaction register units with RTSEngineCore | rts-ai-faction.js | AI units affected by fog/combat |
| **P2** | Remove duplicate drag-box: keep only `#rts-router-box` | rts-subsystem.js, rts-selection.js | No visual conflict |
| **P2** | Fix minimap `faction === 'player'` bug | rts-minimap.js:193 | Friendlies render as enemies |
| **P3** | Merge rts-subsystem UNIT_DEFS with rts-production-palette UNIT_STATS | Both files | One source of truth for unit definitions |
| **P3** | Consolidate `#plt-value` writer to RTSEconomySystem only | rts-ui-core.js | No resource write race |
