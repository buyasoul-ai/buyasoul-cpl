// server.js — Local HTTP server + REST API + SOUL↔BODY BRIDGE
// ============================================================================
// This server is the BODY's doorway. GSK (the soul) perceives and acts through
// these endpoints:
//
//   WS   /spatial          — GSK perceives world state (entities, fog, resources,
//                            threats, player). The browser pushes snapshots here.
//   POST /api/rts/order    — GSK issues embodied RTS orders (move/build/spawn/
//                            research/trade/attack/gather) → relayed to browser.
//   POST /api/world-build  — GSK commands world builds (structure/spawn).
//   GET  /api/world-build  — GSK reads world build state.
//   POST /broadcast        — GSK sends thoughts/events into the world.
//   GET  /api/tasks        — Task store (unchanged).
//
// The browser side (index.html) connects to /spatial and pushes real RTS state;
// god_commands received from GSK are dispatched to the running engine.
// ============================================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

// 3456: stuck legacy process. 3457: squatted by host/genesis-host.cjs (GSK/MCP
// bridge, serves no static files). 3458 is this server's real home.
const PORT = 3458;
const TASKS_FILE = path.join(__dirname, 'void-tasks-live.json');
const WORLD_BUILD_FILE = path.join(__dirname, 'void-world-builds.json');
const root = __dirname;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

// ── In-memory bridge state ────────────────────────────────────────────────
let worldState = {
  entities: [],
  fog: {},
  resources: [],
  threats: [],
  player: null,
  world: { cities: 0, tick: 0 }
};
let browserSockets = new Set();  // browser WS clients (push state in)
let gskSockets = new Set();      // GSK WS clients (perceive state out)

// ── WebSocket Server (the /spatial sensory channel) ───────────────────────
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost:' + PORT);
  const role = url.searchParams.get('role') || 'gsk'; // ?role=browser | ?role=gsk
  if (role === 'browser') {
    browserSockets.add(ws);
    console.log('[Bridge] Browser connected to /spatial');
  } else {
    gskSockets.add(ws);
    console.log('[Bridge] GSK connected to /spatial (perception channel open)');
    // Send the current world state immediately so GSK perceives on connect.
    sendTo(ws, { type: 'state', data: worldState });
  }

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch (e) { return; }

    if (role === 'browser') {
      // Browser pushes live world snapshots.
      if (msg.type === 'spatial_state' || msg.type === 'spatial_telemetry') {
        const snap = msg.snapshot || msg.data || {};
        worldState = {
          timestamp: Date.now(),
          entities: snap.entities || worldState.entities,
          fog: snap.fog || worldState.fog,
          resources: snap.resources || worldState.resources,
          threats: snap.threats || worldState.threats,
          player: snap.player || worldState.player,
          world: snap.world || { ...worldState.world, cities: snap.activeCities ?? worldState.world.cities }
        };
        // Relay the fresh state to every GSK observer.
        for (const g of gskSockets) {
          if (g.readyState === 1) {
            sendTo(g, { type: 'state', data: worldState });
            if ((worldState.threats || []).length > 0) {
              sendTo(g, { type: 'threat_alert', data: { threats: worldState.threats } });
            }
          }
        }
      }
    } else {
      // GSK control messages.
      if (msg.type === 'subscribe') {
        sendTo(ws, { type: 'state', data: worldState });
      }
      if (msg.type === 'sync') {
        sendTo(ws, { type: 'state', data: worldState });
      }
    }
  });

  ws.on('close', () => {
    browserSockets.delete(ws);
    gskSockets.delete(ws);
  });
  ws.on('error', () => {
    browserSockets.delete(ws);
    gskSockets.delete(ws);
  });
});

function sendTo(ws, obj) {
  try { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); } catch (e) {}
}

// Broadcast a god_command to all browser clients (GSK → world).
function broadcastGodCommand(action, params) {
  const msg = { type: 'god_command', action, params };
  for (const b of browserSockets) sendTo(b, msg);
  return browserSockets.size;
}

// ── HTTP Server ───────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ── Bridge: GET /api/world-build — read world build state ────────────────
  if (pathname === '/api/world-build' && req.method === 'GET') {
    if (fs.existsSync(WORLD_BUILD_FILE)) {
      fs.readFile(WORLD_BUILD_FILE, 'utf8', (err, data) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to read world-build store' }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(data);
        }
      });
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ builds: [], spawns: [] }));
    }
    return;
  }

  // ── Bridge: POST /api/world-build — GSK builds a structure / spawns ──────
  if (pathname === '/api/world-build' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        // Persist to store (append).
        let store = { builds: [], spawns: [] };
        if (fs.existsSync(WORLD_BUILD_FILE)) {
          try { store = JSON.parse(fs.readFileSync(WORLD_BUILD_FILE, 'utf8')); } catch (e) {}
        }
        if (payload.type === 'spawn') {
          store.spawns.push({ ...payload, at: Date.now() });
        } else {
          store.builds.push({ ...payload, at: Date.now() });
        }
        fs.writeFile(WORLD_BUILD_FILE, JSON.stringify(store, null, 2), 'utf8', (err) => {
          // Relay to the live world regardless of persistence success.
          const relayed = broadcastGodCommand(
            payload.type === 'spawn' ? 'SPAWN_AGENT_AVATAR' : 'BUILD_STRUCTURE',
            payload
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, relayedTo: relayed, saved: !err, count: store.builds.length }));
        });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    });
    return;
  }

  // ── Bridge: POST /api/rts/order — GSK embodied action → world ───────────
  if (pathname === '/api/rts/order' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const order = JSON.parse(body);
        // Map GSK action types to god_command actions the browser understands.
        const actionMap = {
          move: 'RTS_MOVE',
          build: 'BUILD_STRUCTURE',
          spawn: 'RTS_SPAWN_UNIT',
          research: 'RTS_RESEARCH',
          trade: 'RTS_TRADE',
          attack: 'RTS_ATTACK',
          gather: 'RTS_GATHER'
        };
        const action = actionMap[order.type] || order.type;
        const relayed = broadcastGodCommand(action, order);
        // Also mirror into worldState so GSK perceives the order's effect immediately.
        worldState.world.lastOrder = { action, order, at: Date.now() };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, action, relayedTo: relayed }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    });
    return;
  }

  // ── Bridge: POST /broadcast — GSK sends a thought/event into the world ──
  if (pathname === '/broadcast' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        broadcastGodCommand('GSK_BROADCAST', payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, relayedTo: browserSockets.size }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    });
    return;
  }

  // REST API: GET /api/tasks
  if (pathname === '/api/tasks' && req.method === 'GET') {
    if (fs.existsSync(TASKS_FILE)) {
      fs.readFile(TASKS_FILE, 'utf8', (err, data) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to read tasks store' }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(data);
        }
      });
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
    }
    return;
  }

  // REST API: POST /api/tasks
  if (pathname === '/api/tasks' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const tasks = payload.tasks || [];
        fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf8', err => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to save tasks store' }));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, count: tasks.length }));
          }
        });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    });
    return;
  }

  // REST API: DELETE /api/tasks
  if (pathname === '/api/tasks' && req.method === 'DELETE') {
    if (fs.existsSync(TASKS_FILE)) {
      fs.unlink(TASKS_FILE, err => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to delete tasks store' }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        }
      });
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    }
    return;
  }

  // ── Bridge: GET /api/spatial — one-shot state snapshot (no WS needed) ───
  if (pathname === '/api/spatial' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(worldState));
    return;
  }

  // Static files server
  let rel = pathname;
  if (rel === '/') rel = '/index.html';
  const file = path.resolve(root, '.' + rel);

  if (!file.toLowerCase().startsWith(root.toLowerCase())) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(file, (err, stats) => {
    if (err || stats.isDirectory()) {
      res.writeHead(404);
      res.end('Not Found');
    } else {
      res.writeHead(200, {
        'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      fs.createReadStream(file).pipe(res);
    }
  });
});

// ── Upgrade /spatial to WebSocket ─────────────────────────────────────────
server.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url, 'http://localhost:' + PORT).pathname;
  if (pathname === '/spatial') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Void Server] running at http://localhost:${PORT}/`);
  console.log(`[Void Server] serving map on root, tasks API on /api/tasks`);
  console.log(`[Void Server] SOUL BRIDGE LIVE — /spatial (WS) · /api/rts/order · /api/world-build · /broadcast`);
});
