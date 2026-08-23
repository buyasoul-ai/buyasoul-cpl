/**
 * rts-nav-grid.js
 * BUYASOUL CPL / GODFORGE — A* Navigation Grid (optimized)
 *
 * Improvements made:
 *  - Replaced linear-scan open set with a binary min-heap (priority queue) to speed up pathfinding.
 *  - Replaced Manhattan heuristic with an octile heuristic appropriate for 8-neighbor grids.
 *  - Kept existing diagonal-cut prevention and path smoothing.
 */

(function() {
  'use strict';

  let BOUNDS = { minX: -2500, minZ: -2500, maxX: 2500, maxZ: 2500 };
  let CELL = 5;
  let COLS = 0, ROWS = 0;
  let BLOCKED = null; // Uint8Array
  let debugGroup = null;
  let debugOn = false;

  function init(bounds, cellSize) {
    if (bounds) BOUNDS = Object.assign(BOUNDS, bounds);
    CELL = Math.max(1, cellSize || 5);
    COLS = Math.max(1, Math.ceil((BOUNDS.maxX - BOUNDS.minX) / CELL));
    ROWS = Math.max(1, Math.ceil((BOUNDS.maxZ - BOUNDS.minZ) / CELL));
    BLOCKED = new Uint8Array(COLS * ROWS);
  }

  function worldToCell(x, z) {
    const col = Math.floor((x - BOUNDS.minX) / CELL);
    const row = Math.floor((z - BOUNDS.minZ) / CELL);
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return null;
    return { col, row };
  }

  function cellToWorld(col, row) {
    return {
      x: BOUNDS.minX + col * CELL + CELL / 2,
      z: BOUNDS.minZ + row * CELL + CELL / 2
    };
  }

  function idx(col, row) { return row * COLS + col; }

  function setBlockedAt(x, z, blocked) {
    const c = worldToCell(x, z);
    if (!c) return;
    BLOCKED[idx(c.col, c.row)] = blocked ? 1 : 0;
  }

  function blockCircle(x, z, radius, blocked) {
    const rCells = Math.ceil(radius / CELL);
    const c = worldToCell(x, z);
    if (!c) return;
    const minCol = Math.max(0, c.col - rCells);
    const maxCol = Math.min(COLS - 1, c.col + rCells);
    const minRow = Math.max(0, c.row - rCells);
    const maxRow = Math.min(ROWS - 1, c.row + rCells);
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const wx = BOUNDS.minX + col * CELL + CELL / 2;
        const wz = BOUNDS.minZ + row * CELL + CELL / 2;
        const dx = wx - x, dz = wz - z;
        if (dx * dx + dz * dz <= radius * radius) {
          BLOCKED[idx(col, row)] = blocked ? 1 : 0;
        }
      }
    }
  }

  function unblockCircle(x, z, radius) {
    blockCircle(x, z, radius, false);
  }

  function isWalkable(x, z) {
    const c = worldToCell(x, z);
    if (!c) return false;
    return BLOCKED[idx(c.col, c.row)] === 0;
  }

  // --- Binary min-heap (priority queue) helpers ---
  function heapPush(heap, item) {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (heap[p].f <= heap[i].f) break;
      const t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p;
    }
  }
  function heapPop(heap) {
    if (heap.length === 0) return null;
    const out = heap[0];
    const last = heap.pop();
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      while (true) {
        const l = 2 * i + 1, r = 2 * i + 2;
        let smallest = i;
        if (l < heap.length && heap[l].f < heap[smallest].f) smallest = l;
        if (r < heap.length && heap[r].f < heap[smallest].f) smallest = r;
        if (smallest === i) break;
        const t = heap[i]; heap[i] = heap[smallest]; heap[smallest] = t; i = smallest;
      }
    }
    return out;
  }

  // --- A* pathfinding (optimized) ---
  function findPath(sx, sz, ex, ez) {
    if (!BLOCKED) return [];
    const start = worldToCell(sx, sz);
    const goal = worldToCell(ex, ez);
    if (!start || !goal) return [];
    const goalIdx = idx(goal.col, goal.row);
    if (BLOCKED[goalIdx] === 1) {
      const near = nearestWalkable(goal.col, goal.row);
      if (near) { goal.col = near.col; goal.row = near.row; }
      else return [];
    }

    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    const startKey = idx(start.col, start.row);
    const goalKey = idx(goal.col, goal.row);

    gScore.set(startKey, 0);
    fScore.set(startKey, heuristic(start, goal));

    const openMap = new Map(); // key -> f
    const openHeap = [];
    openMap.set(startKey, fScore.get(startKey));
    heapPush(openHeap, { key: startKey, f: fScore.get(startKey) });

    const dirs = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [1, -1], [-1, 1], [-1, -1]
    ];

    let guard = 0;
    const MAX_GUARD = 20000;
    while (openHeap.length > 0 && guard < MAX_GUARD) {
      guard++;
      const cur = heapPop(openHeap);
      if (!cur) break;
      const curKey = cur.key;
      // If this entry is stale (we pushed a newer f for same key), skip it
      const recordedF = openMap.get(curKey);
      if (recordedF === undefined || Math.abs(recordedF - cur.f) > 1e-9) {
        continue;
      }
      openMap.delete(curKey);

      if (curKey === goalKey) {
        return reconstructPath(cameFrom, curKey, startKey);
      }

      const curCol = curKey % COLS;
      const curRow = Math.floor(curKey / COLS);

      for (const [dc, dr] of dirs) {
        const nc = curCol + dc, nr = curRow + dr;
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
        const nk = idx(nc, nr);
        if (BLOCKED[nk] === 1) continue;
        // skip diagonal cutting corners
        if (dc !== 0 && dr !== 0) {
          if (BLOCKED[idx(curCol + dc, curRow)] === 1 || BLOCKED[idx(curCol, curRow + dr)] === 1) continue;
        }
        const cost = (dc !== 0 && dr !== 0) ? 1.4142135623730951 : 1.0;
        const tentative = (gScore.get(curKey) === undefined ? Infinity : gScore.get(curKey)) + cost;
        const prevG = (gScore.get(nk) === undefined ? Infinity : gScore.get(nk));
        if (tentative < prevG) {
          cameFrom.set(nk, curKey);
          gScore.set(nk, tentative);
          const f = tentative + heuristic({ col: nc, row: nr }, goal);
          fScore.set(nk, f);
          openMap.set(nk, f);
          heapPush(openHeap, { key: nk, f });
        }
      }
    }
    return [];
  }

  // Octile heuristic (admissible for 8-neighbor grid with diagonal cost sqrt(2))
  function heuristic(a, b) {
    const dx = Math.abs(a.col - b.col);
    const dy = Math.abs(a.row - b.row);
    return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
  }

  function nearestWalkable(col, row) {
    for (let r = 1; r < 20; r++) {
      for (let dc = -r; dc <= r; dc++) {
        for (let dr = -r; dr <= r; dr++) {
          if (Math.abs(dc) !== r && Math.abs(dr) !== r) continue;
          const nc = col + dc, nr = row + dr;
          if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
          if (BLOCKED[idx(nc, nr)] === 0) return { col: nc, row: nr };
        }
      }
    }
    return null;
  }

  function reconstructPath(cameFrom, lastKey, startKey) {
    const cells = [];
    let k = lastKey;
    while (k !== undefined) {
      cells.push({ col: k % COLS, row: Math.floor(k / COLS) });
      if (k === startKey) break;
      k = cameFrom.get(k);
    }
    cells.reverse();

    // Convert to world waypoints, then smooth (drop collinear midpoints)
    const raw = cells.map(c => cellToWorld(c.col, c.row));
    return smoothPath(raw);
  }

  function smoothPath(raw) {
    if (raw.length <= 2) return raw;
    const out = [raw[0]];
    for (let i = 1; i < raw.length - 1; i++) {
      const prev = out[out.length - 1];
      const cur = raw[i];
      const next = raw[i + 1];
      const d1 = Math.atan2(cur.z - prev.z, cur.x - prev.x);
      const d2 = Math.atan2(next.z - cur.z, next.x - cur.x);
      if (Math.abs(angleDiff(d1, d2)) > 0.05) {
        out.push(cur); // keep as a real turn waypoint
      }
      // else drop — it's collinear
    }
    out.push(raw[raw.length - 1]);
    return out;
  }

  function angleDiff(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  // --- debug mesh ---
  function debugVisible(show) {
    debugOn = show;
    if (!show) {
      if (debugGroup && debugGroup.parent) debugGroup.parent.remove(debugGroup);
      debugGroup = null;
      return;
    }
    if (debugGroup) return;
    const T = window.THREE;
    if (!T) return;
    debugGroup = new T.Group();
    for (let col = 0; col < COLS; col++) {
      for (let row = 0; row < ROWS; row++) {
        if (BLOCKED[idx(col, row)] !== 1) continue;
        const p = cellToWorld(col, row);
        const m = new T.Mesh(
          new T.BoxGeometry(CELL * 0.8, 0.2, CELL * 0.8),
          new T.MeshBasicMaterial({ color: 0xff3355, transparent: true, opacity: 0.4 })
        );
        m.position.set(p.x, 0.1, p.z);
        debugGroup.add(m);
      }
    }
    if (window.__rtsNavDebugScene) window.__rtsNavDebugScene.add(debugGroup);
    else if (window.scene) window.scene.add(debugGroup);
  }

  function install(opts) {
    opts = opts || {};
    init(opts.bounds, opts.cellSize);
    console.log('[RTSNavGrid] Installed. Grid', COLS + 'x' + ROWS, 'cells of', CELL + 'u.');
  }

  // expose to core
  window.RTSNavGrid = {
    install,
    init,
    worldToCell,
    cellToWorld,
    setBlockedAt,
    blockCircle,
    unblockCircle,
    isWalkable,
    findPath,
    debugVisible,
    _bounds: () => BOUNDS,
    _cell: () => CELL
  };
})();
