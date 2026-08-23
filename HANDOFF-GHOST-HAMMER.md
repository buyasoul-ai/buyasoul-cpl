# CPL FULL DOSSIER — Handoff Document
**From:** the Ghost & the Hammer (forensic investigation units)
**Date:** 2026-08-22
**Repo:** `C:\Users\uncom\Desktop\buyasoul-cpl-fresh` · branch `publish` · HEAD `bc464b3`
**Live site:** https://buyasoul-ai.github.io/buyasoul-cpl/
**Method:** chain-of-custody forensic read — every claim cites file:line

---

## 0. EXECUTIVE SUMMARY

- **142 of 148 Genesis modules load** (141 script tags + 1 ES import). Only **6 true orphans**.
- The RTS engine exists across **23 modules + 2 support files**, 20 loaded, 2 commented out, 1 orphaned.
- **~30 verified defects** found, tiered below. Several are one-line fixes with massive impact.
- **Fog of war never runs at all** (`RTSFogOfWarInstance` is never created).
- **Local test infrastructure is broken**: port 3457 is squatted by `host/genesis-host.cjs`
  (an MCP/GSK bridge that serves no static files). Every historical playtest run against
  localhost:3457 tested the wrong program. The repo's real `server.js` was never reachable
  on its documented port.
- Live-site probe was interrupted before completion — diagnosing "why no RTS visible on
  GitHub Pages" remains an OPEN case (see §7).

---

## 1. PROJECT ARCHITECTURE (verified)

### Stack
- Three.js **r160** (importmap + classic global `window.THREE = THREE`, index.html:995–996, importmap :1062)
- Vanilla JS, ~15.5k-line index.html, 148-module Genesis engine in `src/genesis/`
- GitHub Pages deployment via `git push origin publish` (~1–2 min rebuild)
- Local task/map API: `server.js` (port 3457 **when actually running**) — `/api/tasks` GET/POST/DELETE,
  plus undocumented GSK bridges `/api/world-build` GET/POST (:142–193) and `/api/rts/order` (:195–241),
  WebSocket `/spatial` upgrade (:339–348)

### World structure
- CPL City at origin (0,0,0); Pyramidion dual pyramids; NO-BUILD zone 0–360u
- Zones: 360–600u Lost Mechanics Ring · 600–3000u Lost Worlds Ring · 3000–5000u Outer Void · 5000–8000u Deep Void
- `WORLD_COUNT = 30` (void-population.js:10) vs docs claiming 24 — code is ahead of docs
- 21 sovereign city defs confirmed in `_sovereignCityDefs` (void-population.js)
- 3 vertical strata: Surface Y=0 · Underworld Y=−500 · Heaven Y=640, shaft between;
  VerticalStackManager implemented INLINE in index.html:3042/3156 — the disk file
  `vertical-stack-manager.js` is superseded duplicate
- Strata registered at index.html:10025–10028 ('surface' ACTIVE, 'underworld'/'heaven' LOADED)

### Module loading truth-table (corrected audit)
- On disk: 148 · Script-tag loaded: 141 · ES-imported transitively: void-cosmos.js only
- **TRULY ORPHANED (6):** `bifrost-pyramids.js`, `multiverse-hub.js`, `multiverse-world.js`,
  `soul-forge-nexus.js`, `transition-manager.js`, `rts-ai-brain.js`
- Dynamic flag-gated imports ("Act VI", index.html:2809–2913): world-reaction.js (flag TRUE at :2781),
  city-clock.js, daily-life-loop.js, trust-dialogue.js — these ARE wired, contradicting CPL-TRUE-GOAL.md Phase 7
- Earlier claim of "89 orphans" was an audit tooling error — retracted

---

## 2. THE RTS ENGINE — FULL MAP

### Loaded & live (20 script tags, index.html:1011–1034)
| Layer | Modules |
|---|---|
| Core sim | rts-engine-core (718 ln), rts-nav-grid (294), rts-fog-of-war (197), rts-economy-system (114), rts-farm-system (200), rts-wall-system (235) |
| Input | rts-input-router (priority system: warship 40 < subsystem 50 < NPC 60, modifier-right-click 0), rts-selection, rts-order-generator (RTS-1), rts-order-executor, rts-bridge (wires 1+2 into router/engine) |
| UI | rts-ui-core (HUD singleton/hotkeys/selection Set), rts-ui-engine (NPC glue + health bars only), rts-minimap (256px canvas), rts-production-palette |
| Build | rts-base-builder (menu→ghost→spend→place), rts-production-system, void-rts-buildings (garrison/production/tech) |
| War AI | rts-ai-director (bioHive+imperium wave spawner), rts-war-command (pacing booster + player start army: 8 soldiers + 4 harvesters), starcraft-asymmetric-factions (Protoss shields / Zerg creep / Terran text-only) |

### Disabled (commented out, index.html:1035–1036)
- `rts-subsystem.js` (732 ln) — SC2-style: drag-box select, move/attack-move/hold/patrol,
  formations V/circle/line, own HUD, PLT unit costs (scout 100P, frigate 250P+50❤ …).
  Git history shows its handlers were STRIPPED during input unification
  (`fff50e2`, `c665fda`) after a "4-way right-click conflict". Re-enabling wholesale would
  resurrect the handler war — must be re-integrated through router registration only.
- `rts-ai-faction.js` — two autonomous CPU commanders (Imperium Red vs Void Covenant Blue),
  own resources {profit:500, love:100}, harvesters, base building, squad marches.

### Orphaned
- `rts-ai-brain.js` (RTS-8) — two-clock AI (strategic 1 Hz / tactical 4 Hz), ZERO-CHEAT
  fog-limited vision, uses same orders[] facade as player. Needs
  `RTSAIBrain.install({ entities, fog, playerIndex })` + tick. Never referenced anywhere.
  **Blocked by defect #T1-1** (fog has no instance to give it).

### Tick chain (void-population.js:3920–3984, exact order)
EngineOptimizer → GodforgeArtPassV2 → StarCraftAsymmetricEngine → RTSBridge → RTSEngineCore
→ RTSEconomySystem → RTSUIEngine → RTSUICore → RTSBaseBuilder → RTSProductionSystem
→ RTSGameState → GodPowersEngine → minimap → palette → AdvancedNPCEngine → RTSAIDirector
→ RTSWarCommand → [RTSSubsystem ×2 — DEFECT T2-12] → [RTSAIFaction]

### Install chain (void-population.js:3444–3561)
NavGrid{cellSize:5} → InputRouter → UICore → Bridge → ProductionPalette(._ents/._scene) →
Minimap instance `__rtsMinimap` → EconomySystem → UIEngine → BaseBuilder → ProductionSystem →
Grand Tower + 21 city centers registered as town halls (isTownHall/isGrandTower flags,
nav blockCircle radius 50) → WarCommand install (:3551) → enemy bases flagged isEnemyBase (:3574–3597)

### Faction model
- Factions in engine: `'imperium'`, `'voidCovenant'`, `'bioHive'`, `'neutral'` (engine-core:36)
- voidCovenant = Protoss shields (auto-applied engine-core:80–81) · bioHive = creep speed ×1.3
  (engine-core:529) · imperium = NO mechanical trait (text-only, starcraft-factions:17–21)
- AI director asymmetry: bioHive base (400,0,−300) hp80 spd5.5 cost80 squads6 ·
  imperium base (−400,0,−300) hp130 spd3.8 cost120 squads4 (ai-director:16–35)
- PLAYER_HOME (−104,0,401) duplicated in war-command:26 and ai-director:39

### Win/Lose (rts-game-state.js:99–124)
- DEFEAT = no live entity with `isGrandTower` · VICTORY = none with `isEnemyBase`
- Restart = location.reload() (:89–91)

---

## 3. DEFECT LEDGER — TIER 1 CRITICAL

**T1-1. Fog of war NEVER instantiated.**
`window.RTSFogOfWarInstance` READ at engine-core:685, assigned NOWHERE. Effects:
engine fog visibility no-op; minimap fog layer dead (minimap binds the CLASS not instance,
minimap:42, guard fails silently at :133); ai-brain unusable. Also inside fog module:
broken faction filter `ent.faction !== 'player'` (:106 — 'player' faction doesn't exist);
`visionRange||15` default since GameEntity lacks the field (:107/:161); unbounded `_visionCache`.

**T1-2. Walls UNBLOCK the nav grid.**
wall-system:63 `blockCircle(x,z,1.5)` missing 4th arg → undefined→0 = walkable.
Removal calls nonexistent `navGrid.unblockCircle()` (:191–192) — silent failure.
Additional: `placeWall/placeGate/openGate/closeGate` have ZERO callers (dead system);
stone walls cost `{stone:100}` — resource doesn't exist in economy (:15 vs economy:5–12);
costs never charged anyway; off-by-one segment loop `i<=segments` (:80); HP desync —
combat mutates ent.hp but Map's wall.hp never updates so damage visuals never trigger (:47/:201–206);
no removeGate API; gates immortal.

**T1-3. Minimap renders your own units as ENEMIES.**
minimap:193 tests `faction === 'player'`; actual player faction is 'voidCovenant'.
Everything non-neutral draws #ff4444 red. Unused color var :192.
Also: per-frame canvas allocation in fog blit (:171–175); frustum pan fights camera (:280–286).

**T1-4. Farm economy is broken end-to-end.**
base-builder spends BEFORE validating (:263–288), no refund on farm failure;
wood-spend result ignored (:269) — building places even without wood;
funds check validates profit/love only, skips wood (:229);
farm proximity rule contradicts builder clearance math (farm needs hall ≤8u :76 while builder
rejects any building within def.radius+8=10.5u :243–246 — both can't hold);
hall-null bypass allows placement anywhere (farm:76);
auto-reseed silently drains 60 wood mid-game (farm:134–136).

**T1-5. Telemetry bug (confirmed 5 sites).**
index.html reads `window.sovereignCities` at :7372, :12315, :13008, :13166, :16179 —
never assigned. `_allSovereignCities` locked at module scope (void-population:260).
Telemetry always reports activeCities:0. Line 16179 fallback also checks
`window._allSovereignCities` which equally doesn't exist.

**T1-6. False-defeat race.**
RTSGameState.tick runs from render loop; if it fires before Grand Tower registration,
grandTowerAlive=false → instant DEFEAT overlay (game-state:108–119). Overlay "shutdown"
only neuters AI Director — combat/economy keep running behind modal (:32).

## 4. DEFECT LEDGER — TIER 2 CONFIRMED MALFUNCTIONS

**T2-7.** Protoss shield rechargeTimer never resets on damage (starcraft:72–74) —
"3s out of combat" fiction; SHIELDED_UNITS grows forever, dead units never purged (:36);
single global creepPlane orphaned per spawn (:83,:97).

**T2-8.** AI Director `_unitSpeedMult` assigned (:37/:140) never applied — WarCommand's
`unitSpeed:3` is fiction. Wave orders use legacy targetPos/state protocol bypassing
orders[] facade consumed by order-executor (dual movement protocols coexist) (:106–108).

**T2-9.** void-rts-buildings: ballistics tech effect = empty lambda, still charges
300P/100aether (:110); construction recompute erases damage each tick = free heal exploit
(:128–130); enqueueProduction accepts defs without id.

**T2-10.** Economy: RESOURCES exported by reference — direct mutation bypasses validation
(economy:113; palette exploits negative-add as deduction); two competing writers to #plt-value
(economy:17–20 vs ui-core:63–67 which hides it); build-cost tables duplicated in economy:103
vs base-builder BUILD_DEFS, already drifted (farm missing from economy's table);
crystal nodes hardcoded 30 (:100) spawning only in ring 100–800u (:62) vs nav bounds ±2500;
tick ignores dt (:82–96); NODE_MESHES never pruned.

**T2-11.** Ghost entities: removeFarm (farm:168–175) and removeWall (wall:186–195) remove
mesh but leave RTSEngineCore entity alive/targetable. No die()/unregister.

**T2-12.** Double-tick landmine: RTSSubsystem.tick called at void-population:3975 AND :3983.
Harmless while script commented; enabling tag = formations simulating at 2× speed.

**T2-13.** Duplicate function: createBuildingWithBuildTime declared twice in engine-core
(:177 signature `(scene,mesh,type,...)` and :606 signature `(scene,buildingDef)`).
Hoisting = second wins silently; legacy-signature callers get green wireframe ghost box.

**T2-14.** Faction string chaos: minimap uses 'player', ui-engine hardcodes 'voidCovenant'
(:104,:134), wall/farm default 'voidCovenant' while base-builder passes 'imperium'
(:274) — load-bearing inconsistency across modules.

**T2-15.** rts-ui-core: empty tick stub (:158–160); possible double-update if subscribe
throws post-listener (:167–171); hotkey handler consumes anything not returning false (:129–140).

**T2-16.** Nav-grid silent failures: findPath returns [] on guard exhaustion MAX_GUARD=20000
(:108,:140–141,:182) with zero logging; BLOCKED null-crash paths if setBlockedAt/blockCircle/
isWalkable called pre-init (:45–75); nearestWalkable scans r<20 only (:192–204);
debug mesh-per-cell perf hazard (:270).

**T2-17.** Engine misc: applyFogVisibility always playerIndex=0 (engine-core:687); passive income
every 5s credits voidCovenant buildings only (:656–668); projectile pool OK.

**T2-18.** rts-ui-engine health bars never detached on death (:58 skip pattern); triple-redundant
selection clears across bridge/ui-engine/subsystem (bridge:147, ui-engine:150–154).

**T2-19.** war-command: userData wholesale overwrite risks clobbering entityId chains (:93,:104);
install() lacks _installed latch (:131 area) — double-call double-spawns army.

**T2-20.** game-state stats.startTime = script-load time not match start (:18).

## 5. INFRASTRUCTURE FINDINGS

**INF-1. Port 3457 squatted (CRITICAL for dev loop).**
Running process PID 9516 = `node genesis-host.cjs` — the MCP/GSK bridge from `host/`
(also exists in sibling project `Desktop\genesis-foundation\host\`). It serves ONLY
/gsk/* and /mcp/* routes; everything else 404 (host/genesis-host.cjs:158,168).
It does NOT serve static files. Result: repo's real server.js unreachable on its documented
port; ALL prior playwright runs against localhost:3457 tested garbage (threeLoaded:false,
canvas:false — captured in forensic-playtest output).
**Fix:** run server.js on port 3458 (3456 also has stuck legacy process per AGENTS.md:21)
and update all docs referencing 3457.

**INF-2. Uncommitted work: 649 insertions across 9 files**
(git diff --stat HEAD): AGENTS.md +96, index.html +161, package.json/lock, playtest.js ±64,
play-test-screenshot.png, server.js +232, behavior-attacher.js +123, perception_action_loop.js +3.
Untracked: CPL-TRUE-GOAL.md + ~10 utility scripts (check-inline.js, scan-transcripts.cjs,
patch-build-time.js, prev_index.html 987KB backup, etc.).

**INF-3. Recent commit arc (git log):** bc464b3 war visibility (units ×3 scale, glow lights,
health bars, bigger projectiles, closer enemy bases) ← f71fa32 Expansion Pack 1 (6 cities) ←
5ad78ec AI Director/WarCommand/Palette wiring ← d43ebbb counters/control-groups/fog-visibility ←
14e506f path caching/worker repair/build times ← edfacd9 AoE2 mechanics reference ←
6463b95 tick order fix ← 107efe1 RTS engine wiring.

## 6. DOCS-VS-REALITY DIVERGENCES

| Doc claim | Reality |
|---|---|
| VOID-EXPLORATION.md says Three.js r128 | r160 everywhere |
| TRUE-GOAL Phase 7: world-reaction/trust-dialogue/city-clock/daily-life "not loaded" | All four dynamically imported, flag-gated (index.html:2781–2913); WORLD_REACTION defaults true |
| TRUE-GOAL: "~20 modules on disk not loaded" | Only 6 true orphans (audit correction) |
| AGENTS.md file map omits | server.js GSK bridges (/api/world-build, /api/rts/order, /spatial WS), host/ folder, forensic scripts |
| SUMMARY.md: "registered with VerticalStackManager" | True — but inline implementation (index.html:3156), disk module superseded |
| WORLD_COUNT 24 (docs) | Code says 30 (void-population:10) |

## 7. OPEN CASE — "I've never seen the RTS"

Evidence collected:
- User plays on GitHub Pages (local boot impossible due to INF-1).
- Live-site probe launched twice; execution environment killed the browser child both times
  (localhost probes ran fine moments earlier — cause undetermined).
- Commit bc464b3 ("make war visible") suggests prior agents fought the same symptom.
- Known visibility factors even if war spawns: player army at (−104,0,401) is 414u from origin
  (Lost Mechanics Ring, behind city geometry?); AI bases at ±400 z=−300 are INSIDE old no-build
  guidance zone near city skyline; default camera behavior unknown; false-defeat overlay may
  cover screen early (T1-6); minimap mislabels friendlies (T1-3) so users can't find armies.

Next steps when environment permits:
1. Run probe-live.js against https://buyasoul-ai.github.io/buyasoul-cpl/ (script ready in repo)
2. Capture: entityCount, warAlert DOM, gameOverOverlay state, screenshots at
   PLAYER_HOME/bioHive/imperium coordinates
3. If entities exist: problem is camera/UI/discoverability → fix T1-3, add army selection
   indicator + camera fly-to key
4. If entities don't exist: trace install exceptions in console capture

## 8. FIX PRIORITY (recommended execution order)

1. T1-1 fog instance creation (one line in void-population install: `new RTSFogOfWar({scene,entities}).install()` → assign window.RTSFogOfWarInstance) + fix class bugs first
2. T1-2 wall blockCircle `true` arg + delete unblockCircle call or implement it in nav-grid
3. T1-3 minimap faction check → 'voidCovenant'
4. T1-5 expose `window.sovereignCities = _allSovereignCities` (void-population:260 area)
5. T2-13 dedupe createBuildingWithBuildTime · T2-12 remove second subsystem tick
6. T1-4 farm/base-builder payment flow rewrite (validate-all → spend-all → place → refund-on-fail)
7. T1-6 defeat race guard (skip tick until ENTITIES populated)
8. T2 batch: shield timer reset + array purge, speed multiplier application, ballistics effect,
   RESOURCES freeze, ghost-entity cleanup, faction string normalization ('player'→'voidCovenant')
9. INF-1: move server.js to 3458 + doc update
10. Then: enable rts-subsystem via router-registration-only integration; wire rts-ai-brain
    (after fog fix) with install({entities, fog: window.RTSFogOfWarInstance, playerIndex:1})

## 9. KEY FILE MAP (for the next agent)

| File | Role |
|---|---|
| index.html | Host app; strata/VSM inline (:3042–3290); Act VI dynamic imports (:2781–2930); telemetry (:7372…) ; RTS script tags (:1011–1036) |
| src/genesis/void-population.js | World builder; WORLD_COUNT=30 (:10); _sovereignCityDefs×21; installs (:3444–3561); ticks (:3920–3984) |
| src/genesis/rts-engine-core.js | Entity/combat/economy sim (718 ln) |
| src/genesis/rts-subsystem.js | DISABLED SC2 controls layer (732 ln) |
| src/genesis/rts-ai-brain.js | ORPHANED zero-cheat AI |
| host/genesis-host.cjs | GSK/MCP bridge — NOT a web server; squats 3457 |
| server.js | Real map/tasks/GSK-bridge HTTP server (needs new port) |
| forensic-playtest.js | Local probe (works against correct host) |
| probe-live.js | Ready-to-run GitHub Pages probe (results pending) |

*Chain of custody: all line numbers verified against working tree @ HEAD bc464b3 + uncommitted changes.*
