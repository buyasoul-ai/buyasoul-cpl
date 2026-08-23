/**
 * rts-fog-of-war.js
 * BUYASOUL CPL / GODFORGE — Fog of War (RTS-7)
 *
 * 256×256 grid per player. Bit 0 = EXPLORED (memory), bit 1 = VISIBLE NOW.
 * Active vision: units' vision discs erase last tick, repaint via
 * precomputed stencil per radius (row-contiguous — no sqrt per cell).
 * Fog applied as overlay on units + terrain via visibility callback.
 *
 * Pattern: imperios Niebla.js (mascara arrays + stencil discs + GPU texture).
 *
 * API:
 *   RTSFogOfWar.install({ scene })
 *   RTSFogOfWar.tick(dt, entities)         // 20Hz internal
 *   RTSFogOfWar.mascara(playerIndex)       // Uint8Array 65536, bits
 *   RTSFogOfWar.isVisible(playerIndex, worldX, worldZ)
 *   RTSFogOfWar.isExplored(playerIndex, worldX, worldZ)
 *   RTSFogOfWar.canSee(playerIndex, entity)  // for AI / render culling
 */

(function() {
  'use strict';

  const LADO = 256;             // grid resolution (matches minimap)
  const WORLD_SIZE = 3000;      // world units across (matches minimap)
  const CELL = WORLD_SIZE / LADO;
  const FOG_TICK = 0.05;        // 20 Hz

  const BIT_EXPLORED = 1;
  const BIT_VISIBLE = 2;

  // playerIndex -> faction (must match rts-engine-core GameEntity factions)
  const PLAYER_FACTIONS = ['voidCovenant', 'imperium', 'bioHive'];

  // Precomputed disc stencils per radius (row-contiguous — no sqrt in hot loop)
  const _discCache = new Map(); // radius (cells) -> { rows: [{start,end}...] }

  function discStencil(radiusCells) {
    const key = Math.round(radiusCells);
    if (_discCache.has(key)) return _discCache.get(key);
    const rows = [];
    const r = key;
    for (let dy = -r; dy <= r; dy++) {
      const halfWidth = Math.sqrt(r * r - dy * dy) | 0;
      if (halfWidth === 0 && Math.abs(dy) === r) continue;
      rows.push({ dy, start: -halfWidth, end: halfWidth });
    }
    _discCache.set(key, rows);
    return rows;
  }

  class RTSFogOfWar {
    constructor(opts) {
      this._scene = opts.scene || null;
      this._acum = 0;
      this._grids = new Map();      // playerIndex -> Uint8Array(LADO*LADO)
      this._prevDiscs = new Map();  // playerIndex -> [{cx,cy,rows}]
      this._ents = opts.entities || window.RTSEngineCore?.ENTITIES || new Map();
      this._visionCache = new Map(); // entityId -> radiusCells
    }

    install() {
      // Player 0 is the human; AI players register lazily
      if (!this._grids.has(0)) this._grids.set(0, new Uint8Array(LADO * LADO));
      console.log('[RTSFogOfWar] installed (', LADO, 'x', LADO, 'grid )');
    }

    tick(dt) {
      this._acum += dt;
      if (this._acum < FOG_TICK) return;
      this._acum = 0;
      this._refresh();
    }

    /** Internal: recompute visibility for all players from entity vision. */
    _refresh() {
      for (const [playerIndex, mask] of this._grids) {
        this._erasePlayer(playerIndex);
        this._paintPlayer(playerIndex, mask);
      }
    }

    /** Erase discs from last tick (bit 1 only — memory persists). */
    _erasePlayer(playerIndex) {
      const mask = this._grids.get(playerIndex);
      if (!mask) return;
      const prev = this._prevDiscs.get(playerIndex);
      if (!prev) return;
      for (const disc of prev) {
        const stencil = disc.rows;
        for (const row of stencil) {
          const base = (disc.cy + row.dy) * LADO;
          if (base < 0 || base >= mask.length) continue;
          for (let dx = row.start; dx <= row.end; dx++) {
            const idx = base + disc.cx + dx;
            if (idx >= 0 && idx < mask.length) mask[idx] &= ~BIT_VISIBLE;
          }
        }
      }
      this._prevDiscs.delete(playerIndex);
    }

    /** Paint vision discs for all friendly units of this player. */
    _paintPlayer(playerIndex, mask) {
      const discs = [];
      const wantFaction = PLAYER_FACTIONS[playerIndex] || 'voidCovenant';
      for (const ent of this._ents.values()) {
        if (ent.isDead || !ent.mesh) continue;
        // Resources and foreign-faction entities never grant this player vision
        if (ent.type === 'resource') continue;
        if (ent.faction !== wantFaction) continue;
        const radius = ent.visionRange || 15;
        const radiusCells = radius / CELL;
        const stencil = discStencil(radiusCells);

        const cx = Math.round(ent.mesh.position.x / CELL + LADO / 2);
        const cz = Math.round(ent.mesh.position.z / CELL + LADO / 2);
        if (cx < 0 || cx >= LADO || cz < 0 || cz >= LADO) continue;

        discs.push({ cx, cy: cz, rows: stencil });
        for (const row of stencil) {
          const base = (cz + row.dy) * LADO;
          if (base < 0 || base >= mask.length) continue;
          for (let dx = row.start; dx <= row.end; dx++) {
            const idx = base + cx + dx;
            if (idx >= 0 && idx < mask.length) {
              mask[idx] |= BIT_VISIBLE | BIT_EXPLORED;
            }
          }
        }
      }
      this._prevDiscs.set(playerIndex, discs);
    }

    /** Bitmask for player (Uint8Array 65536). */
    mascara(playerIndex) {
      if (!this._grids.has(playerIndex)) {
        this._grids.set(playerIndex, new Uint8Array(LADO * LADO));
      }
      return this._grids.get(playerIndex);
    }

    /** Is this world cell currently visible to the player? */
    isVisible(playerIndex, worldX, worldZ) {
      const mask = this.mascara(playerIndex);
      const idx = this._worldToCell(worldX, worldZ);
      return (mask[idx] & BIT_VISIBLE) !== 0;
    }

    /** Was this world cell ever explored? */
    isExplored(playerIndex, worldX, worldZ) {
      const mask = this.mascara(playerIndex);
      const idx = this._worldToCell(worldX, worldZ);
      return (mask[idx] & BIT_EXPLORED) !== 0;
    }

    /** Can this player currently see the entity? */
    canSee(playerIndex, entity) {
      if (!entity || !entity.mesh) return false;
      return this.isVisible(playerIndex, entity.mesh.position.x, entity.mesh.position.z);
    }

    /** Entity vision radius in cells (cached). */
    visionRadius(entity) {
      if (!entity) return 0;
      const r = entity.visionRange || 15;
      const key = entity.id + ':' + r;
      if (!this._visionCache.has(key)) {
        if (this._visionCache.size > 1024) this._visionCache.clear();
        this._visionCache.set(key, r / CELL);
      }
      return this._visionCache.get(key);
    }

    _worldToCell(worldX, worldZ) {
      const cx = Math.round(worldX / CELL + LADO / 2);
      const cz = Math.round(worldZ / CELL + LADO / 2);
      if (cx < 0) return 0;
      if (cx >= LADO) return LADO * LADO - 1;
      if (cz < 0) return 0;
      if (cz >= LADO) return LADO * LADO - 1;
      return cz * LADO + cx;
    }

    /** Mark a region explored instantly (used for starting area). */
    reveal(playerIndex, worldX, worldZ, radius) {
      const mask = this.mascara(playerIndex);
      const cx = Math.round(worldX / CELL + LADO / 2);
      const cz = Math.round(worldZ / CELL + LADO / 2);
      const stencil = discStencil(radius / CELL);
      for (const row of stencil) {
        const base = (cz + row.dy) * LADO;
        if (base < 0 || base >= mask.length) continue;
        for (let dx = row.start; dx <= row.end; dx++) {
          const idx = base + cx + dx;
          if (idx >= 0 && idx < mask.length) mask[idx] |= BIT_EXPLORED;
        }
      }
    }
  }

  window.RTSFogOfWar = RTSFogOfWar;
})();
