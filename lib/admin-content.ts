import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { CONTENT_REGISTRY, type ContentNode } from '@/lib/content-registry';
import { getContentSlug } from '@/lib/content-model';
import { getOctokit, GITHUB_OWNER, GITHUB_REPO } from '@/lib/github';
import { parseLessonSource } from '@/lib/lessons';
import { GITHUB_BRANCH } from '@/lib/site-config';

export const MAX_ADMIN_CONTENT_BYTES = 2 * 1024 * 1024;
export const DEFAULT_CMS_DRAFT_BRANCH = 'cms-drafts';

const CMS_DIRECTORY = '.content-cms';
const DRAFT_SCHEMA_VERSION = 1;
const REVISION_SCHEMA_VERSION = 1;

export type ContentPersistenceMode = 'filesystem' | 'github';
export type ContentWorkflowState = 'published' | 'draft' | 'conflicted';

export interface ContentActor {
  uid: string;
  email: string;
}

export interface EditableContentSummary {
  id: string;
  title: string;
  section: ContentNode['section'];
  slug: string;
  path: string;
  level: ContentNode['level'];
  status: ContentNode['status'];
  duration: string;
  lastModified: string;
  hasDraft?: boolean;
}

export interface PublishedContent {
  source: string;
  version: string;
}

export interface EditableContentDraft {
  source: string;
  version: string;
  baseVersion: string;
  updatedAt: string;
  updatedBy: ContentActor;
}

export interface ContentStudioDocument {
  entry: EditableContentSummary;
  published: PublishedContent;
  draft: EditableContentDraft | null;
  workflowState: ContentWorkflowState;
  persistence: ContentPersistenceMode;
  branch?: string;
  draftBranch?: string;
}

export interface SavedContentDraft {
  draft: EditableContentDraft;
  persistence: ContentPersistenceMode;
  draftBranch?: string;
}

export interface PublishedContentResult {
  source: string;
  version: string;
  persistence: ContentPersistenceMode;
  branch?: string;
  commitUrl?: string;
  publishedAt: string;
  draftDiscarded: boolean;
}

export interface ContentRevisionSummary {
  id: string;
  version: string;
  createdAt: string;
  actor: string;
  message: string;
  url?: string;
}

interface StoredContentDraft {
  schemaVersion: 1;
  entryId: string;
  source: string;
  baseVersion: string;
  updatedAt: string;
  updatedBy: ContentActor;
}

interface StoredContentRevision {
  schemaVersion: 1;
  id: string;
  entryId: string;
  source: string;
  version: string;
  createdAt: string;
  actor: string;
  message: string;
}

interface StoredDraftWithVersion {
  record: StoredContentDraft;
  version: string;
}

interface GithubFile {
  source: string;
  sha: string;
}

const StoredDraftSchema = z.object({
  schemaVersion: z.literal(DRAFT_SCHEMA_VERSION),
  entryId: z.string().min(1),
  source: z.string(),
  baseVersion: z.string().min(1),
  updatedAt: z.string().datetime(),
  updatedBy: z.object({
    uid: z.string().min(1),
    email: z.string().email(),
  }),
});

const StoredRevisionSchema = z.object({
  schemaVersion: z.literal(REVISION_SCHEMA_VERSION),
  id: z.string().min(1),
  entryId: z.string().min(1),
  source: z.string(),
  version: z.string().min(1),
  createdAt: z.string().datetime(),
  actor: z.string().min(1),
  message: z.string().min(1),
});

export class ContentEntryNotFoundError extends Error {
  constructor() {
    super('Editable content entry not found.');
    this.name = 'ContentEntryNotFoundError';
  }
}

export class ContentDraftNotFoundError extends Error {
  constructor() {
    super('No saved draft exists for this lesson.');
    this.name = 'ContentDraftNotFoundError';
  }
}

export class ContentRevisionNotFoundError extends Error {
  constructor() {
    super('Content revision not found.');
    this.name = 'ContentRevisionNotFoundError';
  }
}

export class ContentValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join(' '));
    this.name = 'ContentValidationError';
  }
}

export class ContentEditConflictError extends Error {
  constructor(
    message = 'This lesson changed after you opened it. Reload before continuing.',
  ) {
    super(message);
    this.name = 'ContentEditConflictError';
  }
}

export class ContentPersistenceConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentPersistenceConfigError';
  }
}

function isHttpStatus(error: unknown, status: number): boolean {
  return Boolean(
    error && typeof error === 'object' && 'status' in error && error.status === status,
  );
}

function toSummary(entry: ContentNode, hasDraft?: boolean): EditableContentSummary {
  return {
    id: entry.id,
    title: entry.title,
    section: entry.section,
    slug: getContentSlug(entry),
    path: entry.path,
    level: entry.level,
    status: entry.status,
    duration: entry.duration,
    lastModified: entry.seo.lastModified.toISOString(),
    hasDraft,
  };
}

export function listEditableContent(draftCoordinates = new Set<string>()): EditableContentSummary[] {
  return CONTENT_REGISTRY.filter((entry) => entry.renderMode === 'mdoc')
    .map((entry) =>
      toSummary(entry, draftCoordinates.has(`${entry.section}/${getContentSlug(entry)}`)),
    )
    .sort((left, right) =>
      left.section === right.section
        ? left.title.localeCompare(right.title)
        : left.section.localeCompare(right.section),
    );
}

export function findEditableContent(section: string, slug: string): ContentNode {
  const entry = CONTENT_REGISTRY.find(
    (candidate) =>
      candidate.renderMode === 'mdoc' &&
      candidate.section === section &&
      getContentSlug(candidate) === slug,
  );

  if (!entry) throw new ContentEntryNotFoundError();
  return entry;
}

export function validateDraftSourceSize(source: string): void {
  if (Buffer.byteLength(source, 'utf8') > MAX_ADMIN_CONTENT_BYTES) {
    throw new ContentValidationError([
      `Lesson source must be smaller than ${MAX_ADMIN_CONTENT_BYTES / 1024 / 1024} MB.`,
    ]);
  }
}

export function validateEditableContentSource(
  entry: ContentNode,
  source: string,
): ReturnType<typeof parseLessonSource> {
  if (!source.trim()) {
    throw new ContentValidationError(['Lesson source cannot be empty.']);
  }

  const lessonBody = source.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '').trim();
  if (!lessonBody) {
    throw new ContentValidationError(['Lesson body cannot be empty.']);
  }

  validateDraftSourceSize(source);

  try {
    const parsed = parseLessonSource(entry.section, getContentSlug(entry), source);
    if (parsed.frontmatter.registryId !== entry.id) {
      throw new ContentValidationError([
        `Frontmatter registryId must be "${entry.id}" for this lesson.`,
      ]);
    }
    const quizTags = [...lessonBody.matchAll(/\{%\s*quiz\b([\s\S]*?)\/%\}/g)];
    const expectedQuizPrefix =
      `/api/content/${entry.section}/${getContentSlug(entry)}/quiz/`;
    const questionsFile =
      quizTags[0]?.[1].match(/\bquestionsFile="([^"]+)"/)?.[1];
    if (
      quizTags.length !== 1 ||
      !questionsFile ||
      !questionsFile.startsWith(expectedQuizPrefix) ||
      !questionsFile.endsWith('.json')
    ) {
      throw new ContentValidationError([
        `Every lesson must contain exactly one quiz backed by a co-located JSON file under "${expectedQuizPrefix}".`,
      ]);
    }
    if (!parsed.derived.hasQuiz) {
      throw new ContentValidationError(['The lesson quiz could not be rendered.']);
    }
    return parsed;
  } catch (error) {
    if (error instanceof ContentValidationError) throw error;
    throw new ContentValidationError([
      error instanceof Error ? error.message : 'The lesson source is invalid.',
    ]);
  }
}

export function getContentPersistenceMode(): ContentPersistenceMode {
  const configured = process.env.ADMIN_CONTENT_PERSISTENCE?.trim().toLowerCase();
  if (configured === 'filesystem' || configured === 'github') return configured;
  if (configured) {
    throw new ContentPersistenceConfigError(
      'ADMIN_CONTENT_PERSISTENCE must be either "filesystem" or "github".',
    );
  }
  return process.env.VERCEL ? 'github' : 'filesystem';
}

export function getCmsDraftBranch(): string {
  const draftBranch = process.env.GITHUB_CMS_DRAFT_BRANCH?.trim() || DEFAULT_CMS_DRAFT_BRANCH;
  if (draftBranch === GITHUB_BRANCH) {
    throw new ContentPersistenceConfigError(
      'GITHUB_CMS_DRAFT_BRANCH must be different from the published content branch.',
    );
  }
  return draftBranch;
}

function repositoryContentPath(entry: ContentNode): string {
  return `content/entries/${entry.section}/${getContentSlug(entry)}/index.mdoc`;
}

function draftRepositoryPath(entry: ContentNode): string {
  return `${CMS_DIRECTORY}/drafts/${entry.section}/${getContentSlug(entry)}.json`;
}

function filesystemContentPath(entry: ContentNode, projectRoot = process.cwd()): string {
  return path.join(projectRoot, repositoryContentPath(entry));
}

function filesystemDraftPath(entry: ContentNode, projectRoot = process.cwd()): string {
  return path.join(projectRoot, draftRepositoryPath(entry));
}

function filesystemRevisionDirectory(entry: ContentNode, projectRoot = process.cwd()): string {
  return path.join(
    projectRoot,
    CMS_DIRECTORY,
    'revisions',
    entry.section,
    getContentSlug(entry),
  );
}

function sourceVersion(source: string): string {
  return createHash('sha256').update(source).digest('hex');
}

function normalizeSource(source: string): string {
  return `${source.replace(/\s+$/u, '')}\n`;
}

async function writeFileAtomically(targetPath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const temporaryPath = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.${randomUUID()}.tmp`,
  );

  try {
    await fs.writeFile(temporaryPath, content, { encoding: 'utf8', flag: 'wx' });
    await fs.rename(temporaryPath, targetPath);
  } finally {
    await fs.unlink(temporaryPath).catch(() => undefined);
  }
}

function parseStoredDraft(source: string, entry: ContentNode): StoredContentDraft {
  let record: unknown;
  try {
    record = JSON.parse(source);
  } catch {
    throw new ContentPersistenceConfigError(
      `The saved CMS draft for ${entry.section}/${getContentSlug(entry)} is not valid JSON.`,
    );
  }
  const parsed = StoredDraftSchema.safeParse(record);
  if (!parsed.success || parsed.data.entryId !== entry.id) {
    throw new ContentPersistenceConfigError(
      `The saved CMS draft for ${entry.section}/${getContentSlug(entry)} is invalid.`,
    );
  }
  return parsed.data;
}

function toEditableDraft(stored: StoredDraftWithVersion): EditableContentDraft {
  return { ...stored.record, version: stored.version };
}

async function getGithubFile(filePath: string, ref: string): Promise<GithubFile | null> {
  const octokit = getOctokit();
  try {
    const response = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
      ref,
    });

    if (Array.isArray(response.data) || !('content' in response.data) || !('sha' in response.data)) {
      throw new ContentPersistenceConfigError('GitHub returned an unexpected content payload.');
    }

    return {
      source: Buffer.from(response.data.content.replace(/\n/g, ''), 'base64').toString('utf8'),
      sha: response.data.sha,
    };
  } catch (error) {
    if (isHttpStatus(error, 404)) return null;
    throw error;
  }
}

async function ensureGithubDraftBranch(): Promise<void> {
  const octokit = getOctokit();
  const draftBranch = getCmsDraftBranch();

  try {
    await octokit.git.getRef({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      ref: `heads/${draftBranch}`,
    });
    return;
  } catch (error) {
    if (!isHttpStatus(error, 404)) throw error;
  }

  const baseRef = await octokit.git.getRef({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    ref: `heads/${GITHUB_BRANCH}`,
  });

  try {
    await octokit.git.createRef({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      ref: `refs/heads/${draftBranch}`,
      sha: baseRef.data.object.sha,
    });
  } catch (error) {
    if (!isHttpStatus(error, 422)) throw error;
  }
}

async function readPublishedContent(entry: ContentNode): Promise<PublishedContent> {
  if (getContentPersistenceMode() === 'github') {
    const file = await getGithubFile(repositoryContentPath(entry), GITHUB_BRANCH);
    if (!file) throw new ContentEntryNotFoundError();
    return { source: file.source, version: file.sha };
  }

  const source = await fs.readFile(filesystemContentPath(entry), 'utf8');
  return { source, version: sourceVersion(source) };
}

async function readStoredDraft(entry: ContentNode): Promise<StoredDraftWithVersion | null> {
  if (getContentPersistenceMode() === 'github') {
    const file = await getGithubFile(draftRepositoryPath(entry), getCmsDraftBranch());
    if (!file) return null;
    return { record: parseStoredDraft(file.source, entry), version: file.sha };
  }

  try {
    const source = await fs.readFile(filesystemDraftPath(entry), 'utf8');
    return { record: parseStoredDraft(source, entry), version: sourceVersion(source) };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeStoredDraft(
  entry: ContentNode,
  record: StoredContentDraft,
  expectedVersion: string | null,
): Promise<StoredDraftWithVersion> {
  const serialized = `${JSON.stringify(record, null, 2)}\n`;

  if (getContentPersistenceMode() === 'github') {
    await ensureGithubDraftBranch();
    const current = await getGithubFile(draftRepositoryPath(entry), getCmsDraftBranch());
    if ((current?.sha ?? null) !== expectedVersion) {
      throw new ContentEditConflictError('The saved draft changed in another editor. Reload it.');
    }

    try {
      const response = await getOctokit().repos.createOrUpdateFileContents({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: draftRepositoryPath(entry),
        branch: getCmsDraftBranch(),
        sha: current?.sha,
        message: `cms(draft): autosave ${entry.section}/${getContentSlug(entry)}`,
        content: Buffer.from(serialized, 'utf8').toString('base64'),
      });
      return {
        record,
        version: response.data.content?.sha ?? sourceVersion(serialized),
      };
    } catch (error) {
      if (isHttpStatus(error, 409) || isHttpStatus(error, 422)) {
        throw new ContentEditConflictError('The saved draft changed in another editor. Reload it.');
      }
      throw error;
    }
  }

  const current = await readStoredDraft(entry);
  if ((current?.version ?? null) !== expectedVersion) {
    throw new ContentEditConflictError('The saved draft changed in another editor. Reload it.');
  }
  await writeFileAtomically(filesystemDraftPath(entry), serialized);
  return { record, version: sourceVersion(serialized) };
}

export async function getContentStudioDocument(
  section: string,
  slug: string,
): Promise<ContentStudioDocument> {
  const entry = findEditableContent(section, slug);
  const [published, storedDraft] = await Promise.all([
    readPublishedContent(entry),
    readStoredDraft(entry),
  ]);
  const draft = storedDraft ? toEditableDraft(storedDraft) : null;
  const workflowState: ContentWorkflowState = !draft
    ? 'published'
    : draft.baseVersion === published.version
      ? 'draft'
      : 'conflicted';
  const persistence = getContentPersistenceMode();

  return {
    entry: toSummary(entry, Boolean(draft)),
    published,
    draft,
    workflowState,
    persistence,
    branch: persistence === 'github' ? GITHUB_BRANCH : undefined,
    draftBranch: persistence === 'github' ? getCmsDraftBranch() : undefined,
  };
}

async function persistDraft(
  entry: ContentNode,
  source: string,
  baseVersion: string,
  actor: ContentActor,
  expectedVersion: string | null,
  resetBase: boolean,
): Promise<SavedContentDraft> {
  validateDraftSourceSize(source);
  const [published, current] = await Promise.all([
    readPublishedContent(entry),
    readStoredDraft(entry),
  ]);

  if ((current?.version ?? null) !== expectedVersion) {
    throw new ContentEditConflictError('The saved draft changed in another editor. Reload it.');
  }
  if (!current && published.version !== baseVersion) {
    throw new ContentEditConflictError('The published lesson changed before this draft was created.');
  }

  const record: StoredContentDraft = {
    schemaVersion: DRAFT_SCHEMA_VERSION,
    entryId: entry.id,
    source,
    baseVersion: resetBase ? published.version : current?.record.baseVersion ?? baseVersion,
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
  };
  const saved = await writeStoredDraft(entry, record, expectedVersion);

  return {
    draft: toEditableDraft(saved),
    persistence: getContentPersistenceMode(),
    draftBranch: getContentPersistenceMode() === 'github' ? getCmsDraftBranch() : undefined,
  };
}

export async function saveContentDraft(
  section: string,
  slug: string,
  source: string,
  baseVersion: string,
  actor: ContentActor,
  expectedVersion: string | null,
): Promise<SavedContentDraft> {
  return persistDraft(
    findEditableContent(section, slug),
    source,
    baseVersion,
    actor,
    expectedVersion,
    false,
  );
}

export async function rebaseContentDraft(
  section: string,
  slug: string,
  expectedVersion: string,
  actor: ContentActor,
): Promise<SavedContentDraft> {
  const entry = findEditableContent(section, slug);
  const current = await readStoredDraft(entry);
  if (!current) throw new ContentDraftNotFoundError();
  if (current.version !== expectedVersion) {
    throw new ContentEditConflictError('The saved draft changed in another editor. Reload it.');
  }
  const published = await readPublishedContent(entry);
  return persistDraft(
    entry,
    current.record.source,
    published.version,
    actor,
    expectedVersion,
    true,
  );
}

export async function discardContentDraft(
  section: string,
  slug: string,
  expectedVersion: string | null,
): Promise<void> {
  const entry = findEditableContent(section, slug);
  const current = await readStoredDraft(entry);
  if ((current?.version ?? null) !== expectedVersion) {
    throw new ContentEditConflictError('The saved draft changed in another editor. Reload it.');
  }
  if (!current) return;

  if (getContentPersistenceMode() === 'github') {
    try {
      await getOctokit().repos.deleteFile({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: draftRepositoryPath(entry),
        branch: getCmsDraftBranch(),
        sha: current.version,
        message: `cms(draft): discard ${entry.section}/${getContentSlug(entry)}`,
      });
      return;
    } catch (error) {
      if (isHttpStatus(error, 409) || isHttpStatus(error, 422)) {
        throw new ContentEditConflictError('The saved draft changed in another editor. Reload it.');
      }
      throw error;
    }
  }

  await fs.unlink(filesystemDraftPath(entry));
}

async function createLocalRevision(
  entry: ContentNode,
  published: PublishedContent,
  actor: ContentActor,
  message: string,
): Promise<void> {
  const createdAt = new Date().toISOString();
  const id = `${Date.now()}-${published.version.slice(0, 12)}`;
  const revision: StoredContentRevision = {
    schemaVersion: REVISION_SCHEMA_VERSION,
    id,
    entryId: entry.id,
    source: published.source,
    version: published.version,
    createdAt,
    actor: actor.email,
    message,
  };
  await writeFileAtomically(
    path.join(filesystemRevisionDirectory(entry), `${id}.json`),
    `${JSON.stringify(revision, null, 2)}\n`,
  );
}

async function writePublishedContent(
  entry: ContentNode,
  source: string,
  expectedVersion: string,
  actor: ContentActor,
  message: string,
): Promise<Omit<PublishedContentResult, 'publishedAt' | 'draftDiscarded' | 'source'>> {
  const normalizedSource = normalizeSource(source);

  if (getContentPersistenceMode() === 'github') {
    try {
      const response = await getOctokit().repos.createOrUpdateFileContents({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: repositoryContentPath(entry),
        branch: GITHUB_BRANCH,
        sha: expectedVersion,
        message,
        content: Buffer.from(normalizedSource, 'utf8').toString('base64'),
        committer: { name: 'SystemDesigner CMS', email: actor.email },
      });
      return {
        version: response.data.content?.sha ?? expectedVersion,
        persistence: 'github',
        branch: GITHUB_BRANCH,
        commitUrl: response.data.commit.html_url ?? undefined,
      };
    } catch (error) {
      if (isHttpStatus(error, 409) || isHttpStatus(error, 422)) {
        throw new ContentEditConflictError('The published lesson changed before publication.');
      }
      throw error;
    }
  }

  const currentSource = await fs.readFile(filesystemContentPath(entry), 'utf8');
  if (sourceVersion(currentSource) !== expectedVersion) {
    throw new ContentEditConflictError('The published lesson changed before publication.');
  }
  await writeFileAtomically(filesystemContentPath(entry), normalizedSource);
  return { version: sourceVersion(normalizedSource), persistence: 'filesystem' };
}

export async function publishContentDraft(
  section: string,
  slug: string,
  expectedDraftVersion: string,
  expectedPublishedVersion: string,
  actor: ContentActor,
  message?: string,
): Promise<PublishedContentResult> {
  const entry = findEditableContent(section, slug);
  const [published, storedDraft] = await Promise.all([
    readPublishedContent(entry),
    readStoredDraft(entry),
  ]);

  if (!storedDraft) throw new ContentDraftNotFoundError();
  if (storedDraft.version !== expectedDraftVersion) {
    throw new ContentEditConflictError('The saved draft changed in another editor. Reload it.');
  }
  if (
    published.version !== expectedPublishedVersion ||
    storedDraft.record.baseVersion !== published.version
  ) {
    throw new ContentEditConflictError(
      'The published lesson changed since this draft began. Restore or merge against the latest version.',
    );
  }

  validateEditableContentSource(entry, storedDraft.record.source);
  const commitMessage =
    message?.trim().slice(0, 160) ||
    `content(${entry.section}): publish ${getContentSlug(entry)} from CMS`;

  if (getContentPersistenceMode() === 'filesystem') {
    await createLocalRevision(entry, published, actor, commitMessage);
  }

  const saved = await writePublishedContent(
    entry,
    storedDraft.record.source,
    published.version,
    actor,
    commitMessage,
  );
  let draftDiscarded = true;
  try {
    await discardContentDraft(section, slug, storedDraft.version);
  } catch (error) {
    draftDiscarded = false;
    console.error('Published content but could not remove its CMS draft:', error);
  }

  return {
    ...saved,
    source: normalizeSource(storedDraft.record.source),
    publishedAt: new Date().toISOString(),
    draftDiscarded,
  };
}

export async function listContentRevisions(
  section: string,
  slug: string,
): Promise<ContentRevisionSummary[]> {
  const entry = findEditableContent(section, slug);

  if (getContentPersistenceMode() === 'github') {
    const response = await getOctokit().repos.listCommits({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: repositoryContentPath(entry),
      sha: GITHUB_BRANCH,
      per_page: 25,
    });
    return response.data.map((commit) => ({
      id: commit.sha,
      version: commit.sha,
      createdAt: commit.commit.author?.date ?? new Date(0).toISOString(),
      actor: commit.commit.author?.name ?? commit.author?.login ?? 'Unknown author',
      message: commit.commit.message.split('\n')[0],
      url: commit.html_url,
    }));
  }

  try {
    const directory = filesystemRevisionDirectory(entry);
    const files = (await fs.readdir(directory)).filter((file) => file.endsWith('.json'));
    const revisions = await Promise.all(
      files.map(async (file) => {
        const parsed = StoredRevisionSchema.safeParse(
          JSON.parse(await fs.readFile(path.join(directory, file), 'utf8')),
        );
        return parsed.success && parsed.data.entryId === entry.id ? parsed.data : null;
      }),
    );
    return revisions
      .filter((revision): revision is StoredContentRevision => Boolean(revision))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(({ id, version, createdAt, actor, message }) => ({
        id,
        version,
        createdAt,
        actor,
        message,
      }));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  }
}

async function readContentRevision(entry: ContentNode, revisionId: string): Promise<string> {
  if (getContentPersistenceMode() === 'github') {
    if (!/^[a-f0-9]{7,64}$/i.test(revisionId)) throw new ContentRevisionNotFoundError();
    const file = await getGithubFile(repositoryContentPath(entry), revisionId);
    if (!file) throw new ContentRevisionNotFoundError();
    return file.source;
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(revisionId)) throw new ContentRevisionNotFoundError();
  try {
    const parsed = StoredRevisionSchema.safeParse(
      JSON.parse(
        await fs.readFile(
          path.join(filesystemRevisionDirectory(entry), `${revisionId}.json`),
          'utf8',
        ),
      ),
    );
    if (!parsed.success || parsed.data.entryId !== entry.id) {
      throw new ContentRevisionNotFoundError();
    }
    return parsed.data.source;
  } catch (error) {
    if (error instanceof ContentRevisionNotFoundError) throw error;
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new ContentRevisionNotFoundError();
    }
    throw error;
  }
}

export async function restoreContentRevisionToDraft(
  section: string,
  slug: string,
  revisionId: string,
  expectedDraftVersion: string | null,
  actor: ContentActor,
): Promise<SavedContentDraft> {
  const entry = findEditableContent(section, slug);
  const [source, published] = await Promise.all([
    readContentRevision(entry, revisionId),
    readPublishedContent(entry),
  ]);
  return persistDraft(
    entry,
    source,
    published.version,
    actor,
    expectedDraftVersion,
    true,
  );
}

export async function listContentDraftCoordinates(): Promise<Set<string>> {
  if (getContentPersistenceMode() === 'github') {
    const octokit = getOctokit();
    let draftRef;
    try {
      draftRef = await octokit.git.getRef({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        ref: `heads/${getCmsDraftBranch()}`,
      });
    } catch (error) {
      if (isHttpStatus(error, 404)) return new Set();
      throw error;
    }
    const commit = await octokit.git.getCommit({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      commit_sha: draftRef.data.object.sha,
    });
    const tree = await octokit.git.getTree({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      tree_sha: commit.data.tree.sha,
      recursive: 'true',
    });
    const coordinates = new Set<string>();
    for (const item of tree.data.tree) {
      const match = item.path?.match(/^\.content-cms\/drafts\/([^/]+)\/([^/]+)\.json$/);
      if (match) coordinates.add(`${match[1]}/${match[2]}`);
    }
    return coordinates;
  }

  const root = path.join(process.cwd(), CMS_DIRECTORY, 'drafts');
  const coordinates = new Set<string>();
  try {
    for (const section of await fs.readdir(root, { withFileTypes: true })) {
      if (!section.isDirectory()) continue;
      for (const file of await fs.readdir(path.join(root, section.name), { withFileTypes: true })) {
        if (file.isFile() && file.name.endsWith('.json')) {
          coordinates.add(`${section.name}/${file.name.slice(0, -5)}`);
        }
      }
    }
    return coordinates;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return coordinates;
    throw error;
  }
}
