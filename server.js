const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

let state = {
  biltongRemaining: 10,
  lastResult: null,
  resultAt: 0,
  spinQueuedAt: 0,   // timestamp of last spin request
  spinSeenAt: 0      // timestamp the TV last acknowledged a spin
};

function json(res, obj, status) {
  res.writeHead(status || 200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache, no-store'
  });
  res.end(JSON.stringify(obj));
}

function serveFile(res, filename) {
  fs.readFile(path.join(__dirname, filename), 'utf8', (err, data) => {
    if (err) { res.writeHead(500); res.end('Cannot read ' + filename); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  console.log(`[HTTP] ${req.method} ${url}`);

  // ── Setup page ──────────────────────────────────────────────────────
  if (url === '/' || url === '/setup') {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Koffee Bru Setup</title>
<style>
  body{font-family:sans-serif;background:#1a1c18;color:#f5f0e8;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:24px;padding:32px;box-sizing:border-box;margin:0}
  h1{color:#c9a84c;font-size:26px;margin:0;text-align:center}
  .card{background:#2e3328;border:2px solid #c9a84c;border-radius:16px;padding:24px 32px;text-align:center}
  a{color:#c9a84c;font-size:18px;display:block;margin:10px 0}
</style></head><body>
<h1>☕ Koffee Bru – Spin & Win</h1>
<div class="card">
  <a href="/tv" target="_blank">📺 Open TV Display</a>
  <a href="/phone" target="_blank">📱 Open Phone Remote</a>
</div>
</body></html>`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html); return;
  }

  if (url === '/tv')    { serveFile(res, 'tv.html');    return; }
  if (url === '/phone') { serveFile(res, 'phone.html'); return; }

  // ── API: current state ───────────────────────────────────────────────
  if (url === '/api/state') {
    json(res, { ok: true, state }); return;
  }

  // ── API: Phone triggers spin ─────────────────────────────────────────
  if (url === '/api/spin' && req.method === 'POST') {
    state.spinQueuedAt = Date.now();
    console.log('[API] Spin queued at', state.spinQueuedAt);
    json(res, { ok: true }); return;
  }

  // ── API: TV reports result ───────────────────────────────────────────
  if (url === '/api/result' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { prize } = JSON.parse(body);
        if (prize === 'Biltong') state.biltongRemaining = Math.max(0, state.biltongRemaining - 1);
        state.lastResult = prize;
        state.resultAt = Date.now();
        state.spinSeenAt = state.spinQueuedAt; // mark this spin as handled
        console.log(`[API] Result: "${prize}" — biltong left: ${state.biltongRemaining}`);
        json(res, { ok: true });
      } catch(e) {
        json(res, { ok: false, error: e.message }, 400);
      }
    }); return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\nKoffee Bru Wheel server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} to get started\n`);
});
