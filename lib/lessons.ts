/**
 * Server-side Markdoc lesson loader. Reads
 * `content/entries/<section>/<slug>/index.mdoc`,
 * validates the frontmatter (zod) and the body against the closed tag schema
 * (markdoc/config.ts), and DERIVES the interactive flags from the tags actually used —
 * so registry metadata can never silently drift from the real content.
 *
 * Intentionally no YAML dependency: lesson metadata is scalar frontmatter, so a tiny
 * line parser keeps this dependency-light. Files are read at build time via the route's
 * generateStaticParams (SSG), so no runtime filesystem access is required.
 */

import fs from 'node:fs';
import path from 'node:path';
import Markdoc, { type RenderableTreeNode } from '@markdoc/markdoc';
import { z } from 'zod';
import { config, CHALLENGE_RENDER_NAMES } from '@/markdoc/config';

const CONTENT_ENTRIES_DIR = path.join(process.cwd(), 'content', 'entries');

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

const FrontmatterSchema = z.object({
  title: z.string().min(1).optional(),
  section: z.enum(SECTIONS),
  level: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate'),
  duration: z.string().default('20 min'),
  description: z.string().optional(),
  registryId: z.string().optional(),
});

export type LessonFrontmatter = z.infer<typeof FrontmatterSchema>;

export interface LoadedLesson {
  section: string;
  slug: string;
  frontmatter: LessonFrontmatter;
  tree: RenderableTreeNode;
  derived: { hasChallenge: boolean; hasQuiz: boolean; hasCalculator: boolean };
}

export interface ParsedLessonSource {
  frontmatter: LessonFrontmatter;
  tree: RenderableTreeNode;
  derived: LoadedLesson['derived'];
}

/** Minimal `key: value` frontmatter parser (scalars only — arrays/objects belong in tags). */
function parseFrontmatter(src: string): { data: Record<string, string>; body: string } {
  const match = src.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: src };
  const data: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key) data[key] = val;
  }
  return { data, body: match[2] };
}

function deriveFlags(tree: RenderableTreeNode): LoadedLesson['derived'] {
  const names = new Set<string>();
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.name === 'string') names.add(node.name);
    if (Array.isArray(node.children)) node.children.forEach(walk);
  };
  walk(tree as any);
  return {
    hasChallenge: CHALLENGE_RENDER_NAMES.some((n) => names.has(n)),
    hasQuiz: names.has('Quiz'),
    hasCalculator: names.has('CapacityChallenge'),
  };
}

/**
 * Parse and validate Markdoc source independently from the filesystem. The admin
 * editor uses this before persisting a draft so invalid content never reaches the
 * repository or a deployed lesson.
 */
export function parseLessonSource(
  section: string,
  slug: string,
  source: string,
): ParsedLessonSource {
  const { data, body } = parseFrontmatter(source);
  const frontmatter = FrontmatterSchema.parse({
    ...data,
    section: data.section || section,
  });

  if (frontmatter.section !== section) {
    throw new Error(
      `Frontmatter section must be "${section}" for ${section}/${slug}; received "${frontmatter.section}".`,
    );
  }

  const ast = Markdoc.parse(body);
  const errors = Markdoc.validate(ast, config).filter(
    (error) => error.error.level === 'error' || error.error.level === 'critical',
  );

  if (errors.length) {
    throw new Error(
      `Markdoc validation failed for ${section}/${slug}: ` +
        errors.map((error) => error.error.message).join('; '),
    );
  }

  const tree = Markdoc.transform(ast, config);
  const plainTree = JSON.parse(JSON.stringify(tree)) as RenderableTreeNode;

  return {
    frontmatter,
    tree: plainTree,
    derived: deriveFlags(tree),
  };
}

export function lessonFilePath(section: string, slug: string): string {
  return path.join(CONTENT_ENTRIES_DIR, section, slug, 'index.mdoc');
}

/**
 * Load + validate a single lesson. Throws on Markdoc validation errors so a broken
 * lesson fails the build instead of rendering garbage. Returns null if the file
 * doesn't exist (the route turns that into a 404).
 */
export function loadLesson(section: string, slug: string): LoadedLesson | null {
  const file = lessonFilePath(section, slug);
  if (!fs.existsSync(file)) return null;

  const parsed = parseLessonSource(section, slug, fs.readFileSync(file, 'utf8'));
  return { section, slug, ...parsed };
}

/** Enumerate every authored lesson — drives generateStaticParams and CI validation. */
export function listLessons(): { section: string; slug: string }[] {
  if (!fs.existsSync(CONTENT_ENTRIES_DIR)) return [];
  const out: { section: string; slug: string }[] = [];
  for (const section of fs.readdirSync(CONTENT_ENTRIES_DIR)) {
    const dir = path.join(CONTENT_ENTRIES_DIR, section);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(dir);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;
    for (const slug of fs.readdirSync(dir)) {
      if (fs.existsSync(lessonFilePath(section, slug))) out.push({ section, slug });
    }
  }
  return out.sort((a, b) =>
    a.section === b.section ? a.slug.localeCompare(b.slug) : a.section.localeCompare(b.section)
  );
}
