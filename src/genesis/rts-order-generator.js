/**
 * rts-order-generator.js
 * BUYASOUL CPL / GODFORGE — RTS Order Generator (RTS-1)
 *
 * The ONE input owner. Swappable modes (SelectMove, Build, Repair).
 * Contextual cursor: unit decides order from target (harvest/attack/move).
 * Replaces the fragmented handler war in rts-input-router + rts-subsystem.
 *
 * Pattern: OpenRA OrderGenerator + imperios Ordenes.js
 */

(function() {
  'use strict';

  const T = window.THREE;

  // ─── ORDER TYPES ─────────────────────────────────────────────────────
  const ORDER_TYPE = {
    MOVE: 'move',
    ATTACK: 'attack',
    HARVEST: 'harvest',
    REPAIR: 'repair',
    RALLY: 'rally',
    BUILD: 'build',
    PATROL: 'patrol',
    HOLD: 'hold'
  };

  // ─── MODES (swappable input owners) ──────────────────────────────────
  const MODE = {
    SELECT_MOVE: 'select_move',
    BUILD: 'build',
    REPAIR: 'repair'
  };

  // ─── CONTEXTUAL CURSOR TYPES ─────────────────────────────────────────
  const CURSOR = {
    DEFAULT: 'default',
    MOVE: 'crosshair',
    ATTACK: 'crosshair',
    HARVEST: 'copy',
    REPAIR: 'help',
    BUILD: 'cell',
    INVALID: 'not-allowed'
  };

  // ─── ORDER GENERATOR CLASS ───────────────────────────────────────────
  class OrderGenerator {
    constructor(ctx) {
      this.ctx = ctx; // { scene, camera, entities, selection, economy, navGrid }
      this.mode = MODE.SELECT_MOVE;
      this.buildDef = null; // { defId, ghostMesh, valid, rotation }
      this.hoverTarget = null; // { entityId, orderType, cursor }
      this.hoverRing = null;
      this._mouse = new T.Vector2();
      this._ray = new T.Raycaster();
      this._groundPlane = new T.Plane(new T.Vector3(0, 1, 0), 0);
      this._point = new T.Vector3();
      this._targetPoint = new T.Vector3();
    }

    // ─── PUBLIC API ────────────────────────────────────────────────────

    setMode(mode, buildDef = null) {
      this.mode = mode;
      this.buildDef = buildDef;
      this._clearHover();
      if (mode === MODE.BUILD && buildDef) this._createBuildGhost(buildDef);
      else this._removeBuildGhost();
      console.log('[OrderGenerator] Mode:', mode);
    }

    getMode() { return this.mode; }

    // Main entry: handle right-click (issue order)
    handleRightClick(clientX, clientY, shiftKey) {
      if (this.mode === MODE.BUILD) return this._handleBuildClick(clientX, clientY, shiftKey);
      if (this.mode === MODE.REPAIR) return this._handleRepairClick(clientX, clientY, shiftKey);
      return this._handleSelectMoveClick(clientX, clientY, shiftKey);
    }

    // Main entry: handle left-click (select)
    handleLeftClick(clientX, clientY, shiftKey) {
      return this._handleSelect(clientX, clientY, shiftKey);
    }

    // Main entry: handle drag-box selection
    handleBoxSelect(rect, shiftKey) {
      return this._handleBoxSelect(rect, shiftKey);
    }

    // Main entry: handle double-click (select all of type)
    handleDoubleClick(clientX, clientY) {
      return this._handleDoubleClick(clientX, clientY);
    }

    // Main entry: handle hover (contextual cursor)
    handleHover(clientX, clientY) {
      this._updateHover(clientX, clientY);
    }

    // Per-frame tick (for hover ring, build ghost)
    tick(dt) {
      this._tickHoverRing(dt);
      this._tickBuildGhost(dt);
    }

    // ─── SELECT/MOVE MODE (default) ────────────────────────────────────

    _handleSelectMoveClick(clientX, clientY, shiftKey) {
      const selection = this.ctx.selection;
      const entities = this.ctx.entities;
      if (!selection || !entities) return false;

      // Raycast for hits
      const hits = this._raycast(clientX, clientY);
      if (!hits.length) {
        // Click on ground with units selected → move order
        if (selection.size > 0) {
          this._issueMoveOrder(selection, this._targetPoint, shiftKey);
          return true;
        }
        return false;
      }

      // Find first valid hit
      const hit = hits.find(h => h.object && h.object.userData);
      if (!hit) return false;

      const targetEntity = this._getEntityFromObject(hit.object, entities);
      if (!targetEntity) return false;

      // UNIT DECIDES ORDER (contextual cursor logic)
      const orderType = this._decideOrder(targetEntity, selection);
      if (!orderType) return false;

      // Execute the order
      switch (orderType) {
        case ORDER_TYPE.ATTACK:
          this._issueAttackOrder(selection, targetEntity, shiftKey);
          break;
        case ORDER_TYPE.HARVEST:
          this._issueHarvestOrder(selection, targetEntity, shiftKey);
          break;
        case ORDER_TYPE.REPAIR:
          this._issueRepairOrder(selection, targetEntity, shiftKey);
          break;
        case ORDER_TYPE.MOVE:
          this._issueMoveOrder(selection, this._targetPoint, shiftKey);
          break;
      }
      return true;
    }

    // The core contextual logic: unit decides what to do at target
    _decideOrder(targetEntity, selection) {
      // Accept both RTSSelection instance and plain Set/iterable
      const ids = (selection && selection.ids instanceof Set) ? selection.ids : (selection || []);
      const entities = this.ctx.entities;

      // Check if any selected unit can interact with target
      for (const entityId of ids) {
        const unit = entities.get(entityId);
        if (!unit || unit.isDead) continue;

        // Resource node + harvester
        if (targetEntity.type === 'resource' && this._canHarvest(unit)) {
          return ORDER_TYPE.HARVEST;
        }

        // Enemy unit/building
        if ((targetEntity.type === 'unit' || targetEntity.type === 'building') &&
            targetEntity.faction !== unit.faction &&
            this._canAttack(unit)) {
          return ORDER_TYPE.ATTACK;
        }

        // Damaged friendly building + repair-capable unit
        if (targetEntity.type === 'building' &&
            targetEntity.faction === unit.faction &&
            targetEntity.hp < targetEntity.maxHp &&
            this._canRepair(unit)) {
          return ORDER_TYPE.REPAIR;
        }

        // Friendly producer building → rally point
        if (targetEntity.type === 'building' &&
            targetEntity.faction === unit.faction &&
            targetEntity.isProducer &&
            this._canRally(unit)) {
          return ORDER_TYPE.RALLY;
        }
      }

      // Default: move to point
      return ORDER_TYPE.MOVE;
    }

    _canHarvest(unit) { return unit.type === 'unit' && unit.maxCarry > 0; }
    _canAttack(unit) { return unit.type === 'unit' && unit.attackDamage > 0; }
    _canRepair(unit) { return unit.type === 'unit' && unit.canRepair === true; }
    _canRally(unit) { return unit.type === 'unit'; }

    // ─── ORDER ISSUANCE ────────────────────────────────────────────────

    _issueMoveOrder(selection, targetPos, encolar) {
      const entities = this.ctx.entities;
      const navGrid = this.ctx.navGrid;
      const movable = this._getMovableUnits(selection, entities);
      if (!movable.length) return false;

      // FORMATION: hex rings + greedy assignment (imperios pattern)
      const slots = this._calculateFormationSlots(movable, targetPos, entities);

      for (let i = 0; i < movable.length; i++) {
        const unit = movable[i];
        const slot = slots[i];
        this._pushOrder(unit, {
          type: ORDER_TYPE.MOVE,
          destination: slot,
          encolar
        }, navGrid);
      }

      // Visual feedback: move marker
      this._spawnMoveMarker(targetPos);
      this._playOrderSound('move');
      return true;
    }

    _issueAttackOrder(selection, target, encolar) {
      const entities = this.ctx.entities;
      const movable = this._getMovableUnits(selection, entities);
      if (!movable.length) return false;

      for (const unit of movable) {
        this._pushOrder(unit, {
          type: ORDER_TYPE.ATTACK,
          targetId: target.id,
          encolar
        }, null);
      }
      this._spawnMoveMarker(target.mesh?.position || new T.Vector3());
      this._playOrderSound('attack');
      return true;
    }

    _issueHarvestOrder(selection, target, encolar) {
      const entities = this.ctx.entities;
      const workers = Array.from(selection)
        .map(id => entities.get(id))
        .filter(u => u && !u.isDead && u.type === 'unit' && u.maxCarry > 0);
      if (!workers.length) return false;

      for (const unit of workers) {
        this._pushOrder(unit, {
          type: ORDER_TYPE.HARVEST,
          targetId: target.id,
          encolar
        }, null);
      }
      this._playOrderSound('harvest');
      return true;
    }

    _issueRepairOrder(selection, target, encolar) {
      const entities = this.ctx.entities;
      const repairers = Array.from(selection)
        .map(id => entities.get(id))
        .filter(u => u && !u.isDead && u.type === 'unit' && u.canRepair);
      if (!repairers.length) return false;

      for (const unit of repairers) {
        this._pushOrder(unit, {
          type: ORDER_TYPE.REPAIR,
          targetId: target.id,
          encolar
        }, null);
      }
      this._playOrderSound('repair');
      return true;
    }

    // ─── BUILD MODE ────────────────────────────────────────────────────

    _handleBuildClick(clientX, clientY, shiftKey) {
      if (!this.buildDef || !this.buildDef.valid) return false;
      const pos = this._getBuildPosition();
      if (!pos) return false;

      // Queue build order via production system
      if (this.ctx.production && this.ctx.production.encolar) {
        this.ctx.production.encolar(this.buildDef.defId, pos, this.buildDef.rotation);
      }
      this._playOrderSound('build');

      if (!shiftKey) this.setMode(MODE.SELECT_MOVE); // Exit build mode after one
      return true;
    }

    _getBuildPosition() {
      const hits = this._raycastMouse();
      if (hits.length) return this._targetPoint.clone();
      return null;
    }

    _createBuildGhost(def) {
      // Ghost mesh snapped to grid, green/red validity
      // Implementation delegated to build system
    }

    _removeBuildGhost() {
      if (this.buildDef && this.buildDef.ghostMesh) {
        if (this.buildDef.ghostMesh.parent) {
          this.buildDef.ghostMesh.parent.remove(this.buildDef.ghostMesh);
        }
        this.buildDef.ghostMesh = null;
      }
    }

    _tickBuildGhost(dt) {
      if (this.mode !== MODE.BUILD || !this.buildDef) return;
      const pos = this._getBuildPosition();
      if (pos && this.buildDef.ghostMesh) {
        this.buildDef.ghostMesh.position.copy(pos);
        this.buildDef.ghostMesh.position.y = 0.1;
        // Update validity color (green/red)
      }
    }

    // ─── REPAIR MODE ───────────────────────────────────────────────────

    _handleRepairClick(clientX, clientY, shiftKey) {
      const hits = this._raycast(clientX, clientY);
      const target = hits.find(h => {
        const ent = this._getEntityFromObject(h.object, this.ctx.entities);
        return ent && ent.type === 'building' && ent.hp < ent.maxHp && ent.faction === 'voidCovenant';
      });
      if (!target) return false;

      const ent = this._getEntityFromObject(target.object, this.ctx.entities);
      const selection = this.ctx.selection;
      const repairers = Array.from(selection)
        .map(id => this.ctx.entities.get(id))
        .filter(u => u && !u.isDead && u.type === 'unit' && u.canRepair);

      for (const unit of repairers) {
        this._pushOrder(unit, { type: ORDER_TYPE.REPAIR, targetId: ent.id, encolar: shiftKey }, null);
      }
      this.setMode(MODE.SELECT_MOVE);
      return true;
    }

    // ─── SELECTION (left-click, drag-box, double-click) ────────────────

    _handleSelect(clientX, clientY, shiftKey) {
      const hits = this._raycast(clientX, clientY);
      const entities = this.ctx.entities;
      const selection = this.ctx.selection;

      // Find first unit hit
      const hit = hits.find(h => {
        const ent = this._getEntityFromObject(h.object, entities);
        return ent && ent.type === 'unit';
      });

      if (hit) {
        const entity = this._getEntityFromObject(hit.object, entities);
        if (!shiftKey) selection.clear();
        selection.add(entity.id);
        this._emitSelectionChange();
        return true;
      }

      // Click on ground/building → clear selection (unless shift)
      if (!shiftKey) {
        selection.clear();
        this._emitSelectionChange();
      }
      return false;
    }

    _handleBoxSelect(rect, shiftKey) {
      const entities = this.ctx.entities;
      const selection = this.ctx.selection;
      const camera = this.ctx.camera;
      if (!camera) return false;

      if (!shiftKey) selection.clear();

      for (const [id, entity] of entities) {
        if (entity.type !== 'unit' || entity.isDead || entity.faction !== 'voidCovenant') continue;
        if (!entity.mesh) continue;

        const screenPos = entity.mesh.position.clone().project(camera);
        const sx = (screenPos.x + 1) / 2 * window.innerWidth;
        const sy = (-screenPos.y + 1) / 2 * window.innerHeight;

        if (sx >= rect.left && sx <= rect.right && sy >= rect.top && sy <= rect.bottom) {
          selection.add(id);
          if (selection.size >= 60) break; // Cap
        }
      }
      this._emitSelectionChange();
      return true;
    }

    _handleDoubleClick(clientX, clientY) {
      const hits = this._raycast(clientX, clientY);
      const entities = this.ctx.entities;
      const selection = this.ctx.selection;

      const hit = hits.find(h => {
        const ent = this._getEntityFromObject(h.object, entities);
        return ent && ent.type === 'unit';
      });
      if (!hit) return false;

      const entity = this._getEntityFromObject(hit.object, entities);
      const typeKey = entity.defId || entity.type;

      selection.clear();
      for (const [id, ent] of entities) {
        if (ent.type === 'unit' && !ent.isDead && ent.faction === 'voidCovenant' &&
            (ent.defId === typeKey || ent.type === typeKey)) {
          selection.add(id);
        }
      }
      this._emitSelectionChange();
      return true;
    }

    // ─── FORMATION SLOTS (hex rings + greedy assignment) ──────────────

    _calculateFormationSlots(units, targetPos, entities) {
      const n = units.length;
      const slots = [];
      if (n === 1) {
        slots.push(targetPos.clone());
        return slots;
      }

      // Max unit radius for spacing
      let maxR = 0.5;
      for (const unit of units) {
        if (unit.radius) maxR = Math.max(maxR, unit.radius);
      }
      const spacing = Math.max(1.6, maxR * 2.2);

      // Generate candidate slots: center + hex rings
      const candidates = [{ x: targetPos.x, z: targetPos.z }];
      for (let ring = 1; candidates.length < n * 2; ring++) {
        const count = ring * 6;
        const r = ring * spacing;
        for (let i = 0; i < count && candidates.length < n * 2; i++) {
          const angle = (i / count) * Math.PI * 2 + ring * 0.37;
          candidates.push({
            x: targetPos.x + Math.cos(angle) * r,
            z: targetPos.z + Math.sin(angle) * r
          });
        }
      }

      // Greedy assignment: sort units by distance to center, each picks nearest free slot
      const unitOrder = units.map((u, i) => ({ i, u, dist: u.mesh.position.distanceTo(targetPos) }));
      unitOrder.sort((a, b) => a.dist - b.dist);

      const used = new Uint8Array(candidates.length);
      for (const { i, u } of unitOrder) {
        let bestIdx = -1, bestD = Infinity;
        for (let c = 0; c < candidates.length; c++) {
          if (used[c]) continue;
          const dx = candidates[c].x - u.mesh.position.x;
          const dz = candidates[c].z - u.mesh.position.z;
          const d = dx * dx + dz * dz;
          if (d < bestD) { bestD = d; bestIdx = c; }
        }
        if (bestIdx < 0) bestIdx = 0;
        used[bestIdx] = 1;
        slots[i] = new T.Vector3(candidates[bestIdx].x, 0, candidates[bestIdx].z);
      }

      // Fill any remaining
      while (slots.length < n) slots.push(targetPos.clone());

      return slots;
    }

    // ─── COMMAND QUEUE (per-unit) ──────────────────────────────────────

    _pushOrder(unit, order, navGrid) {
      if (!unit.orders) unit.orders = [];
      if (order.encolar) {
        unit.orders.push(order);
      } else {
        unit.orders = [order];
      }
      // Request path if move order and navGrid available
      if (order.type === ORDER_TYPE.MOVE && navGrid && order.destination) {
        unit._navTarget = order.destination.clone();
        unit._navWaypoints = navGrid.findPath(
          unit.mesh.position.x, unit.mesh.position.z,
          order.destination.x, order.destination.z
        );
        unit._navWPIndex = 0;
      }
    }

    // ─── HOVER / CONTEXTUAL CURSOR ─────────────────────────────────────

    _updateHover(clientX, clientY) {
      const hits = this._raycast(clientX, clientY);
      let newHover = null;

      if (hits.length) {
        const hit = hits.find(h => h.object && h.object.userData);
        if (hit) {
          const targetEntity = this._getEntityFromObject(hit.object, this.ctx.entities);
          if (targetEntity && this.ctx.selection.size > 0) {
            const orderType = this._decideOrder(targetEntity, this.ctx.selection);
            newHover = { entityId: targetEntity.id, orderType, cursor: this._cursorForOrder(orderType) };
          }
        }
      }

      if (newHover && (!this.hoverTarget || this.hoverTarget.entityId !== newHover.entityId)) {
        this.hoverTarget = newHover;
        this._createHoverRing();
      } else if (!newHover && this.hoverTarget) {
        this._clearHover();
      }
    }

    _cursorForOrder(orderType) {
      switch (orderType) {
        case ORDER_TYPE.ATTACK: return CURSOR.ATTACK;
        case ORDER_TYPE.HARVEST: return CURSOR.HARVEST;
        case ORDER_TYPE.REPAIR: return CURSOR.REPAIR;
        case ORDER_TYPE.RALLY: return CURSOR.BUILD;
        default: return CURSOR.MOVE;
      }
    }

    _createHoverRing() {
      if (this.hoverRing) return;
      const segments = 48;
      const points = [];
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push(new T.Vector3(Math.cos(angle) * 1.5, 0, Math.sin(angle) * 1.5));
      }
      const geo = new T.BufferGeometry().setFromPoints(points);
      const mat = new T.LineDashedMaterial({
        color: 0xffffff, dashSize: 0.3, gapSize: 0.2,
        transparent: true, opacity: 0.6, depthTest: false
      });
      this.hoverRing = new T.Line(geo, mat);
      this.hoverRing.computeLineDistances();
      this.hoverRing.frustumCulled = false;
      this.hoverRing.renderOrder = 89; // Always on top
      this.hoverRing.visible = false;
      this.ctx.scene?.add(this.hoverRing);
    }

    _tickHoverRing(dt) {
      if (!this.hoverTarget || !this.hoverRing) {
        if (this.hoverRing) this.hoverRing.visible = false;
        return;
      }
      const target = this.ctx.entities?.get(this.hoverTarget.entityId);
      if (target && target.mesh) {
        this.hoverRing.position.copy(target.mesh.position);
        this.hoverRing.position.y = 0.15;
        this.hoverRing.visible = true;
      } else {
        this.hoverRing.visible = false;
      }
    }

    _clearHover() {
      this.hoverTarget = null;
      if (this.hoverRing) {
        this.hoverRing.visible = false;
        if (this.hoverRing.parent) this.hoverRing.parent.remove(this.hoverRing);
        this.hoverRing = null;
      }
    }

    // ─── UTILITIES ─────────────────────────────────────────────────────

    _raycast(clientX, clientY) {
      this._mouse.x = (clientX / window.innerWidth) * 2 - 1;
      this._mouse.y = -(clientY / window.innerHeight) * 2 + 1;
      this._ray.setFromCamera(this._mouse, this.ctx.camera);
      this._ray.ray.intersectPlane(this._groundPlane, this._targetPoint);
      const hits = this._ray.intersectObjects(this.ctx.scene?.children || [], true);
      return hits;
    }

    _raycastMouse() {
      return this._raycast(this._lastX || 0, this._lastY || 0);
    }

    _getEntityFromObject(obj, entities) {
      let current = obj;
      while (current) {
        if (current.userData?.entityId) {
          return entities.get(current.userData.entityId);
        }
        current = current.parent;
      }
      return null;
    }

    _getMovableUnits(selection, entities) {
      const out = [];
      const ids = (selection && selection.ids instanceof Set) ? selection.ids : (selection || []);
      for (const id of ids) {
        const u = entities.get(id);
        if (u && !u.isDead && u.type === 'unit' && u.speed > 0) out.push(u);
      }
      return out;
    }

    _spawnMoveMarker(pos) {
      if (!this.ctx.scene) return;
      const marker = new T.Mesh(
        new T.RingGeometry(1, 1.5, 16),
        new T.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.8, side: T.DoubleSide })
      );
      marker.rotation.x = -Math.PI / 2;
      marker.position.copy(pos);
      marker.position.y = 0.2;
      marker.userData.life = 1.5;
      this.ctx.scene.add(marker);
      // Auto-remove
      const removeMarker = () => {
        marker.userData.life -= 0.016;
        if (marker.userData.life <= 0) {
          if (marker.parent) marker.parent.remove(marker);
        } else {
          requestAnimationFrame(removeMarker);
        }
      };
      requestAnimationFrame(removeMarker);
    }

    _playOrderSound(type) {
      if (this.ctx.audio) this.ctx.audio.sfx?.('order', { type });
    }

    _emitSelectionChange() {
      if (this.ctx.onSelectionChange) this.ctx.onSelectionChange(Array.from(this.ctx.selection));
    }
  }

  // ─── EXPORT ──────────────────────────────────────────────────────────
  window.RTSOrderGenerator = OrderGenerator;
  window.RTS_ORDER_TYPE = ORDER_TYPE;
  window.RTS_MODE = MODE;
})();