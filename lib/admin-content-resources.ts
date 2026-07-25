import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  SECTION_CATEGORIES,
  type ContentNode,
} from '@/lib/content-registry';
import {
  ContentEditConflictError,
  ContentEntryNotFoundError,
  ContentValidationError,
  getContentPersistenceMode,
  validateEditableContentSource,
  type ContentActor,
} from '@/lib/admin-content';
import { getOctokit, GITHUB_OWNER, GITHUB_REPO } from '@/lib/github';
import { parseLessonSource } from '@/lib/lessons';
import { GITHUB_BRANCH } from '@/lib/site-config';

export const MAX_ADMIN_ASSET_BYTES = 1024 * 1024;
export const REGISTRY_REPOSITORY_PATH = 'content/registry.json';

const CONTENT_SECTIONS = [
  'fundamentals',
  'genai',
  'ml-systems',
  'technology',
  'case-studies',
  'practice',
  'reference',
  'tools',
] as const;

const ContentSectionSchema = z.enum(CONTENT_SECTIONS);
const SlugSchema = z
  .string()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase kebab-case.');
const RelationshipSchema = z.array(SlugSchema).max(40);
const UrlPathSchema = z.string().regex(/^\/[a-z0-9][a-z0-9-/]*$/);

export const AdminContentMetadataSchema = z
  .object({
    id: SlugSchema,
    title: z.string().trim().min(2).max(140),
    path: UrlPathSchema,
    section: ContentSectionSchema,
    level: z.enum(['beginner', 'intermediate', 'advanced']),
    duration: z.string().trim().min(3).max(30),
    hasQuiz: z.literal(true),
    hasScenarios: z.boolean(),
    hasCalculator: z.boolean(),
    hasChallenge: z.boolean().optional(),
    renderMode: z.literal('mdoc'),
    prerequisites: RelationshipSchema,
    related: RelationshipSchema,
    nextInSequence: SlugSchema.optional(),
    tags: z.array(z.string().trim().min(1).max(60)).min(1).max(40),
    category: z.string().trim().min(1).max(100).optional(),
    seo: z.object({
      metaDescription: z.string().trim().min(20).max(160),
      keywords: z.array(z.string().trim().min(1).max(80)).min(1).max(40),
      priority: z.number().min(0).max(1),
      changeFreq: z.enum(['weekly', 'monthly', 'yearly']),
      lastModified: z.string().datetime(),
    }),
    status: z.enum(['active', 'draft', 'deprecated']),
    canonicalId: SlugSchema.optional(),
    aliases: z.array(UrlPathSchema).max(20).optional(),
  })
  .strict();

const QuizQuestionSchema = z
  .object({
    question: z.string().trim().min(10).max(500),
    options: z.array(z.string().trim().min(1).max(1000)).min(2).max(6),
    correctAnswer: z.number().int().min(0),
    explanation: z.string().trim().min(10).max(2000),
  })
  .superRefine((question, context) => {
    if (question.correctAnswer >= question.options.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['correctAnswer'],
        message: 'Correct answer must point to one of the available options.',
      });
    }
  });

export const AdminQuizSchema = z
  .object({
    title: z.string().trim().min(3).max(140),
    section: ContentSectionSchema,
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
    duration: z.string().trim().min(3).max(30),
    questions: z.array(QuizQuestionSchema).min(4).max(12),
  })
  .strict();

const ExistingQuizAssetSchema = z.union([
  z.array(QuizQuestionSchema).min(4).max(12),
  z
    .object({
      title: z.string().trim().min(3).max(140).optional(),
      section: ContentSectionSchema.optional(),
      difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
      duration: z.string().trim().min(3).max(30).optional(),
      questions: z.array(QuizQuestionSchema).min(4).max(12),
    })
    .strict(),
]);

const NewLessonAssetSchema = z.object({
  kind: z.enum(['code', 'data']),
  fileName: z.string().min(1).max(180),
  content: z.string(),
});

export const CreateLessonSchema = z.object({
  slug: SlugSchema,
  metadata: AdminContentMetadataSchema,
  source: z.string().optional(),
  quizFileName: z
    .string()
    .min(6)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/),
  quiz: AdminQuizSchema,
  assets: z.array(NewLessonAssetSchema).max(20).default([]),
  expectedVersion: z.string().min(1),
  message: z.string().trim().max(160).optional(),
});

export type AdminContentMetadata = z.infer<typeof AdminContentMetadataSchema>;
export type AdminQuiz = z.infer<typeof AdminQuizSchema>;
export type ContentAssetKind = 'code' | 'quiz' | 'data';

export interface AdminContentMetadataDocument {
  metadata: AdminContentMetadata;
  version: string;
  categories: Array<{ key: string; title: string }>;
}

export interface AdminContentAssetSummary {
  kind: ContentAssetKind;
  fileName: string;
  size: number;
  publicUrl: string;
}

export interface AdminContentAssetDocument {
  entry: Pick<AdminContentMetadata, 'id' | 'title' | 'section' | 'path'>;
  version: string;
  assets: AdminContentAssetSummary[];
}

export interface AdminMutationResult {
  version: string;
  persistence: 'filesystem' | 'github';
  commitUrl?: string;
}

interface RegistryDocument {
  entries: AdminContentMetadata[];
  source: string;
  version: string;
}

interface GithubRepositoryState {
  headSha: string;
  treeSha: string;
}

interface RepositoryChange {
  filePath: string;
  content: string | null;
}

interface RepositoryMutationResult extends AdminMutationResult {
  changedPaths: string[];
}

const ASSET_EXTENSIONS: Record<ContentAssetKind, Set<string>> = {
  code: new Set([
    '.c',
    '.cjs',
    '.cpp',
    '.cs',
    '.css',
    '.go',
    '.gql',
    '.graphql',
    '.html',
    '.java',
    '.js',
    '.json',
    '.jsx',
    '.md',
    '.mjs',
    '.php',
    '.proto',
    '.py',
    '.rb',
    '.rs',
    '.sh',
    '.sql',
    '.ts',
    '.tsx',
    '.txt',
    '.yaml',
    '.yml',
  ]),
  quiz: new Set(['.json']),
  data: new Set(['.csv', '.json', '.md', '.txt', '.xml', '.yaml', '.yml']),
};

function isHttpStatus(error: unknown, status: number): boolean {
  return Boolean(
    error && typeof error === 'object' && 'status' in error && error.status === status,
  );
}

function sourceVersion(source: string): string {
  return createHash('sha256').update(source).digest('hex');
}

function normalizeText(source: string): string {
  return `${source.replace(/\s+$/u, '')}\n`;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function contentSlug(entry: Pick<AdminContentMetadata, 'id' | 'path'>): string {
  return entry.path.split('/').filter(Boolean).pop() || entry.id;
}

function lessonRepositoryRoot(section: string, slug: string): string {
  return `content/entries/${section}/${slug}`;
}

function lessonSourceRepositoryPath(section: string, slug: string): string {
  return `${lessonRepositoryRoot(section, slug)}/index.mdoc`;
}

function assetRepositoryPath(
  section: string,
  slug: string,
  kind: ContentAssetKind,
  fileName: string,
): string {
  return `${lessonRepositoryRoot(section, slug)}/${kind}/${fileName}`;
}

function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const location = issue.path.length ? `${issue.path.join('.')}: ` : '';
    return `${location}${issue.message}`;
  });
}

function parseMetadata(value: unknown): AdminContentMetadata {
  const parsed = AdminContentMetadataSchema.safeParse(value);
  if (!parsed.success) throw new ContentValidationError(formatZodIssues(parsed.error));
  return {
    ...parsed.data,
    prerequisites: uniqueStrings(parsed.data.prerequisites),
    related: uniqueStrings(parsed.data.related),
    tags: uniqueStrings(parsed.data.tags),
    aliases: parsed.data.aliases ? uniqueStrings(parsed.data.aliases) : undefined,
    seo: {
      ...parsed.data.seo,
      keywords: uniqueStrings(parsed.data.seo.keywords),
    },
  };
}

function parseQuiz(value: unknown): AdminQuiz {
  const parsed = AdminQuizSchema.safeParse(value);
  if (!parsed.success) throw new ContentValidationError(formatZodIssues(parsed.error));
  return parsed.data;
}

export function validateAdminQuizAsset(value: unknown): void {
  const parsed = ExistingQuizAssetSchema.safeParse(value);
  if (!parsed.success) throw new ContentValidationError(formatZodIssues(parsed.error));
}

function validateRegistry(entries: AdminContentMetadata[]): void {
  const issues: string[] = [];
  const ids = new Set<string>();
  const paths = new Set<string>();
  const aliases = new Set<string>();

  for (const entry of entries) {
    if (ids.has(entry.id)) issues.push(`Registry ID "${entry.id}" is already in use.`);
    if (paths.has(entry.path)) issues.push(`Registry path "${entry.path}" is already in use.`);
    ids.add(entry.id);
    paths.add(entry.path);
  }

  for (const entry of entries) {
    const expectedPrefix = `/${entry.section}/`;
    if (!entry.path.startsWith(expectedPrefix)) {
      issues.push(`${entry.id}: path must begin with "${expectedPrefix}".`);
    }
    if (!entry.hasQuiz) issues.push(`${entry.id}: every lesson must have a quiz.`);
    for (const prerequisite of entry.prerequisites) {
      if (!ids.has(prerequisite)) {
        issues.push(`${entry.id}: prerequisite "${prerequisite}" does not exist.`);
      }
    }
    for (const related of entry.related) {
      if (!ids.has(related)) issues.push(`${entry.id}: related lesson "${related}" does not exist.`);
    }
    if (entry.nextInSequence && !ids.has(entry.nextInSequence)) {
      issues.push(`${entry.id}: next lesson "${entry.nextInSequence}" does not exist.`);
    }
    if (entry.canonicalId && !ids.has(entry.canonicalId)) {
      issues.push(`${entry.id}: canonical lesson "${entry.canonicalId}" does not exist.`);
    }
    for (const alias of entry.aliases ?? []) {
      if (aliases.has(alias)) issues.push(`${entry.id}: alias "${alias}" is already in use.`);
      aliases.add(alias);
    }
  }

  if (issues.length) throw new ContentValidationError(issues);
}

function parseRegistrySource(source: string): AdminContentMetadata[] {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new ContentValidationError(['The content registry is not valid JSON.']);
  }
  if (!Array.isArray(value)) {
    throw new ContentValidationError(['The content registry must contain an array of lessons.']);
  }
  const entries = value.map(parseMetadata);
  validateRegistry(entries);
  return entries;
}

function serializeRegistry(entries: AdminContentMetadata[]): string {
  return `${JSON.stringify(entries, null, 2)}\n`;
}

async function getGithubRepositoryState(ref = GITHUB_BRANCH): Promise<GithubRepositoryState> {
  const octokit = getOctokit();
  const branch = await octokit.git.getRef({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    ref: `heads/${ref}`,
  });
  const commit = await octokit.git.getCommit({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    commit_sha: branch.data.object.sha,
  });
  return {
    headSha: branch.data.object.sha,
    treeSha: commit.data.tree.sha,
  };
}

async function readGithubText(filePath: string, ref = GITHUB_BRANCH): Promise<string | null> {
  try {
    const response = await getOctokit().repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
      ref,
    });
    if (Array.isArray(response.data) || !('content' in response.data)) {
      throw new ContentValidationError([`"${filePath}" is not a readable file.`]);
    }
    return Buffer.from(response.data.content.replace(/\n/g, ''), 'base64').toString('utf8');
  } catch (error) {
    if (isHttpStatus(error, 404)) return null;
    throw error;
  }
}

async function commitGithubChanges(
  changes: RepositoryChange[],
  expectedVersion: string,
  actor: ContentActor,
  message: string,
): Promise<RepositoryMutationResult> {
  const octokit = getOctokit();
  const state = await getGithubRepositoryState();
  if (state.headSha !== expectedVersion) {
    throw new ContentEditConflictError(
      'Published content changed while this form was open. Reload before saving.',
    );
  }

  try {
    const tree = await Promise.all(
      changes.map(async (change) => {
        if (change.content === null) {
          return {
            path: change.filePath,
            mode: '100644' as const,
            type: 'blob' as const,
            sha: null,
          };
        }
        const blob = await octokit.git.createBlob({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          content: Buffer.from(change.content, 'utf8').toString('base64'),
          encoding: 'base64',
        });
        return {
          path: change.filePath,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blob.data.sha,
        };
      }),
    );
    const nextTree = await octokit.git.createTree({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      base_tree: state.treeSha,
      tree,
    });
    const commit = await octokit.git.createCommit({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      message,
      tree: nextTree.data.sha,
      parents: [state.headSha],
      author: {
        name: 'SystemDesigner CMS',
        email: actor.email,
        date: new Date().toISOString(),
      },
    });
    await octokit.git.updateRef({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      ref: `heads/${GITHUB_BRANCH}`,
      sha: commit.data.sha,
      force: false,
    });
    return {
      version: commit.data.sha,
      persistence: 'github',
      commitUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/commit/${commit.data.sha}`,
      changedPaths: changes.map((change) => change.filePath),
    };
  } catch (error) {
    if (isHttpStatus(error, 409) || isHttpStatus(error, 422)) {
      throw new ContentEditConflictError(
        'Published content changed while this form was being saved. Reload and try again.',
      );
    }
    throw error;
  }
}

function resolveFilesystemRepositoryPath(filePath: string): string {
  const root = path.resolve(process.cwd());
  const target = path.resolve(root, filePath);
  const relative = path.relative(root, target);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`)) {
    throw new ContentValidationError(['The requested repository path is not allowed.']);
  }
  return target;
}

async function writeFileAtomically(targetPath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.cms-${process.pid}-${Date.now()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, content, { encoding: 'utf8', flag: 'wx' });
    await fs.rename(temporaryPath, targetPath);
  } finally {
    await fs.unlink(temporaryPath).catch(() => undefined);
  }
}

async function commitFilesystemChanges(
  changes: RepositoryChange[],
): Promise<RepositoryMutationResult> {
  for (const change of changes) {
    const target = resolveFilesystemRepositoryPath(change.filePath);
    if (change.content === null) {
      await fs.unlink(target);
    } else {
      await writeFileAtomically(target, change.content);
    }
  }
  return {
    version: sourceVersion(
      changes.map((change) => `${change.filePath}\0${change.content ?? 'DELETE'}`).join('\0'),
    ),
    persistence: 'filesystem',
    changedPaths: changes.map((change) => change.filePath),
  };
}

async function commitRepositoryChanges(
  changes: RepositoryChange[],
  expectedVersion: string,
  actor: ContentActor,
  message: string,
): Promise<RepositoryMutationResult> {
  if (getContentPersistenceMode() === 'github') {
    return commitGithubChanges(changes, expectedVersion, actor, message);
  }
  return commitFilesystemChanges(changes);
}

async function readRegistryDocument(): Promise<RegistryDocument> {
  if (getContentPersistenceMode() === 'github') {
    const state = await getGithubRepositoryState();
    const source = await readGithubText(REGISTRY_REPOSITORY_PATH);
    if (!source) throw new ContentValidationError(['The content registry file is missing.']);
    return {
      entries: parseRegistrySource(source),
      source,
      version: state.headSha,
    };
  }

  const source = await fs.readFile(
    resolveFilesystemRepositoryPath(REGISTRY_REPOSITORY_PATH),
    'utf8',
  );
  return {
    entries: parseRegistrySource(source),
    source,
    version: sourceVersion(source),
  };
}

function findRegistryEntry(
  registry: RegistryDocument,
  section: string,
  slug: string,
): AdminContentMetadata {
  const entry = registry.entries.find(
    (candidate) => candidate.section === section && contentSlug(candidate) === slug,
  );
  if (!entry) throw new ContentEntryNotFoundError();
  return entry;
}

async function readPublishedLessonSource(section: string, slug: string): Promise<string> {
  const repositoryPath = lessonSourceRepositoryPath(section, slug);
  if (getContentPersistenceMode() === 'github') {
    const source = await readGithubText(repositoryPath);
    if (!source) throw new ContentEntryNotFoundError();
    return source;
  }
  try {
    return await fs.readFile(resolveFilesystemRepositoryPath(repositoryPath), 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new ContentEntryNotFoundError();
    }
    throw error;
  }
}

function toContentNode(metadata: AdminContentMetadata): ContentNode {
  return {
    ...metadata,
    seo: {
      ...metadata.seo,
      lastModified: new Date(metadata.seo.lastModified),
    },
  };
}

function assertExpectedVersion(actual: string, expected: string): void {
  if (actual !== expected) {
    throw new ContentEditConflictError(
      'Published content changed while this form was open. Reload before saving.',
    );
  }
}

export async function getAdminContentMetadata(
  section: string,
  slug: string,
): Promise<AdminContentMetadataDocument> {
  const registry = await readRegistryDocument();
  const metadata = findRegistryEntry(registry, section, slug);
  return {
    metadata,
    version: registry.version,
    categories: SECTION_CATEGORIES[metadata.section].map(({ key, title }) => ({ key, title })),
  };
}

export async function publishAdminContentMetadata(
  section: string,
  slug: string,
  value: unknown,
  expectedVersion: string,
  actor: ContentActor,
  message?: string,
): Promise<AdminContentMetadataDocument & AdminMutationResult> {
  const registry = await readRegistryDocument();
  assertExpectedVersion(registry.version, expectedVersion);
  const current = findRegistryEntry(registry, section, slug);
  const input = parseMetadata(value);

  if (
    input.id !== current.id ||
    input.section !== current.section ||
    input.path !== current.path
  ) {
    throw new ContentValidationError([
      'Registry ID, section, and URL path cannot be renamed from the metadata editor.',
    ]);
  }

  const source = await readPublishedLessonSource(section, slug);
  const parsed = parseLessonSource(section, slug, source);
  const metadata: AdminContentMetadata = {
    ...input,
    hasQuiz: true,
    hasCalculator: parsed.derived.hasCalculator,
    hasChallenge: parsed.derived.hasChallenge || undefined,
    seo: {
      ...input.seo,
      lastModified: new Date().toISOString(),
    },
  };
  const entries = registry.entries.map((entry) => (entry.id === current.id ? metadata : entry));
  validateRegistry(entries);
  const registrySource = serializeRegistry(entries);
  const mutation = await commitRepositoryChanges(
    [{ filePath: REGISTRY_REPOSITORY_PATH, content: registrySource }],
    expectedVersion,
    actor,
    message?.trim().slice(0, 160) || `content(${section}): update ${slug} metadata`,
  );

  return {
    metadata,
    version:
      mutation.persistence === 'filesystem' ? sourceVersion(registrySource) : mutation.version,
    persistence: mutation.persistence,
    commitUrl: mutation.commitUrl,
    categories: SECTION_CATEGORIES[metadata.section].map(({ key, title }) => ({ key, title })),
  };
}

function validateAssetFileName(kind: ContentAssetKind, fileName: string): string {
  const normalized = fileName.trim().replace(/\\/g, '/');
  const segments = normalized.split('/');
  if (
    !normalized ||
    normalized.startsWith('/') ||
    segments.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(segment),
    )
  ) {
    throw new ContentValidationError([
      'Asset names may use letters, numbers, dots, underscores, dashes, and safe subfolders.',
    ]);
  }
  const extension = path.posix.extname(normalized).toLowerCase();
  if (!ASSET_EXTENSIONS[kind].has(extension)) {
    throw new ContentValidationError([
      `"${extension || '(none)'}" is not an allowed ${kind} file extension.`,
    ]);
  }
  return normalized;
}

function validateAssetContent(kind: ContentAssetKind, content: string): void {
  if (Buffer.byteLength(content, 'utf8') > MAX_ADMIN_ASSET_BYTES) {
    throw new ContentValidationError(['Assets must be smaller than 1 MB.']);
  }
  if (kind === 'quiz') {
    let quiz: unknown;
    try {
      quiz = JSON.parse(content);
    } catch {
      throw new ContentValidationError(['Quiz assets must contain valid JSON.']);
    }
    validateAdminQuizAsset(quiz);
  }
}

function publicAssetUrl(
  section: string,
  slug: string,
  kind: ContentAssetKind,
  fileName: string,
): string {
  return `/api/content/${section}/${slug}/${kind}/${fileName
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

function validateSourceAssetReferences(
  source: string,
  section: string,
  slug: string,
  availableUrls: Set<string>,
): void {
  const prefix = `/api/content/${section}/${slug}/`;
  const references = [
    ...source.matchAll(
      new RegExp(
        `${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:code|quiz|data)/[^"')\\s]+`,
        'g',
      ),
    ),
  ].map((match) => match[0]);
  const missing = [...new Set(references.filter((reference) => !availableUrls.has(reference)))];
  if (missing.length) {
    throw new ContentValidationError(
      missing.map((reference) => `The lesson references missing asset "${reference}".`),
    );
  }
}

async function listGithubLessonAssets(
  section: string,
  slug: string,
): Promise<{ version: string; assets: AdminContentAssetSummary[] }> {
  const state = await getGithubRepositoryState();
  const tree = await getOctokit().git.getTree({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    tree_sha: state.treeSha,
    recursive: 'true',
  });
  const prefix = `${lessonRepositoryRoot(section, slug)}/`;
  const assets: AdminContentAssetSummary[] = [];
  for (const item of tree.data.tree) {
    if (item.type !== 'blob' || !item.path?.startsWith(prefix)) continue;
    const relative = item.path.slice(prefix.length);
    const [kind, ...fileParts] = relative.split('/');
    if (kind !== 'code' && kind !== 'quiz' && kind !== 'data') continue;
    const fileName = fileParts.join('/');
    if (!fileName) continue;
    assets.push({
      kind,
      fileName,
      size: item.size ?? 0,
      publicUrl: publicAssetUrl(section, slug, kind, fileName),
    });
  }
  return {
    version: state.headSha,
    assets: assets.sort((left, right) =>
      left.kind === right.kind
        ? left.fileName.localeCompare(right.fileName)
        : left.kind.localeCompare(right.kind),
    ),
  };
}

async function walkFilesystemAssets(
  directory: string,
  root: string,
  kind: ContentAssetKind,
  section: string,
  slug: string,
  assets: AdminContentAssetSummary[],
): Promise<void> {
  let items;
  try {
    items = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return;
    throw error;
  }
  for (const item of items) {
    const target = path.join(directory, item.name);
    if (item.isDirectory()) {
      await walkFilesystemAssets(target, root, kind, section, slug, assets);
    } else if (item.isFile()) {
      const stats = await fs.stat(target);
      const fileName = path.relative(root, target).split(path.sep).join('/');
      assets.push({
        kind,
        fileName,
        size: stats.size,
        publicUrl: publicAssetUrl(section, slug, kind, fileName),
      });
    }
  }
}

async function listFilesystemLessonAssets(
  section: string,
  slug: string,
): Promise<{ version: string; assets: AdminContentAssetSummary[] }> {
  const assets: AdminContentAssetSummary[] = [];
  for (const kind of ['code', 'quiz', 'data'] as const) {
    const root = resolveFilesystemRepositoryPath(
      `${lessonRepositoryRoot(section, slug)}/${kind}`,
    );
    await walkFilesystemAssets(root, root, kind, section, slug, assets);
  }
  assets.sort((left, right) =>
    left.kind === right.kind
      ? left.fileName.localeCompare(right.fileName)
      : left.kind.localeCompare(right.kind),
  );
  const versions = await Promise.all(
    assets.map(async (asset) => {
      const file = resolveFilesystemRepositoryPath(
        assetRepositoryPath(section, slug, asset.kind, asset.fileName),
      );
      return `${asset.kind}/${asset.fileName}\0${await fs.readFile(file, 'utf8')}`;
    }),
  );
  return { version: sourceVersion(versions.join('\0')), assets };
}

async function listLessonAssets(
  section: string,
  slug: string,
): Promise<{ version: string; assets: AdminContentAssetSummary[] }> {
  return getContentPersistenceMode() === 'github'
    ? listGithubLessonAssets(section, slug)
    : listFilesystemLessonAssets(section, slug);
}

export async function getAdminContentAssets(
  section: string,
  slug: string,
): Promise<AdminContentAssetDocument> {
  const registry = await readRegistryDocument();
  const entry = findRegistryEntry(registry, section, slug);
  const inventory = await listLessonAssets(section, slug);
  return {
    entry: {
      id: entry.id,
      title: entry.title,
      section: entry.section,
      path: entry.path,
    },
    ...inventory,
  };
}

export async function readAdminContentAsset(
  section: string,
  slug: string,
  kindValue: string,
  fileNameValue: string,
): Promise<{ content: string; asset: AdminContentAssetSummary; version: string }> {
  const kind = z.enum(['code', 'quiz', 'data']).parse(kindValue);
  const fileName = validateAssetFileName(kind, fileNameValue);
  const inventory = await getAdminContentAssets(section, slug);
  const asset = inventory.assets.find(
    (candidate) => candidate.kind === kind && candidate.fileName === fileName,
  );
  if (!asset) throw new ContentEntryNotFoundError();
  const repositoryPath = assetRepositoryPath(section, slug, kind, fileName);
  const content =
    getContentPersistenceMode() === 'github'
      ? await readGithubText(repositoryPath)
      : await fs.readFile(resolveFilesystemRepositoryPath(repositoryPath), 'utf8');
  if (content === null) throw new ContentEntryNotFoundError();
  return { content, asset, version: inventory.version };
}

function quizFileReferencedBySource(
  source: string,
  section: string,
  slug: string,
  fileName: string,
): boolean {
  return source.includes(publicAssetUrl(section, slug, 'quiz', fileName));
}

export async function upsertAdminContentAsset(
  section: string,
  slug: string,
  kindValue: string,
  fileNameValue: string,
  content: string,
  expectedVersion: string,
  actor: ContentActor,
): Promise<AdminContentAssetDocument & AdminMutationResult> {
  const kind = z.enum(['code', 'quiz', 'data']).parse(kindValue);
  const fileName = validateAssetFileName(kind, fileNameValue);
  validateAssetContent(kind, content);
  if (path.posix.extname(fileName).toLowerCase() === '.json' && kind !== 'quiz') {
    try {
      JSON.parse(content);
    } catch {
      throw new ContentValidationError(['JSON assets must contain valid JSON.']);
    }
  }

  const registry = await readRegistryDocument();
  findRegistryEntry(registry, section, slug);
  const inventory = await listLessonAssets(section, slug);
  assertExpectedVersion(inventory.version, expectedVersion);
  const existing = inventory.assets.find(
    (candidate) => candidate.kind === kind && candidate.fileName === fileName,
  );
  if (kind === 'quiz') {
    const quizFiles = inventory.assets.filter((asset) => asset.kind === 'quiz');
    if (!existing && quizFiles.length > 0) {
      throw new ContentValidationError([
        'Each lesson has exactly one quiz file. Replace the existing quiz instead of adding another.',
      ]);
    }
    const source = await readPublishedLessonSource(section, slug);
    if (!quizFileReferencedBySource(source, section, slug, fileName)) {
      throw new ContentValidationError([
        'The lesson body must reference this quiz filename before it can be published.',
      ]);
    }
  }

  const mutation = await commitRepositoryChanges(
    [
      {
        filePath: assetRepositoryPath(section, slug, kind, fileName),
        content: normalizeText(content),
      },
    ],
    expectedVersion,
    actor,
    `content(${section}): ${existing ? 'update' : 'add'} ${slug} ${kind} asset`,
  );
  const nextInventory = await listLessonAssets(section, slug);
  return {
    entry: {
      id: registry.entries.find((entry) => entry.section === section && contentSlug(entry) === slug)!
        .id,
      title: registry.entries.find((entry) => entry.section === section && contentSlug(entry) === slug)!
        .title,
      section: section as AdminContentMetadata['section'],
      path: `/${section}/${slug}`,
    },
    version: nextInventory.version,
    assets: nextInventory.assets,
    persistence: mutation.persistence,
    commitUrl: mutation.commitUrl,
  };
}

export async function deleteAdminContentAsset(
  section: string,
  slug: string,
  kindValue: string,
  fileNameValue: string,
  expectedVersion: string,
  actor: ContentActor,
): Promise<AdminContentAssetDocument & AdminMutationResult> {
  const kind = z.enum(['code', 'quiz', 'data']).parse(kindValue);
  const fileName = validateAssetFileName(kind, fileNameValue);
  if (kind === 'quiz') {
    throw new ContentValidationError(['A lesson quiz cannot be deleted. Replace it instead.']);
  }
  const registry = await readRegistryDocument();
  const entry = findRegistryEntry(registry, section, slug);
  const inventory = await listLessonAssets(section, slug);
  assertExpectedVersion(inventory.version, expectedVersion);
  const asset = inventory.assets.find(
    (candidate) => candidate.kind === kind && candidate.fileName === fileName,
  );
  if (!asset) throw new ContentEntryNotFoundError();
  const source = await readPublishedLessonSource(section, slug);
  if (source.includes(asset.publicUrl)) {
    throw new ContentValidationError([
      'This asset is still referenced by the published lesson. Remove the reference first.',
    ]);
  }

  const mutation = await commitRepositoryChanges(
    [{ filePath: assetRepositoryPath(section, slug, kind, fileName), content: null }],
    expectedVersion,
    actor,
    `content(${section}): remove ${slug} ${kind} asset`,
  );
  const nextInventory = await listLessonAssets(section, slug);
  return {
    entry: {
      id: entry.id,
      title: entry.title,
      section: entry.section,
      path: entry.path,
    },
    version: nextInventory.version,
    assets: nextInventory.assets,
    persistence: mutation.persistence,
    commitUrl: mutation.commitUrl,
  };
}

export async function getNewLessonOptions(): Promise<{
  version: string;
  sections: Array<{
    key: AdminContentMetadata['section'];
    title: string;
    categories: Array<{ key: string; title: string }>;
  }>;
}> {
  const registry = await readRegistryDocument();
  return {
    version: registry.version,
    sections: CONTENT_SECTIONS.map((section) => ({
      key: section,
      title: section
        .split('-')
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join(' '),
      categories: SECTION_CATEGORIES[section].map(({ key, title }) => ({ key, title })),
    })),
  };
}

export function buildStarterLessonSource(
  metadata: AdminContentMetadata,
  slug: string,
  quizFileName: string,
): string {
  const description = metadata.seo.metaDescription;
  return `---
title: ${JSON.stringify(metadata.title)}
section: ${metadata.section}
level: ${metadata.level}
duration: ${JSON.stringify(metadata.duration)}
description: ${JSON.stringify(description)}
registryId: ${metadata.id}
---

{% section-card tone="intro" %}
## What is ${metadata.title}?

${description}

In plain language, this lesson introduces the idea, explains why it matters, and gives you a safe starting point for deeper study.
{% /section-card %}

{% section-card %}
## Why it matters

Describe the practical problem this concept solves, the signals that tell you it is relevant, and the trade-offs a designer should evaluate.
{% /section-card %}

{% section-card %}
## How it works

Build the explanation progressively: start with the core mechanism, then add a concrete example, operational considerations, and common failure modes.
{% /section-card %}

{% quiz
   title=${JSON.stringify(`${metadata.title} Check`)}
   questionsFile="/api/content/${metadata.section}/${slug}/quiz/${quizFileName}"
/%}
`;
}

export async function createAdminLesson(
  inputValue: unknown,
  actor: ContentActor,
): Promise<
  AdminMutationResult & {
    entry: AdminContentMetadata;
    changedPaths: string[];
  }
> {
  const parsed = CreateLessonSchema.safeParse(inputValue);
  if (!parsed.success) throw new ContentValidationError(formatZodIssues(parsed.error));
  const input = parsed.data;
  const registry = await readRegistryDocument();
  assertExpectedVersion(registry.version, input.expectedVersion);

  const expectedPath = `/${input.metadata.section}/${input.slug}`;
  if (
    input.metadata.id !== input.slug ||
    input.metadata.path !== expectedPath ||
    input.metadata.status !== 'draft'
  ) {
    throw new ContentValidationError([
      'New lessons must use the slug as their registry ID and URL, and begin in draft status.',
    ]);
  }
  if (
    registry.entries.some(
      (entry) => entry.id === input.slug || entry.path === expectedPath,
    )
  ) {
    throw new ContentValidationError(['A lesson already uses this slug or URL path.']);
  }

  const quiz = parseQuiz({
    ...input.quiz,
    section: input.metadata.section,
    difficulty: input.metadata.level,
  });
  const provisionalMetadata = parseMetadata({
    ...input.metadata,
    hasQuiz: true,
    hasCalculator: false,
    hasChallenge: undefined,
    renderMode: 'mdoc',
    seo: {
      ...input.metadata.seo,
      lastModified: new Date().toISOString(),
    },
  });
  const source = normalizeText(
    input.source?.trim() ||
      buildStarterLessonSource(provisionalMetadata, input.slug, input.quizFileName),
  );
  const parsedSource = validateEditableContentSource(toContentNode(provisionalMetadata), source);
  if (parsedSource.frontmatter.registryId !== provisionalMetadata.id) {
    throw new ContentValidationError([
      `Frontmatter registryId must be "${provisionalMetadata.id}".`,
    ]);
  }
  const quizReference = publicAssetUrl(
    provisionalMetadata.section,
    input.slug,
    'quiz',
    input.quizFileName,
  );
  if (!source.includes(quizReference) || !parsedSource.derived.hasQuiz) {
    throw new ContentValidationError([
      `The lesson must include one quiz that references "${quizReference}".`,
    ]);
  }
  const metadata: AdminContentMetadata = {
    ...provisionalMetadata,
    hasCalculator: parsedSource.derived.hasCalculator,
    hasChallenge: parsedSource.derived.hasChallenge || undefined,
  };
  const entries = [...registry.entries, metadata];
  validateRegistry(entries);

  const seenAssets = new Set<string>();
  const assetChanges: RepositoryChange[] = [];
  for (const asset of input.assets) {
    const fileName = validateAssetFileName(asset.kind, asset.fileName);
    validateAssetContent(asset.kind, asset.content);
    const key = `${asset.kind}/${fileName}`;
    if (seenAssets.has(key)) {
      throw new ContentValidationError([`The new lesson includes "${key}" more than once.`]);
    }
    seenAssets.add(key);
    assetChanges.push({
      filePath: assetRepositoryPath(metadata.section, input.slug, asset.kind, fileName),
      content: normalizeText(asset.content),
    });
  }
  validateSourceAssetReferences(
    source,
    metadata.section,
    input.slug,
    new Set([
      quizReference,
      ...input.assets.map((asset) =>
        publicAssetUrl(
          metadata.section,
          input.slug,
          asset.kind,
          validateAssetFileName(asset.kind, asset.fileName),
        ),
      ),
    ]),
  );

  const changes: RepositoryChange[] = [
    { filePath: REGISTRY_REPOSITORY_PATH, content: serializeRegistry(entries) },
    {
      filePath: lessonSourceRepositoryPath(metadata.section, input.slug),
      content: source,
    },
    {
      filePath: assetRepositoryPath(
        metadata.section,
        input.slug,
        'quiz',
        input.quizFileName,
      ),
      content: `${JSON.stringify(quiz, null, 2)}\n`,
    },
    ...assetChanges,
  ];
  if (getContentPersistenceMode() === 'filesystem') {
    for (const change of changes.slice(1)) {
      try {
        await fs.access(resolveFilesystemRepositoryPath(change.filePath));
        throw new ContentValidationError([`"${change.filePath}" already exists.`]);
      } catch (error) {
        if (error instanceof ContentValidationError) throw error;
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
          throw error;
        }
      }
    }
  } else {
    for (const change of changes.slice(1)) {
      if (await readGithubText(change.filePath)) {
        throw new ContentValidationError([`"${change.filePath}" already exists.`]);
      }
    }
  }

  const mutation = await commitRepositoryChanges(
    changes,
    input.expectedVersion,
    actor,
    input.message?.trim().slice(0, 160) ||
      `content(${metadata.section}): create ${input.slug} lesson`,
  );
  return {
    entry: metadata,
    version: mutation.version,
    persistence: mutation.persistence,
    commitUrl: mutation.commitUrl,
    changedPaths: mutation.changedPaths,
  };
}
