import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ContentAssetNotFoundError,
  getContentAssetCacheControl,
  getContentAssetMimeType,
  InvalidContentAssetPathError,
  readContentAsset,
} from '@/lib/content-assets';

let projectRoot: string;

async function writeFixture(relativePath: string, content: string): Promise<void> {
  const filePath = path.join(projectRoot, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

beforeEach(async () => {
  projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'content-assets-'));
});

afterEach(async () => {
  await fs.rm(projectRoot, { recursive: true, force: true });
});

describe('readContentAsset', () => {
  it('reads from the canonical content/entries lesson root', async () => {
    const assetPath = 'technology/example/code/sample.ts';
    await writeFixture(`content/entries/${assetPath}`, 'from entries');

    const asset = await readContentAsset(
      ['technology', 'example', 'code', 'sample.ts'],
      projectRoot,
    );

    expect(asset.content).toBe('from entries');
  });

  it('does not resolve assets that exist only under app', async () => {
    await writeFixture('app/genai/example/quiz/questions.json', '{"legacy":true}');

    await expect(
      readContentAsset(['genai', 'example', 'quiz', 'questions.json'], projectRoot),
    ).rejects.toBeInstanceOf(ContentAssetNotFoundError);
  });

  it.each([
    ['..', 'example', 'code', 'sample.ts'],
    ['technology', '..', 'code', 'sample.ts'],
    ['technology', 'example', 'code', '..', 'secret.txt'],
    ['technology', 'example', 'code', '/etc/passwd'],
    ['technology', 'example', 'code', '../secret.txt'],
    ['technology', 'example', 'code', '..\\secret.txt'],
  ])('rejects traversal path segments: %j', async (...pathSegments) => {
    await expect(readContentAsset(pathSegments, projectRoot)).rejects.toBeInstanceOf(
      InvalidContentAssetPathError,
    );
  });

  it('allows only code, quiz, and data asset directories', async () => {
    await expect(
      readContentAsset(['technology', 'example', 'page.tsx'], projectRoot),
    ).rejects.toBeInstanceOf(InvalidContentAssetPathError);
    await expect(
      readContentAsset(['technology', 'example', 'private', 'secret.txt'], projectRoot),
    ).rejects.toBeInstanceOf(InvalidContentAssetPathError);
  });

  it('rejects symlinks that escape the lesson asset root', async () => {
    await writeFixture('content/entries/technology/example/code/inside.txt', 'inside');
    await writeFixture('secret.txt', 'outside');
    await fs.symlink(
      path.join(projectRoot, 'secret.txt'),
      path.join(projectRoot, 'content/entries/technology/example/code/linked.txt'),
    );

    await expect(
      readContentAsset(['technology', 'example', 'code', 'linked.txt'], projectRoot),
    ).rejects.toBeInstanceOf(InvalidContentAssetPathError);
  });
});

describe('content asset response metadata', () => {
  it('returns media types that match common lesson assets', () => {
    expect(getContentAssetMimeType('example.js')).toBe('text/javascript');
    expect(getContentAssetMimeType('example.yaml')).toBe('application/yaml');
    expect(getContentAssetMimeType('quiz.json')).toBe('application/json');
    expect(getContentAssetMimeType('example.unknown')).toBe('text/plain');
  });

  it('preserves the existing environment cache policies', () => {
    expect(getContentAssetCacheControl('production', 'preview')).toBe(
      'public, max-age=0, must-revalidate',
    );
    expect(getContentAssetCacheControl('development', 'staging')).toBe(
      'public, max-age=3600, must-revalidate',
    );
    expect(getContentAssetCacheControl('development', undefined)).toBe(
      'public, max-age=300, must-revalidate',
    );
  });
});
