import http from 'node:http';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 5177;

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const host = readArg('--host') ?? process.env.HOST ?? DEFAULT_HOST;
const port = Number.parseInt(readArg('--port') ?? process.env.PORT ?? String(DEFAULT_PORT), 10);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`Invalid port: ${port}`);
}

function toRequestSnapshot(request) {
  return {
    receivedAt: new Date().toISOString(),
    method: request.method,
    url: request.url,
    httpVersion: request.httpVersion,
    remoteAddress: request.socket.remoteAddress,
    headers: request.headers,
    rawHeaders: request.rawHeaders,
  };
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-modierheaders-test-server': 'headers-json',
  });
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeScriptJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function renderHeaderRows(headers) {
  return Object.entries(headers)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([name, value]) => `
        <tr>
          <th scope="row">${escapeHtml(name)}</th>
          <td>${escapeHtml(Array.isArray(value) ? value.join(', ') : value ?? '')}</td>
        </tr>
      `,
    )
    .join('');
}

function renderPage(snapshot) {
  const initialRows = renderHeaderRows(snapshot.headers);
  const initialJson = safeScriptJson(snapshot);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>modierHeaders Test Site</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5f7fb;
        --panel: #ffffff;
        --panel-muted: #eef3f8;
        --text: #17212f;
        --muted: #5d6b7d;
        --border: #cdd7e4;
        --accent: #0f766e;
        --accent-strong: #0b4f4a;
        --danger: #9f1239;
      }

      * {
        box-sizing: border-box;
      }

      body {
        background: var(--bg);
        color: var(--text);
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        margin: 0;
      }

      main {
        display: grid;
        gap: 1rem;
        margin: 0 auto;
        max-width: 1100px;
        padding: 1.25rem;
      }

      header,
      section {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 1rem;
      }

      header {
        align-items: center;
        display: flex;
        gap: 1rem;
        justify-content: space-between;
      }

      h1,
      h2,
      p {
        margin: 0;
      }

      h1 {
        font-size: 1.35rem;
        line-height: 1.2;
      }

      h2 {
        font-size: 1rem;
      }

      .muted {
        color: var(--muted);
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      button,
      a.button {
        align-items: center;
        background: var(--accent);
        border: 1px solid var(--accent);
        border-radius: 6px;
        color: #ffffff;
        cursor: pointer;
        display: inline-flex;
        font: inherit;
        font-weight: 650;
        min-height: 2.25rem;
        padding: 0.45rem 0.75rem;
        text-decoration: none;
      }

      button.secondary,
      a.button.secondary {
        background: var(--panel);
        border-color: var(--border);
        color: var(--text);
      }

      button:hover,
      a.button:hover {
        border-color: var(--accent-strong);
      }

      .grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      table {
        border-collapse: collapse;
        font-size: 0.92rem;
        width: 100%;
      }

      th,
      td {
        border-top: 1px solid var(--border);
        padding: 0.55rem;
        text-align: left;
        vertical-align: top;
      }

      th {
        color: var(--muted);
        font-weight: 650;
        width: 15rem;
      }

      code,
      pre {
        font-family: "Cascadia Code", "SFMono-Regular", Consolas, monospace;
      }

      pre {
        background: var(--panel-muted);
        border: 1px solid var(--border);
        border-radius: 6px;
        margin: 0;
        max-height: 360px;
        overflow: auto;
        padding: 0.75rem;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .section-heading {
        align-items: start;
        display: flex;
        gap: 1rem;
        justify-content: space-between;
        margin-bottom: 0.85rem;
      }

      .status {
        color: var(--muted);
        font-size: 0.9rem;
        margin-top: 0.75rem;
      }

      .error {
        color: var(--danger);
      }

      @media (max-width: 820px) {
        header,
        .section-heading {
          align-items: stretch;
          flex-direction: column;
        }

        .grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <h1>modierHeaders Test Site</h1>
          <p class="muted">Local header viewer for request-header and redirect rules.</p>
        </div>
        <div class="actions">
          <a class="button secondary" href="/">Reload page request</a>
          <button id="refreshFetch" type="button">Refresh fetch headers</button>
        </div>
      </header>

      <section>
        <div class="section-heading">
          <div>
            <h2>Page Request Headers</h2>
            <p class="muted">Captured from the request that loaded this document.</p>
          </div>
          <button class="secondary" id="copyPageJson" type="button">Copy JSON</button>
        </div>
        <table>
          <tbody>${initialRows}</tbody>
        </table>
      </section>

      <section>
        <div class="section-heading">
          <div>
            <h2>Fetch Request Headers</h2>
            <p class="muted">Captured from <code>GET /headers.json</code>, useful for <code>xmlhttprequest</code> rules.</p>
          </div>
          <button class="secondary" id="copyFetchJson" type="button">Copy JSON</button>
        </div>
        <div class="grid">
          <div>
            <table>
              <tbody id="fetchRows">
                <tr>
                  <td class="muted">Waiting for fetch...</td>
                </tr>
              </tbody>
            </table>
          </div>
          <pre id="fetchJson">{}</pre>
        </div>
        <p class="status" id="fetchStatus"></p>
      </section>

      <section>
        <div class="section-heading">
          <div>
            <h2>Raw Page Request</h2>
            <p class="muted">Method, path, HTTP version, remote address, headers, and raw header order.</p>
          </div>
        </div>
        <pre id="pageJson"></pre>
      </section>
    </main>

    <script>
      const initialRequest = ${initialJson};
      const pageJson = document.querySelector('#pageJson');
      const fetchJson = document.querySelector('#fetchJson');
      const fetchRows = document.querySelector('#fetchRows');
      const fetchStatus = document.querySelector('#fetchStatus');

      function headerRows(headers) {
        return Object.entries(headers)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([name, value]) => {
            const rendered = Array.isArray(value) ? value.join(', ') : value ?? '';
            return '<tr><th scope="row">' + escapeHtml(name) + '</th><td>' + escapeHtml(rendered) + '</td></tr>';
          })
          .join('');
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;');
      }

      async function copyJson(value, button) {
        await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
        const label = button.textContent;
        button.textContent = 'Copied';
        window.setTimeout(() => {
          button.textContent = label;
        }, 900);
      }

      async function refreshFetchHeaders() {
        fetchStatus.textContent = 'Refreshing...';
        fetchStatus.className = 'status';

        try {
          const response = await fetch('/headers.json?cacheBust=' + Date.now(), { cache: 'no-store' });
          const body = await response.json();
          fetchRows.innerHTML = headerRows(body.headers);
          fetchJson.textContent = JSON.stringify(body, null, 2);
          fetchStatus.textContent = 'Updated ' + body.receivedAt;
          window.latestFetchRequest = body;
        } catch (error) {
          fetchStatus.textContent = error instanceof Error ? error.message : String(error);
          fetchStatus.className = 'status error';
        }
      }

      pageJson.textContent = JSON.stringify(initialRequest, null, 2);
      document.querySelector('#refreshFetch').addEventListener('click', refreshFetchHeaders);
      document.querySelector('#copyPageJson').addEventListener('click', (event) => copyJson(initialRequest, event.currentTarget));
      document.querySelector('#copyFetchJson').addEventListener('click', (event) => copyJson(window.latestFetchRequest ?? {}, event.currentTarget));
      refreshFetchHeaders();
    </script>
  </body>
</html>`;
}

const server = http.createServer((request, response) => {
  const snapshot = toRequestSnapshot(request);
  const url = new URL(request.url ?? '/', `http://${host}:${port}`);

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
    });
    response.end();
    return;
  }

  if (url.pathname === '/favicon.ico') {
    response.writeHead(204, { 'cache-control': 'no-store' });
    response.end();
    return;
  }

  if (url.pathname === '/headers.json') {
    sendJson(response, 200, snapshot);
    return;
  }

  response.writeHead(200, {
    'cache-control': 'no-store',
    'content-type': 'text/html; charset=utf-8',
    'x-modierheaders-test-server': 'headers-page',
  });
  response.end(renderPage(snapshot));
});

server.listen(port, host, () => {
  const url = `http://${host}:${port}/`;
  console.log(`Header test site running at ${url}`);
  console.log('Press Ctrl+C to stop.');
});
