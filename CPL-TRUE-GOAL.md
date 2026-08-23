# CPL TRUE GOAL — The Improvement Mandate

> **Status:** DRAFT — created 2026-08-11
> **Repo:** `buyasoul-cpl-fresh` (branch: `publish`)
> **Goal:** Make everything better — stabilize the world, complete the Age of Empires II RTS integration, and achieve a fully functional sovereign-void + RTS simulation.

---

## 1. Diagnosis Summary

### What Works ✅
- **21 Sovereign Void Realms** — all city files exist and expose `window.spawn<Name>()` functions; data-driven spawn system in `void-population.js` (`_sovereignCityDefs` array, lines 3387-3408) is committed and guarded by `typeof window[def.fn] === 'function'`.
- **Tick loop** — `void-population.js` calls `cityGroup.userData.update(time, dt)` for every city (lines 3896-3898).
- **Dispose cleanup** — `_allSovereignCities` is properly cleaned up on dispose (lines 3975-3978).
- **RTS tick integration** — `rts-bridge.js` ticks before `rts-engine-core.js` (lines 3916-3920).
- **All 13 RTS script tags** present in `index.html` (lines 1003-1027, 1029-1030).
- **Three.js r160** loaded both as ES module (importmap, line ~1040) and classic script global (lines 995-997) for backward compatibility with sovereign city files.

### What's Broken 🔴
1. **`window.sovereignCities` telemetry bug** — `index.html` references `window.sovereignCities` in spatial telemetry (lines 7371, 12298, 12991, 13149) but no such variable exists. The actual array is `_allSovereignCities`, which is private to the `void-population.js` module scope. Telemetry always reports `activeCities: 0`.
2. **`rts-subsystem.js` and `rts-ai-faction.js` are commented out** in `index.html` (lines 1034-1035) even though `void-population.js` has full wiring for them (install at 3542-3546, tick at 3960-3964).
3. **Uncommitted index.html changes** — syntax fixes (method shorthand → function declarations for spatial telemetry), city clock HUD chips, THREE global load, RTS farm tick (line 15545), duplicate WebSocket handler cleanup (lines 12928-13264).
4. **`city-clock.js` and `daily-life-loop.js` are untracked** — not committed to the repo.
5. **`rts-farm-system.js` and `rts-wall-system.js` are untracked** — not committed despite being referenced in index.html (line 1023).

### What's Missing 🟡
- Push all uncommitted changes to `origin/publish`.
- Verify all 21 cities actually spawn on the live GitHub Pages site.
- Fix the `window.sovereignCities` reference.
- Enable `rts-subsystem.js` and `rts-ai-faction.js`.
- Commit `city-clock.js`, `daily-life-loop.js`, `rts-farm-system.js`, `rts-wall-system.js`.
- Complete Age of Empires II RTS integration (fog of war, base building, economy, unit commands, formations).
- Test RTS tick order and AoE mechanics end-to-end on the live site.

---

## 2. The True Goal Plan

### Phase 1: Stabilize (Push + Commit)
**Goal:** Get all in-progress work committed and pushed to `origin/publish`.

| # | Task | Files | Action |
|---|------|-------|--------|
| 1.1 | Commit uncommitted index.html changes | `index.html` | Review `git diff`, commit with message: `feat: city clock HUD, THREE global, sovereign city spawn tags, RTS farm tick, telemetry syntax fix` |
| 1.2 | Commit untracked genesis files | `city-clock.js`, `daily-life-loop.js`, `rts-farm-system.js`, `rts-wall-system.js` | `git add` + commit: `feat: city clock, daily life loop, farm system, wall system` |
| 1.3 | Commit modified RTS/genesis files | `behavior-attacher.js`, `perception_action_loop.js`, `rts-base-builder.js`, `rts-bridge.js`, `rts-engine-core.js`, `rts-order-executor.js` | Commit: `feat: RTS subsystem refinements` |
| 1.4 | Commit modified playtest/server files | `playtest.js`, `server.js` | Commit: `feat: playtest + server updates` |
| 1.5 | Push all to `origin/publish` | — | `git push origin publish` |

### Phase 2: Fix the Telemetry Bug
**Goal:** `activeCities` in spatial telemetry reports the real count.

| # | Task | Files | Action |
|---|------|-------|--------|
| 2.1 | Expose `_allSovereignCities` on `window` | `void-population.js` (line 246) | Add `window.sovereignCities = _allSovereignCities;` after the array declaration |
| 2.2 | Verify telemetry references match | `index.html` (lines 7371, 12298, 12991, 13149) | Confirm `window.sovereignCities` now resolves |
| 2.3 | Test on live site | — | Deploy to `publish` branch, check spatial telemetry shows non-zero city count |

### Phase 3: Enable RTS Subsystem + AI Faction
**Goal:** Unlock the full RTS control layer (StarCraft-style drag selection, formations, AI commanders).

| # | Task | Files | Action |
|---|------|-------|--------|
| 3.1 | Uncomment `rts-subsystem.js` script tag | `index.html` (line 1034) | Remove `<!-- -->` wrapper |
| 3.2 | Uncomment `rts-ai-faction.js` script tag | `index.html` (line 1035) | Remove `<!-- -->` wrapper |
| 3.3 | Verify install hooks fire | `void-population.js` (lines 3542-3546) | Confirm `window.RTSSubsystem.install()` and `window.RTSAIFaction.install()` are called during city setup |
| 3.4 | Verify tick integration | `void-population.js` (lines 3960-3964) | Confirm `RTSSubsystem.tick(dt)` and `RTSAIFaction.tick(dt)` fire in the main loop |
| 3.5 | Test on live site | — | Deploy, verify no console errors, RTS subsystem + AI factions active |

### Phase 4: Age of Empires II RTS Integration (Complete)
**Goal:** Full AoE II-style RTS mechanics integrated into the void cosmos.

| # | Task | Files | Action |
|---|------|-------|--------|
| 4.1 | Fog of War | `rts-fog-of-war.js` (already loaded, line 1021) | Verify it renders over the sovereign city terrain; test visibility toggles with unit movement |
| 4.2 | Economy System | `rts-economy-system.js` (line 1022), `rts-farm-system.js` (line 1023) | Verify farm collection ticks (line 15545 in index.html); confirm PLT resource flow (Profit/Love/Tax) |
| 4.3 | Base Building | `rts-base-builder.js` (line 1025), `rts-wall-system.js` | Test wall placement around town centers; verify foundation ghosts + build queue |
| 4.4 | Unit Commands | `rts-order-executor.js` (line 1015), `rts-order-generator.js` (line 1014) | Test right-click move/attack-patrol; verify waypoint chaining |
| 4.5 | Selection + UI | `rts-selection.js` (line 1013), `rts-input-router.js` (line 1012), `rts-ui-core.js` (line 1019), `rts-ui-engine.js` (line 1024) | Test drag-box selection, control groups, unit info panels |
| 4.6 | Pathfinding | `rts-nav-grid.js` (line 1011) | Verify units path around sovereign city obstacles; test dynamic blocking |
| 4.7 | Production | `rts-production-system.js` (line 1026), `rts-production-palette.js` (line 1018) | Test barracks training, production queue UI |
| 4.8 | AI Director | `rts-ai-director.js` (line 1029), `rts-war-command.js` (line 1030) | Test AI commander spawns squads, issues patrol orders |
| 4.9 | Game State | `rts-game-state.js` (line 1027) | Verify win/lose conditions, phase transitions (peace → war) |
| 4.10 | RTS Subsystem (SC2-style) | `rts-subsystem.js` (Phase 3) | Test formations (V-shape, line, circle), attack-move, hold position |
| 4.11 | AI Faction (AoE-style) | `rts-ai-faction.js` (Phase 3) | Test autonomous commander with Imperium Red vs Void Covenant Blue; verify resource mining, base building, squad marches, combat |
| 4.12 | Minimap | `rts-minimap.js` (line 1017) | Verify fog overlay on minimap, unit icons, camera sync |

### Phase 5: City Clock + Daily Life Loop (Ship It)
**Goal:** Fully integrate the day/night cycle and NPC profession simulation.

| # | Task | Files | Action |
|---|------|-------|--------|
| 5.1 | Commit city-clock.js | `city-clock.js` (Phase 1.2) | Already done |
| 5.2 | Commit daily-life-loop.js | `daily-life-loop.js` (Phase 1.2) | Already done |
| 5.3 | Wire into tick loop | `void-population.js` | Verify city clock `tick()` is called; confirm daily life loop hooks into NPC schedules |
| 5.4 | Test day/night cycle | — | Deploy, verify sky color + hemi intensity changes via `window.__genesisLights` (city-clock.js line 85) |

### Phase 6: Verification (Live Site)
**Goal:** Everything works on `https://buyasoul-ai.github.io/buyasoul-cpl/`.

| # | Task | Action |
|---|------|--------|
| 6.1 | All 21 cities spawn | Visit live site, open dev tools, check `window.sovereignCities.length === 21` |
| 6.2 | RTS subsystems load | Check console for `RTSSubsystem` + `RTSAIFaction` install logs |
| 6.3 | Fog of War active | Verify dark overlay, clears on unit movement |
| 6.4 | Economy flowing | Check farm collection ticks, PLT resource updates |
| 6.5 | Spatial telemetry correct | Verify `activeCities > 0` in WebSocket telemetry payload |
| 6.6 | No console errors | Clean deploy, no `THREE.*` or `undefined` errors |

### Phase 7: GODFORGE Gap Closure (Post-Stabilization)
**Goal:** Wire up modules that exist on disk but aren't loaded, fix continuous reaction loop.

| # | Task | Files | Action |
|---|------|-------|--------|
| 7.1 | Wire world-reaction.js into tick loop | `void-population.js` | Add `window.WorldReaction.tick(dt)` call in main tick loop (after line 3920) |
| 7.2 | Load trust-dialogue.js as script tag | `index.html` | Add `<script src="src/genesis/trust-dialogue.js">` before void-population.js |
| 7.3 | Load unloaded Genesis modules | `index.html` | Add script tags for: `citizen-memory.js`, `god-powers-toolbar.js` (already loaded), `property-ledger.js`, `sanctum-adapter.js`, `video-manager.js`, `performance-governor.js`, `scale-engine.js`, `sector-manager.js`, `visibility-system.js`, `world-editor.js`, `procedural-city.js`, `cinematic-renderer.js`, `streaming-manager.js`, `asset-pipeline.js`, `interior-*.js` (5 files), `resource-pool.js` (already loaded) |
| 7.4 | Wire city clock tick | `void-population.js` | Add `window.CityClock?.tick?.(dt)` in main tick loop |
| 7.5 | Wire daily-life-loop tick | `void-population.js` | Add `window.DailyLifeLoop?.tick?.(dt)` in main tick loop |

---

### Key Insight: GODFORGE Audit Overstates CPL Readiness

The GODFORGE 198-phase audit (`seshat-second-brain/pages/GODFORGE - FULL 198 PHASE AUDIT.md`) tracks `genesis-foundation` commits — but CPL is a separate codebase with copies of many Genesis modules. Real status:

- **~35% truly live and wired** in CPL index.html + void-population.js tick loop
- **~30% on disk but NOT loaded** in index.html (trust-dialogue, video-manager, performance-governor, scale-engine, sector-manager, visibility-system, world-editor, procedural-city, cinematic-renderer, citizen-memory, sanctum-adapter, property-ledger, interior-*, streaming-manager, asset-pipeline, etc.)
- **~35% missing entirely** from CPL (multiplayer, voice chat, physics engine, weather system, self-questioning loop, cross-world memory, behavior cloning, self-audit trail)

**Additional critical gaps found during GODFORGE cross-reference:**
1. **Telemetry bug**: `window.sovereignCities` referenced 4× in index.html (lines 7371, 12298, 12991, 13149) but variable is `_allSovereignCities` (private to module scope) — telemetry always shows 0 cities
2. **`world-reaction.js`** exists and is loaded in void-population.js install (line 3437) but NOT wired into the tick loop — consequence reactions only fire on install, not continuously
3. **`trust-dialogue.js`** exists as a file but is NOT loaded as a script tag in `index.html`
4. **~20 modules on disk but not loaded** in index.html
5. **~20 GODFORGE phases have NO equivalent** in CPL

Full mapping: `seshat-second-brain/pages/GODFORGE-CPL-MAPPING.md`

## 3. Coordinate System Reference
| Range | Zone | Content |
|-------|------|---------|
| 0–360u | NO-BUILD | ABSOLUTELY NOTHING |
| 360–600u | Lost Mechanics Ring | 3 LM cities + New City (CPL clone) + Grand Tower |
| 600–3000u | Lost Worlds Ring | Outer ring worlds |
| 3000–5000u | Outer Void | — |
| 5000–8000u | Deep Void | — |
| 8000u+ | Far Void | — |

## 4. 24 Coordinates (Worlds)
1. Genesis Citadel (0,0,0)
2. Sovereign Marketplace
3. Obsidian Spire
4. Resonant Veil
5. Solar Forge
6. Bioluminescent Hive
7. Neon Zenith
8. Iron Foundry
9. Aetherium Skylands
10. Elysian Vault
11. Astral Spire
12. Quantum Rift
13. Chronos Temple
14. Glacial Matrix
15. Abyssal Trench
16. Hyperion Array
17. Titan Graveyard
18. Rift Warzone
19. Vortex Siege
20. Omega Crucible
21. Alien Warzone (alien-warzone-city.js)
22–24. Reserved

## 5. RTS Tick Order (Critical)
1. `rts-bridge.js` — bridge before engine (line 3916)
2. `rts-engine-core.js` — entity update (line 3919)
3. `rts-economy-system.js` — resource ticks (line 3923)
4. `rts-base-builder.js` — construction progress (line 3933)
5. `rts-production-system.js` — unit training (line 3936)
6. `rts-game-state.js` — win/lose checks (line 3939)
7. `rts-ai-director.js` — AI commander orders (line 3952)
8. `rts-war-command.js` — war state transitions (line 3955)
9. `rts-subsystem.js` — SC2-style controls (line 3960)
10. `rts-ai-faction.js` — autonomous factions (line 3963)
11. `rts-minimap.js` — UI refresh (line 3946)
