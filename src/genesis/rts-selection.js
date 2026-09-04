/**
 * rts-selection.js
 * BUYASOUL CPL / GODFORGE — Unified Selection System (RTS-2)
 *
 * ONE Set<number> as the single source of truth for selection.
 * Exact AoE2 semantics: plain click, shift-toggle, drag-box with deadzone,
 * double-click select-all-same-type, Ctrl+1..9 control groups.
 *
 * Replaces the fragmented selection states in rts-subsystem.js, rts-ui-core.js,
 * and rts-engine-core.js. Everyone reads from and writes to THIS Set.
 *
 * Pattern: imperios-1800-2100 Seleccion.js + OpenRA Selection.cs
 */

(function() {
  'use strict';

  const T = window.THREE;

  // ─── CONFIG ──────────────────────────────────────────────────────────
  const CFG = {
    MAX_SELECTION: 60,         // Cap (imperios TOPE = 60)
    DRAG_DEADZONE: 6,         // px — click vs drag-box threshold (imperios UMBRAL_ARRASTRE)
    DOUBLE_CLICK_MS: 320,     // Max interval for double-click (imperios MS_DOBLE)
    CTRL_GROUP_COUNT: 10,    // Ctrl+1..9 + Ctrl+0
    SELECTION_RING_COLOR: 0x00ff88,
    HOVER_RING_COLOR: 0xffffff,
    RING_SEGMENTS: 48,
  };

  // ─── SELECTION CLASS ─────────────────────────────────────────────────
  class RTSSelection {
    constructor(ctx) {
      this.ctx = ctx; // { scene, camera, entities }

      /** @type {Set<number>} — THE single source of truth */
      this.ids = new Set();

      /** Stable ordered list for HUD (no dancing between frames) */
      this.list = [];

      /** Control groups: Map<groupNum, Set<entityId>> */
      this.groups = new Map();
      for (let i = 0; i < CFG.CTRL_GROUP_COUNT; i++) this.groups.set(i, new Set());

      // ── Internal state ──
      this._lastClickTime = 0;
      this._lastClickEntityId = -1;
      this._dragState = 'idle'; // 'idle' | 'pending' | 'active'
      this._dragStartX = 0;
      this._dragStartY = 0;
      this._dragBoxEl = null;
      this._shiftDown = false;
      this._ctrlDown = false;
      this._listeners = {};

      // ── Selection visual rings (pooled) ──
      this._ringPool = [];
      this._activeRings = new Map(); // entityId -> Line mesh
      this._hoverRing = null;
      this._hoverEntityId = -1;

      // ── Camera reference for box select projection ──
      this._tempVec = new T.Vector3();
    }

    // ─── PUBLIC API ─────────────────────────────────────────────────────

    /**
     * Select a single entity. Clears existing selection unless shift.
     * @param {number} entityId
     * @param {boolean} shift - if true, toggle (add/remove) instead of replace
     */
    select(entityId, shift = false) {
      if (!shift) this.ids.clear();
      if (this.ids.has(entityId) && shift) {
        this.ids.delete(entityId);
      } else {
        if (this.ids.size >= CFG.MAX_SELECTION && !this.ids.has(entityId)) return;
        this.ids.add(entityId);
      }
      this._syncList();
      this._emit('change', { ids: this.list, type: 'click' });
    }

    /**
     * Box select all player units within screen-space rectangle.
     * @param {Object} rect - { left, top, right, bottom } in screen px
     * @param {boolean} shift - if true, add to existing selection
     */
    boxSelect(rect, shift = false) {
      if (!shift) this.ids.clear();
      const camera = this.ctx.camera;
      const entities = this.ctx.entities;
      if (!camera || !entities) return;

      for (const [id, ent] of entities) {
        if (ent.type !== 'unit' || ent.isDead) continue;
        if (ent.faction !== 'voidCovenant') continue;
        if (!ent.mesh) continue;

        // Project to screen
        this._tempVec.copy(ent.mesh.position);
        this._tempVec.project(camera);
        const sx = (this._tempVec.x + 1) / 2 * window.innerWidth;
        const sy = (-this._tempVec.y + 1) / 2 * window.innerHeight;

        if (sx >= rect.left && sx <= rect.right && sy >= rect.top && sy <= rect.bottom) {
          if (this.ids.size >= CFG.MAX_SELECTION) break;
          this.ids.add(id);
        }
      }
      this._syncList();
      this._emit('change', { ids: this.list, type: 'box' });
    }

    /**
     * Double-click: select ALL units of the same type on screen.
     * @param {number} entityId - the unit that was double-clicked
     */
    selectAllOfType(entityId) {
      const entities = this.ctx.entities;
      const ref = entities.get(entityId);
      if (!ref || ref.type !== 'unit') return;

      const typeKey = ref.defId || ref.unitType || ref.type;
      const camera = this.ctx.camera;

      this.ids.clear();
      for (const [id, ent] of entities) {
        if (ent.type !== 'unit' || ent.isDead || ent.faction !== 'voidCovenant') continue;
        const entTypeKey = ent.defId || ent.unitType || ent.type;
        if (entTypeKey !== typeKey) continue;
        if (!ent.mesh) continue;

        // Only select if on screen
        this._tempVec.copy(ent.mesh.position);
        this._tempVec.project(camera);
        if (this._tempVec.x < -1 || this._tempVec.x > 1 || this._tempVec.y < -1 || this._tempVec.y > 1) continue;

        if (this.ids.size >= CFG.MAX_SELECTION) break;
        this.ids.add(id);
      }
      this._syncList();
      this._emit('change', { ids: this.list, type: 'double' });
    }

    /** Clear all selection */
    clear() {
      if (this.ids.size === 0) return;
      this.ids.clear();
      this._syncList();
      this._emit('change', { ids: [], type: 'clear' });
    }

    /** Get the current selection as an array (stable order) */
    getSelected() { return this.list; }

    /** Get the current selection as a Set */
    getSet() { return this.ids; }

    /** Check if entity is selected */
    isSelected(entityId) { return this.ids.has(entityId); }

    /** Remove dead entities from selection AND control groups (call each tick) */
    cullDead(entities) {
      let changed = false;
      // Cull from active selection
      for (const id of this.ids) {
        const ent = entities.get(id);
        if (!ent || ent.isDead) {
          this.ids.delete(id);
          changed = true;
        }
      }
      // Cull dead from control groups
      for (const [, group] of this.groups) {
        for (const id of group) {
          const ent = entities.get(id);
          if (!ent || ent.isDead) {
            group.delete(id);
          }
        }
      }
      if (changed) {
        this._syncList();
        this._emit('change', { ids: this.list, type: 'cull' });
      }
    }

    // ─── CONTROL GROUPS (Ctrl+1..9, 1..9 to recall) ───────────────────

    /**
     * Save current selection to a control group.
     * @param {number} groupNum - 0..9
     */
    saveGroup(groupNum) {
      if (groupNum < 0 || groupNum >= CFG.CTRL_GROUP_COUNT) return;
      const group = this.groups.get(groupNum);
      group.clear();
      for (const id of this.ids) group.add(id);
      this._emit('groupSaved', { group: groupNum, count: group.size });
    }

    /**
     * Recall a control group (replace current selection).
     * @param {number} groupNum - 0..9
     * @param {boolean} doubleTap - if true, center camera on group
     */
    recallGroup(groupNum, doubleTap = false) {
      if (groupNum < 0 || groupNum >= CFG.CTRL_GROUP_COUNT) return;
      const group = this.groups.get(groupNum);
      if (group.size === 0) return;

      this.ids.clear();
      for (const id of group) {
        if (this.ids.size >= CFG.MAX_SELECTION) break;
        this.ids.add(id);
      }
      this._syncList();
      this._emit('change', { ids: this.list, type: 'group', group: groupNum });

      if (doubleTap) this._emit('centerCamera', { ids: this.list });
    }

    /**
     * Add a control group to current selection (shift+number).
     */
    addGroup(groupNum) {
      if (groupNum < 0 || groupNum >= CFG.CTRL_GROUP_COUNT) return;
      const group = this.groups.get(groupNum);
      for (const id of group) {
        if (this.ids.size >= CFG.MAX_SELECTION) break;
        this.ids.add(id);
      }
      this._syncList();
      this._emit('change', { ids: this.list, type: 'groupAdd', group: groupNum });
    }

    /**
     * Flash selection rings white briefly for visual feedback (group recall).
     * @param {number} duration - flash duration in ms (default 300)
     */
    flashGroupRings(duration = 300) {
      const flashColor = 0xffffff;
      const normalColor = CFG.SELECTION_RING_COLOR;
      const start = performance.now();

      const doFlash = () => {
        const elapsed = performance.now() - start;
        const t = elapsed / duration;
        if (t >= 1) {
          // Revert all active rings to normal color
          for (const [id, ring] of this._activeRings) {
            if (ring.material) ring.material.color.setHex(normalColor);
          }
          return;
        }
        // Alternate between white and normal for a blink effect
        const blink = Math.floor(t * 6) % 2 === 0 ? flashColor : normalColor;
        for (const [id, ring] of this._activeRings) {
          if (ring.material) ring.material.color.setHex(blink);
        }
        requestAnimationFrame(doFlash);
      };
      requestAnimationFrame(doFlash);
    }

    // ─── DRAG BOX STATE MACHINE ─────────────────────────────────────────

    /**
     * Call on mousedown (left button).
     * Returns 'pending' if a drag might start, 'click' if it's just a click.
     */
    onMouseDown(clientX, clientY, shift, ctrl) {
      this._shiftDown = shift;
      this._ctrlDown = ctrl;
      this._dragState = 'pending';
      this._dragStartX = clientX;
      this._dragStartY = clientY;
      return 'pending';
    }

    /**
     * Call on mousemove. Returns 'active' if drag exceeded deadzone.
     */
    onMouseMove(clientX, clientY) {
      if (this._dragState !== 'pending') return this._dragState;
      const dx = clientX - this._dragStartX;
      const dy = clientY - this._dragStartY;
      if (Math.abs(dx) >= CFG.DRAG_DEADZONE || Math.abs(dy) >= CFG.DRAG_DEADZONE) {
        this._dragState = 'active';
        this._showDragBox(this._dragStartX, this._dragStartY, clientX, clientY);
        return 'active';
      }
      return 'pending';
    }

    /**
     * Call on mouseup (left button). Returns the rect if box-select happened,
     * or 'click' if it was just a click.
     */
    onMouseUp(clientX, clientY) {
      const state = this._dragState;
      this._dragState = 'idle';

      if (state === 'active') {
        const rect = this._getDragRect(this._dragStartX, this._dragStartY, clientX, clientY);
        this._hideDragBox();
        this.boxSelect(rect, this._shiftDown);
        return rect;
      }

      // It was a click — check for double-click
      this._hideDragBox();
      return 'click';
    }

    /**
     * Check if a click on an entity is a double-click.
     * @returns {boolean} true if this is a double-click
     */
    checkDoubleClick(entityId) {
      const now = performance.now();
      if (this._lastClickEntityId === entityId && (now - this._lastClickTime) < CFG.DOUBLE_CLICK_MS) {
        this._lastClickTime = 0;
        this._lastClickEntityId = -1;
        return true;
      }
      this._lastClickTime = now;
      this._lastClickEntityId = entityId;
      return false;
    }

    // ─── HOVER (visual ring on hovered unit) ───────────────────────────

    setHover(entityId) {
      if (entityId === this._hoverEntityId) return;
      this._hoverEntityId = entityId;
      if (entityId < 0) {
        if (this._hoverRing) this._hoverRing.visible = false;
        return;
      }
      this._ensureHoverRing();
      if (this._hoverRing) this._hoverRing.visible = true;
    }

    // ─── SELECTION VISUALS (pooled rings) ───────────────────────────────

    /**
     * Update selection rings to match current selection. Call per frame.
     * Uses object pooling — no per-frame allocation.
     */
    updateRings(entities) {
      // Hide rings for deselected entities
      for (const [id, ring] of this._activeRings) {
        if (!this.ids.has(id)) {
          ring.visible = false;
          this._ringPool.push(ring);
          this._activeRings.delete(id);
        }
      }

      // Show/create rings for selected entities
      for (const id of this.ids) {
        const ent = entities.get(id);
        if (!ent || !ent.mesh) continue;

        let ring = this._activeRings.get(id);
        if (!ring) {
          ring = this._ringPool.pop() || this._createRing();
          this._activeRings.set(id, ring);
        }
        ring.visible = true;
        ring.position.copy(ent.mesh.position);
        ring.position.y = 0.15;

        // Color by faction
        const mat = ring.material;
        const color = (ent.faction === 'voidCovenant') ? CFG.SELECTION_RING_COLOR : 0xff4444;
        if (mat.color.getHex() !== color) mat.color.setHex(color);
      }

      // Update hover ring
      if (this._hoverEntityId >= 0 && this._hoverRing) {
        const ent = entities.get(this._hoverEntityId);
        if (ent && ent.mesh) {
          this._hoverRing.position.copy(ent.mesh.position);
          this._hoverRing.position.y = 0.1;
          this._hoverRing.visible = true;
        } else {
          this._hoverRing.visible = false;
          this._hoverEntityId = -1;
        }
      }
    }

    _createRing() {
      const points = [];
      const r = 1.2;
      for (let i = 0; i <= CFG.RING_SEGMENTS; i++) {
        const a = (i / CFG.RING_SEGMENTS) * Math.PI * 2;
        points.push(new T.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
      }
      const geo = new T.BufferGeometry().setFromPoints(points);
      const mat = new T.LineBasicMaterial({
        color: CFG.SELECTION_RING_COLOR,
        transparent: true, opacity: 0.8,
        depthTest: false, // Always visible (imperios pattern)
      });
      const ring = new T.Line(geo, mat);
      ring.frustumCulled = false;
      ring.renderOrder = 89; // On top of everything
      ring.visible = false;
      this.ctx.scene?.add(ring);
      return ring;
    }

    _ensureHoverRing() {
      if (this._hoverRing) return;
      const points = [];
      const r = 1.4;
      for (let i = 0; i <= CFG.RING_SEGMENTS; i++) {
        const a = (i / CFG.RING_SEGMENTS) * Math.PI * 2;
        points.push(new T.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
      }
      const geo = new T.BufferGeometry().setFromPoints(points);
      const mat = new T.LineDashedMaterial({
        color: CFG.HOVER_RING_COLOR, dashSize: 0.3, gapSize: 0.2,
        transparent: true, opacity: 0.6, depthTest: false,
      });
      this._hoverRing = new T.Line(geo, mat);
      this._hoverRing.computeLineDistances();
      this._hoverRing.frustumCulled = false;
      this._hoverRing.renderOrder = 89;
      this._hoverRing.visible = false;
      this.ctx.scene?.add(this._hoverRing);
    }

    // ─── DRAG BOX VISUAL ────────────────────────────────────────────────

    _showDragBox(x1, y1, x2, y2) {
      if (!this._dragBoxEl) this._createDragBoxEl();
      const rect = this._getDragRect(x1, y1, x2, y2);
      this._dragBoxEl.style.left = rect.left + 'px';
      this._dragBoxEl.style.top = rect.top + 'px';
      this._dragBoxEl.style.width = (rect.right - rect.left) + 'px';
      this._dragBoxEl.style.height = (rect.bottom - rect.top) + 'px';
      this._dragBoxEl.style.display = 'block';
    }

    _hideDragBox() {
      if (this._dragBoxEl) this._dragBoxEl.style.display = 'none';
    }

    _createDragBoxEl() {
      this._dragBoxEl = document.createElement('div');
      this._dragBoxEl.id = 'rts-drag-box';
      Object.assign(this._dragBoxEl.style, {
        position: 'fixed',
        border: '1px solid rgba(0, 255, 136, 0.8)',
        background: 'rgba(0, 255, 136, 0.1)',
        pointerEvents: 'none',
        zIndex: '9998',
        display: 'none',
      });
      document.body.appendChild(this._dragBoxEl);
    }

    _getDragRect(x1, y1, x2, y2) {
      return {
        left: Math.min(x1, x2),
        top: Math.min(y1, y2),
        right: Math.max(x1, x2),
        bottom: Math.max(y1, y2),
      };
    }

    // ─── EVENT BUS ─────────────────────────────────────────────────────

    on(event, fn) {
      (this._listeners[event] = this._listeners[event] || []).push(fn);
    }

    _emit(event, data) {
      const fns = this._listeners[event];
      if (fns) for (const fn of fns) { try { fn(data); } catch (e) { console.warn('[RTSSelection] listener:', e); } }
    }

    // ─── INTERNAL ───────────────────────────────────────────────────────

    _syncList() {
      this.list = Array.from(this.ids);
    }
  }

  // ─── EXPORT ──────────────────────────────────────────────────────────
  window.RTSSelection = RTSSelection;
  window.RTS_SELECTION_CFG = CFG;
})();