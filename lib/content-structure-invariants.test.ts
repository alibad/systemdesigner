import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTENT_REGISTRY } from './content-registry';

const ROOT = process.cwd();
const SECTIONS = [
  'fundamentals',
  'genai',
  'ml-systems',
  'technology',
  'case-studies',
  'practice',
  'reference',
  'tools',
] as const;

const activeEntries = CONTENT_REGISTRY.filter((entry) => entry.status === 'active');
const authoredEntries = CONTENT_REGISTRY.filter((entry) => entry.renderMode === 'mdoc');

function walkMdocFiles(directory: string, files: string[] = []): string[] {
  if (!fs.existsSync(directory)) return files;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walkMdocFiles(file, files);
    else if (entry.isFile() && entry.name.endsWith('.mdoc')) files.push(file);
  }
  return files;
}

function relative(file: string): string {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function isFile(file: string): boolean {
  try {
    return fs.statSync(file).isFile();
  } catch (_error) {
    return false;
  }
}

function slugFor(entryPath: string): string {
  return entryPath.split('/').filter(Boolean).at(-1)!;
}

function bodyPathFor(entry: (typeof authoredEntries)[number]): string {
  return path.join(
    ROOT,
    'content',
    'entries',
    entry.section,
    slugFor(entry.path),
    'index.mdoc',
  );
}

function registryIdFor(file: string): string | undefined {
  const source = fs.readFileSync(file, 'utf8');
  const frontmatter = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  return frontmatter?.[1].match(/^registryId:\s*["']?([^\s"']+)["']?\s*$/m)?.[1];
}

function quizFilesFor(entry: (typeof authoredEntries)[number]): string[] {
  const quizDirectory = path.join(path.dirname(bodyPathFor(entry)), 'quiz');
  if (!fs.existsSync(quizDirectory)) return [];
  return fs
    .readdirSync(quizDirectory)
    .filter((file) => file.endsWith('.json'))
    .sort();
}

describe('final content structure invariants', () => {
  it('keeps every active registry entry on the canonical render mode and body target', () => {
    expect(activeEntries.length).toBeGreaterThan(0);
    expect(activeEntries.every((entry) => entry.renderMode === 'mdoc')).toBe(true);

    const bodyTargets = activeEntries.map((entry) => relative(bodyPathFor(entry)));
    expect(new Set(activeEntries.map((entry) => entry.id)).size).toBe(activeEntries.length);
    expect(new Set(bodyTargets).size).toBe(activeEntries.length);
  });

  it('has exactly one correctly bound canonical body per registry entry, including drafts', () => {
    const expectedBodies = authoredEntries.map((entry) => relative(bodyPathFor(entry))).sort();
    const actualBodies = walkMdocFiles(path.join(ROOT, 'content', 'entries'))
      .map(relative)
      .sort();

    expect(actualBodies).toEqual(expectedBodies);

    const actualBindings = actualBodies
      .map((file) => registryIdFor(path.join(ROOT, file)))
      .sort();
    const expectedBindings = authoredEntries.map((entry) => entry.id).sort();
    expect(actualBindings).toEqual(expectedBindings);

    for (const entry of authoredEntries) {
      expect(registryIdFor(bodyPathFor(entry))).toBe(entry.id);
    }
    expect(fs.existsSync(path.join(ROOT, 'content', 'lessons'))).toBe(false);
  });

  it('keeps all eight section-level dynamic routes', () => {
    const expectedRoutes = SECTIONS.map(
      (section) => `app/${section}/[slug]/page.tsx`,
    ).sort();
    const actualRoutes = SECTIONS
      .map((section) => `app/${section}/[slug]/page.tsx`)
      .filter((file) => isFile(path.join(ROOT, file)))
      .sort();

    expect(actualRoutes).toEqual(expectedRoutes);
  });

  it('does not allow concrete pages to shadow registered content paths', () => {
    const shadowingPages = activeEntries
      .map((entry) => `app${entry.path}/page.tsx`)
      .filter((file) => fs.existsSync(path.join(ROOT, file)));

    expect(shadowingPages).toEqual([]);
  });

  it('keeps exactly one co-located and referenced quiz for every lesson', () => {
    for (const entry of authoredEntries) {
      expect(entry.hasQuiz, entry.id).toBe(true);

      const quizFiles = quizFilesFor(entry);
      expect(quizFiles, entry.id).toHaveLength(1);

      const source = fs.readFileSync(bodyPathFor(entry), 'utf8');
      const quizTags = [...source.matchAll(/\{%\s*quiz\b([\s\S]*?)\/%\}/g)];
      expect(quizTags, entry.id).toHaveLength(1);

      const slug = slugFor(entry.path);
      const expectedReference =
        `/api/content/${entry.section}/${slug}/quiz/${quizFiles[0]}`;
      expect(quizTags[0][1], entry.id).toContain(
        `questionsFile="${expectedReference}"`,
      );
    }
  });
});
