/* ============================================================================
 * RTS WAR COMMAND — "War Is Coming" (Build 1)
 * Makes the RTS war REAL, VISIBLE and FAST:
 *  1. Crashes the AI timeline: factions pump units 2x faster, march 3x speed,
 *     squad waves form every ~10-15s instead of every 5 minutes.
 *  2. Spawns a REAL player army at Grand Tower (8 soldiers + 4 harvesters in
 *     formation) — selectable + right-click commandable via the existing
 *     AdvancedNPCEngine / RTSEngineCore chain.
 *  3. War alerts: red banner + compass arrow when a strike wave forms.
 * No engine rewrites — everything rides the APIs that already exist.
 * Flag: __GENESIS_RTS_WAR_COMMAND (default ON).
 * ==========================================================================*/
window.__GENESIS_RTS_WAR_COMMAND = (typeof window.__GENESIS_RTS_WAR_COMMAND === 'boolean') ? window.__GENESIS_RTS_WAR_COMMAND : true;

(function () {
  if (window.__GENESIS_RTS_WAR_COMMAND === false) {
    window.RTSWarCommand = { install() {}, tick() {} };
    return;
  }

  let SCENE_REF = null;
  let _alertEl = null;
  let _arrowEl = null;
  let _alertUntil = 0;
  let _lastAlert = 0;
  const PLAYER_HOME = { x: -104, z: 401 }; // Grand Tower (matches AI director)

  // ─── WAVE ALERT UI ─────────────────────────────────────────────────────
  function ensureAlertUI() {
    if (_alertEl) return;
    _alertEl = document.createElement('div');
    _alertEl.id = 'rts-war-alert';
    Object.assign(_alertEl.style, {
      position: 'fixed', top: '96px', left: '50%', transform: 'translateX(-50%)',
      padding: '10px 22px', borderRadius: '10px', zIndex: '120',
      background: 'linear-gradient(135deg, rgba(120,0,0,0.9), rgba(200,20,20,0.85))',
      border: '2px solid #ff4444', color: '#fff', fontFamily: 'Outfit, sans-serif',
      fontSize: '15px', fontWeight: '800', letterSpacing: '1.5px', textTransform: 'uppercase',
      boxShadow: '0 0 30px rgba(255,40,40,0.5)', display: 'none', pointerEvents: 'none'
    });
    document.body.appendChild(_alertEl);

    _arrowEl = document.createElement('div');
    _arrowEl.id = 'rts-war-arrow';
    Object.assign(_arrowEl.style, {
      position: 'fixed', bottom: '120px', left: '50%', zIndex: '119',
      fontSize: '30px', color: '#ff4444', textShadow: '0 0 12px #ff0000',
      display: 'none', pointerEvents: 'none', transform: 'translateX(-50%)'
    });
    _arrowEl.textContent = '▼';
    document.body.appendChild(_arrowEl);
  }

  function showWaveAlert(info) {
    ensureAlertUI();
    const now = performance.now();
    if (now - _lastAlert < 8000) return; // don't spam every wave
    _lastAlert = now;
    _alertUntil = now + 6000;
    const names = { bioHive: 'BIO HIVE (ALIEN)', imperium: 'IMPERIUM (TERRAN)' };
    _alertEl.textContent = '⚔ STRIKE WAVE INCOMING — ' + (names[info.factionId] || info.name || 'ENEMY') + ' · ' + info.count + ' UNITS';
    _alertEl.style.display = 'block';
    _arrowEl.style.display = 'block';
    if (typeof console !== 'undefined') console.log('[WarCommand] ALERT: ' + _alertEl.textContent);
  }

  function tickAlertUI() {
    if (!_alertEl) return;
    const now = performance.now();
    if (now > _alertUntil) {
      _alertEl.style.display = 'none';
      _arrowEl.style.display = 'none';
    }
  }

  // ─── PLAYER ARMY ───────────────────────────────────────────────────────
  function spawnPlayerArmy() {
    const T = window.THREE;
    if (!T || !window.AdvancedNPCEngine || !window.RTSEngineCore) return 0;
    const group = new T.Group();
    group.name = 'rts-player-army';

    // 8 soldiers in a line, facing the enemy approach (south of the tower)
    const SOLDIER_COUNT = 8;
    for (let i = 0; i < SOLDIER_COUNT; i++) {
      const mesh = window.AdvancedNPCEngine.createHumanoidRig(0x44aaff, false);
      mesh.position.set(PLAYER_HOME.x - 30 + (i - (SOLDIER_COUNT - 1) / 2) * 3, 0, PLAYER_HOME.z + 18);
      group.add(mesh);
      const ent = window.RTSEngineCore.registerEntity(mesh, 'unit', 'voidCovenant', 150, 1.2);
      ent.speed = 4.5;
      ent.attackDamage = 15;
      ent.attackRange = 6;
      mesh.userData.rtsRole = 'soldier'; // additive — never overwrite userData (entityId lives there)
    }

    // 4 harvesters behind the line
    for (let i = 0; i < 4; i++) {
      const mesh = window.AdvancedNPCEngine.createHumanoidRig(0xffcc44, false);
      mesh.position.set(PLAYER_HOME.x - 20 + (i - 1.5) * 4, 0, PLAYER_HOME.z + 30);
      group.add(mesh);
      const ent = window.RTSEngineCore.registerEntity(mesh, 'unit', 'voidCovenant', 200, 1.4);
      ent.speed = 4.0;
      ent.maxCarry = 25;
      mesh.userData.rtsRole = 'harvester'; // additive — never overwrite userData (entityId lives there)
    }

    SCENE_REF.add(group);
    if (typeof console !== 'undefined') console.log('[WarCommand] Player army spawned: ' + SOLDIER_COUNT + ' soldiers + 4 harvesters at Grand Tower.');
    return SOLDIER_COUNT + 4;
  }

  // ─── INSTALL / TICK ────────────────────────────────────────────────────
  let _installed = false;
  function install(scene) {
    if (_installed || !scene) return; // latch — double-call double-spawns the army
    _installed = true;
    SCENE_REF = scene;

    // 1. Crash the AI timeline to real-war speeds.
    if (window.RTSAIDirector && typeof window.RTSAIDirector.setPacing === 'function') {
      window.RTSAIDirector.setPacing({
        resourceRate: 36,     // 2x default (18) → unit every ~2.2s
        spawnCost: 80,        // keep base cost
        squadThreshold: 6,    // waves of 6 → every ~13s per faction
        unitSpeed: 3          // 3x march speed → 1300u in ~80s instead of 4min
      });
      if (typeof window.RTSAIDirector.onWave === 'function') {
        window.RTSAIDirector.onWave(showWaveAlert);
      }
    }

    // 2. Spawn the player army (safe after scene + engines are live).
    try { spawnPlayerArmy(); } catch (e) { if (typeof console !== 'undefined') console.warn('[WarCommand] Army spawn failed:', e && e.message); }

    if (typeof console !== 'undefined') console.log('[WarCommand] War Command active — AI pumping, army deployed, alerts live.');
  }

  function tick(dt) {
    tickAlertUI();
  }

  window.RTSWarCommand = { install, tick };
})();
