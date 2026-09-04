import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createAdminLesson,
  deleteAdminContentAsset,
  getAdminContentAssets,
  getAdminContentMetadata,
  getNewLessonOptions,
  publishAdminContentMetadata,
  readAdminContentAsset,
  upsertAdminContentAsset,
  validateAdminQuizAsset,
} from './admin-content-resources';

const projectRoot = process.cwd();
const originalPersistence = process.env.ADMIN_CONTENT_PERSISTENCE;
const temporaryRoots: string[] = [];
const actor = { uid: 'resource-admin', email: 'admin@example.com' };

function prepareWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'systemdesigner-resources-'));
  temporaryRoots.push(root);
  const lessonRoot = path.join(
    root,
    'content',
    'entries',
    'fundamentals',
    'scalability-basics',
  );
  fs.mkdirSync(path.join(lessonRoot, 'quiz'), { recursive: true });
  fs.copyFileSync(
    path.join(projectRoot, 'content', 'registry.json'),
    path.join(root, 'content', 'registry.json'),
  );
  fs.copyFileSync(
    path.join(
      projectRoot,
      'content',
      'entries',
      'fundamentals',
      'scalability-basics',
      'index.mdoc',
    ),
    path.join(lessonRoot, 'index.mdoc'),
  );
  fs.copyFileSync(
    path.join(
      projectRoot,
      'content',
      'entries',
      'fundamentals',
      'scalability-basics',
      'quiz',
      'scalability-basics.json',
    ),
    path.join(lessonRoot, 'quiz', 'scalability-basics.json'),
  );
  process.env.ADMIN_CONTENT_PERSISTENCE = 'filesystem';
  process.chdir(root);
  return root;
}

function sampleQuestions() {
  return Array.from({ length: 4 }, (_, index) => ({
    question: `Which design statement correctly describes sample concept ${index + 1}?`,
    options: [
      `Correct design statement ${index + 1}`,
      `Incorrect shortcut ${index + 1}`,
      `Unrelated implementation detail ${index + 1}`,
      `Unsafe production assumption ${index + 1}`,
    ],
    correctAnswer: 0,
    explanation: `The correct statement preserves the workload context and trade-offs for concept ${
      index + 1
    }.`,
  }));
}

afterEach(() => {
  process.chdir(projectRoot);
  if (originalPersistence === undefined) delete process.env.ADMIN_CONTENT_PERSISTENCE;
  else process.env.ADMIN_CONTENT_PERSISTENCE = originalPersistence;
  while (temporaryRoots.length) {
    fs.rmSync(temporaryRoots.pop()!, { recursive: true, force: true });
  }
});

describe('admin-managed registry metadata and lesson resources', () => {
  it('accepts every existing co-located quiz in the asset editor', () => {
    const quizFiles: string[] = [];
    const walk = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(target);
        else if (target.includes(`${path.sep}quiz${path.sep}`) && target.endsWith('.json')) {
          quizFiles.push(target);
        }
      }
    };
    walk(path.join(projectRoot, 'content', 'entries'));

    const sessions = JSON.parse(fs.readFileSync(path.join(projectRoot, 'content/learning/sessions.json'), 'utf8')) as Record<string, { isCheckpoint?: boolean; questionsFile?: string }>;
    const checkpoints = Object.values(sessions).filter(step => step.isCheckpoint && step.questionsFile);
    const registry = JSON.parse(fs.readFileSync(path.join(projectRoot, 'content/registry.json'), 'utf8'));
    expect(quizFiles).toHaveLength(registry.length + checkpoints.length);
    for (const file of quizFiles) {
      expect(() => validateAdminQuizAsset(JSON.parse(fs.readFileSync(file, 'utf8'))), file).not
        .toThrow();
    }
  });

  it('publishes validated metadata while protecting registry identity', async () => {
    const root = prepareWorkspace();
    const initial = await getAdminContentMetadata('fundamentals', 'scalability-basics');
    const updated = await publishAdminContentMetadata(
      'fundamentals',
      'scalability-basics',
      {
        ...initial.metadata,
        title: 'Scalability Basics Updated',
        tags: [...initial.metadata.tags, 'cms-managed'],
      },
      initial.version,
      actor,
      'Update scalability metadata',
    );

    expect(updated.metadata.title).toBe('Scalability Basics Updated');
    const registry = JSON.parse(
      fs.readFileSync(path.join(root, 'content', 'registry.json'), 'utf8'),
    ) as Array<{ id: string; title: string; tags: string[] }>;
    expect(registry.find((entry) => entry.id === 'scalability-basics')).toEqual(
      expect.objectContaining({
        title: 'Scalability Basics Updated',
        tags: expect.arrayContaining(['cms-managed']),
      }),
    );

    await expect(
      publishAdminContentMetadata(
        'fundamentals',
        'scalability-basics',
        { ...updated.metadata, id: 'renamed-lesson' },
        updated.version,
        actor,
      ),
    ).rejects.toThrow(/cannot be renamed/i);
  });

  it('lists, replaces, adds, reads, and safely removes lesson assets', async () => {
    prepareWorkspace();
    const initial = await getAdminContentAssets('fundamentals', 'scalability-basics');
    expect(initial.assets).toContainEqual(
      expect.objectContaining({
        kind: 'quiz',
        fileName: 'scalability-basics.json',
      }),
    );

    const quizDocument = await readAdminContentAsset(
      'fundamentals',
      'scalability-basics',
      'quiz',
      'scalability-basics.json',
    );
    const quiz = JSON.parse(quizDocument.content);
    quiz.questions[0].explanation =
      'This updated explanation is long enough to remain a useful teaching note.';
    const replaced = await upsertAdminContentAsset(
      'fundamentals',
      'scalability-basics',
      'quiz',
      'scalability-basics.json',
      JSON.stringify(quiz, null, 2),
      initial.version,
      actor,
    );
    expect(replaced.assets.filter((asset) => asset.kind === 'quiz')).toHaveLength(1);

    const withData = await upsertAdminContentAsset(
      'fundamentals',
      'scalability-basics',
      'data',
      'sample.json',
      JSON.stringify({ requestsPerSecond: 1000 }, null, 2),
      replaced.version,
      actor,
    );
    expect(withData.assets).toContainEqual(
      expect.objectContaining({ kind: 'data', fileName: 'sample.json' }),
    );

    const removed = await deleteAdminContentAsset(
      'fundamentals',
      'scalability-basics',
      'data',
      'sample.json',
      withData.version,
      actor,
    );
    expect(removed.assets).not.toContainEqual(
      expect.objectContaining({ kind: 'data', fileName: 'sample.json' }),
    );
    await expect(
      deleteAdminContentAsset(
        'fundamentals',
        'scalability-basics',
        'quiz',
        'scalability-basics.json',
        removed.version,
        actor,
      ),
    ).rejects.toThrow(/cannot be deleted/i);
  });

  it('creates a hidden lesson with registry metadata, Markdoc body, and four-question quiz', async () => {
    const root = prepareWorkspace();
    const options = await getNewLessonOptions();
    const slug = 'cms-created-lesson';
    const result = await createAdminLesson(
      {
        slug,
        metadata: {
          id: slug,
          title: 'CMS Created Lesson',
          path: `/fundamentals/${slug}`,
          section: 'fundamentals',
          level: 'beginner',
          duration: '20 min',
          hasQuiz: true,
          hasScenarios: false,
          hasCalculator: false,
          renderMode: 'mdoc',
          prerequisites: [],
          related: ['scalability-basics'],
          tags: ['cms', 'authoring', 'lesson'],
          category: 'getting-started',
          seo: {
            metaDescription:
              'Learn how a complete lesson can be created safely through the administrative content workflow.',
            keywords: ['CMS lesson authoring', 'content workflow'],
            priority: 0.6,
            changeFreq: 'monthly',
            lastModified: new Date().toISOString(),
          },
          status: 'draft',
        },
        quizFileName: `${slug}-check.json`,
        quiz: {
          title: 'CMS Created Lesson Check',
          section: 'fundamentals',
          difficulty: 'beginner',
          duration: '8 min',
          questions: sampleQuestions(),
        },
        assets: [],
        expectedVersion: options.version,
      },
      actor,
    );

    expect(result.entry.status).toBe('draft');
    const lessonRoot = path.join(root, 'content', 'entries', 'fundamentals', slug);
    expect(fs.existsSync(path.join(lessonRoot, 'index.mdoc'))).toBe(true);
    expect(fs.existsSync(path.join(lessonRoot, 'quiz', `${slug}-check.json`))).toBe(true);
    const source = fs.readFileSync(path.join(lessonRoot, 'index.mdoc'), 'utf8');
    expect(source.match(/^section: fundamentals$/gm)).toHaveLength(1);
    const registry = JSON.parse(
      fs.readFileSync(path.join(root, 'content', 'registry.json'), 'utf8'),
    ) as Array<{ id: string; status: string }>;
    expect(registry).toContainEqual(expect.objectContaining({ id: slug, status: 'draft' }));
  });
});
