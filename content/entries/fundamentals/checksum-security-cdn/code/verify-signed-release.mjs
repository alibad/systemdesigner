#!/usr/bin/env node
import {
  generateKeyPairSync,
  sign,
  timingSafeEqual,
  verify,
  createHash,
} from 'node:crypto';

const digest = (bytes) => createHash('sha384').update(bytes).digest();
const publishedAsset = Buffer.from('console.log("release-42");\n');
const changedAsset = Buffer.from('console.log("send-token");\n');
const { publicKey, privateKey } = generateKeyPairSync('ed25519');

const manifest = Buffer.from(JSON.stringify({
  path: '/assets/app.release-42.js',
  algorithm: 'sha384',
  digest: digest(publishedAsset).toString('base64'),
}));
const signature = sign(null, manifest, privateKey);

function accepts(bytes, recordBytes = manifest, recordSignature = signature) {
  if (!verify(null, recordBytes, publicKey, recordSignature)) return false;
  const record = JSON.parse(recordBytes.toString('utf8'));
  if (record.algorithm !== 'sha384') return false;
  const expected = Buffer.from(record.digest, 'base64');
  const actual = digest(bytes);
  return expected.length === actual.length
    && timingSafeEqual(expected, actual);
}

const forgedManifest = Buffer.from(manifest.toString('utf8').replace('sha384', 'sha256'));
console.log('published asset:', accepts(publishedAsset) ? 'ACCEPT' : 'BLOCK');
console.log('changed asset:  ', accepts(changedAsset) ? 'ACCEPT' : 'BLOCK');
console.log('forged record:  ', accepts(publishedAsset, forgedManifest) ? 'ACCEPT' : 'BLOCK');

if (!accepts(publishedAsset) || accepts(changedAsset) || accepts(publishedAsset, forgedManifest)) {
  process.exitCode = 1;
}
