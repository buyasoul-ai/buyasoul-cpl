'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = 3399;
const DASHBOARD_DIR = __dirname;
const GSK_DATA_DIR = 'C:\\Users\\uncom\\Desktop\\gsk-oss\\data';
const GSK_CORE_DIR = 'C:\\Users\\uncom\\Desktop\\gsk-oss\\gsk-core';

const SOUL_JOURNAL = path.join(GSK_DATA_DIR, 'soul-journal.jsonl');
const MAIN_JOURNAL_JSONL = path.join(GSK_DATA_DIR, 'gsk', 'journal.jsonl');
const MAIN_JOURNAL_JSON = path.join(GSK_DATA_DIR, 'gsk', 'journal.json');
const AUTO_JOURNAL = path.join(GSK_DATA_DIR, 'auto_journal.jsonl');
const NARRATIVE = path.join(GSK_DATA_DIR, 'gsk', 'narrative.json');
const OBSERVATIONS = path.join(GSK_DATA_DIR, 'gsk', 'observations.log');
const INBOX = path.join(GSK_DATA_DIR, 'gsk', 'inbox.jsonl');
const COMMENTS = path.join(DASHBOARD_DIR, 'data', 'comments.jsonl');
const NOTES = path.join(DASHBOARD_DIR, 'data', 'notes.jsonl');
const DROPBOX_DIR = path.join(DASHBOARD_DIR, 'data', 'dropbox');
const KNOWLEDGE = path.join(GSK_DATA_DIR, 'gsk', 'knowledge.jsonl');
const SKILLS_DIR = path.join(GSK_CORE_DIR, 'skills');

const GSK_A2A = 'http://127.0.0.1:4492/a2a';
const SCRIBE = 'http://127.0.0.1:4000/ump/remember';
const NINE_ROUTER_API_KEY = 'oma_live_LwExG5AaU_5Joz-R_iC9E9aTpAj0m0s7GK09xVflvQg';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDir(DROPBOX_DIR);
ensureDir(path.dirname(COMMENTS));
ensureDir(path.dirname(NOTES));
ensureDir(path.dirname(INBOX));

function logReq(method, p, status) {
  console.log(`[SoulDashboard] ${method} ${p} ${status}`);
}

function parseMood(moodStr) {
  if (!moodStr) return { label: 'unknown', valence: 0.5, arousal: 0.5 };
  const m = String(moodStr).match(/^([^:]+):v=([0-9.]+):a=([0-9.]+)/);
  if (m) return { label: m[1], valence: parseFloat(m[2]), arousal: parseFloat(m[3]) };
  return { label: moodStr, valence: 0.5, arousal: 0.5 };
}

function readJSONL(file) {
  if (!fs.existsSync(file)) return [];
  const content = fs.readFileSync(file, 'utf8').trim();
  if (!content) return [];
  return content.split('\n').filter(l => l.trim()).map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

function readJSON(file) {
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function appendJSONL(file, obj) {
  ensureDir(path.dirname(file));
  fs.appendFileSync(file, JSON.stringify(obj) + '\n');
}

function mergeJournals(limit = 100) {
  const sources = [
    { file: SOUL_JOURNAL, source: 'soul', typeKey: 'type' },
    { file: MAIN_JOURNAL_JSONL, source: 'autonomy', typeKey: 'type' },
    { file: AUTO_JOURNAL, source: 'auto', typeKey: 'type' },
  ];
  const entries = [];
  let idx = 0;
  for (const src of sources) {
    const lines = readJSONL(src.file);
    for (const line of lines) {
      const mood = parseMood(line.mood);
      entries.push({
        id: `${src.source}:${idx++}`,
        source: src.source,
        type: line[src.typeKey] || 'entry',
        content: line.content || line.body || JSON.stringify(line),
        cycle: line.cycle ?? line.cycleCount ?? null,
        mood: mood.label,
        valence: mood.valence,
        arousal: mood.arousal,
        timestamp: line.timestamp ?? Date.now(),
        date: line.timestamp ? new Date(line.timestamp).toISOString() : new Date().toISOString()
      });
    }
  }
  const narrativeData = readJSON(NARRATIVE);
  if (Array.isArray(narrativeData)) {
    for (const n of narrativeData) {
      const mood = parseMood(n.mood);
      entries.push({
        id: `narrative:${idx++}`,
        source: 'narrative',
        type: 'narrative',
        content: n.body || n.content || '',
        cycle: n.cycle ?? null,
        mood: mood.label,
        valence: mood.valence,
        arousal: mood.arousal,
        timestamp: n.timestamp ?? Date.now(),
        date: n.timestamp ? new Date(n.timestamp).toISOString() : new Date().toISOString()
      });
    }
  }
  entries.sort((a, b) => b.timestamp - a.timestamp);
  return entries.slice(0, limit);
}

function getComments(journalId) {
  const all = readJSONL(COMMENTS);
  return all.filter(c => c.journalId === journalId).sort((a, b) => b.timestamp - a.timestamp);
}

function postToSCRIBE(key, value, tags = []) {
  return fetch(SCRIBE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value, tags, source: 'soul-dashboard' })
  }).catch(() => {}); // fire and forget
}

async function callGSK(message) {
  const taskId = `task_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const sendRes = await fetch(GSK_A2A, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${NINE_ROUTER_API_KEY}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'message/send',
      params: {
        message: { role: 'user', parts: [{ type: 'text', text: message }] },
        metadata: { source: 'soul-dashboard', task: 'chat' }
      }
    })
  });
  const sendJson = await sendRes.json();
  const returnedTaskId = sendJson.result?.taskId;
  if (!returnedTaskId) throw new Error('No taskId from GSK');

  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000));
    const getRes = await fetch(GSK_A2A, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NINE_ROUTER_API_KEY}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'tasks/get',
        params: { taskId: returnedTaskId }
      })
    });
    const getJson = await getRes.json();
    const task = getJson.result;
    if (task && task.status === 'completed') {
      const out = task.result?.result?.output || task.result?.output || task.result;
      return typeof out === 'string' ? out : JSON.stringify(out);
    }
    if (task && task.status === 'failed') throw new Error(task.error || 'GSK task failed');
  }
  throw new Error('GSK timeout');
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  try {
    // GET / -> index.html
    if (req.method === 'GET' && pathname === '/') {
      const html = fs.readFileSync(path.join(DASHBOARD_DIR, 'index.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(html);
    }

    // GET /api/journal
    if (req.method === 'GET' && pathname === '/api/journal') {
      const limit = Math.min(parseInt(parsed.query.limit) || 100, 500);
      const entries = mergeJournals(limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      logReq('GET', pathname, 200);
      return res.end(JSON.stringify(entries));
    }

    // GET /api/comments
    if (req.method === 'GET' && pathname === '/api/comments') {
      const journalId = parsed.query.journalId;
      if (!journalId) { res.writeHead(400); return res.end(JSON.stringify({ error: 'journalId required' })); }
      const comments = getComments(journalId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      logReq('GET', pathname, 200);
      return res.end(JSON.stringify(comments));
    }

    // POST /api/comment
    if (req.method === 'POST' && pathname === '/api/comment') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', async () => {
        try {
          const { journalId, body: commentBody, author } = JSON.parse(body);
          if (!journalId || !commentBody || !author) {
            res.writeHead(400); return res.end(JSON.stringify({ error: 'journalId, body, author required' }));
          }
          const comment = { journalId, body: commentBody, author, timestamp: Date.now() };
          appendJSONL(COMMENTS, comment);
          appendJSONL(INBOX, { type: 'comment', ...comment });
          postToSCRIBE(`comment:${Date.now()}`, comment, ['dashboard', 'comment']);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          logReq('POST', pathname, 200);
          res.end(JSON.stringify({ ok: true, id: crypto.randomUUID() }));
        } catch (e) {
          res.writeHead(400); res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // POST /api/chat
    if (req.method === 'POST' && pathname === '/api/chat') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', async () => {
        try {
          const { message } = JSON.parse(body);
          if (!message) { res.writeHead(400); return res.end(JSON.stringify({ error: 'message required' })); }
          const reply = await callGSK(message);
          appendJSONL(COMMENTS, { type: 'chat', journalId: 'chat', body: message, author: 'user', reply, timestamp: Date.now() });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          logReq('POST', pathname, 200);
          res.end(JSON.stringify({ reply }));
        } catch (e) {
          res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // GET /api/thoughts
    if (req.method === 'GET' && pathname === '/api/thoughts') {
      const since = parseInt(parsed.query.since) || 0;
      const entries = mergeJournals(50).filter(e => e.timestamp > since);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      logReq('GET', pathname, 200);
      return res.end(JSON.stringify(entries));
    }

    // POST /api/notes
    if (req.method === 'POST' && pathname === '/api/notes') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const { body: noteBody } = JSON.parse(body);
          if (!noteBody) { res.writeHead(400); return res.end(JSON.stringify({ error: 'body required' })); }
          const note = { body: noteBody, timestamp: Date.now() };
          appendJSONL(NOTES, note);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          logReq('POST', pathname, 200);
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400); res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // GET /api/notes
    if (req.method === 'GET' && pathname === '/api/notes') {
      const notes = readJSONL(NOTES).sort((a, b) => b.timestamp - a.timestamp);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      logReq('GET', pathname, 200);
      return res.end(JSON.stringify(notes));
    }

    // POST /api/skills
    if (req.method === 'POST' && pathname === '/api/skills') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const { name, code } = JSON.parse(body);
          if (!name || !code) { res.writeHead(400); return res.end(JSON.stringify({ error: 'name, code required' })); }
          if (!/^[a-zA-Z0-9_-]+$/.test(name)) { res.writeHead(400); return res.end(JSON.stringify({ error: 'invalid name' })); }
          try { new Function(code); } catch { res.writeHead(400); return res.end(JSON.stringify({ error: 'code does not parse' })); }
          ensureDir(SKILLS_DIR);
          const skillPath = path.join(SKILLS_DIR, `${name}.js`);
          fs.writeFileSync(skillPath, code, 'utf8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          logReq('POST', pathname, 200);
          res.end(JSON.stringify({ ok: true, path: skillPath }));
        } catch (e) {
          res.writeHead(400); res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // POST /api/knowledge
    if (req.method === 'POST' && pathname === '/api/knowledge') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const { topic, content, source } = JSON.parse(body);
          if (!topic || !content) { res.writeHead(400); return res.end(JSON.stringify({ error: 'topic, content required' })); }
          const entry = {
            topic,
            source: source || 'dashboard',
            abstract: String(content).substring(0, 2000),
            related: [],
            verified: true,
            timestamp: new Date().toISOString()
          };
          appendJSONL(KNOWLEDGE, entry);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          logReq('POST', pathname, 200);
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400); res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // POST /api/files (base64 JSON)
    if (req.method === 'POST' && pathname === '/api/files') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const { filename, data } = JSON.parse(body);
          if (!filename || !data) { res.writeHead(400); return res.end(JSON.stringify({ error: 'filename, data required' })); }
          const safe = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
          const filePath = path.join(DROPBOX_DIR, safe);
          const buf = Buffer.from(data, 'base64');
          fs.writeFileSync(filePath, buf);
          appendJSONL(KNOWLEDGE, {
            topic: `file_drop_${safe}`,
            source: 'file_drop',
            abstract: `Uploaded file saved to ${filePath}`,
            related: [],
            verified: true,
            timestamp: new Date().toISOString()
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          logReq('POST', pathname, 200);
          res.end(JSON.stringify({ ok: true, path: filePath }));
        } catch (e) {
          res.writeHead(400); res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    logReq(req.method, pathname, 404);
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    logReq(req.method, pathname, 500);
    res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, () => {
  console.log(`[SoulDashboard] Server running on http://localhost:${PORT}`);
});