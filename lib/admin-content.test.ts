import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ContentEntryNotFoundError,
  ContentPersistenceConfigError,
  ContentValidationError,
  findEditableContent,
  getContentStudioDocument,
  getCmsDraftBranch,
  getContentPersistenceMode,
  listContentRevisions,
  listEditableContent,
  publishContentDraft,
  restoreContentRevisionToDraft,
  saveContentDraft,
  validateEditableContentSource,
} from './admin-content';
import { lessonFilePath } from './lessons';

const originalPersistence = process.env.ADMIN_CONTENT_PERSISTENCE;
const originalVercel = process.env.VERCEL;
const originalDraftBranch = process.env.GITHUB_CMS_DRAFT_BRANCH;
const projectRoot = process.cwd();

afterEach(() => {
  if (originalPersistence === undefined) delete process.env.ADMIN_CONTENT_PERSISTENCE;
  else process.env.ADMIN_CONTENT_PERSISTENCE = originalPersistence;

  if (originalVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = originalVercel;

  if (originalDraftBranch === undefined) delete process.env.GITHUB_CMS_DRAFT_BRANCH;
  else process.env.GITHUB_CMS_DRAFT_BRANCH = originalDraftBranch;
});

describe('admin content editing', () => {
  it('lists registry-backed Markdoc entries with stable edit coordinates', () => {
    const entries = listEditableContent();
    expect(entries.length).toBeGreaterThan(400);
    expect(entries).toContainEqual(
      expect.objectContaining({
        id: 'scalability-basics',
        section: 'fundamentals',
        slug: 'scalability-basics',
      }),
    );
  });

  it('validates an existing lesson with the production Markdoc schema', () => {
    const entry = findEditableContent('fundamentals', 'scalability-basics');
    const source = fs.readFileSync(lessonFilePath(entry.section, 'scalability-basics'), 'utf8');

    expect(validateEditableContentSource(entry, source).frontmatter.registryId).toBe(
      'scalability-basics',
    );
  });

  it('rejects source whose registry ID points at another lesson', () => {
    const entry = findEditableContent('fundamentals', 'scalability-basics');
    const source = fs
      .readFileSync(lessonFilePath(entry.section, 'scalability-basics'), 'utf8')
      .replace('registryId: scalability-basics', 'registryId: another-lesson');

    expect(() => validateEditableContentSource(entry, source)).toThrow(ContentValidationError);
  });

  it('rejects empty source and source without its registry identity', () => {
    const entry = findEditableContent('fundamentals', 'scalability-basics');

    expect(() => validateEditableContentSource(entry, '   ')).toThrow(ContentValidationError);
    expect(() =>
      validateEditableContentSource(
        entry,
        '---\nsection: fundamentals\nregistryId: scalability-basics\n---\n',
      ),
    ).toThrow(ContentValidationError);
    expect(() => validateEditableContentSource(entry, '## What is scalability?')).toThrow(
      ContentValidationError,
    );
  });

  it('rejects unknown Markdoc tags', () => {
    const entry = findEditableContent('fundamentals', 'scalability-basics');
    const source = `---\nregistryId: scalability-basics\n---\n\n{% unknown-admin-tag /%}\n`;

    expect(() => validateEditableContentSource(entry, source)).toThrow(ContentValidationError);
  });

  it('rejects a CMS lesson draft without its co-located quiz assessment', () => {
    const entry = findEditableContent('fundamentals', 'scalability-basics');
    const source = fs
      .readFileSync(lessonFilePath(entry.section, 'scalability-basics'), 'utf8')
      .replace(/\n\{%\s*quiz\b[\s\S]*?\/%\}\s*$/u, '\n');

    expect(() => validateEditableContentSource(entry, source)).toThrow(
      /Every lesson must contain exactly one quiz/,
    );
  });

  it('does not accept arbitrary path segments', () => {
    expect(() => findEditableContent('fundamentals', '../scalability-basics')).toThrow(
      ContentEntryNotFoundError,
    );
  });

  it('defaults to filesystem locally and GitHub on Vercel', () => {
    delete process.env.ADMIN_CONTENT_PERSISTENCE;
    delete process.env.VERCEL;
    expect(getContentPersistenceMode()).toBe('filesystem');

    process.env.VERCEL = '1';
    expect(getContentPersistenceMode()).toBe('github');
  });

  it('keeps editorial drafts off the published branch', () => {
    process.env.GITHUB_CMS_DRAFT_BRANCH = 'main';
    expect(() => getCmsDraftBranch()).toThrow(ContentPersistenceConfigError);
  });

  it('persists the local draft, publish, revision, and restore lifecycle', async () => {
    const section = 'fundamentals';
    const slug = 'scalability-basics';
    const source = fs.readFileSync(lessonFilePath(section, slug), 'utf8');
    const updatedSource = source.replace(
      '## What is Scalability?',
      '## What is Scalability?\n\nContent Studio lifecycle test marker.',
    );
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'systemdesigner-cms-'));
    const lessonPath = path.join(
      temporaryRoot,
      'content',
      'entries',
      section,
      slug,
      'index.mdoc',
    );
    const actor = { uid: 'admin-test', email: 'admin@example.com' };

    fs.mkdirSync(path.dirname(lessonPath), { recursive: true });
    fs.writeFileSync(lessonPath, source);
    process.chdir(temporaryRoot);

    try {
      const initial = await getContentStudioDocument(section, slug);
      const savedDraft = await saveContentDraft(
        section,
        slug,
        updatedSource,
        initial.published.version,
        actor,
        null,
      );
      expect(savedDraft.draft.source).toContain('Content Studio lifecycle test marker.');

      const withDraft = await getContentStudioDocument(section, slug);
      expect(withDraft.workflowState).toBe('draft');

      const published = await publishContentDraft(
        section,
        slug,
        savedDraft.draft.version,
        initial.published.version,
        actor,
        'Publish lifecycle test',
      );
      expect(published.draftDiscarded).toBe(true);
      expect(fs.readFileSync(lessonPath, 'utf8')).toContain('Content Studio lifecycle test marker.');

      const revisions = await listContentRevisions(section, slug);
      expect(revisions).toHaveLength(1);
      const restored = await restoreContentRevisionToDraft(
        section,
        slug,
        revisions[0].id,
        null,
        actor,
      );
      expect(restored.draft.source).toBe(source);
    } finally {
      process.chdir(projectRoot);
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });
});
