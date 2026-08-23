const fs = require('fs');
const acorn = require('acorn');

const html = fs.readFileSync('index.html', 'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
let m, idx = 0;
while ((m = re.exec(html)) !== null) {
    const attrs = m[1];
    const content = m[2];
    if (attrs.includes('src=')) continue;
    if (!content.trim()) continue;
    idx++;
    // Show first line of each inline script to identify it
    const firstLine = content.split('\n').find(l => l.trim()).trim().slice(0, 90);
    console.log(`#${idx} attrs=[${attrs.trim()}] first=[${firstLine}]`);
}
