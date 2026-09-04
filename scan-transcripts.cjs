const fs = require('fs');
const path = require('path');
const os = require('os');

// Resolve recent transcripts via Git Bash-compatible path
const listPath = path.join(os.homedir(), 'recent_transcripts.txt');
const files = fs.readFileSync(listPath, 'utf8').trim().split(/\r?\n/).filter(Boolean);

const counts = {};
function bump(k){ counts[k] = (counts[k]||0)+1; }

function normBash(cmd){
  let s = cmd.trim();
  let seg = s.split(/(?:&&|\|\||;|\|)/)[0].trim();
  seg = seg.replace(/^([A-Za-z_][A-Za-z0-9_]*=\S+\s+)+/, '');
  seg = seg.replace(/^(sudo\s+|timeout\s+\S+\s+|env\s+)/, '');
  const toks = seg.split(/\s+/).filter(Boolean);
  if (!toks.length) return null;
  const t0 = toks[0];
  const base = path.basename(t0).replace(/\.exe$/, '');
  const subs = ['git','gh','docker','kubectl','npm','yarn','pnpm','bun','cargo','go','rustc','make','just','dotnet','aws','gcloud','az','tmux'];
  if (subs.includes(base) && toks[1]) {
    return base + ' ' + toks[1];
  }
  return base;
}

for (const f of files) {
  // f may be /c/Users/... (Git Bash style). Convert to Windows path for Node.
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
      if (name === 'Bash') {
        const cmd = item.input && item.input.command;
        if (typeof cmd !== 'string') continue;
        const n = normBash(cmd);
        if (n) bump('Bash:' + n);
      } else {
        bump('TOOL:' + name);
      }
    }
  }
}
const out = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
for (const [k,v] of out) console.log(v + '\t' + k);
