const https = require('https');
const acorn = require('acorn');

function fetch(url) {
  return new Promise((resolve) => {
    https.get(url, { timeout: 15000 }, (r) => {
      let d = '';
      r.on('data', (c) => d += c);
      r.on('end', () => resolve({ status: r.statusCode, body: d }));
    }).on('error', (e) => resolve({ error: e.message }));
  });
}

(async () => {
  const ts = Date.now();
  
  // Fetch index.html and void-population.js
  const idx = await fetch(`https://buyasoul-ai.github.io/buyasoul-cpl/index.html?t=${ts}`);
  const vp = await fetch(`https://buyasoul-ai.github.io/buyasoul-cpl/src/genesis/void-population.js?t=${ts}`);
  
  const idxBody = idx.body || '';
  const vpBody = vp.body || '';
  
  // 1. Check all RTS module script tags in index.html
  const scriptTags = idxBody.match(/<script src="src\/genesis\/(rts-[a-z-]+\.js)"/g) || [];
  console.log('=== RTS Module Script Tags in index.html ===');
  console.log('Found:', scriptTags.length);
  
  const rtsModules = [
    'rts-engine-core', 'rts-fog-of-war', 'rts-economy-system', 'rts-farm-system',
    'rts-base-builder', 'rts-order-executor', 'rts-nav-grid', 'rts-input-router',
    'rts-ui-engine', 'rts-game-state', 'rts-production-system', 'rts-ai-director',
    'rts-war-command', 'rts-subsystem', 'rts-ai-brain',
    // Also check for order generator, selection, minimap, ui-core, bridge
    'rts-order-generator', 'rts-selection', 'rts-minimap', 'rts-ui-core', 'rts-bridge'
  ];
  
  for (const mod of rtsModules) {
    const found = idxBody.includes(`src="src/genesis/${mod}.js"`) || idxBody.includes(`src="src/genesis/${mod}.js"`);
    console.log(`  ${mod}.js: ${found ? 'LOADED' : 'MISSING'}`);
  }
  
  // 2. Check install calls in index.html
  console.log('\n=== RTS Install Calls in index.html ===');
  const installPatterns = [
    'RTSEngineCore.install',
    'RTSFogOfWar',
    'RTSEconomySystem.install',
    'RTSInputRouter.install',
    'RTSNavGrid.install',
    'RTSBridge.install',
    'RTSUICore.install',
    'RTSUIEngine.install',
    'RTSBaseBuilder.install',
    'RTSProductionSystem.install',
    'RTSProductionPalette',
    'RTSGameState.install',
    'RTSMinimap',
    'RTSAIDirector.install',
    'RTSWarCommand.install',
    'RTSAIBrain',
    'AdvancedNPCEngine.install',
    'DivineTerrainSculptor.install',
  ];
  
  for (const pattern of installPatterns) {
    const found = idxBody.includes(pattern);
    console.log(`  ${pattern}: ${found ? 'YES' : 'NO ⚠️'}`);
  }
  
  // 3. Check tick calls in void-population.js
  console.log('\n=== RTS Tick Calls in void-population.js ===');
  const tickPatterns = [
    'RTSBridge.tick',
    'RTSFogOfWarInstance.tick',
    'RTSEngineCore.tick',
    'RTSEconomySystem.tick',
    'RTSUIEngine.tick',
    'RTSUICore.tick',
    'RTSBaseBuilder.tick',
    'RTSProductionSystem.tick',
    'RTSGameState.tick',
    'RTSMinimap',
    'RTSProductionPalette.tick',
    'AdvancedNPCEngine.tick',
    'RTSAIDirector.tick',
    'RTSWarCommand.tick',
    'RTSAIBrainInstance.tick',
    'RTSFarmSystem',
    'DivineTerrainSculptor',
  ];
  
  for (const pattern of tickPatterns) {
    const found = vpBody.includes(pattern);
    console.log(`  ${pattern}: ${found ? 'YES' : 'NO ⚠️'}`);
  }
  
  // 4. Check for VoidBuildingPanel
  console.log('\n=== VoidBuildingPanel ===');
  console.log('  setupClickDetection:', idxBody.includes('VoidBuildingPanel.setupClickDetection'));
  console.log('  install call:', vpBody.includes('VoidBuildingPanel'));
  
  // 5. Check RTSBridge has production ref
  console.log('\n=== RTSBridge wiring ===');
  console.log('  Has production ref:', idxBody.includes('production: window.RTSProductionSystem'));
  
  // 6. Check for War Room button
  console.log('\n=== GodforgeUI War Room ===');
  console.log('  RTSUICore HUD check:', idxBody.includes('RTSUICore HUD not found') || vpBody.includes('RTSUICore HUD'));
})();
