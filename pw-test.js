const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));
    
    try {
        await page.goto('http://localhost:3458/', { waitUntil: 'load', timeout: 45000 });
        await page.waitForTimeout(4000);
        
        const globals = await page.evaluate(() => ({
            THREE: !!window.THREE,
            YUKA: !!window.YUKA,
            RTSEngineCore: !!window.RTSEngineCore,
            gskBridge: !!window.gskBridge,
            thoughtStream: !!window.__thoughtStream,
            spawnCitizen: !!window.spawnCitizen,
            genesis: !!window.Genesis,
            cplReady: window.__cplReady
        }));
        
        console.log('Globals:', JSON.stringify(globals, null, 2));
        console.log('Console errors:', errors.length);
        errors.slice(0, 20).forEach(e => console.log('  - ' + e));
    } catch (e) {
        console.log('Navigation error:', e.message);
    }
    
    await browser.close();
})();
