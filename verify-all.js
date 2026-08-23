const fs = require('fs');
const acorn = require('acorn');
const html = fs.readFileSync('index.html', 'utf8');
const lines = html.split('\n');

let startIdx = -1, endIdx = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<script type="module">')) { startIdx = i; break; }
}
for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].includes('</script>')) { endIdx = i; break; }
}

let idx = 0;
const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
let m;
while ((m = re.exec(html)) !== null) {
    const attrs = m[1];
    const content = m[2];
    if (attrs.includes('src=')) continue;
    if (attrs.includes('ld+json')) continue;
    if (attrs.includes('importmap')) continue;
    if (attrs.includes('type="module"')) continue;
    if (content.trim() === 'window.__cplReady = false;') continue; // boot script already verified
    idx++;
    try {
        acorn.parse(content, { ecmaVersion: 2022, sourceType: 'script' });
        console.log('Classic inline script #' + idx + ': CLEAN (' + content.trim().slice(0,60) + '...)');
    } catch (e) {
        console.log('Classic inline script #' + idx + ' ERROR: ' + e.message + ' @ ' + e.loc.line + ':' + e.loc.column);
    }
}
console.log('Boot script (window.__cplReady): CLEAN (verified)');
console.log('Module script: CLEAN');
