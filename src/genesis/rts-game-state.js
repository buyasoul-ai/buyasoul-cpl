/**
 * rts-game-state.js
 * BUYASOUL CPL / GODFORGE — RTS Game State & Win/Loss Overlays
 *
 * Tracks:
 *   1. Health of the Grand Tower (Defeat if destroyed).
 *   2. Health of hostile AI command centers (Victory if both destroyed).
 *   3. Popups with stats and reload triggers.
 */

(function() {
  'use strict';

  let gameOverActive = false;
  // Win/lose evaluation unlocks only after the Grand Tower registers — prevents
  // the render-loop race where tick() fires before populate() finishes.
  let _sawGrandTower = false;
  let stats = {
    unitsTrained: 0,
    structuresBuilt: 0,
    startTime: Date.now()
  };

  // Track every building placed by the player
  window.addEventListener('rts:build', function(e) {
    stats.structuresBuilt++;
  });


  function createGameOverScreen(victory) {
    if (gameOverActive) return;
    gameOverActive = true;

    // Stop loops if possible or slow time down
    if (window.RTSAIDirector) window.RTSAIDirector.tick = () => {};

    const overlay = document.createElement('div');
    overlay.id = 'rts-gameover-overlay';
    
    const titleColor = victory ? '#00ffcc' : '#ff3355';
    const titleText = victory ? '🏆 VICTORY ACHIEVED' : '💀 SYSTEM DEFEATED';
    const subText = victory ? 'You successfully defended the Grand Tower and wiped out the hostile threat.' : 'The Grand Tower has fallen. The void collapse is complete.';

    const gameDuration = Math.round((Date.now() - stats.startTime) / 1000);
    const min = Math.floor(gameDuration / 60);
    const sec = gameDuration % 60;
    const durationStr = `${min}m ${sec}s`;

    // Fetch final economy stats
    let totalProfit = 0;
    if (window.RTSEconomySystem && window.RTSEconomySystem.RESOURCES) {
      totalProfit = Math.floor(window.RTSEconomySystem.RESOURCES.profit);
    }

    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      background: 'rgba(3, 6, 12, 0.9)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '99999',
      fontFamily: 'Outfit, -apple-system, sans-serif',
      color: '#ffffff'
    });

    overlay.innerHTML = `
      <div style="background: rgba(10, 20, 40, 0.7); border: 2px solid ${titleColor}; border-radius: 24px; padding: 40px; width: 480px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.8), 0 0 30px ${titleColor}33;">
        <h1 style="color: ${titleColor}; font-size: 32px; font-weight: 800; letter-spacing: 1.5px; margin-top:0; margin-bottom: 12px;">${titleText}</h1>
        <p style="font-size: 14px; color: #aaa; line-height: 1.6; margin-bottom: 30px;">${subText}</p>
        
        <div style="display: flex; flex-direction: column; gap: 12px; background: rgba(255,255,255,0.03); padding: 20px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08); margin-bottom: 30px; font-family: ui-monospace, monospace; text-align: left; font-size: 13px;">
          <div style="display:flex; justify-content:space-between;"><span style="color:#888;">Match Duration:</span><span>${durationStr}</span></div>
          <div style="display:flex; justify-content:space-between;"><span style="color:#888;">PLT Profit Available:</span><span>💰 ${totalProfit}</span></div>
          <div style="display:flex; justify-content:space-between;"><span style="color:#888;">Void Raiders Trained:</span><span>${stats.unitsTrained}</span></div>
          <div style="display:flex; justify-content:space-between;"><span style="color:#888;">Structures Built:</span><span>${stats.structuresBuilt}</span></div>
        </div>

        <button id="rts-restart-btn" style="background: linear-gradient(135deg, ${titleColor}, #222); border: none; color: #fff; padding: 14px 28px; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; width: 100%; transition: all 0.3s; box-shadow: 0 4px 15px rgba(0,0,0,0.4);">
          RESTART MATCH
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('rts-restart-btn').onclick = () => {
      window.location.reload();
    };
  }

  // Hook unit training triggers to count stats
  window.addEventListener('rts:unit-spawned', () => {
    stats.unitsTrained++;
  });

  function tick() {
    if (gameOverActive || !window.RTSEngineCore) return;

    let grandTowerAlive = false;
    let enemyBasesAlive = 0;

    for (const ent of window.RTSEngineCore.ENTITIES.values()) {
      if (ent.isDead) continue;

      if (ent.isGrandTower) {
        grandTowerAlive = true;
      }
      if (ent.isEnemyBase) {
        enemyBasesAlive++;
      }
    }

    // Record first sighting of the Grand Tower; before that, the match
    // doesn't exist yet — neither defeat nor victory may fire.
    if (!_sawGrandTower) {
      if (!grandTowerAlive) return;
      _sawGrandTower = true;
      stats.startTime = Date.now(); // match starts at registration, not script load
    }

    // 1. Loss Condition (Grand Tower fell)
    if (!grandTowerAlive) {
      createGameOverScreen(false);
    }
    // 2. Win Condition (All enemy command centers destroyed)
    else if (enemyBasesAlive === 0) {
      createGameOverScreen(true);
    }
  }

  window.RTSGameState = {
    tick,
    stats
  };

})();
