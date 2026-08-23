const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch({
        headless: true,
        args: ['--enable-webgl', '--ignore-gpu-blocklist']
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    // Inject BEFORE any page script runs
    await page.addInitScript(() => {
        window.__caughtErrors = [];
        window.addEventListener('error', (e) => {
            window.__caughtErrors.push({
                type: 'error-event',
                message: e.message,
                filename: e.filename,
                lineno: e.lineno,
                colno: e.colno
            });
        });
        window.addEventListener('unhandledrejection', (e) => {
            window.__caughtErrors.push({ type: 'rejection', message: String(e.reason) });
        });
    });

    page.on('console', msg => {
        const loc = msg.location();
        if (msg.type() === 'error' || msg.text().includes('Unexpected')) {
            console.log('[CONSOLE]', msg.type(), msg.text(), 'at', loc.url.split('/').pop() + ':' + loc.lineNumber);
        }
    });

    await page.goto('http://localhost:3458/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(6000);

    const errors = await page.evaluate(() => window.__caughtErrors || []);
    console.log('=== CAUGHT ERRORS (with file/line) ===');
    errors.forEach(e => console.log(JSON.stringify(e)));

    const state = await page.evaluate(() => ({
        entities: window.RTSEngineCore?.ENTITIES?.size || 0,
        buildings: window.VoidRTSBuildings?.all ? window.VoidRTSBuildings.all().length : 'no all()',
        fog: !!window.RTSFogOfWarInstance,
        citizens: window.agentCitizens ? window.agentCitizens.length : 0,
        cameraSet: !!(window.camera || window.Camera),
        hasCanvas: !!document.querySelector('canvas')
    }));
    console.log('=== STATE ===', JSON.stringify(state, null, 2));

    await page.screenshot({ path: path.join(__dirname, 'play-test-screenshot.png') });
    await browser.close();
})();
