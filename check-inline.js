const fs = require('fs');
const acorn = require('acorn');

const html = fs.readFileSync('index.html', 'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
let m, idx = 0;
while ((m = re.exec(html)) !== null) {
    const attrs = m[1];
    const content = m[2];
    if (attrs.includes('src=')) continue;
    if (attrs.includes('ld+json')) continue;
    if (attrs.includes('importmap')) continue;
    if (attrs.includes('type="module"')) {
        // Parse as module
        try { acorn.parse(content, { ecmaVersion: 2022, sourceType: 'module' }); console.log('MODULE script: CLEAN'); }
        catch (e) { console.log('MODULE script ERROR: ' + e.message + ' @ ' + e.loc.line + ':' + e.loc.column); }
        continue;
    }
    idx++;
    try {
        acorn.parse(content, { ecmaVersion: 2022, sourceType: 'script' });
        console.log(`Classic inline script #${idx}: CLEAN (${content.trim().slice(0,60)}...)`);
    } catch (e) {
        console.log(`Classic inline script #${idx} ERROR: ${e.message} @ ${e.loc.line}:${e.loc.column}`);
    }
}
