// behavior-attacher.js — P-D Sovereign Agent FSM: declarative behavior registry + planner
// ===========================================================================
// Genie Engine graft: "task-based unit commands" (gather / build / trade / patrol /
// socialize / flee / pursue / threaten) + goal-oriented, no-cheat AI.
//
// DESIGN (CASCADE by construction): a behavior is PURE. Each tick it returns an
// INTENT — { move?, speed?, emit?, trust?, say? } — and the loop (the
// server-equivalent) EXECUTES it. The model (behavior) proposes; the loop decides.
// No behavior can mutate the world directly. Trust bands (P-A) gate which behavior
// is chosen, so a betrayed citizen flees and a befriended one socializes.
//
// Default ON (no flag gate) — it is a library; perception_action_loop.js drives it.
(function () {
  function install(Genesis) {
    if (!Genesis) return;
    if (Genesis.BehaviorAttacher) return; // idempotent

    var STATE = {
      GATHER: 'gather', BUILD: 'build', TRADE: 'trade', PATROL: 'patrol',
      SOCIALIZE: 'socialize', FLEE: 'flee', IDLE: 'idle', PURSUE: 'pursue', THREATEN: 'threaten',
      // Daily-life states (consumed by the time-aware planner; anchors come from
      // daily-life-loop.js via ctx.work / ctx.home / ctx.social / ctx.profession)
      WORK: 'work', SLEEP: 'sleep', COMMUTE: 'commute', SOCIAL_HANGOUT: 'social-hangout'
    };

    var behaviors = {};
    function registerBehavior(name, def) { if (name && def && typeof def.tick === 'function') behaviors[name] = def; }
    function getBehavior(name) { return behaviors[name] || null; }

    // intent builders (merged into one object by the behavior tick)
    function moveTo(x, z, speed) { return { move: { x: x, z: z }, speed: speed || 2.4 }; }
    function emit(type, payload) { return { emit: [{ type: type, payload: payload || {} }] }; }
    function trust(target, delta, type, desc) { return { trust: { target: target, delta: delta, type: type, desc: desc } }; }
    function say(text) { return { say: text }; }
    function dist(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }

    // ── GATHER: drift toward a resource node near the world, emit gather ──
    registerBehavior(STATE.GATHER, {
      tick: function (ctx, dt) {
        if (!ctx.target || dist(ctx.target.x, ctx.target.z, ctx.pos.x, ctx.pos.z) < 3)
          ctx.target = { x: (Math.random() - 0.5) * 70, z: (Math.random() - 0.5) * 70 };
        var intent = moveTo(ctx.target.x, ctx.target.z, 2.4);
        if (Math.random() < 0.01) intent.emit = [{ type: 'agent:gather', payload: { id: ctx.id, at: ctx.target } }];
        return intent;
      }
    });

    // ── BUILD: go to a build site, emit build ──
    registerBehavior(STATE.BUILD, {
      tick: function (ctx, dt) {
        if (!ctx.target || dist(ctx.target.x, ctx.target.z, ctx.pos.x, ctx.pos.z) < 3)
          ctx.target = { x: 18 + (ctx.idx % 3) * 12, z: 18 + (ctx.idx % 2) * 12 };
        var intent = moveTo(ctx.target.x, ctx.target.z, 2.0);
        if (Math.random() < 0.008) intent.emit = [{ type: 'agent:build', payload: { id: ctx.id, at: ctx.target } }];
        return intent;
      }
    });

    // ── TRADE: approach the hub/visitor; trading raises trust ──
    registerBehavior(STATE.TRADE, {
      tick: function (ctx, dt) {
        var t = ctx.playerPos || { x: 0, z: 0 };
        var intent = moveTo(t.x, t.z, 2.6);
        if (Math.random() < 0.02) {
          // P-C: trust-gated trade dialogue
          var TD = (typeof Genesis !== 'undefined' && Genesis.TrustDialogue);
          var sayText = TD ? TD.getDialogue(ctx.id, 'trade') : null;
          if (sayText) intent.say = sayText;
          intent.emit = [{ type: 'agent:trade', payload: { id: ctx.id } }];
          intent.trust = trust('player', 1, 'trade', 'Citizen traded with the visitor');
        }
        return intent;
      }
    });

    // ── PATROL: loop a route around home ──
    registerBehavior(STATE.PATROL, {
      tick: function (ctx, dt) {
        var home = ctx.home || { x: 0, z: 0 };
        var route = ctx.route && ctx.route.length
          ? ctx.route
          : [home, { x: home.x + 24, z: home.z + 10 }, { x: home.x - 18, z: home.z - 14 }];
        var p = route[ctx.leg % route.length];
        if (dist(p.x, p.z, ctx.pos.x, ctx.pos.z) < 2) ctx.leg = (ctx.leg || 0) + 1;
        return moveTo(p.x, p.z, 2.0);
      }
    });

    // ── SOCIALIZE: approach visitor/friend, raise trust, greet once ──
    registerBehavior(STATE.SOCIALIZE, {
      tick: function (ctx, dt) {
        var t = ctx.playerPos || { x: 0, z: 0 };
        var intent = moveTo(t.x, t.z, 2.8);
        if (!ctx.greeted && dist(t.x, t.z, ctx.pos.x, ctx.pos.z) < 12) {
          ctx.greeted = true;
          // P-C: trust-gated dialogue (band-aware, personality-toned)
          var TD = (typeof Genesis !== 'undefined' && Genesis.TrustDialogue);
          var sayText = TD ? TD.getDialogue(ctx.id, 'greeting') : null;
          intent.say = sayText || 'Hello, friend. I remember you.';
          intent.trust = trust('player', 2, 'socialize', 'Citizen socialized with the visitor');
        }
        if (Math.random() < 0.015) intent.trust = trust('player', 1, 'socialize', 'Citizen enjoyed the company');
        return intent;
      }
    });

    // ── FLEE: hostile — run away from the visitor, announce hostility ──
    // P47: if BetrayalRecall is present, the citizen shouts a SPECIFIC
    // betrayal line referencing what the player did (not generic hostility).
    registerBehavior(STATE.FLEE, {
      enter: function (ctx) { ctx._announced = false; },
      tick: function (ctx, dt) {
        var t = ctx.playerPos || { x: 0, z: 0 };
        var ax = ctx.pos.x - t.x, az = ctx.pos.z - t.z, d = Math.hypot(ax, az) || 1;
        var fx = ctx.pos.x + (ax / d) * 40, fz = ctx.pos.z + (az / d) * 40;
        var intent = moveTo(fx, fz, 3.4);
        if (!ctx._announced) {
          ctx._announced = true;
          // P47: try betrayal-specific dialogue first
          var BR = (typeof Genesis !== 'undefined' && Genesis.BetrayalRecall);
          var betrayalSay = BR ? BR.sayRecall(ctx.id, 'player') : null;
          if (betrayalSay) {
            intent.say = betrayalSay.say;
            intent.emit = [{ type: 'agent:betrayal', payload: { id: ctx.id, band: 'HOSTILE', eventType: betrayalSay.meta.eventType, description: betrayalSay.meta.description } }];
          } else {
            intent.emit = [{ type: 'agent:hostile', payload: { id: ctx.id, band: 'HOSTILE' } }];
          }
        } else if (Math.random() < 0.008) {
          // Occasionally re-announce hostility with a recall line
          var BR2 = (typeof Genesis !== 'undefined' && Genesis.BetrayalRecall);
          var recallLine = BR2 ? BR2.sayRecall(ctx.id, 'player') : null;
          if (recallLine) intent.say = recallLine.say;
          intent.emit = [{ type: 'agent:flee', payload: { id: ctx.id } }];
        }
        return intent;
      }
    });

    // ── PURSUE: mind tracked — approach (used if a 'player' entity is present) ──
    registerBehavior(STATE.PURSUE, {
      tick: function (ctx, dt) {
        var t = ctx.playerPos || { x: 0, z: 0 };
        return moveTo(t.x, t.z, 3.0);
      }
    });

    // ── THREATEN (non-destructive): hostile shout, keep distance, never strike ──
    // P47: uses BetrayalRecall to reference specific wrongs when threatening.
    registerBehavior(STATE.THREATEN, {
      enter: function (ctx) { ctx._threat = false; },
      tick: function (ctx, dt) {
        var t = ctx.playerPos || { x: 0, z: 0 };
        var d = dist(t.x, t.z, ctx.pos.x, ctx.pos.z);
        var intent;
        if (d < 10) {
          var ax = ctx.pos.x - t.x, az = ctx.pos.z - t.z, m = d || 1;
          intent = moveTo(ctx.pos.x + (ax / m) * 8, ctx.pos.z + (az / m) * 8, 3.0);
        } else {
          intent = moveTo(t.x, t.z, 3.0);
        }
        if (!ctx._threat) {
          ctx._threat = true;
          // P47: try betrayal-specific dialogue first
          var BR = (typeof Genesis !== 'undefined' && Genesis.BetrayalRecall);
          var betrayalSay = BR ? BR.sayRecall(ctx.id, 'player') : null;
          if (betrayalSay) {
            intent.say = betrayalSay.say;
            intent.emit = [{ type: 'agent:threaten', payload: { id: ctx.id, eventType: betrayalSay.meta.eventType } }];
          } else {
            intent.emit = [{ type: 'agent:threaten', payload: { id: ctx.id } }];
          }
        } else if (Math.random() < 0.005 && Genesis.TrustDialogue) {
          var hostileSay = Genesis.TrustDialogue.getDialogue(ctx.id, 'threaten');
          if (hostileSay) intent.say = hostileSay;
        }
        return intent;
      }
    });

    // ── IDLE ──
    registerBehavior(STATE.IDLE, {
      tick: function (ctx, dt) {
        if (Math.random() < 0.005) return emit('agent:idle', { id: ctx.id });
        return null;
      }
    });

    // ── WORK: go to the work anchor, then stand and emit agent:work ──
    registerBehavior(STATE.WORK, {
      tick: function (ctx, dt) {
        var w = ctx.work || null;
        if (!w) {
          // No anchor assigned (daily-life-loop off): degrade to gather drift.
          if (!ctx.target || dist(ctx.target.x, ctx.target.z, ctx.pos.x, ctx.pos.z) < 3)
            ctx.target = { x: (Math.random() - 0.5) * 70, z: (Math.random() - 0.5) * 70 };
          return moveTo(ctx.target.x, ctx.target.z, 2.4);
        }
        var intent = moveTo(w.x, w.z, 2.0);
        if (dist(w.x, w.z, ctx.pos.x, ctx.pos.z) < 4) {
          // At the work site: work in place (occasional emit + a tiny drift so
          // the body visibly "labors" instead of standing frozen).
          if (Math.random() < 0.02) {
            intent.emit = [{ type: 'agent:work', payload: { id: ctx.id, at: w, profession: ctx.profession || null } }];
          }
          if (Math.random() < 0.01 && Genesis.EventBridge && typeof Genesis.EventBridge.emit === 'function') {
            Genesis.EventBridge.emit('agent:work', { id: ctx.id, name: ctx.name, profession: ctx.profession || null });
          }
        }
        return intent;
      }
    });

    // ── COMMUTE: walk from home to work (no stationing) ──
    registerBehavior(STATE.COMMUTE, {
      tick: function (ctx, dt) {
        var w = ctx.work || ctx.social || null;
        if (!w) {
          if (Math.random() < 0.01) return emit('agent:commute', { id: ctx.id });
          return null;
        }
        return moveTo(w.x, w.z, 2.6);
      }
    });

    // ── SLEEP: return home, then dim (no movement) + occasional Zzz ──
    registerBehavior(STATE.SLEEP, {
      tick: function (ctx, dt) {
        var h = ctx.home || null;
        if (!h) {
          // No home anchor: curl up in place.
          if (Math.random() < 0.01) return emit('agent:sleep', { id: ctx.id });
          return null;
        }
        if (dist(h.x, h.z, ctx.pos.x, ctx.pos.z) > 3) {
          return moveTo(h.x, h.z, 2.0);
        }
        // Home: asleep. Signal the body to dim (visual only) + Zzz.
        if (typeof Genesis !== 'undefined' && Genesis.EventBridge && typeof Genesis.EventBridge.emit === 'function') {
          if (Math.random() < 0.01) Genesis.EventBridge.emit('agent:sleep', { id: ctx.id, name: ctx.name });
        }
        if (Math.random() < 0.02) return emit('agent:sleep', { id: ctx.id });
        return null;
      }
    });

    // ── SOCIAL_HANGOUT: go to the social district and mingle (no player needed) ──
    registerBehavior(STATE.SOCIAL_HANGOUT, {
      tick: function (ctx, dt) {
        var s = ctx.social || ctx.home || null;
        if (!s) {
          if (Math.random() < 0.01) return emit('agent:socialize', { id: ctx.id });
          return null;
        }
        var intent = moveTo(s.x, s.z, 2.2);
        if (dist(s.x, s.z, ctx.pos.x, ctx.pos.z) < 4 && Math.random() < 0.02) {
          intent.emit = [{ type: 'agent:socialize', payload: { id: ctx.id, at: s } }];
        }
        return intent;
      }
    });

    // Daily schedule by hour of the game-day (single source of truth for both the
    // planner and the daily-life-loop labeler):
    //   0-6    sleep (nights are for rest)
    //   6-8    wake + commute to work
    //   8-12   work
    //   12-13  lunch break (social district)
    //   13-18  work
    //   18-22  dusk — socialize at the social district / trade with visitor
    //   22-24  head home, sleep
    function scheduleFor(ctx) {
      var t = (ctx && typeof ctx.time === 'number') ? ctx.time : null;
      if (t === null || typeof t !== 'number') return null;
      if (t < 6 || t >= 22) return STATE.SLEEP;
      if (t >= 6 && t < 8) return STATE.COMMUTE;
      if (t >= 8 && t < 12) return STATE.WORK;
      if (t >= 12 && t < 13) return STATE.SOCIAL_HANGOUT;
      if (t >= 13 && t < 18) return STATE.WORK;
      return STATE.SOCIAL_HANGOUT; // 18-22 dusk
    }

    // Planner: time-aware daily life first, trust-gated social/defense second.
    // The global city clock (window.GSKCityClock, from city-clock.js) owns the
    // TIME; the Trust Ledger band still overrides for fleeing/befriending.
    function planFor(ctx) {
      // Trust overrides trump the clock entirely (a betrayed citizen flees at noon).
      if (ctx.band === 'HOSTILE') return STATE.FLEE;
      if (ctx.band === 'FRIEND') return ctx.playerNear ? STATE.SOCIALIZE : STATE.TRADE;

      var clock = (typeof window !== 'undefined' && window.GSKCityClock) ? window.GSKCityClock : null;
      var t = (clock && typeof clock.get === 'function') ? clock.get().time : null;

      // No clock (daily-life off): fall back to the legacy 12s goal rotation.
      if (t === null || typeof t !== 'number') {
        var goals = [STATE.GATHER, STATE.BUILD, STATE.TRADE, STATE.PATROL];
        var pick = goals[Math.floor((ctx.time / 12) % goals.length)];
        if (pick === STATE.TRADE && !ctx.playerPos) pick = STATE.PATROL;
        return pick;
      }
      var sched = scheduleFor({ time: t });
      return sched || STATE.PATROL;
    }

    var BehaviorAttacher = {
      STATE: STATE,
      registerBehavior: registerBehavior,
      getBehavior: getBehavior,
      planFor: planFor,
      scheduleFor: scheduleFor,
      summary: function () { return { behaviors: Object.keys(behaviors) }; }
    };

    Genesis.BehaviorAttacher = BehaviorAttacher;
    if (typeof Genesis.registerModule === 'function') {
      Genesis.registerModule('behavior-attacher', { status: 'validated', path: './src/genesis/behavior-attacher.js', gun: 'FSM' });
    }
    if (Genesis.EventBridge && typeof Genesis.EventBridge.emit === 'function') {
      Genesis.EventBridge.emit('behavior-attacher:ready', { at: Date.now() });
    }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { install };
  if (typeof window !== 'undefined' && window.Genesis) install(window.Genesis);
})();
