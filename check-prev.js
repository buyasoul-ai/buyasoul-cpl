const fs = require('fs');
const acorn = require('acorn');
const html = fs.readFileSync('prev_index.html', 'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
let m;
while ((m = re.exec(html)) !== null) {
    const attrs = m[1];
    const content = m[2];
    if (attrs.includes('src=')) continue;
    if (attrs.includes('ld+json')) continue;
    if (attrs.includes('importmap')) continue;
    if (attrs.includes('type="module"')) {
        try { acorn.parse(content, { ecmaVersion: 2022, sourceType: 'module' }); console.log('PREV module script: CLEAN'); }
        catch (e) { console.log('PREV module script ERROR: ' + e.message + ' @ ' + e.loc.line + ':' + e.loc.column); }
    }
}
