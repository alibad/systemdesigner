#!/usr/bin/env node
/**
 * One-shot GitHub App setup via the App Manifest flow.
 *
 * Starts a tiny local server. You:
 *   1. open http://localhost:8765/  → click "Create GitHub App" (you must be logged into GitHub)
 *   2. on the install page → click "Install"
 *
 * The server then:
 *   - exchanges the manifest `code` for the App's id + private key (PEM)
 *   - writes the PEM to ./secrets/github-app.pem
 *   - captures the installation id from the post-install redirect
 *   - writes GITHUB_APP_* / GITHUB_REPO_* into .env.local (preserving existing lines)
 *
 * Run:  node scripts/setup-github-app.cjs
 */

'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SECRETS_DIR = path.join(ROOT, 'secrets');
const PEM_PATH = path.join(SECRETS_DIR, 'github-app.pem');
const META_PATH = path.join(SECRETS_DIR, 'github-app.json');
const ENV_PATH = path.join(ROOT, '.env.local');

const PORT = Number(process.env.PORT || 8765);
const BASE = `http://localhost:${PORT}`;
const OWNER = process.env.GITHUB_REPO_OWNER || 'alibad';
const REPO = process.env.GITHUB_REPO_NAME || 'systemdesigner';
const STATE = crypto.randomBytes(8).toString('hex');
const SUFFIX = String(1000 + Math.floor(Math.random() * 9000));
const APP_NAME = `SystemDesigner Maintainer ${SUFFIX}`;

const manifest = {
  name: APP_NAME,
  url: 'https://systemdesigner.net',
  redirect_url: `${BASE}/callback`,
  setup_url: `${BASE}/installed`,
  setup_on_update: true,
  public: false,
  default_permissions: { issues: 'write', contents: 'write', metadata: 'read' },
  default_events: [],
  hook_attributes: { active: false },
};

fs.mkdirSync(SECRETS_DIR, { recursive: true });

let appMeta = null; // { id, slug, html_url, client_id }

function log(...a) { console.log('[setup]', ...a); }

function esc(s) { return String(s).replace(/"/g, '&quot;'); }

function page(title, bodyHtml) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:60px auto;padding:0 20px;color:#1f2328;line-height:1.5}
.card{border:1px solid #d0d7de;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
h1{font-size:22px;margin:0 0 12px}.btn{display:inline-block;background:#1f883d;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;border:0;font-size:15px;cursor:pointer}
.muted{color:#656d76;font-size:14px}code{background:#f6f8fa;padding:2px 6px;border-radius:6px}</style></head>
<body><div class="card">${bodyHtml}</div></body></html>`;
}

function exchangeCode(code) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: 'POST',
        hostname: 'api.github.com',
        path: `/app-manifests/${encodeURIComponent(code)}/conversions`,
        headers: {
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'systemdesigner-app-setup',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Length': 0,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
          } else {
            reject(new Error(`conversion failed ${res.statusCode}: ${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function upsertEnv(vars) {
  let existing = '';
  try { existing = fs.readFileSync(ENV_PATH, 'utf8'); } catch (_e) {}
  const keys = Object.keys(vars);
  // drop any prior lines for these keys
  const kept = existing
    .split('\n')
    .filter((line) => !keys.some((k) => line.trimStart().startsWith(k + '=')))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
  const block =
    '\n\n# --- GitHub App (feedback widget → GitHub Issues) — added by setup-github-app.cjs ---\n' +
    keys.map((k) => `${k}=${vars[k]}`).join('\n') + '\n';
  fs.writeFileSync(ENV_PATH, (kept ? kept : '') + block, { mode: 0o600 });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, BASE);

  if (url.pathname === '/') {
    const body = `<h1>Create your GitHub App</h1>
      <p class="muted">This creates a private GitHub App named <code>${esc(APP_NAME)}</code> on your account,
      with <strong>Issues: Read &amp; write</strong> and <strong>Contents: Read &amp; write</strong>
      permissions, used by feedback and the authenticated admin content editor.</p>
      <form id="f" action="https://github.com/settings/apps/new?state=${STATE}" method="post">
        <input type="hidden" name="manifest" value='${esc(JSON.stringify(manifest))}'>
        <button class="btn" type="submit">Create GitHub App →</button>
      </form>
      <p class="muted" style="margin-top:16px">You must be signed in to GitHub as <code>${esc(OWNER)}</code>. After creating, you'll be brought back here automatically.</p>`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(page('Create GitHub App', body));
    return;
  }

  if (url.pathname === '/callback') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code) { res.writeHead(400); res.end('missing code'); return; }
    if (state !== STATE) { res.writeHead(400); res.end('state mismatch'); return; }
    try {
      const conv = await exchangeCode(code);
      appMeta = { id: conv.id, slug: conv.slug, html_url: conv.html_url, client_id: conv.client_id };
      fs.writeFileSync(PEM_PATH, conv.pem, { mode: 0o600 });
      fs.writeFileSync(META_PATH, JSON.stringify(appMeta, null, 2), { mode: 0o600 });
      log(`✓ App created: ${conv.slug} (id ${conv.id}). PEM saved to secrets/github-app.pem`);
      const installUrl = `https://github.com/settings/apps/${conv.slug}/installations`;
      const body = `<h1>✅ App created: ${esc(conv.slug)}</h1>
        <p>App ID <code>${conv.id}</code> and its private key are saved locally.</p>
        <p><strong>Last step:</strong> install the app on <code>${esc(OWNER)}/${esc(REPO)}</code>.</p>
        <p><a class="btn" href="${installUrl}">Install the app →</a></p>
        <p class="muted">Pick <em>Only select repositories → ${esc(REPO)}</em>, then click Install. You'll be redirected back here and setup will finish automatically.</p>`;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(page('App created', body));
    } catch (e) {
      log('✗ exchange error:', e.message);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(page('Error', `<h1>❌ Setup failed</h1><p class="muted">${esc(e.message)}</p>`));
    }
    return;
  }

  if (url.pathname === '/installed') {
    const installationId = url.searchParams.get('installation_id');
    if (!appMeta) { res.writeHead(400); res.end('app not created yet'); return; }
    if (!installationId) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(page('Missing installation', `<h1>Hmm, no installation id</h1><p class="muted">Try the install link again.</p>`));
      return;
    }
    try {
      upsertEnv({
        GITHUB_APP_ID: appMeta.id,
        GITHUB_APP_INSTALLATION_ID: installationId,
        GITHUB_APP_PRIVATE_KEY_PATH: './secrets/github-app.pem',
        GITHUB_REPO_OWNER: OWNER,
        GITHUB_REPO_NAME: REPO,
      });
      fs.writeFileSync(path.join(SECRETS_DIR, 'DONE'), `app=${appMeta.id} installation=${installationId}\n`);
      log(`✓ Installed. installation_id=${installationId}. Wrote .env.local`);
      log('DONE');
      const body = `<h1>🎉 All set!</h1>
        <p>Feedback and admin content editing are configured for <code>${esc(OWNER)}/${esc(REPO)}</code>.</p>
        <ul class="muted">
          <li>App ID: <code>${appMeta.id}</code></li>
          <li>Installation ID: <code>${installationId}</code></li>
          <li>Private key: <code>secrets/github-app.pem</code></li>
          <li>Written to <code>.env.local</code></li>
        </ul>
        <p class="muted">You can close this tab.</p>`;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(page('Done', body));
    } catch (e) {
      log('✗ finish error:', e.message);
      res.writeHead(500); res.end('error: ' + e.message);
    }
    return;
  }

  res.writeHead(404); res.end('not found');
});

server.listen(PORT, () => {
  log(`server on ${BASE}`);
  log(`App name: ${APP_NAME}`);
  log(`Open ${BASE}/ in a browser logged in as ${OWNER}`);
});
