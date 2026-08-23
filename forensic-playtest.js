const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    await page.addInitScript(() => {
        window.__caughtErrors = [];
        window.addEventListener('error', e => window.__caughtErrors.push({ type: 'error', message: e.message, file: (e.filename||'').split('/').pop(), line: e.lineno }));
        window.addEventListener('unhandledrejection', e => window.__caughtErrors.push({ type: 'rejection', message: String(e.reason).slice(0,300) }));
    });
    const logs = [];
    page.on('console', msg => { if (msg.type() === 'error' || msg.type() === 'warning') logs.push(`[${msg.type()}] ${msg.text().slice(0,220)}`); });

    await page.goto('http://localhost:3458/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => console.log('GOTO FAIL', e.message));
    // wait for boot
    await page.waitForTimeout(10000);

    const state = await page.evaluate(() => {
        const E = window.RTSEngineCore?.ENTITIES;
        const ents = [];
        if (E) for (const [id, e] of E) ents.push({ id, type: e.type, faction: e.faction, hp: Math.round(e.hp), pos: e.mesh ? [+e.mesh.position.x.toFixed(1), +e.mesh.position.y.toFixed(1), +e.mesh.position.z.toFixed(1)] : null, state: e.state, isTurret: !!e.isTurret, isTownHall: !!e.isTownHall, isGrandTower: !!e.isGrandTower, isEnemyBase: !!e.isEnemyBase });
        const cam = window.camera || (window.Genesis && window.Genesis.camera);
        return {
            threeLoaded: !!window.THREE,
            canvas: !!document.querySelector('canvas'),
            entityCount: E ? E.size : 'NO RTSEngineCore',
            entities: ents.slice(0, 40),
            totalEntitiesReported: ents.length,
            fogInstance: !!window.RTSFogOfWarInstance,
            minimapExists: !!document.querySelector('canvas.rts-minimap') || !!window.__rtsMinimap,
            warAlertDom: !!document.getElementById('rts-war-alert'),
            economyHud: !!document.getElementById('rts-economy-hud'),
            pltValue: document.getElementById('plt-value') ? document.getElementById('plt-value').textContent : 'none',
            gameOverOverlayShown: (() => { const el = document.getElementById('rts-gameover-overlay'); return el ? (getComputedStyle(el).display !== 'none' && el.style.display !== 'none') : 'no-el'; })(),
            resources: window.RTSEconomySystem ? JSON.parse(JSON.stringify(window.RTSEconomySystem.RESOURCES)) : 'none',
            cameraPos: cam ? [+cam.position.x.toFixed(0), +cam.position.y.toFixed(0), +cam.position.z.toFixed(0)] : 'unknown',
            sovereignCities: window.sovereignCities ? window.sovereignCities.length : 'undefined',
            genesisCities: (window.Genesis && window.Genesis.VoidPopulation) ? 'present' : 'absent',
            activeStratum: window.activeStratum,
            aiDirectorPacing: window.RTSAIDirector ? Object.keys(window.RTSAIDirector) : 'none',
        };
    }).catch(e => ({ EVAL_FAIL: String(e).slice(0, 400) }));

    console.log('=== STATE ===');
    console.log(JSON.stringify(state, null, 1));

    // Screenshot 1: default view after boot
    await page.screenshot({ path: path.join(__dirname, 'forensic-01-default.png') });

    // Fly camera to player army spawn (war command PLAYER_HOME -104,0,401), look down
    const flyTo = async (x, y, z, name) => {
        await page.evaluate(([tx, ty, tz]) => {
            const cam = window.camera || (window.Genesis && window.Genesis.camera);
            if (!cam) return 'no-camera';
            cam.position.set(tx, ty, tz);
            if (window.controls && window.controls.target) window.controls.target.set(0, 0, 0);
            else if (cam.lookAt) cam.lookAt(0, 2, 0);
            return 'moved';
        }, [x, y, z]).catch(() => {});
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(__dirname, `forensic-${name}.png`) });
    };

    await flyTo(-104, 60, 480, '02-playerhome');     // player army spawn area
    await flyTo(400, 80, -200, '03-biohive-base');   // bioHive AI base
    await flyTo(-400, 80, -200, '04-imperium-base'); // imperium AI base

    console.log('=== CONSOLE ERRORS/WARNINGS (first 30) ===');
    logs.slice(0, 30).forEach(l => console.log(l));

    const errors = await page.evaluate(() => window.__caughtErrors || []).catch(() => []);
    console.log('=== PAGE ERRORS ===');
    errors.slice(0, 15).forEach(e => console.log(JSON.stringify(e)));

    await browser.close();
})();
