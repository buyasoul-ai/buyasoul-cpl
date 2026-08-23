/**
 * daily-life-loop.js — CPL DAILY LIFE: professions, homes, work anchors.
 * ===========================================================================
 * Closes the vision-audit gap "NPC work/draft/customize daily life loop."
 *
 * The sovereign citizens (Allie, ARIA, Brasi, Pope, Sudo) spawned by
 * perception_action_loop.js are aimless — they drift random points on a 12s
 * rotation. This module gives each one a PROFESSION and deterministic
 * { home, work, social } anchors, written onto their EntityRegistry record's
 * meta (the SAME records perception_action_loop reads — r.meta.home already
 * flows into st.home; we add st.work / st.social / st.profession).
 *
 * behavior-attacher.js consumes these anchors via the ctx object in its
 * time-aware planFor(): night → SLEEP at home, dawn → COMMUTE to work,
 * day → WORK, noon → SOCIALIZE, dusk → SOCIALIZE/TRADE.
 *
 * Flag-gated by window.__GENESIS_DAILY_LIFE (default ON).
 */
(function () {
  function install(Genesis) {
    if (!Genesis) return;
    if (Genesis.DailyLife) return; // idempotent

    var FLAG = '__GENESIS_DAILY_LIFE';

    function flagOn() {
      return (typeof window === 'undefined') || window[FLAG] !== false;
    }

    // Profession roster. Each profession has a district bias (which of the
    // city's 4 districts it lives/works in) and a role tag for future
    // draft/customize phases. Anchors are deterministic per (name, idx) so the
    // city layout is stable across reloads.
    var PROFESSIONS = [
      { name: 'Farmer',   district: 'home',   workZone: { x: [-70, -30], z: [-70, -30] }, color: 0x88ff66, role: 'producer' },
      { name: 'Merchant', district: 'social', workZone: { x: [-70, -30], z: [30, 70] },    color: 0xffaa44, role: 'commerce' },
      { name: 'Smith',    district: 'work',   workZone: { x: [-70, -30], z: [-70, -30] }, color: 0xff8844, role: 'producer' },
      { name: 'Priest',   district: 'learn',  workZone: { x: [30, 70],   z: [30, 70] },    color: 0xaa88ff, role: 'keeper' },
      { name: 'Architect',district: 'learn',  workZone: { x: [30, 70],   z: [-70, -30] }, color: 0x66ccff, role: 'builder' }
    ];

    // Deterministic pseudo-random from a seed (no Math.random — stable anchors).
    function seeded(seed) {
      var s = seed % 2147483647; if (s <= 0) s += 2147483646;
      return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    }

    function anchorFor(name, idx, zone, seedBase) {
      var rnd = seeded(seedBase + idx * 101 + name.length * 7);
      return {
        x: Math.round((zone.x[0] + rnd() * (zone.x[1] - zone.x[0])) * 10) / 10,
        z: Math.round((zone.z[0] + rnd() * (zone.z[1] - zone.z[0])) * 10) / 10
      };
    }

    // Assign profession + anchors to every spawned citizen record, once.
    // Reads current citizens from EntityRegistry so it composes with whatever
    // spawned them (perception_action_loop ROSTER or AgentGateway spawns).
    function assignCitizens() {
      var Reg = Genesis.EntityRegistry;
      if (!Reg || typeof Reg.find !== 'function') return false;
      var list = Reg.find('citizen');
      if (!list || !list.length) return false;
      var assigned = 0;
      list.forEach(function (r, i) {
        if (r.meta && r.meta.profession) return; // already assigned
        var prof = PROFESSIONS[i % PROFESSIONS.length];
        var homeZone = { x: [30, 70], z: [-70, -30] };      // 'home' district
        var socialZone = { x: [-70, -30], z: [30, 70] };    // 'social' district
        var home = anchorFor(r.id || String(i), i, homeZone, 1000 + i);
        var work = anchorFor(r.id || String(i), i, prof.workZone, 2000 + i);
        var social = anchorFor(r.id || String(i), i, socialZone, 3000 + i);
        if (r.meta) {
          r.meta.profession = prof.name;
          r.meta.professionColor = prof.color;
          r.meta.role = prof.role;
          r.meta.home = home;
          r.meta.work = work;
          r.meta.social = social;
          r.meta.anchorsAssigned = true;
        }
        attachLabel(r, prof, i);
        assigned++;
      });
      return assigned > 0;
    }

    // ─── VISIBLE STATE: floating name+status label + body emissive color ───
    // A small canvas-text sprite hovers above each citizen showing
    // "Name · PROFESSION" and the current schedule state (WORK/SLEEP/etc).
    // The body emissive is tinted by state: working=gold, sleeping=dim blue,
    // socializing=cyan. Pure visual; no game logic depends on it.
    function attachLabel(r, prof, i) {
      var T = (typeof window !== 'undefined') ? window.THREE : null;
      if (!T || !r || !r.obj) return;
      // Skip if already attached (re-assign safety).
      if (r.obj.userData && r.obj.userData.__dailyLifeLabel) return;
      var label = makeLabelSprite((r.meta && r.meta.name) || r.id, prof ? prof.name : '');
      label.position.set(0, 3.4, 0); // above head (head is at ~2.35)
      r.obj.add(label);
      if (!r.obj.userData) r.obj.userData = {};
      r.obj.userData.__dailyLifeLabel = label;
      r.obj.userData.__dailyLifeEmissive = prof ? prof.color : 0x66ddff;
      r.obj.userData.__dailyLifeStatus = 'idle';
      applyStatusVisual(r, 'idle');
    }

    function makeLabelSprite(nameText, roleText) {
      var T = (typeof window !== 'undefined') ? window.THREE : null;
      if (!T) return null;
      var canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 128;
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 34px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(nameText, 256, 42);
      ctx.font = 'bold 24px monospace';
      ctx.fillStyle = '#88ffcc';
      if (roleText) ctx.fillText(roleText.toUpperCase(), 256, 86);
      var tex = new T.CanvasTexture(canvas);
      tex.minFilter = T.LinearFilter;
      var mat = new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
      var sprite = new T.Sprite(mat);
      sprite.scale.set(6, 1.5, 1);
      sprite.renderOrder = 999;
      return sprite;
    }

    // Status → label text + body emissive tint. Called each tick.
    var STATUS_TEXT = {
      work: 'WORK', sleep: 'SLEEP', commute: 'COMMUTE', 'social-hangout': 'SOCIALIZE',
      idle: 'IDLE', flee: 'FLEE', trade: 'TRADE', pursue: 'PURSUE'
    };
    var STATUS_COLOR = {
      work: 0xffcc44,      // gold
      sleep: 0x3344aa,     // dim blue
      commute: 0x66ffcc,   // teal
      'social-hangout': 0x44ff88, // cyan-green
      idle: 0x3366aa,
      flee: 0xff4444,
      trade: 0xffaa44,
      pursue: 0xff66aa
    };
    function applyStatusVisual(r, status) {
      if (!r || !r.obj) return;
      var ud = r.obj.userData || (r.obj.userData = {});
      ud.__dailyLifeStatus = status;
      var label = ud.__dailyLifeLabel;
      if (label && label.material && label.material.map && status) {
        // Re-draw only when the text actually changes (cheap text write).
        var key = (status || 'idle') + '|' + ((r.meta && r.meta.name) || '');
        if (label._textKey !== key) {
          var name = (r.meta && r.meta.name) || r.id;
          var role = (r.meta && r.meta.profession) || '';
          var canvas = label.material.map.image;
          if (canvas && canvas.getContext) {
            var ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.font = 'bold 34px monospace'; ctx.fillStyle = '#ffffff';
            ctx.fillText(name, 256, 40);
            ctx.font = 'bold 26px monospace';
            ctx.fillStyle = STATUS_COLOR[status] ? '#' + STATUS_COLOR[status].toString(16).padStart(6, '0') : '#88ffcc';
            ctx.fillText((role ? role.toUpperCase() + ' · ' : '') + (STATUS_TEXT[status] || status), 256, 86);
            label.material.map.needsUpdate = true;
          }
          label._textKey = key;
        }
      }
      // Emissive tint on the body (first MeshStandardMaterial child).
      if (r.obj.children) {
        for (var i = 0; i < r.obj.children.length; i++) {
          var m = r.obj.children[i];
          if (m.isMesh && m.material && m.material.emissive) {
            var c = STATUS_COLOR[status] || 0x081828;
            m.material.emissive.setHex(c);
            m.material.emissiveIntensity = (status === 'sleep') ? 0.06 : 0.25;
            break;
          }
        }
      }
    }

    function tick(dt) {
      if (!flagOn()) return;
      assignCitizens(); // cheap no-op after first assignment
      updateStatusLabels();
    }

    // Derive each citizen's schedule state from the clock + trust band and push
    // it to the visible label/emissive. Mirrors behavior-attacher.planFor so the
    // LABEL matches the actual behavior (single schedule source = scheduleFor).
    function updateStatusLabels() {
      var Reg = Genesis.EntityRegistry;
      if (!Reg || typeof Reg.find !== 'function') return;
      var list = Reg.find('citizen');
      if (!list || !list.length) return;
      var clock = (typeof window !== 'undefined' && window.GSKCityClock) ? window.GSKCityClock : null;
      var t = (clock && typeof clock.get === 'function') ? clock.get().time : null;
      var BA = Genesis.BehaviorAttacher;
      var TL = Genesis.TrustLedger;
      var PLAYER = 'player';
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        if (!r || !r.obj) continue;
        var status = 'idle';
        // Trust band override: a betrayed citizen is fleeing, not working.
        if (TL && typeof TL.getBand === 'function' && r.id) {
          try {
            if (TL.getBand(r.id, PLAYER) === 'HOSTILE') { status = 'flee'; }
          } catch (_) {}
        }
        if (status !== 'flee' && t !== null && typeof t === 'number' && BA && typeof BA.scheduleFor === 'function') {
          status = BA.scheduleFor({ time: t }) || 'idle';
        }
        applyStatusVisual(r, status);
      }
    }

    Genesis.DailyLife = DailyLife;
    if (typeof window !== 'undefined') window.GSKDailyLife = DailyLife;

    // Assign on install (citizens may already be spawned) and register a tick.
    assignCitizens();

    if (Genesis.EngineScheduler && typeof Genesis.EngineScheduler.defineTick === 'function') {
      Genesis.EngineScheduler.defineTick('daily-life', function (d) { tick(d); }, function () { return flagOn(); });
    } else if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      var loop = function () { tick(0.016); window.requestAnimationFrame(loop); };
      window.requestAnimationFrame(loop);
    }
    if (Genesis.GenesisKernel && typeof Genesis.GenesisKernel.registerSystem === 'function') {
      Genesis.GenesisKernel.registerSystem('daily-life', function (d) { tick(d || 0.016); });
    }
    if (typeof Genesis.registerModule === 'function') {
      Genesis.registerModule('daily-life', { status: 'validated', path: './src/genesis/daily-life-loop.js', gun: 'life' });
    }
    if (Genesis.EventBridge && typeof Genesis.EventBridge.emit === 'function') {
      Genesis.EventBridge.emit('daily-life:ready', { professions: DailyLife.professions() });
    }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { install };
  if (typeof window !== 'undefined' && window.Genesis) install(window.Genesis);
})();
