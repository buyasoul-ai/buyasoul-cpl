const fs = require('fs');
const acorn = require('acorn');

// Get all script srcs from index.html that are CLASSIC (not module)
const html = fs.readFileSync('index.html', 'utf8');
const tags = html.match(/<script[^>]*src="([^"]+)"[^>]*>/g) || [];
const classicSrcs = tags.filter(t => !t.includes('type="module"')).map(t => {
    const m = t.match(/src="([^"]+)"/);
    return m ? m[1] : null;
}).filter(Boolean);

// Parse each loaded file as a SCRIPT (classic) to find which would throw
console.log('Files loaded as CLASSIC scripts that contain module syntax (import/export):');
let found = false;
classicSrcs.forEach(src => {
    // Only check local files
    if (!src.startsWith('http') && !src.startsWith('//')) {
        const clean = src.replace(/^\.\//, '');
        let filePath = clean;
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            if (/^\s*(import|export)\s/m.test(content)) {
                // Try parsing as classic script
                try {
                    acorn.parse(content, { ecmaVersion: 2022, sourceType: 'script' });
                } catch (e) {
                    console.log('  ❌ ' + clean + ' → ' + e.message.slice(0, 80));
                    found = true;
                }
            }
        }
    }
});
if (!found) console.log('  (none)');
