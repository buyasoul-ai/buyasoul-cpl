const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    const failed = [];
    page.on('response', r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
    page.on('requestfailed', r => failed.push(`FAILED ${r.url()} :: ${r.failure()?.errorText}`));
    await page.goto('http://localhost:3458/index.html', { waitUntil: 'networkidle', timeout: 45000 }).catch(e => console.log('goto:', e.message.slice(0, 100)));
    await page.waitForTimeout(8000);
    console.log('=== FAILED REQUESTS ===');
    [...new Set(failed)].forEach(f => console.log(f));
    await browser.close();
})();
