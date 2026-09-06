/**
 * rts-ui-engine.js
 * BUYASOUL CPL / GODFORGE — RTS UI, Unit Control & Selection
 * 
 * Clean, unified interface utilizing RTSInputRouter:
 *   1. Screen-space drag selection box (green) using RTSInputRouter.registerBoxSelector.
 *   2. Single unit selection using RTSInputRouter.registerLeftClick.
 *   3. Right-click commanding (Move, Attack, Harvest) using RTSInputRouter.registerRightClick.
 *   4. 3D Health bars above all registered entities.
 */

(function() {
  'use strict';

  let SCENE = null;
  let CAMERA = null;

  // --- HEALTH BARS ---
  let HEALTH_BAR_GEO = null;
  let MAT_BG = null;
  let MAT_FG = null;

  function initHealthBarAssets() {
    if (HEALTH_BAR_GEO) return;
    const T = window.THREE;
    if (!T) return;
    HEALTH_BAR_GEO = new T.PlaneGeometry(2, 0.3);
    MAT_BG = new T.MeshBasicMaterial({ color: 0x330000, side: T.DoubleSide, depthTest: false });
    MAT_FG = new T.MeshBasicMaterial({ color: 0x00ff00, side: T.DoubleSide, depthTest: false });
  }

  function ensureHealthBar(ent) {
    if (!ent.mesh) return;
    if (ent.healthBarGroup) return;

    initHealthBarAssets();
    if (!HEALTH_BAR_GEO) return;

    const T = window.THREE;
    const group = new T.Group();
    const bg = new T.Mesh(HEALTH_BAR_GEO, MAT_BG);
    bg.position.z = -0.01;
    const fg = new T.Mesh(HEALTH_BAR_GEO, MAT_FG.clone());
    
    group.add(bg);
    group.add(fg);
    group.position.y = ent.radius + 3; // Above the unit
    
    ent.mesh.add(group);
    ent.healthBarGroup = group;
    ent.healthBarFg = fg;
  }

  function updateHealthBars() {
    if (!window.RTSEngineCore || !CAMERA) return;

    for (const ent of window.RTSEngineCore.ENTITIES.values()) {
      if (ent.isDead) continue;
      if (ent.type === 'resource') continue; // No health bar for crystals
      
      ensureHealthBar(ent);
      
      if (ent.healthBarGroup) {
        // Billboard to camera
        ent.healthBarGroup.quaternion.copy(CAMERA.quaternion);
        
        // Update scale based on HP
        const hpPct = Math.max(0, ent.hp / ent.maxHp);
        ent.healthBarFg.scale.x = hpPct;
        ent.healthBarFg.position.x = -1 * (1 - hpPct); // anchor left
        
        // Color gradient
        if (hpPct > 0.5) ent.healthBarFg.material.color.setHex(0x00ff00);
        else if (hpPct > 0.25) ent.healthBarFg.material.color.setHex(0xffff00);
        else ent.healthBarFg.material.color.setHex(0xff0000);
      }
    }
  }

  // --- SELECTION & COMMAND LOGIC ---

  function setupInputHandlers() {
    if (!window.RTSInputRouter) return;

    // 1. Box Selector (Drag selection)
    window.RTSInputRouter.registerBoxSelector(({ rect, shiftKey }) => {
      if (!window.RTSEngineCore || !window.AdvancedNPCEngine || !CAMERA) return;

      const left = rect.left;
      const right = rect.right;
      const top = rect.top;
      const bottom = rect.bottom;

      const halfW = window.innerWidth / 2;
      const halfH = window.innerHeight / 2;

      if (!shiftKey) {
        window.AdvancedNPCEngine.clearNPCSelection();
      }

      let selectedCount = 0;
      for (const ent of window.RTSEngineCore.ENTITIES.values()) {
        if (ent.isDead || ent.type !== 'unit') continue;
        if (ent.faction !== 'voidCovenant') continue; // Player owned units are voidCovenant

        const pos = ent.mesh.position.clone();
        pos.project(CAMERA);

        const screenX = (pos.x * halfW) + halfW;
        const screenY = -(pos.y * halfH) + halfH;

        if (screenX >= left && screenX <= right && screenY >= top && screenY <= bottom) {
          window.AdvancedNPCEngine.selectNPC(ent.mesh);
          selectedCount++;
        }
      }
      console.log(`[RTS UI Engine] Box Selected ${selectedCount} player units.`);
    });

    // 2. Left Click (Single selection)
    window.RTSInputRouter.registerLeftClick(40, ({ hits, shiftKey }) => {
      if (!window.RTSEngineCore || !window.AdvancedNPCEngine) return false;

      if (hits && hits.length > 0) {
        let hitObj = hits[0].object;
        while (hitObj && hitObj.userData.entityId === undefined) {
          hitObj = hitObj.parent;
        }

        if (hitObj && hitObj.userData.entityId !== undefined) {
          const ent = window.RTSEngineCore.getEntity(hitObj.userData.entityId);
          
          // A. Select unit
          if (ent && ent.type === 'unit' && ent.faction === 'voidCovenant') {
            if (!shiftKey) window.AdvancedNPCEngine.clearNPCSelection();
            window.AdvancedNPCEngine.selectNPC(ent.mesh);
            window.dispatchEvent(new CustomEvent('rts:building-selected', { detail: null }));
            return true; // Consumed click
          }
          
          // B. Select player-built building (like Barracks)
          if (ent && ent.type === 'building' && ent.isPlayerBuilt) {
            if (!shiftKey) window.AdvancedNPCEngine.clearNPCSelection();
            window.dispatchEvent(new CustomEvent('rts:building-selected', { detail: { buildingId: ent.id } }));
            return true; // Consumed click
          }
        }
      }

      if (!shiftKey) {
        window.AdvancedNPCEngine.clearNPCSelection();
      }
      window.dispatchEvent(new CustomEvent('rts:building-selected', { detail: null }));
      return false;
    });

    // 3. Right Click (Commands: Move, Attack, Harvest)
    window.RTSInputRouter.registerRightClick(40, ({ point, hits }) => {
      if (!window.RTSEngineCore || !window.AdvancedNPCEngine || !point) return false;
      
      // Get currently selected units from AdvancedNPCEngine or RTSUICore
      // Note: AdvancedNPCEngine keeps selection in a private Set but we can command them
      if (window.AdvancedNPCEngine.commandNPCsTo) {
        let targetId = null;
        if (hits && hits.length > 0) {
          let hitObj = hits[0].object;
          while (hitObj && hitObj.userData.entityId === undefined) {
            hitObj = hitObj.parent;
          }
          if (hitObj && hitObj.userData.entityId !== undefined) {
            targetId = hitObj.userData.entityId;
          }
        }

        window.AdvancedNPCEngine.commandNPCsTo(point, targetId);
        return true; // Consumed right-click
      }

      return false;
    });
  }

  let _installed = false;
  function install(scene, camera) {
    if (_installed) return; // prevent double-install → duplicate input handlers
    _installed = true;
    SCENE = scene;
    CAMERA = camera;
    setupInputHandlers();
    console.log('[RTS UI Engine] Installed with unified RTSInputRouter integration.');
  }

  function tick(dt) {
    updateHealthBars();
  }

  window.RTSUIEngine = {
    install,
    tick
  };

})();
