(function() {
  'use strict';

  // ─── SHARED STATE (single source of truth) ────��─────────────────────
  const UI_STATE = {
    resources: { profit: 0, love: 0, tax: 0, aether: 0 },
    selection: new Set(),      // entity ids
    buildMode: null,           // { defId, ghost }
    hotkeys: {},               // registered hotkey meta
    listeners: {}
  };

  function emit(event, payload) {
    const fns = UI_STATE.listeners[event];
    if (fns) for (const fn of fns) { try { fn(payload); } catch (e) { console.warn('[RTSUICore] listener error:', e); } }
  }

  function on(event, fn) {
    (UI_STATE.listeners[event] = UI_STATE.listeners[event] || []).push(fn);
  }

  // ─── ECONOMY HUD ────────────────────────────────────────────────────
  let hudEl = null;
  let hudProfitEl = null, hudLoveEl = null, hudTaxEl = null, hudAetherEl = null;

  function createHUD() {
    if (hudEl) return;
    hudEl = document.createElement('div');
    hudEl.id = 'rts-economy-hud';
    Object.assign(hudEl.style, {
      position: 'fixed',
      top: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: '18px',
      background: 'rgba(6, 10, 20, 0.82)',
      border: '1px solid rgba(0, 255, 204, 0.35)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 15px rgba(0, 255, 204, 0.15)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      padding: '8px 24px',
      borderRadius: '40px',
      zIndex: '100',
      fontFamily: 'Outfit, -apple-system, sans-serif',
      pointerEvents: 'auto'
    });
    hudEl.innerHTML = [
      '<span style="background:linear-gradient(135deg,rgba(255,204,0,.25),rgba(255,102,0,.25));border:1px solid #ffd700;color:#ffd700;padding:4px 12px;border-radius:14px;font-size:12px;font-weight:700;letter-spacing:1px;">PLT</span>',
      stat('profit', '💰 PROFIT', '#ffd700'),
      stat('love', '🌸 LOVE', '#ff66cc'),
      stat('tax', '⚖️ TAX', '#00ffcc'),
      stat('aether', '✦ AETHER', '#aa66ff')
    ].join('');
    document.body.appendChild(hudEl);
    hudProfitEl = document.getElementById('rts-hud-profit');
    hudLoveEl = document.getElementById('rts-hud-love');
    hudTaxEl = document.getElementById('rts-hud-tax');
    hudAetherEl = document.getElementById('rts-hud-aether');

    // Also drive the legacy #plt-value if anyone still reads it
    if (!document.getElementById('plt-value')) {
      const plt = document.createElement('span');
      plt.id = 'plt-value';
      plt.style.display = 'none';
      document.body.appendChild(plt);
    }
  }

  function stat(id, label, color) {
    return '<div class="gf-stat-item" style="display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;letter-spacing:.5px;color:' + color + ';text-shadow:0 0 12px ' + color + '55;">' +
      '<span style="opacity:0.92;">' + label + ':</span>' +
      '<span class="gf-stat-val" id="rts-hud-' + id + '" style="font-family:ui-monospace,monospace;font-weight:800;font-size:16px;color:#fff;">0</span></div>';
  }

  function readResources() {
    // Primary: RTSEconomySystem (what harvesters write to)
    if (window.RTSEconomySystem && window.RTSEconomySystem.RESOURCES) {
      const r = window.RTSEconomySystem.RESOURCES;
      UI_STATE.resources = {
        profit: r.profit || 0,
        love: r.love || 0,
        tax: r.tax || 0,
        aether: r.aether || 0
      };
    }
    // Overlay: Genesis ResourcePool grand-tower pool (P/L/T if it exists)
    const RP = window.Genesis && window.Genesis.ResourcePool;
    if (RP && RP.get) {
      const gt = RP.get('grand-tower') || RP.get('player') || RP.get('imperium');
      if (gt && !window.RTSEconomySystem) {
        UI_STATE.resources.profit += gt.profit || 0;
        UI_STATE.resources.love += gt.love || 0;
        UI_STATE.resources.tax += gt.tax || 0;
      }
    }
  }

  function updateHUD() {
    if (!hudEl) return;
    readResources();
    const r = UI_STATE.resources;
    if (hudProfitEl) hudProfitEl.textContent = Math.floor(r.profit).toLocaleString();
    if (hudLoveEl) hudLoveEl.textContent = Math.floor(r.love).toLocaleString();
    if (hudTaxEl) hudTaxEl.textContent = Math.floor(r.tax).toLocaleString();
    if (hudAetherEl) hudAetherEl.textContent = Math.floor(r.aether).toLocaleString();
    const plt = document.getElementById('plt-value');
    if (plt) plt.textContent = Math.floor(r.profit);
  }

  // Throttled / event-driven HUD updates to avoid per-frame DOM churn
  function scheduleHUDUpdate() {
    if (scheduleHUDUpdate.queued) return;
    scheduleHUDUpdate.queued = true;
    setTimeout(() => { try { updateHUD(); } finally { scheduleHUDUpdate.queued = false; } }, 250); // max 4 updates/sec
  }

  // ─── HOTKEY REGISTRY ────────────────────────────────────────────────
  // Register a hotkey. opts: { key, label, focus: 'world'|'terminal'|'any', action }
  const HOTKEYS = {};
  function registerHotkey(opts) {
    if (!opts || !opts.key) return;
    const k = opts.key.toLowerCase();
    HOTKEYS[k] = HOTKEYS[k] || [];
    HOTKEYS[k].push(opts);
  }

  function onKey(key, e, ctx) {
    const list = HOTKEYS[key];
    if (!list) return false;
    for (const h of list) {
      if (h.focus && h.focus !== 'any' && h.focus !== ctx.focus) continue;
      try {
        const result = h.action(e);
        if (result !== false) return true; // consumed
      } catch (err) { console.warn('[RTSUICore] hotkey error:', err); }
    }
    return false;
  }

  // ─── SELECTION HELPERS ──────────────────────────────────────────────
  function getSelection() { return UI_STATE.selection; }
  function setSelection(ids) {
    UI_STATE.selection = new Set(ids || []);
    emit('selection:change', { ids: Array.from(UI_STATE.selection) });
  }
  function addSelection(id) {
    UI_STATE.selection.add(id);
    emit('selection:change', { ids: Array.from(UI_STATE.selection) });
  }
  function clearSelection() {
    UI_STATE.selection.clear();
    emit('selection:change', { ids: [] });
  }

  // ─── TICK ──────────────────────────────────────────────────────────
  function tick() {
    // HUD updates are now throttled / event-driven to avoid per-frame DOM writes.
  }

  let installed = false;
  function install() {
    if (installed) return;
    installed = true;
    createHUD();
    // Attempt to subscribe to any economy event emitter; fall back to a throttled poll.
    if (window.RTSEconomySystem && typeof window.RTSEconomySystem.on === 'function') {
      try {
        window.RTSEconomySystem.on('resources:change', scheduleHUDUpdate);
      } catch (e) {
        // some RTSEconomySystem implementations may not support on(); fall back below
        setInterval(updateHUD, 500);
      }
    } else {
      setInterval(updateHUD, 500); // fallback poll (500ms)
    }
    // Initial render of HUD
    updateHUD();

    if (window.RTSInputRouter && window.RTSInputRouter.registerKeyHandler) {
      window.RTSInputRouter.registerKeyHandler(0, onKey);
    }
    console.log('[RTSUICore] Unified UI core installed.');
  }

  window.RTSUICore = {
    UI_STATE,
    emit,
    on,
    install,
    tick,
    registerHotkey,
    getSelection,
    setSelection,
    addSelection,
    clearSelection,
    readResources,
    updateHUD
  };
})();
