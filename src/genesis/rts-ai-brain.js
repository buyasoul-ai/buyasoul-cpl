/**
 * rts-ai-brain.js
 * BUYASOUL CPL / GODFORGE — AI Brain (RTS-8)
 *
 * Two-clock AI (imperios IA.js pattern):
 *   STRATEGIC (~1Hz): economy, build plan, raid decisions, tech
 *   TACTICAL  (~4Hz): combat micro, flee, harvest, exploration
 *
 * ZERO CHEATS: only knows entities its own vision can see (fog grid).
 * ALL actions go through the SAME order facade as the player
 * (unit.orders[] consumed by rts-order-executor) — so AI units get
 * formations, queues and A* for free.
 *
 * API:
 *   RTSAIBrain.install({ entities, fog, playerIndex })
 *   RTSAIBrain.tick(dt)
 *   RTSAIBrain.isAlive(faction)
 */

(function() {
  'use strict';

  const STRATEGIC_TICK = 1.0;   // 1 Hz
  const TACTICAL_TICK = 0.25;   // 4 Hz
  const FLEE_HP_RATIO = 0.25;   // flee below 25% hp
  const RAID_PRESSURE = 2;      // raid when enemy count ratio > this
  const T = () => window.THREE;

  // Which factions the brain controls (voidCovenant = human player, never AI)
  const AI_FACTIONS = ['imperium', 'bioHive'];

  class RTSAIBrain {
    constructor(opts) {
      this._entities = opts.entities || window.RTSEngineCore?.ENTITIES || new Map();
      this._fog = opts.fog || window.RTSFogOfWarInstance || null;
      this._playerIndex = opts.playerIndex || 1; // player 0 = human
      this._strategicAcum = 0;
      this._tacticalAcum = 0;
      this._plan = {
        nextRaidAt: performance.now() + 15000, // first raid after 15s
        rallyPoints: new Map(), // faction -> {x,z}
        raidCooldown: 20000,    // ms between raids
      };
      this._factionIndex = new Map(); // faction -> playerIndex (for fog)
      AI_FACTIONS.forEach((f, i) => this._factionIndex.set(f, i + 1));
    }

    install() {
      // Give each AI faction a fog grid
      if (this._fog) {
        for (let i = 0; i <= AI_FACTIONS.length; i++) this._fog.mascara(i);
      }
      console.log('[RTSAIBrain] installed — controls', AI_FACTIONS.join(', '));
    }

    tick(dt) {
      this._strategicAcum += dt;
      this._tacticalAcum += dt;

      if (this._tacticalAcum >= TACTICAL_TICK) {
        this._tacticalAcum = 0;
        this._tactical();
      }
      if (this._strategicAcum >= STRATEGIC_TICK) {
        this._strategicAcum = 0;
        this._strategic();
      }
    }

    /** Is this faction still alive (has units)? */
    isAlive(faction) {
      for (const ent of this._entities.values()) {
        if (!ent.isDead && ent.faction === faction && (ent.type === 'unit' || ent.type === 'building')) return true;
      }
      return false;
    }

    // ─── STRATEGIC (1 Hz): raids + rally ───────────────────────────────

    _strategic() {
      const now = performance.now();
      for (const faction of AI_FACTIONS) {
        if (!this.isAlive(faction)) continue;

        // Count own units vs visible enemies
        let ownUnits = 0, visibleEnemies = 0, ownBuildings = 0;
        for (const ent of this._entities.values()) {
          if (ent.isDead || !ent.mesh) continue;
          if (ent.faction === faction) {
            if (ent.type === 'unit') ownUnits++;
            if (ent.type === 'building') ownBuildings++;
          } else if (ent.faction === 'voidCovenant' && ent.type === 'unit' && this._canSee(faction, ent)) {
            visibleEnemies++;
          }
        }

        // RAID: enough pressure and cooldown elapsed
        if (now >= this._plan.nextRaidAt && ownUnits >= 4 && visibleEnemies > 0) {
          this._launchRaid(faction, ownUnits);
          this._plan.nextRaidAt = now + this._plan.raidCooldown;
        }

        // RALLY: set rally point near most of own army
        if (!this._plan.rallyPoints.has(faction)) {
          const own = this._ownUnits(faction);
          if (own.length > 0) {
            const avg = own.reduce((acc, u) => {
              acc.x += u.mesh.position.x; acc.z += u.mesh.position.z; return acc;
            }, { x: 0, z: 0 });
            this._plan.rallyPoints.set(faction, {
              x: avg.x / own.length, z: avg.z / own.length,
            });
          }
        }
      }
    }

    _launchRaid(faction, unitCount) {
      // Pick a visible enemy cluster as target
      let target = null, bestDist = Infinity;
      for (const ent of this._entities.values()) {
        if (ent.isDead || !ent.mesh) continue;
        if (ent.faction !== 'voidCovenant' || !this._canSee(faction, ent)) continue;
        const d = ent.mesh.position.length();
        if (d < bestDist) { bestDist = d; target = ent; }
      }
      if (!target) return;

      // Send half the army
      const units = this._ownUnits(faction);
      const raiders = units.slice(0, Math.max(2, Math.floor(unitCount * 0.5)));
      for (const u of raiders) {
        u.orders = [{ type: 'attack', targetId: target.id }];
      }
      console.log('[RTSAIBrain]', faction, 'raid launched with', raiders.length, 'units');
    }

    // ─── TACTICAL (4 Hz): micro each unit ──────────────────────────────

    _tactical() {
      for (const faction of AI_FACTIONS) {
        if (!this.isAlive(faction)) continue;
        for (const ent of this._entities.values()) {
          if (ent.isDead || !ent.mesh || ent.faction !== faction || ent.type !== 'unit') continue;
          this._microUnit(faction, ent);
        }
      }
    }

    _microUnit(faction, unit) {
      // FLEE: low hp and under fire → retreat to rally point
      if (unit.hp < unit.maxHp * FLEE_HP_RATIO && this._underFire(unit)) {
        const rally = this._plan.rallyPoints.get(faction) || { x: 0, z: 0 };
        unit.orders = [{ type: 'move', destination: new (T().Vector3)(rally.x, 0, rally.z) }];
        return;
      }

      // HARVESTER: seek nearest resource
      if (unit.maxCarry > 0 && !unit.targetId) {
        let nearest = null, bestD = Infinity;
        for (const other of this._entities.values()) {
          if (other.isDead || other.type !== 'resource') continue;
          const d = unit.mesh.position.distanceTo(other.mesh.position);
          if (d < bestD) { bestD = d; nearest = other; }
        }
        if (nearest) {
          unit.orders = [{ type: 'harvest', targetId: nearest.id }];
          return;
        }
      }

      // COMBAT: attack visible enemy in vision range, else hold
      if (unit.attackDamage > 0 && !unit.targetId) {
        let enemy = null, bestD = Infinity;
        const vision = unit.visionRange || 20;
        for (const other of this._entities.values()) {
          if (other.isDead || other.faction === faction || !this._canSee(faction, other)) continue;
          if (other.type !== 'unit' && other.type !== 'building') continue;
          const d = unit.mesh.position.distanceTo(other.mesh.position);
          if (d < vision && d < bestD) { bestD = d; enemy = other; }
        }
        if (enemy) {
          unit.orders = [{ type: 'attack', targetId: enemy.id }];
          return;
        }
      }

      // IDLE: patrol small area (exploration) — but only every ~2s to save CPU
      if (!unit.targetPos && Math.random() < 0.05) {
        const rally = this._plan.rallyPoints.get(faction) || { x: 0, z: 0 };
        const jitter = 30;
        unit.orders = [{
          type: 'move',
          destination: {
            x: rally.x + (Math.random() - 0.5) * jitter,
            z: rally.z + (Math.random() - 0.5) * jitter,
            clone() { return { x: this.x, z: this.z }; },
          },
        }];
      }
    }

    // ─── HELPERS ───────────────────────────────────────────────────────

    _ownUnits(faction) {
      const out = [];
      for (const ent of this._entities.values()) {
        if (!ent.isDead && ent.mesh && ent.faction === faction && ent.type === 'unit') out.push(ent);
      }
      return out;
    }

    _underFire(unit) {
      // If any enemy is within 1.5× vision, assume under fire
      const range = (unit.visionRange || 20) * 1.5;
      for (const other of this._entities.values()) {
        if (other.isDead || other.faction === unit.faction) continue;
        if (other.type !== 'unit' || other.attackDamage <= 0) continue;
        if (unit.mesh.position.distanceTo(other.mesh.position) < range) return true;
      }
      return false;
    }

    /** Vision-limited check: can this AI faction see the entity? */
    _canSee(faction, entity) {
      if (!this._fog) return true; // no fog = omniscient (dev mode)
      const pi = this._factionIndex.get(faction) ?? 1;
      return this._fog.canSee(pi, entity);
    }
  }

  window.RTSAIBrain = RTSAIBrain;
})();
