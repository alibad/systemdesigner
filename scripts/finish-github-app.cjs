#!/usr/bin/env node
/**
 * Finish setting up a manually-created GitHub App.
 *
 * Picks up the downloaded private key, resolves the installation id from the API,
 * writes GITHUB_APP_* / GITHUB_REPO_* into .env.local (preserving existing lines),
 * and verifies the whole chain — without creating an issue or commit.
 *
 *   APP_ID=3923081 node scripts/finish-github-app.cjs
 *   (optionally:  PEM=/path/to/key.pem  OWNER=alibad  REPO=systemdesigner)
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SECRETS_DIR = path.join(ROOT, 'secrets');
const PEM_DEST = path.join(SECRETS_DIR, 'github-app.pem');
const ENV_PATH = path.join(ROOT, '.env.local');

const APP_ID = process.env.APP_ID || '3923081';
const OWNER = process.env.OWNER || 'alibad';
const REPO = process.env.REPO || 'systemdesigner';

function findPem() {
  if (process.env.PEM && fs.existsSync(process.env.PEM)) return process.env.PEM;
  if (fs.existsSync(PEM_DEST)) return PEM_DEST;
  // newest *.private-key.pem (or any *.pem) in ~/Downloads
  const dl = path.join(os.homedir(), 'Downloads');
  let candidates = [];
  try {
    candidates = fs.readdirSync(dl)
      .filter((f) => f.endsWith('.pem'))
      .map((f) => ({ f, p: path.join(dl, f), m: fs.statSync(path.join(dl, f)).mtimeMs }))
      .sort((a, b) => b.m - a.m);
  } catch (_e) {}
  const priv = candidates.find((c) => /private-key/i.test(c.f)) || candidates[0];
  return priv ? priv.p : null;
}

function b64url(s) {
  return Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function appJwt(appId, pem) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: String(appId) }));
  const data = `${head}.${body}`;
  const sig = crypto.createSign('RSA-SHA256').update(data).sign(pem).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${data}.${sig}`;
}
function api(method, p, token, tokenType = 'Bearer') {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { method, hostname: 'api.github.com', path: p, headers: {
        Accept: 'application/vnd.github+json', 'User-Agent': 'sd-app-finish',
        'X-GitHub-Api-Version': '2022-11-28', Authorization: `${tokenType} ${token}`, 'Content-Length': 0,
      } },
      (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => resolve({ status: res.statusCode, body: d })); }
    );
    req.on('error', reject); req.end();
  });
}
function upsertEnv(vars) {
  let existing = '';
  try { existing = fs.readFileSync(ENV_PATH, 'utf8'); } catch (_e) {}
  const keys = Object.keys(vars);
  const kept = existing.split('\n')
    .filter((line) => !keys.some((k) => line.trimStart().startsWith(k + '=')))
    .join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
  const block = '\n\n# --- GitHub App (feedback + admin content editor) ---\n' +
    keys.map((k) => `${k}=${vars[k]}`).join('\n') + '\n';
  fs.writeFileSync(ENV_PATH, (kept || '') + block, { mode: 0o600 });
}

(async () => {
  fs.mkdirSync(SECRETS_DIR, { recursive: true });

  const pemSrc = findPem();
  if (!pemSrc) {
    console.error('✗ No private key found. Click "Generate a private key" on the app page (it downloads a .pem to ~/Downloads), then re-run.');
    process.exit(2);
  }
  const pem = fs.readFileSync(pemSrc, 'utf8');
  if (!pem.includes('PRIVATE KEY')) { console.error('✗ File is not a PEM private key:', pemSrc); process.exit(2); }
  if (path.resolve(pemSrc) !== path.resolve(PEM_DEST)) {
    fs.copyFileSync(pemSrc, PEM_DEST); fs.chmodSync(PEM_DEST, 0o600);
    console.log(`✓ Saved private key → secrets/github-app.pem  (from ${pemSrc})`);
  } else {
    console.log('✓ Using existing secrets/github-app.pem');
  }

  const jwt = appJwt(APP_ID, pem);
  const app = await api('GET', '/app', jwt);
  if (app.status !== 200) { console.error('✗ App auth failed (check APP_ID / key):', app.status, app.body); process.exit(1); }
  const appData = JSON.parse(app.body);
  const issuesPerm = appData.permissions && appData.permissions.issues;
  const contentsPerm = appData.permissions && appData.permissions.contents;
  console.log(`✓ Authenticated as app: ${appData.slug} (id ${appData.id}); issues: ${issuesPerm || 'NONE'}; contents: ${contentsPerm || 'NONE'}`);
  if (issuesPerm !== 'write') {
    console.warn('⚠ The app does NOT have Issues: write yet. Set Permissions & events → Issues: Read and write → Save, then re-run.');
  }
  if (contentsPerm !== 'write') {
    console.warn('⚠ The app does NOT have Contents: write yet. Set Permissions & events → Contents: Read and write → Save, approve the installation update, then re-run.');
  }

  const inst = await api('GET', `/repos/${OWNER}/${REPO}/installation`, jwt);
  if (inst.status === 404) {
    console.error(`✗ App is not installed on ${OWNER}/${REPO}. Click "Install App" → Only select repositories → ${REPO}, then re-run.`);
    process.exit(3);
  }
  if (inst.status !== 200) { console.error('✗ Installation lookup failed:', inst.status, inst.body); process.exit(1); }
  const installationId = JSON.parse(inst.body).id;
  console.log(`✓ Installation found: id ${installationId}`);

  upsertEnv({
    GITHUB_APP_ID: APP_ID,
    GITHUB_APP_INSTALLATION_ID: installationId,
    GITHUB_APP_PRIVATE_KEY_PATH: './secrets/github-app.pem',
    GITHUB_REPO_OWNER: OWNER,
    GITHUB_REPO_NAME: REPO,
  });
  console.log('✓ Wrote GitHub App vars to .env.local (existing keys preserved)');

  // Verify: mint an installation token and read the repo (no issue created)
  const tok = await api('POST', `/app/installations/${installationId}/access_tokens`, jwt);
  if (tok.status !== 201) { console.error('✗ Could not mint installation token:', tok.status, tok.body); process.exit(1); }
  const token = JSON.parse(tok.body).token;
  const r = await api('GET', `/repos/${OWNER}/${REPO}`, token, 'token');
  if (r.status !== 200) { console.error('✗ Repo read failed with installation token:', r.status); process.exit(1); }
  console.log(`✓ Verified: installation token can access ${OWNER}/${REPO}`);
  console.log(`\n🎉 Done. Feedback and admin content editing are configured for ${OWNER}/${REPO}.` +
    (issuesPerm !== 'write' || contentsPerm !== 'write'
      ? '\n   (Grant the missing permissions above, approve the installation update, then re-run.)'
      : ''));
})().catch((e) => { console.error('✗ finish crashed:', e.message); process.exit(1); });
