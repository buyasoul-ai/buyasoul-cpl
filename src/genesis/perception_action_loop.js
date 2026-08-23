// perception_action_loop.js — P-D Sovereign Agent FSM driver
// ===========================================================================
// The Engine-Tick Loop that closes the wilds.ai "Engine-Tick Loop" gap:
//   PERCEIVE (trust band + visitor proximity) -> PLAN (BehaviorAttacher) ->
//   ACT (execute intent) -> REACT (events flow through EventBridge P-F spine).
//
// It spawns named sovereign citizens, builds their VISIBLE proxy bodies via
// CitizenAI.syncFromRegistry (closing the "no visible citizen bodies" gap), and
// drives them. It disables CitizenAI's own simple wander tick to avoid double
// control — CitizenAI remains the body/memory substrate; this loop is the brain.
//
// Flag default ON (window.__GENESIS_AGENT_FSM !== false) — law: flags default ON.
(function () {
  function install(Genesis) {
    if (!Genesis) return;
    if (Genesis.AgentFSM) return; // idempotent

    var FLAG = '__GENESIS_AGENT_FSM';
    var PLAYER = 'player';
    var ROSTER = ['Allie', 'ARIA', 'Brasi', 'Pope', 'Sudo'];
    var spawned = false;
    var states = new Map(); // id -> ctx (mutable FSM state)

    function flagOn() {
      return (typeof window === 'undefined') || window[FLAG] !== false;
    }

    function spawnCitizens() {
      var Reg = Genesis.EntityRegistry;
      var CA = Genesis.CitizenAI;
      if (!Reg || !CA) return false;
      var existing = (Reg.find && Reg.find('citizen')) || [];
      if (existing.length) { spawned = true; CA.syncFromRegistry(); reposition(); return true; }
      ROSTER.forEach(function (name, i) {
        var id = Reg.register(null, {
          kind: 'citizen', owner: 'agent://fsm', tags: ['citizen', 'fsm'],
          meta: { name: name, role: 'sovereign-agent', fsm: true }
        });
        states.set(id, { id: id, name: name, idx: i, behavior: null, target: null, leg: 0, greeted: false, _announced: false, _threat: false });
      });
      CA.syncFromRegistry(); // builds proxy bodies + CitizenAI records
      reposition();
      spawned = true;
      if (Genesis.EventBridge && Genesis.EventBridge.emit) {
        Genesis.EventBridge.emit('agent:spawn', { count: ROSTER.length, roster: ROSTER });
      }
      return true;
    }

    // Bring proxy bodies to a visible near ring so the world looks inhabited.
    function reposition() {
      var CA = Genesis.CitizenAI; if (!CA) return;
      var Reg = Genesis.EntityRegistry; if (!Reg || !Reg.find) return;
      var list = Reg.find('citizen'); if (!list) return;
      list.forEach(function (r, i) {
        if (r.obj && r.obj.position) {
          var a = (i / Math.max(1, list.length)) * Math.PI * 2;
          var rad = 42 + (i % 3) * 12;
          r.obj.position.set(Math.cos(a) * rad, 0, Math.sin(a) * rad);
          if (r.meta) r.meta.home = { x: r.obj.position.x, z: r.obj.position.z };
        }
      });
    }

    function playerPosition() {
      var Reg = Genesis.EntityRegistry;
      if (Reg && Reg.find) {
        var p = Reg.find('player');
        if (p && p.length && p[0].obj && p[0].obj.position) return { x: p[0].obj.position.x, z: p[0].obj.position.z };
      }
      return { x: 0, z: 0 }; // hub/pyramid as the visitor magnet
    }

    function tick(dt) {
      if (!flagOn()) return;
      // Defensive: ensure only THIS loop drives citizen movement even if Act VI
      // flipped CitizenAI's flag on after our install. Bodies still build via
      // syncFromRegistry (no flag gate). Reversible by flipping the flag.
      if (Genesis.CitizenAI && typeof window !== 'undefined' && window.__GENESIS_CITIZEN_AI === true) {
        try { window.__GENESIS_CITIZEN_AI = false; } catch (_) {}
      }
      var CA = Genesis.CitizenAI, TL = Genesis.TrustLedger, EB = Genesis.EventBridge, BA = Genesis.BehaviorAttacher;
      if (!CA || !TL || !BA) return;          // systems not ready yet
      if (!spawned && !spawnCitizens()) return;
      var time = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
      var pPos = playerPosition();
      var Reg = Genesis.EntityRegistry;
      var citizens = (Reg && Reg.find) ? Reg.find('citizen') : [];
      citizens.forEach(function (r, i) {
        var st = states.get(r.id);
        if (!st) { st = { id: r.id, name: (r.meta && r.meta.name) || r.id, idx: i, behavior: null, target: null, leg: 0, greeted: false }; states.set(r.id, st); }
        var obj = r.obj;
        var pos = (obj && obj.position) ? { x: obj.position.x, z: obj.position.z } : { x: 0, z: 0 };
        var band = TL.getBand(r.id, PLAYER);
        var playerNear = Math.hypot(pPos.x - pos.x, pPos.z - pos.z) < 14;

        // PERCEIVE (band + proximity)
        st.pos = pos;
        st.home = (r.meta && r.meta.home) || pos;
        st.route = (r.meta && r.meta.route) || null;
        st.work = (r.meta && r.meta.work) || null;
        st.social = (r.meta && r.meta.social) || null;
        st.profession = (r.meta && r.meta.profession) || null;
        st.playerPos = pPos; st.playerNear = playerNear; st.band = band; st.time = time; st.idx = i;

        // PLAN
        var planned = BA.planFor(st);
        if (st.behavior !== planned) {
          st.behavior = planned;
          if (EB && EB.emit) EB.emit('agent:plan', { id: r.id, name: st.name, behavior: planned, band: band });
        }

        // ACT (behavior proposes intent; loop executes)
        var def = BA.getBehavior(planned);
        var intent = def ? def.tick(st, dt || 0.016) : null;
        applyIntent(r, st, intent, EB, TL, dt || 0.016);

        // REACT: trust band transitions already emit via TrustLedger; recorded here.
        if (EB && EB.emit && intent && intent.trust) { /* agent:react emitted inside applyIntent */ }
      });
    }

    function applyIntent(r, ctx, intent, EB, TL, dt) {
      if (!intent) return;
      var obj = r.obj;
      if (intent.move && obj && obj.position) {
        var tx = intent.move.x, tz = intent.move.z, sp = (intent.speed || 2.4) * dt;
        var dx = tx - obj.position.x, dz = tz - obj.position.z, d = Math.hypot(dx, dz) || 1;
        if (d > 0.2) {
          obj.position.x += (dx / d) * sp;
          obj.position.z += (dz / d) * sp;
          if (typeof obj.lookAt === 'function') obj.lookAt(tx, obj.position.y, tz);
        }
      }
      if (intent.emit && EB && EB.emit) {
        intent.emit.forEach(function (e) { EB.emit(e.type, Object.assign({ id: ctx.id, name: ctx.name }, e.payload || {})); });
      }
      if (intent.trust && TL && TL.addTrustDelta) {
        var res = TL.addTrustDelta(ctx.id, intent.trust.target, intent.trust.delta, intent.trust.type, intent.trust.desc, 'agent-fsm');
        if (res && res.ok && EB && EB.emit) EB.emit('agent:react', { id: ctx.id, name: ctx.name, behavior: ctx.behavior, band: res.band, score: res.newScore });
      }
      if (intent.say && EB && EB.emit) EB.emit('agent:say', { id: ctx.id, name: ctx.name, text: intent.say });
    }

    var AgentFSM = {
      flag: FLAG,
      isEnabled: function () { return flagOn(); },
      tick: tick,
      spawn: function () { return spawnCitizens(); },
      summary: function () {
        var by = {};
        for (var s of states.values()) by[s.behavior || 'none'] = (by[s.behavior || 'none'] || 0) + 1;
        return { enabled: flagOn(), spawned: spawned, citizens: states.size, behaviors: by };
      },
      // demo hook: prove the FSM reacts — drop a citizen to HOSTILE, it flees.
      debugBetray: function (id) {
        if (Genesis.TrustLedger) return Genesis.TrustLedger.addTrustDelta(id, PLAYER, -60, 'betrayal', 'Debug betrayal', 'debug');
        return null;
      }
    };

    Genesis.AgentFSM = AgentFSM;

    // CitizenAI is imported + ON (Act VI), but we are the sovereign brain: disable
    // its simple wander tick so only THIS loop drives movement. Bodies still build
    // via syncFromRegistry (which has no flag gate). Reversible: flip the flag back.
    if (Genesis.CitizenAI) { try { window.__GENESIS_CITIZEN_AI = false; } catch (_) {} }

    if (Genesis.EngineScheduler && typeof Genesis.EngineScheduler.defineTick === 'function') {
      Genesis.EngineScheduler.defineTick('agent-fsm', function (d) { tick(d); }, function () { return flagOn(); });
    } else if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      var loop = function () { tick(0.016); window.requestAnimationFrame(loop); };
      window.requestAnimationFrame(loop);
    }
    if (Genesis.GenesisKernel && typeof Genesis.GenesisKernel.registerSystem === 'function') {
      Genesis.GenesisKernel.registerSystem('agent-fsm', function (d) { tick(d || 0.016); });
    }
    if (typeof Genesis.registerModule === 'function') {
      Genesis.registerModule('agent-fsm', { status: 'validated', path: './src/genesis/perception_action_loop.js', gun: 'FSM' });
    }
    if (Genesis.EventBridge && typeof Genesis.EventBridge.emit === 'function') {
      Genesis.EventBridge.emit('agent-fsm:ready', { at: Date.now() });
    }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { install };
  if (typeof window !== 'undefined' && window.Genesis) install(window.Genesis);
})();
