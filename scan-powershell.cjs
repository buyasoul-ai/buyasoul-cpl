const fs = require('fs');
const path = require('path');
const os = require('os');

const listPath = path.join(os.homedir(), 'recent_transcripts.txt');
const files = fs.readFileSync(listPath, 'utf8').trim().split(/\r?\n/).filter(Boolean);

function bump(map, k){ map[k] = (map[k]||0)+1; }

const psMap = {};
const bashMap = {};

function firstSeg(cmd){
  return cmd.trim().split(/(?:\r?\n|;|\|)/)[0].trim();
}

for (const f of files) {
  let winPath = f;
  if (/^\/([a-zA-Z])\//.test(f)) {
    winPath = f.replace(/^\/([a-zA-Z])\//, '$1:/').replace(/\//g, '\\');
  }
  let data;
  try { data = fs.readFileSync(winPath, 'utf8'); } catch(e){ continue; }
  for (const line of data.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let obj;
    try { obj = JSON.parse(line); } catch(e){ continue; }
    const content = obj && obj.message && obj.message.content;
    if (!Array.isArray(content)) continue;
    for (const item of content) {
      if (!item || item.type !== 'tool_use') continue;
      const name = item.name;
      if (name === 'PowerShell') {
        const cmd = item.input && item.input.command;
        if (typeof cmd !== 'string') continue;
        const seg = firstSeg(cmd);
        if (!seg) continue;
        // Get first cmdlet/alias token
        const toks = seg.split(/\s+/).filter(Boolean);
        if (!toks.length) continue;
        let t0 = toks[0];
        // Strip any leading $var assignments
        let i = 0;
        while (i < toks.length && /^[a-zA-Z_][a-zA-Z0-9_]*=/.test(toks[i])) i++;
        if (i >= toks.length) continue;
        t0 = toks[i];
        // Strip leading punctuation
        t0 = t0.replace(/^[^a-zA-Z]+/, '');
        if (!t0) continue;
        // Key cmdlets/aliases
        bump(psMap, t0);
      } else if (name === 'bash' || name === 'Bash') {
        const cmd = item.input && item.input.command;
        if (typeof cmd !== 'string') continue;
        const seg = firstSeg(cmd);
        if (!seg) continue;
        const toks = seg.split(/\s+/).filter(Boolean);
        if (!toks.length) continue;
        // strip env assignments
        let i = 0;
        while (i < toks.length && /^[A-Za-z_][A-Za-z0-9_]*=\S+/.test(toks[i])) i++;
        if (i >= toks.length) continue;
        let t0 = toks[i];
        t0 = t0.replace(/\.exe$/, '');
        const base = path.basename(t0);
        bump(bashMap, base);
      }
    }
  }
}
console.log('=== PowerShell (top tokens) ===');
for (const [k,v] of Object.entries(psMap).sort((a,b)=>b[1]-a[1]).slice(0,40)) console.log(v+'\t'+k);
console.log('\n=== Bash (top base tokens) ===');
for (const [k,v] of Object.entries(bashMap).sort((a,b)=>b[1]-a[1]).slice(0,40)) console.log(v+'\t'+k);
