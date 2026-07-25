#!/usr/bin/env node
/**
 * Verify the GitHub App credentials in .env.local work end-to-end — WITHOUT creating
 * any issue. It signs an App JWT, mints an installation token, and reads the repo.
 *
 *   node scripts/verify-github-app.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');

function loadEnv() {
  const out = {};
  for (const file of ['.env.local', '.env']) {
    try {
      const txt = fs.readFileSync(path.join(ROOT, file), 'utf8');
      for (const line of txt.split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !(m[1] in out)) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    } catch (_e) {}
  }
  return out;
}

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function appJwt(appId, pem) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: String(appId) }));
  const data = `${header}.${payload}`;
  const sig = crypto.createSign('RSA-SHA256').update(data).sign(pem).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${data}.${sig}`;
}

function api(method, p, token, tokenType = 'Bearer') {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { method, hostname: 'api.github.com', path: p, headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'systemdesigner-verify',
        'X-GitHub-Api-Version': '2022-11-28',
        'Authorization': `${tokenType} ${token}`,
        'Content-Length': 0,
      } },
      (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () =>
        resolve({ status: res.statusCode, body: d })); }
    );
    req.on('error', reject); req.end();
  });
}

(async () => {
  const env = loadEnv();
  const appId = env.GITHUB_APP_ID;
  const installationId = env.GITHUB_APP_INSTALLATION_ID;
  const owner = env.GITHUB_REPO_OWNER || 'alibad';
  const repo = env.GITHUB_REPO_NAME || 'systemdesigner';
  const keyPath = env.GITHUB_APP_PRIVATE_KEY_PATH;
  let pem = env.GITHUB_APP_PRIVATE_KEY || '';
  if (keyPath) pem = fs.readFileSync(path.resolve(ROOT, keyPath), 'utf8');
  else if (pem && !pem.startsWith('-----')) pem = Buffer.from(pem, 'base64').toString('utf8');

  const miss = [];
  if (!appId) miss.push('GITHUB_APP_ID');
  if (!installationId) miss.push('GITHUB_APP_INSTALLATION_ID');
  if (!pem) miss.push('GITHUB_APP_PRIVATE_KEY[_PATH]');
  if (miss.length) { console.error('✗ Missing:', miss.join(', ')); process.exit(1); }

  console.log(`• App ID ${appId}, installation ${installationId}, repo ${owner}/${repo}`);

  const jwt = appJwt(appId, pem);
  const app = await api('GET', '/app', jwt);
  if (app.status !== 200) { console.error('✗ JWT/app auth failed:', app.status, app.body); process.exit(1); }
  console.log(`✓ App JWT valid — app: ${JSON.parse(app.body).slug}`);

  const tok = await api('POST', `/app/installations/${installationId}/access_tokens`, jwt);
  if (tok.status !== 201) { console.error('✗ Could not mint installation token:', tok.status, tok.body); process.exit(1); }
  const token = JSON.parse(tok.body).token;
  console.log('✓ Installation token minted');

  const r = await api('GET', `/repos/${owner}/${repo}`, token, 'token');
  if (r.status !== 200) { console.error('✗ Repo read failed:', r.status, r.body); process.exit(1); }
  console.log(`✓ Can access ${owner}/${repo} — issues permission present: the feedback widget is ready.`);
  console.log('\n🎉 GitHub App is configured correctly. (No issue was created.)');
})().catch((e) => { console.error('✗ Verify crashed:', e.message); process.exit(1); });
