/**
 * rts-minimap.js
 * BUYASOUL CPL / GODFORGE — Minimap (RTS-6)
 *
 * 4-layer canvas minimap (imperios Minimapa pattern):
 *   1. TERRAIN   — biomes/painted once to offscreen canvas
 *   2. FOG       — explored/visible from FogOfWar (10 Hz refresh)
 *   3. ENTITIES  — unit/building dots, own always, enemies if visible
 *   4. FRUSTUM   — camera trapezoid redrawn every frame
 *
 * Input: left-drag = pan camera, right-click = issue order at world point.
 * Attack flash = red pulse for 4s.
 */

(function() {
  'use strict';

  const LADO = 256;           // canvas resolution = fog grid size
  const PERIODO = 0.1;       // 10 Hz for expensive layers (fog + entities)
  const ATTACK_FLASH_TTL = 4;

  const MAP_RANGE = 3000;     // world units from center — covers all 10 realms
  const HALF = MAP_RANGE * 0.5;

  // Player colors (matching imperios COLORES_JUGADOR)
  const PLAYER_COLORS = [0x00aaff, 0xff4444, 0x44ff44, 0xffaa00,
                          0xaa44ff, 0x44ffff, 0xff44aa, 0xffff44];

  class RTSMinimap {
    constructor(opts) {
      this.canvas = null;
      this.ctx2d = null;
      this._terrainCanvas = null;  // pre-rendered once
      this._fogImageData = null;
      this._acum = 0;
      this._attackFlashes = [];   // {x,z,color,born}
      this._dragging = false;
      this._container = opts.container || document.body;
      this._scene = opts.scene || null;
      this._camera = opts.camera || null;
      this._entities = opts.entities || window.RTSEngineCore?.ENTITIES || new Map();
      this._fog = opts.fog || window.RTSFogOfWarInstance || null;
      this._worldSize = opts.worldSize || MAP_RANGE;
      this._half = this._worldSize * 0.5;
      this._onRightClick = opts.onRightClick || null; // callback({worldX,worldZ})
    }

    // ─── LIFECYCLE ─────────────────────────────────────────────────────

    install() {
      this._createCanvas();
      this._renderTerrain();
      this._installInput();
      console.log('[RTSMinimap] installed (', LADO, 'px )');
    }

    /** Call per frame. dt in seconds. */
    tick(dt) {
      this._acum += dt;
      if (this._acum >= PERIODO) {
        this._acum = 0;
        this._refreshFog();
        this._refreshEntities();
      }
      this._composite();     // always: blit terrain+fog+entities
      this._drawFrustum();   // always: camera trapezoid
      this._purgeFlashes();
    }

    /** Call when an attack happens to flash the minimap. */
    attackFlash(worldX, worldZ, color) {
      this._attackFlashes.push({ x: worldX, z: worldZ, color: color || 0xff4444, born: performance.now() });
    }

    // ─── CANVAS CREATION ───────────────────────────────────────────────

    _createCanvas() {
      this.canvas = document.createElement('canvas');
      this.canvas.width = LADO;
      this.canvas.height = LADO;
      this.canvas.className = 'rts-minimap';
      Object.assign(this.canvas.style, {
        position: 'fixed', bottom: '12px', right: '12px',
        width: LADO + 'px', height: LADO + 'px',
        border: '1px solid rgba(0,255,204,0.35)',
        borderRadius: '8px', zIndex: '110',
        imageRendering: 'pixelated', cursor: 'pointer',
        boxShadow: '0 0 20px rgba(0,0,0,0.6)',
      });
      this._container.appendChild(this.canvas);
      this.ctx2d = this.canvas.getContext('2d');
      this.ctx2d.imageSmoothingEnabled = false;

      this._terrainCanvas = document.createElement('canvas');
      this._terrainCanvas.width = LADO;
      this._terrainCanvas.height = LADO;
    }

    // ─── LAYER 1: TERRAIN (render once) ────────────────────────────────

    _renderTerrain() {
      const g = this._terrainCanvas.getContext('2d');
      const img = g.createImageData(LADO, LADO);
      const data = img.data;
      const half = this._half;
      // Procedural: gradient from center (bright) to edges (dark), with noise
      for (let py = 0; py < LADO; py++) {
        for (let px = 0; px < LADO; px++) {
          const wx = (px / LADO - 0.5) * this._worldSize;
          const wz = (py / LADO - 0.5) * this._worldSize;
          const dist = Math.hypot(wx, wz);
          const norm = dist / half; // 0 at center, 1 at edge
          // Base terrain color (dark green/blue gradient)
          const r = Math.floor(20 + norm * 30);
          const gn = Math.floor(50 + (1 - norm) * 60);
          const b = Math.floor(30 + (1 - norm) * 50);
          // Noise
          const noise = (Math.sin(wx * 0.03) * Math.cos(wz * 0.02) * 10) | 0;
          const idx = (py * LADO + px) * 4;
          data[idx]     = Math.max(0, Math.min(255, r + noise));
          data[idx + 1] = Math.max(0, Math.min(255, gn + noise));
          data[idx + 2] = Math.max(0, Math.min(255, b + noise));
          data[idx + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
    }

    // ─── LAYER 2: FOG (10 Hz) ──────────────────────────────────────────

    _refreshFog() {
      // If fog system exists, read its data; otherwise just clear to visible
      if (this._fog && this._fog.mascara) {
        const mask = this._fog.mascara(0); // player 0 mask
        if (mask) {
          const img = this.ctx2d.createImageData(LADO, LADO);
          for (let i = 0; i < mask.length && i < LADO * LADO; i++) {
            const explored = mask[i] & 1;  // bit 0
            const visible = mask[i] & 2;   // bit 1
            const idx = i * 4;
            if (!explored) {
              // Unexplored: black
              img.data[idx] = 0; img.data[idx+1] = 0; img.data[idx+2] = 0; img.data[idx+3] = 220;
            } else if (!visible) {
              // Explored but not currently visible: dim
              img.data[idx] = 0; img.data[idx+1] = 0; img.data[idx+2] = 10; img.data[idx+3] = 130;
            }
            // visible: no overlay (terrain shows through)
          }
          this._fogImageData = img;
          return;
        }
      }
      this._fogImageData = null; // no fog = fully visible
    }

    // ─── LAYER 3: ENTITIES (10 Hz) ─────────────────────────────────────

    _refreshEntities() {
      // Will be composited directly in _composite using _entities Map
    }

    // ─── COMPOSITING (every frame: terrain + fog + entity dots + attacks)

    _composite() {
      const g = this.ctx2d;
      g.drawImage(this._terrainCanvas, 0, 0); // blit terrain

      // Fog overlay
      if (this._fogImageData) {
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = LADO; tmpCanvas.height = LADO;
        const tmpCtx = tmpCanvas.getContext('2d');
        tmpCtx.putImageData(this._fogImageData, 0, 0);
        g.drawImage(tmpCanvas, 0, 0);
      }

      // Entity dots
      const half = this._half;
      const worldSize = this._worldSize;
      g.fillStyle = '#00ff88';
      for (const ent of this._entities.values()) {
        if (ent.isDead || !ent.mesh) continue;
        // Skip resources and projectiles — only units + buildings
        if (ent.type !== 'unit' && ent.type !== 'building') continue;

        const wx = ent.mesh.position.x;
        const wz = ent.mesh.position.z;
        const px = ((wx + half) / worldSize) * LADO;
        const py = ((wz + half) / worldSize) * LADO;

        g.fillStyle = ent.faction === 'voidCovenant' ? '#00ff88'
                    : ent.faction === 'neutral' ? '#aaaaaa'
                    : '#ff4444';
        const size = ent.type === 'building' ? 4 : 2;
        g.fillRect(Math.floor(px), Math.floor(py), size, size);
      }

      // Attack flashes
      const now = performance.now();
      for (const f of this._attackFlashes) {
        const age = (now - f.born) / 1000;
        if (age > ATTACK_FLASH_TTL) continue;
        const px = ((f.x + half) / worldSize) * LADO;
        const py = ((f.z + half) / worldSize) * LADO;
        const alpha = Math.max(0, 1 - age / ATTACK_FLASH_TTL);
        g.fillStyle = `rgba(255,60,60,${alpha.toFixed(2)})`;
        g.beginPath();
        g.arc(px, py, 4 + age * 2, 0, Math.PI * 2);
        g.fill();
      }
    }

    // ─── LAYER 4: FRUSTUM (every frame) ────────────────────────────────

    _drawFrustum() {
      if (!this._camera) return;
      const g = this.ctx2d;
      const half = this._half;
      const worldSize = this._worldSize;

      // Project camera viewport corners to world
      const cam = this._camera;
      const lookAt = cam.getWorldDirection?.()
        ? cam.position.clone().add(cam.getWorldDirection(new THREE.Vector3()).multiplyScalar(50))
        : cam.position.clone();

      // Simple frustum approximation: center + extents based on FOV + distance
      const cx = ((lookAt.x + half) / worldSize) * LADO;
      const cy = ((lookAt.z + half) / worldSize) * LADO;
      const radius = 12; // approximate viewport half-size on minimap

      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(cx, cy, radius, 0, Math.PI * 2);
      g.stroke();
    }

    // ─── INPUT (left-drag pan, right-click order) ──────────────────────

    _installInput() {
      const el = this.canvas;
      let drag = false;

      const local = (e) => {
        const r = el.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      };

      el.addEventListener('pointerdown', (e) => {
        if (e.button === 0) {
          drag = true;
          el.setPointerCapture?.(e.pointerId);
          this._panToMinimapPoint(local(e));
        } else if (e.button === 2 && this._onRightClick) {
          const p = this._minimapToWorld(local(e));
          this._onRightClick(p.x, p.z);
        }
        e.preventDefault();
        e.stopPropagation();
      });

      el.addEventListener('pointermove', (e) => {
        if (!drag) return;
        this._panToMinimapPoint(local(e));
        e.stopPropagation();
      });

      const up = (e) => { drag = false; el.releasePointerCapture?.(e.pointerId); e.stopPropagation(); };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); });
    }

    _panToMinimapPoint(p) {
      if (!this._camera) return;
      const world = this._minimapToWorld(p);
      // Move camera target; camera.position is set by player-cam or OrbitControls
      // For now just log the target position — actual camera pan needs
      // player-cam integration or an event bus signal.
      if (this._camera.position) {
        this._camera.position.x = world.x;
        this._camera.position.z = world.z;
      }
    }

    _minimapToWorld(p) {
      const worldSize = this._worldSize;
      const half = this._half;
      return {
        x: (p.x / LADO) * worldSize - half,
        z: (p.y / LADO) * worldSize - half,
      };
    }

    _purgeFlashes() {
      const now = performance.now();
      this._attackFlashes = this._attackFlashes.filter(f => (now - f.born) < ATTACK_FLASH_TTL * 1000);
    }
  }

  window.RTSMinimap = RTSMinimap;
})();
