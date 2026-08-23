/**
 * city-clock.js — CPL CITY CLOCK: the main-city day/night cycle.
 * ===========================================================================
 * The vision audit's #1 Body gap was "NPC work/draft/customize daily life
 * loop." The main city had NO clock (only soul-realms had day/night inside
 * realm-world.js). This module gives the main city a real 24h clock that:
 *
 *   1. Advances day/time in the EngineScheduler tick (canonical per-frame order).
 *   2. Exposes window.GSKCityClock { day, time, speed, phase(), toHUD() }.
 *   3. Drives day/night BRIGHTNESS on the scene lights WITHOUT fighting the
 *      GSK mood bridge (mood owns HUE via atmos.sky/fog/hemi colors; this clock
 *      owns BRIGHTNESS via light intensity + its own orbiting sun light).
 *
 * Flag-gated by window.__GENESIS_CITY_CLOCK (default ON).
 */
(function () {
  function install(Genesis) {
    if (!Genesis) return;
    if (Genesis.CityClock) return; // idempotent

    var FLAG = '__GENESIS_CITY_CLOCK';

    function flagOn() {
      return (typeof window === 'undefined') || window[FLAG] !== false;
    }

    // 24h game-day in ~12 real minutes by default. Tune via window.GSK_DAY_SPEED
    // (hours of game time per real second). 24 / (12*60) = 0.0333.
    var DEFAULT_SPEED = (typeof window !== 'undefined' && window.GSK_DAY_SPEED)
      ? window.GSK_DAY_SPEED : 24 / (12 * 60);

    // Phases and their brightness multipliers (applied to hemi/sun intensity).
    // GSK mood keeps the HUE; this keeps how DIM the world is.
    var PHASES = [
      { name: 'dawn',  start: 5.0,  end: 8.0,  hemiMul: 0.55, sunI: 0.55, sunWarm: 0x6644aa },
      { name: 'day',   start: 8.0,  end: 17.0, hemiMul: 1.00, sunI: 1.15, sunWarm: 0xfff2cc },
      { name: 'dusk',  start: 17.0, end: 20.5, hemiMul: 0.55, sunI: 0.60, sunWarm: 0xff8844 },
      { name: 'night', start: 20.5, end: 24.0, hemiMul: 0.30, sunI: 0.15, sunWarm: 0x88aaff }
    ];

    var clock = {
      day: 1,
      time: 8.0,       // start at morning so the city is bright on first load
      speed: DEFAULT_SPEED,
      paused: false,
      _lastReal: 0,
      _sun: null,
      _hemiBase: null,   // base intensity of the scene hemi light (set lazily)
      _hemiLight: null,
      _dirty: true
    };

    function phase() {
      var t = clock.time;
      if (t < 5.0) return 'night';          // 0-5 is still night
      for (var i = 0; i < PHASES.length; i++) {
        if (t >= PHASES[i].start && t < PHASES[i].end) return PHASES[i].name;
      }
      return 'night';
    }
    function phaseConfig() {
      var n = phase();
      for (var i = 0; i < PHASES.length; i++) if (PHASES[i].name === n) return PHASES[i];
      return PHASES[PHASES.length - 1];
    }

    // Human clock string: "14:20" and "Day 3 · Night".
    function fmtHMS(t) {
      var h = Math.floor(t);
      var m = Math.floor((t - h) * 60);
      return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }
    function toHUD() {
      return { day: clock.day, time: fmtHMS(clock.time), phase: phase() };
    }

    // Lazily find the scene hemi light so the clock can scale its intensity.
    // The GSK mood bridge re-colors it every frame but never sets intensity —
    // so scaling intensity here never fights the mood hues.
    function resolveLights() {
      if (clock._hemiLight) return true;
      var scene = Genesis.scene;
      if (!scene) return false;
      // Prefer a handle if index.html exposes one; else traverse.
      var H = (typeof window !== 'undefined') ? window.__genesisLights : null;
      if (H && H.hemi) {
        clock._hemiLight = H.hemi;
        clock._hemiBase = (typeof H.hemiBase === 'number') ? H.hemiBase : (H.hemi.intensity || 1.0);
      } else {
        var found = null;
        scene.traverse(function (o) {
          if (found) return;
          if (o && o.isHemisphereLight) found = o;
        });
        if (found) {
          clock._hemiLight = found;
          clock._hemiBase = found.intensity || 1.0;
        }
      }
      return !!clock._hemiLight;
    }

    // Create the orbiting sun light (the clock's own, so the mood bridge never
    // touches it). It sweeps across the sky based on time of day.
    function ensureSun() {
      if (clock._sun || !Genesis.scene) return;
      var T = (typeof window !== 'undefined') ? window.THREE : null;
      if (!T) return;
      var sun = new T.DirectionalLight(0xfff2cc, 1.15);
      sun.name = 'gsk-city-sun';
      Genesis.scene.add(sun);
      // Optional small glowing orb so the sun is visible at dawn/dusk.
      clock._sun = sun;
    }

    function applyAtmosphere(dt) {
      if (!flagOn()) return;
      var cfg = phaseConfig();
      resolveLights();
      ensureSun();
      // Hemi brightness
      if (clock._hemiLight) {
        var target = clock._hemiBase * cfg.hemiMul;
        // Smooth toward target to avoid popping at phase boundaries.
        clock._hemiLight.intensity += (target - clock._hemiLight.intensity) * Math.min(1, dt * 1.5);
      }
      // Sun position + intensity
      if (clock._sun) {
        var T = (typeof window !== 'undefined') ? window.THREE : null;
        if (T) {
          var sunAngle = ((clock.time - 6) / 12) * Math.PI; // 6 = sunrise, 18 = sunset
          var sx = Math.cos(sunAngle) * 60;
          var sy = Math.sin(sunAngle) * 55;
          var sz = 24;
          clock._sun.position.set(sx, Math.max(sy, -8), sz);
          clock._sun.intensity += (cfg.sunI - clock._sun.intensity) * Math.min(1, dt * 1.5);
          if (cfg.sunWarm && clock._sun.color) clock._sun.color.setHex(cfg.sunWarm);
        }
      }
      // Update HUD clock element if present
      if (typeof document !== 'undefined' && document.getElementById) {
        var el = document.getElementById('gsk-city-clock');
        if (el) {
          var hud = toHUD();
          var label = hud.day + ' · ' + hud.time + ' · ' + hud.phase;
          if (el.textContent !== label) el.textContent = label;
          // tint the clock chip by phase
          var chip = document.getElementById('gsk-city-clock-chip');
          if (chip) {
            var cls = 'phase-' + hud.phase;
            if (chip.getAttribute('data-phase') !== cls) {
              chip.setAttribute('data-phase', cls);
              chip.className = chip.className.replace(/phase-[a-z]+/g, '').trim() + ' ' + cls;
            }
          }
        }
      }
    }

    function tick(dt) {
      if (!flagOn() || clock.paused) return;
      clock.time += clock.speed * (dt || 0.016);
      if (clock.time >= 24) { clock.time -= 24; clock.day++; }
      applyAtmosphere(dt || 0.016);
    }

    // Public API
    var CityClock = {
      flag: FLAG,
      isEnabled: flagOn,
      get: function () { return clock; },
      phase: phase,
      toHUD: toHUD,
      setTime: function (t) { if (typeof t === 'number') { clock.time = ((t % 24) + 24) % 24; } },
      setSpeed: function (s) { if (typeof s === 'number' && s >= 0) clock.speed = s; },
      pause: function (p) { clock.paused = !!p; },
      tick: tick,
      _applyNow: applyAtmosphere
    };

    Genesis.CityClock = CityClock;
    if (typeof window !== 'undefined') window.GSKCityClock = CityClock;

    // Register in the EngineScheduler (canonical per-frame order). Falls back
    // to a rAF loop if the scheduler isn't installed yet.
    if (Genesis.EngineScheduler && typeof Genesis.EngineScheduler.defineTick === 'function') {
      Genesis.EngineScheduler.defineTick('city-clock', function (d) { tick(d); }, function () { return flagOn(); });
    } else if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      var loop = function () { tick(0.016); window.requestAnimationFrame(loop); };
      window.requestAnimationFrame(loop);
    }
    if (Genesis.GenesisKernel && typeof Genesis.GenesisKernel.registerSystem === 'function') {
      Genesis.GenesisKernel.registerSystem('city-clock', function (d) { tick(d || 0.016); });
    }
    if (typeof Genesis.registerModule === 'function') {
      Genesis.registerModule('city-clock', { status: 'validated', path: './src/genesis/city-clock.js', gun: 'clock' });
    }
    if (Genesis.EventBridge && typeof Genesis.EventBridge.emit === 'function') {
      Genesis.EventBridge.emit('city-clock:ready', { at: clock.time, day: clock.day });
    }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { install };
  if (typeof window !== 'undefined' && window.Genesis) install(window.Genesis);
})();
