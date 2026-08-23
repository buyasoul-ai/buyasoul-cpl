const fs = require('fs');
const acorn = require('acorn');
const html = fs.readFileSync('index.html', 'utf8');
const lines = html.split('\n');

// find module script start
let startIdx = -1, endIdx = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<script type="module">')) { startIdx = i; break; }
}
for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].includes('</script>')) { endIdx = i; break; }
}
const content = lines.slice(startIdx + 1, endIdx).join('\n');
const startFileLine = startIdx + 2; // first content line is startIdx+1, which is file line (startIdx+1)+1
console.log('Module script: file line ' + (startIdx + 2) + ' to ' + (endIdx + 1));
console.log('Content length: ' + content.length + ' chars, ' + content.split('\n').length + ' lines');

try {
    acorn.parse(content, { ecmaVersion: 2022, sourceType: 'module' });
    console.log('Module script: CLEAN');
} catch (e) {
    const fileLine = startIdx + 1 + e.loc.line;
    console.log('Module script ERROR: ' + e.message + ' @ content:' + e.loc.line + ':' + e.loc.column + ' = FILE LINE ' + fileLine);
    // Show the file line and surrounding context
    for (let j = fileLine - 3; j <= fileLine + 2; j++) {
        console.log((j === fileLine ? '>>> ' : '    ') + j + ': ' + lines[j - 1]);
    }
}
