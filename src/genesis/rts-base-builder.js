/**
 * rts-base-builder.js
 * BUYASOUL CPL / GODFORGE — Player Base Building
 *
 * Phase 5: spend PLT to construct structures. Bottom-right build menu.
 * Select a structure -> ghost hologram snaps to the nav grid -> left-click
 * places it (validating funds + collision + walkability). Esc / right-click cancels.
 *
 * Buildings register with RTSEngineCore AND mark the RTSNavGrid as obstacles.
 */

(function() {
  'use strict';

  // ─── BUILDABLE STRUCTURES ───────────────────────────────────────────
  const BUILD_DEFS = {
    townhall: {
      name: 'Town Hall',
      icon: '🏛️',
      cost: { profit: 300, love: 50, tax: 0 },
      hp: 1500,
      radius: 8,
      color: 0xffcc00,
      desc: 'Central building - enables farm placement nearby'
    },
    barracks: {
      name: 'Barracks',
      icon: '⚔️',
      cost: { profit: 150, love: 0, tax: 0 },
      hp: 800,
      radius: 6,
      color: 0x00ff88,
      desc: 'Train combat units'
    },
    turret: {
      name: 'Turret',
      icon: '🎯',
      cost: { profit: 100, love: 0, tax: 0 },
      hp: 400,
      radius: 3,
      color: 0xff8844,
      desc: 'Auto-fires at enemies',
      attackRange: 18,
      attackDamage: 12
    },
    wall: {
      name: 'Wall',
      icon: '🧱',
      cost: { profit: 30, love: 0, tax: 0 },
      hp: 500,
      radius: 3,
      color: 0x88aacc,
      desc: 'Blocks enemy movement'
    },
    refinery: {
      name: 'Crystal Refinery',
      icon: '💎',
      cost: { profit: 200, love: 10, tax: 0 },
      hp: 600,
      radius: 5,
      color: 0x00ffcc,
      desc: 'Boosts crystal harvest rate'
    },
    farm: {
      name: 'Farm',
      icon: '🌾',
      cost: { profit: 80, wood: 40, love: 0, tax: 0 },
      hp: 200,
      radius: 2.5,
      color: 0x5db83a,
      desc: 'Produces food - must be near Town Hall'
    }
  };

  let SCENE = null;
  let CAMERA = null;
  let activeBuild = null;     // { def, defId, ghost }
  let buildMenu = null;
  let installed = false;
  const BUILT = [];           // { entity, mesh, defId }

  // ─── BUILD MENU UI (bottom-right) ───────────────────────────────────
  function createBuildMenu() {
    if (buildMenu) return;
    buildMenu = document.createElement('div');
    buildMenu.id = 'rts-build-menu';
    Object.assign(buildMenu.style, {
      position: 'fixed',
      top: '96px',
      right: '300px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      background: 'var(--gf-bg-glass)',
      border: '1px solid var(--gf-border-cyan)',
      borderRadius: '14px',
      padding: '10px',
      zIndex: '110',
      fontFamily: 'var(--gf-font-main)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 15px rgba(0, 255, 204, 0.1)'
    });
    buildMenu.innerHTML = '<div style="font-size:11px;letter-spacing:1.5px;color:#00ff88;text-align:center;margin-bottom:4px;">⚒ BUILD</div>';
    for (const [id, def] of Object.entries(BUILD_DEFS)) {
      const btn = document.createElement('button');
      btn.dataset.build = id;
      btn.innerHTML = '<span style="font-size:14px;">' + def.icon + '</span> ' + def.name +
        '<div style="font-size:10px;color:#88ff88;margin-top:2px;">💰 ' + def.cost.profit + 'P</div>';
      Object.assign(btn.style, {
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid ' + hexStr(def.color),
        color: '#ffffff',
        padding: '6px 12px',
        borderRadius: '10px',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: 600,
        textAlign: 'left',
        transition: 'all 0.2s'
      });
      btn.title = def.desc;
      btn.onclick = (e) => {
        e.stopPropagation();
        if (activeBuild && activeBuild.defId === id) { cancelBuild(); return; }
        enterBuildMode(id);
      };
      buildMenu.appendChild(btn);
    }
    document.body.appendChild(buildMenu);
  }

  function hexStr(num) {
    return '#' + num.toString(16).padStart(6, '0');
  }

  // ─── GHOST HOLOGRAM ─────────────────────────────────────────────────
  function makeGhost(def) {
    const T = window.THREE;
    if (!T) return null;
    const group = new T.Group();
    const mat = new T.MeshStandardMaterial({
      color: def.color,
      transparent: true,
      opacity: 0.45,
      emissive: def.color,
      emissiveIntensity: 0.3
    });
    const base = new T.Mesh(new T.BoxGeometry(def.radius * 2, 1, def.radius * 2), mat);
    base.position.y = 0.5;
    base.userData.isGhostBase = true;
    group.add(base);
    if (def.attackRange) {
      const range = new T.Mesh(
        new T.CircleGeometry(def.attackRange, 32),
        new T.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.08, side: T.DoubleSide, depthWrite: false })
      );
      range.rotation.x = -Math.PI / 2;
      range.position.y = 0.05;
      range.userData.isGhostRange = true;
      group.add(range);
    }
    const marker = new T.Mesh(
      new T.CylinderGeometry(0.8, 1.6, def.radius * 2 + 3, 4),
      new T.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.35 })
    );
    marker.position.y = def.radius + 1.5;
    marker.userData.isGhostMarker = true;
    group.add(marker);
    SCENE.add(group);
    return group;
  }

  function setGhostValid(valid) {
    if (!activeBuild || !activeBuild.ghost) return;
    const color = valid ? activeBuild.def.color : 0xff3355;
    activeBuild.ghost.traverse((c) => {
      if (!c.isMesh) return;
      if (c.userData.isGhostRange) {
        c.material.color.setHex(valid ? 0x00ff88 : 0xff3355);
        c.material.opacity = valid ? 0.08 : 0.14;
      } else {
        c.material.color.setHex(color);
      }
    });
  }

  // ─── BUILD MODE ─────────────────────────────────────────────────────
  function enterBuildMode(defId) {
    const def = BUILD_DEFS[defId];
    if (!def) return;
    cancelBuild();
    activeBuild = { defId, def, ghost: makeGhost(def) };
    console.log('[RTSBuilder] Build mode:', def.name);
    document.body.style.cursor = 'crosshair';
  }

  function cancelBuild() {
    if (activeBuild && activeBuild.ghost) {
      if (activeBuild.ghost.parent) activeBuild.ghost.parent.remove(activeBuild.ghost);
    }
    activeBuild = null;
    document.body.style.cursor = '';
  }

  function updateGhost(point) {
    if (!activeBuild || !point) return;
    // Snap to nav grid
    let sx = point.x, sz = point.z;
    if (window.RTSNavGrid) {
      const cell = window.RTSNavGrid.worldToCell(point.x, point.z);
      if (cell) {
        const wp = window.RTSNavGrid.cellToWorld(cell.col, cell.row);
        sx = wp.x; sz = wp.z;
      }
    }
    activeBuild.ghost.position.set(sx, 0, sz);

    // Validate
    const valid = validatePlacement(sx, sz);
    setGhostValid(valid);
    activeBuild.valid = valid;
  }

  function validatePlacement(x, z) {
    const def = activeBuild.def;
    // Funds — every resource in the cost table must be covered
    const funds = getFunds();
    if (funds.profit < (def.cost.profit || 0)) return false;
    if (funds.love < (def.cost.love || 0)) return false;
    if (funds.wood < (def.cost.wood || 0)) return false;
    // Walkability / collision (sample footprint)
    if (window.RTSNavGrid) {
      const steps = 4;
      const r = def.radius * 0.7;
      for (let i = 0; i < steps; i++) {
        const ang = (i / steps) * Math.PI * 2;
        const px = x + Math.cos(ang) * r;
        const pz = z + Math.sin(ang) * r;
        if (!window.RTSNavGrid.isWalkable(px, pz)) return false;
      }
    }
    // RTSEngineCore collision: true footprint overlap (circle-circle).
    // Farms skip town halls — the hall is their required placement anchor.
    if (window.RTSEngineCore) {
      const existing = window.RTSEngineCore.getEntitiesInRadius({ x, y: 0, z }, def.radius + 50);
      for (const ent of existing) {
        if (ent.type !== 'building' || ent.isDead || !ent.mesh) continue;
        if (activeBuild.defId === 'farm' && ent.isTownHall) continue;
        const er = ent.radius || 1;
        const dx = ent.mesh.position.x - x;
        const dz = ent.mesh.position.z - z;
        const minDist = er + def.radius;
        if ((dx * dx + dz * dz) < minDist * minDist) return false;
      }
    }
    return true;
  }

  function getFunds() {
    const r = window.RTSEconomySystem ? window.RTSEconomySystem.RESOURCES : {};
    return { profit: r.profit || 0, love: r.love || 0, tax: r.tax || 0, wood: r.wood || 0 };
  }

  // ─── PAYMENT (validate-all → spend-all → place → refund-on-fail) ────
  const COST_KEYS = ['profit', 'love', 'wood'];

  function payCost(cost) {
    if (!window.RTSEconomySystem || !window.RTSEconomySystem.spendResource) return true;
    const eco = window.RTSEconomySystem;
    const spent = [];
    for (const key of COST_KEYS) {
      const amt = cost[key] || 0;
      if (amt <= 0) continue;
      if (!eco.spendResource(key, amt)) {
        for (const s of spent) eco.addResource(s.key, s.amt); // roll back
        console.warn('[RTSBuilder] Not enough ' + key + ' for ' + activeBuild.def.name);
        return false;
      }
      spent.push({ key, amt });
    }
    return true;
  }

  function refundCost(cost) {
    if (!window.RTSEconomySystem || !window.RTSEconomySystem.addResource) return;
    for (const key of COST_KEYS) {
      if ((cost[key] || 0) > 0) window.RTSEconomySystem.addResource(key, cost[key]);
    }
  }

  // ─── PLACEMENT ──────────────────────────────────────────────────────
  function placeBuilding(x, z) {
    if (!activeBuild || !activeBuild.valid) return;
    const def = activeBuild.def;
    const defId = activeBuild.defId;

    // Spend only after validation passed; refund everything on placement failure
    if (!payCost(def.cost)) return;

    // Special handling for farms - use RTSFarmSystem
    if (defId === 'farm' && window.RTSFarmSystem) {
      const entity = window.RTSFarmSystem.registerFarm(SCENE, x, z, 'voidCovenant');
      if (!entity) {
        refundCost(def.cost);
        console.warn('[RTSBuilder] Farm placement failed - no town hall nearby (cost refunded)');
        return;
      }
      // Mark nav grid blocked
      if (window.RTSNavGrid) {
        window.RTSNavGrid.blockCircle(x, z, def.radius, true);
      }
      BUILT.push({ entity, mesh: entity.mesh, defId });
      console.log('[RTSBuilder] Placed', def.name, 'at', x, z);
      emitBuild(defId, x, z);
      cancelBuild();
      return;
    }

    // Mesh for regular buildings
    const T = window.THREE;
    if (!T) return;
    const group = new T.Group();
    const mat = new T.MeshStandardMaterial({
      color: def.color,
      roughness: 0.4,
      metalness: 0.6,
      emissive: def.color,
      emissiveIntensity: 0.15
    });
    const base = new T.Mesh(new T.BoxGeometry(def.radius * 2, 2.5, def.radius * 2), mat);
    base.position.y = 1.25;
    base.castShadow = true;
    group.add(base);

    if (def.attackRange) {
      const barrel = new T.Mesh(
        new T.CylinderGeometry(0.5, 0.7, 3, 6),
        new T.MeshStandardMaterial({ color: 0x222233, roughness: 0.3, metalness: 0.8 })
      );
      barrel.position.y = 4;
      group.add(barrel);
    }
    if (defId === 'wall') {
      base.scale.set(1, 1.6, 1);
      base.position.y = 2;
    }

    group.position.set(x, 0, z);
    group.userData.isPlayerBuilding = true;
    SCENE.add(group);

    // Register with RTSEngineCore
    let entity = null;
    if (window.RTSEngineCore) {
      entity = window.RTSEngineCore.registerEntity(group, 'building', 'voidCovenant', def.hp, def.radius);
      if (entity) {
        entity.isPlayerBuilt = true;
        entity.isTownHall = (defId === 'townhall');
        if (def.attackRange) {
          entity.attackRange = def.attackRange;
          entity.attackDamage = def.attackDamage;
          entity.isTurret = true;
        }
      }
    }

    // Mark nav grid blocked
    if (window.RTSNavGrid) {
      window.RTSNavGrid.blockCircle(x, z, def.radius, true);
    }

    BUILT.push({ entity, mesh: group, defId });
    console.log('[RTSBuilder] Placed', def.name, 'at', x, z);
    emitBuild(defId, x, z);
    cancelBuild();
  }

  function emitBuild(defId, x, z) {
    const evt = new CustomEvent('rts:build', { detail: { defId, x, z } });
    window.dispatchEvent(evt);
  }

  // ─── INPUT ROUTING ──────────────────────────────────────────────────
  function handleLeftClick(ctx) {
    if (!activeBuild) return false;
    if (ctx.point && activeBuild.valid) {
      placeBuilding(ctx.point.x, ctx.point.z);
      return true; // consumed
    }
    return true; // still consumed while in build mode
  }

  function handleRightClick(ctx) {
    if (activeBuild) {
      cancelBuild();
      return true; // consumed — cancel build, don't issue move command
    }
    return false;
  }

  function handleKey(key, e, ctx) {
    if (!activeBuild) return false;
    if (key === 'escape') {
      cancelBuild();
      return true;
    }
    if (key === 'b') {
      if (buildMenu) buildMenu.style.display = buildMenu.style.display === 'none' ? 'flex' : 'none';
      return true;
    }
    return false;
  }

  function toggleMenu() {
    if (buildMenu) buildMenu.style.display = buildMenu.style.display === 'none' ? 'flex' : 'none';
  }

  // ─── TICK ───────────────────────────────────────────────────────────
  function tick() {
    if (!activeBuild) return;
    // Follow cursor via last raycast point
    const pt = window.__godforgeLastRaycastPoint;
    if (pt) updateGhost(pt);
  }

  // ─── INSTALL ────────────────────────────────────────────────────────
  function install(opts) {
    if (installed) return;
    installed = true;
    opts = opts || {};
    SCENE = opts.scene || null;
    CAMERA = opts.camera || null;
    if (!SCENE) { console.warn('[RTSBuilder] No scene'); return; }

    createBuildMenu();
    if (window.RTSInputRouter) {
      window.RTSInputRouter.registerLeftClick(10, handleLeftClick);
      window.RTSInputRouter.registerRightClick(10, handleRightClick);
      window.RTSInputRouter.registerKeyHandler(10, handleKey);
    }
    console.log('[RTSBuilder] Base building installed.');
  }

  window.RTSBaseBuilder = {
    install,
    tick,
    BUILD_DEFS,
    enterBuildMode,
    cancelBuild,
    toggleMenu,
    built: () => BUILT.slice()
  };
})();
