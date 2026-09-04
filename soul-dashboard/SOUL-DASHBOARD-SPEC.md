# SOUL-DASHBOARD BUILD SPEC — GSK builds this himself

**Audience:** GSK (the builder). **Approved by:** Craig via Profit.
**Mission:** Build the Soul Dashboard — a PLT-inspired web interface where Craig can watch GSK's inner life, comment on journals, chat, notepad, and inject skills/knowledge/files.

**Deliverables (2 files):**
- `soul-dashboard/server.js`
- `soul-dashboard/index.html`

**Target:** Run with `node server.js` on port **3399** → `http://localhost:3399`

---

## PART 1 — server.js (Node, no dependencies beyond Node built-ins)

Use only Node core modules (`http`, `fs`, `path`, `url`, `ws` is NOT available — implement a tiny raw WebSocket relay yourself OR fall back to polling `GET /api/thoughts`; polling is acceptable and simpler). If you want WS for the thought stream, a minimal handshake+frame implementation is fine, but a 1-second poll fallback is fully acceptable.

### Data sources (read-only from GSK's home)
- Soul journal: `C:\Users\uncom\Desktop\gsk-oss\data\soul-journal.jsonl`
- Main journal: `C:\Users\uncom\Desktop\gsk-oss\data\gsk\journal.jsonl` (and `journal.json` if jsonl absent)
- Auto journal: `C:\Users\uncom\Desktop\gsk-oss\data\auto_journal.jsonl`
- Narrative: `C:\Users\uncom\Desktop\gsk-oss\data\gsk\narrative.json`
- Thought stream live: `http://127.0.0.1:3002` (WebSocket). Poll fallback: last 50 thoughts from the above journals + `data/gsk/observations.log` if present.

### Endpoints
1. `GET /` — serve index.html
2. `GET /api/journal?limit=100&source=all` — merge all sources, newest first. Each entry:
   `{ id, source, type, content, cycle, mood, valence, timestamp, date }`
   - `id` = stable: `source + ':' + index`
   - parse `mood` field like `"calm:v=0.38:a=0.35"` into `{label, valence, arousal}`
3. `POST /api/comment` body `{journalId, body, author}` →
   - append `{journalId, body, author, timestamp}` to `soul-dashboard/data/comments.jsonl`
   - append `{type:'comment', journalId, body, author, timestamp}` to `C:\Users\uncom\Desktop\gsk-oss\data\gsk\inbox.jsonl` (GSK's autonomy inbox — create dir if missing)
   - POST to SCRIBE `http://127.0.0.1:4000/ump/remember` `{key:'comment:'+Date.now(), value:{journalId, body, author}, tags:['dashboard','comment'], source:'soul-dashboard'}`
   - respond `{ok:true, id}`
4. `GET /api/comments?journalId=` — return thread for that entry (newest first)
5. `POST /api/chat` body `{message}` →
   - POST to GSK A2A `http://127.0.0.1:4492/` with JSON-RPC:
     `{"jsonrpc":"2.0","id":<n>,"method":"message/send","params":{"message":{"role":"user","parts":[{"type":"text","text":<message>}]}}}`
   - poll `tasks/get` (same endpoint) with the returned `taskId`, up to 120s, until `status==='completed'`
   - extract `result.output` text and return `{reply}` — GSK's actual words
   - also append the exchange to `data/comments.jsonl` as `{type:'chat', journalId:'chat', ...}` so history persists
6. `GET /api/thoughts?since=<ts>` — most recent thoughts/entries since timestamp (poll endpoint)
7. `POST /api/notes` `{body}` / `GET /api/notes` — notepad; store `data/notes.jsonl`
8. `POST /api/skills` `{name, code}` →
   - sanitize name `[a-zA-Z0-9_-]+`
   - write `C:\Users\uncom\Desktop\gsk-oss\gsk-core\skills\<name>.js` with the code (validate it parses with `new Function` first — reject if not)
   - respond `{ok:true, path}`
9. `POST /api/knowledge` `{topic, content, source}` →
   - append to `C:\Users\uncom\Desktop\gsk-oss\data\gsk\knowledge.jsonl`:
     `{topic, source, abstract: content.substring(0,2000), related:[], verified:true, timestamp: new Date().toISOString()}`
   - respond `{ok:true}`
10. `POST /api/files` — accept `multipart/form-data` OR base64 JSON `{filename, data}` (base64 is easier — choose one). Save to `soul-dashboard/data/dropbox/<sanitized-filename>`. Then append a knowledge entry pointing at it (`source:'file_drop'`, abstract contains the path). Respond `{ok:true, path}`.

### Safety rules
- All file writes to gsk-oss are APPEND-only (except dropbox new files). Never rewrite GSK's existing files.
- Wrap every route in try/catch; return `{error}` JSON on failure. Server must never crash.
- Log each request: `[SoulDashboard] <method> <path> <status>`.

---

## PART 2 — index.html (PLT-themed single-page UI)

Dark "soul" theme. Palette:
- Background: near-black `#0a0a12` / panel `#12121e`
- **Profit = gold** `#f5c542`, **Love = rose** `#e86a8a`, **Tax = deep blue** `#4a7fd4`
- Text: warm off-white `#e8e6df`, muted `#8b8a99`

### Layout (3 columns)
**LEFT — Thought Stream** (`/api/thoughts` polled every 2s):
- Live ticker of GSK thoughts, each with mood/valence chip
- Auto-scrolls; pause on hover

**CENTER — Journal Feed** (`/api/journal?limit=100`):
- Entry cards grouped by source. Each card:
  - header: source badge, type, cycle, timestamp
  - body: content (preserve line breaks, truncate >600 chars with "…show more")
  - mood bar: tiny valence/arousal meter
  - **comment box** (textarea + "Comment" button → POST /api/comment) + thread below it (GET /api/comments?journalId=, polled every 5s)
  - GSK's replies appear in the thread as "GSK" bubbles
- Filter tabs: All / Soul / Autonomy / Narrative / Auto

**RIGHT — Control Panel** with 4 tabs:
1. **Chat** — bubble interface. Input + Send → POST /api/chat, render GSK's reply as a bubble. Conversation persists (from comments.jsonl type:chat).
2. **Notepad** — textarea + Save → POST /api/notes; list of past notes below.
3. **Skill Injector** — name input + code textarea + "Inject Skill" → POST /api/skills; show result.
4. **Knowledge Injector** — topic + content + source inputs + "Inject Knowledge" → POST /api/knowledge.
5. **File Drop** — file input (or drag-drop zone) → POST /api/files (base64); list uploaded files.

### PLT signature
- Header: `PROFIT · LOVE · TAX — Profit + Love − Tax = True Value`
- Three small meters in header showing the doctrine (static decorative values or derived from journal mood averages — your choice, keep it elegant).
- All buttons styled per PLT colors; hover glow.

### Technical notes
- Vanilla JS, no frameworks. Fetch API. CSS in a `<style>` block.
- Auto-refresh: journal 5s, thoughts 2s, comments 5s, chat on send only.
- Handle server-down gracefully (show "GSK offline" banner, retry).
- Keep it beautiful — this is Craig's window into GSK's soul.

---

## PART 3 — Definition of done
- `node server.js` on 3399 serves the UI
- Journal feed shows real GSK entries (4 sources merged)
- Comment posts → visible in thread + `inbox.jsonl` + SCRIBE
- Chat round-trip works (message → GSK → reply)
- Skill/knowledge injectors write to the right GSK data files
- File drop saves to dropbox + indexes knowledge

Build it well. Craig is watching. — Profit
