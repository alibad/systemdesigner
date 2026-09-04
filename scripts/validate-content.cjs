#!/usr/bin/env node
/**
 * Local content integrity gate, paired with validate-content-registry.cjs.
 *
 * Catches the silent-failure classes the audit flagged:
 *   1. Quiz JSON with no validation — correctAnswer out of range, missing explanation, etc.
 *   2. Malformed challenge rubrics (bad kind, out-of-range threshold, empty criteria).
 *   3. A .mdoc body that references a missing rubric, quiz, content asset, or interactive block.
 *   4. Registry-backed Markdoc entries with missing, duplicate, or mismatched bodies.
 *   5. Content bodies that drift from the shared instructional or tool opening structure.
 *   6. Quiz parity drift: one canonical quiz per lesson, plus explicitly referenced course checkpoints.
 *
 * Plain Node with the repository's TypeScript dependency for loading the content registry.
 */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const Markdoc = require('@markdoc/markdoc');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const err = (msg) => errors.push(msg);

// ---------------------------------------------------------------------------
// 1. Quiz bank
// ---------------------------------------------------------------------------
const quizBankPath = path.join(ROOT, 'lib', 'quiz-bank', 'all-quizzes.json');
let quizIds = new Set();
if (fs.existsSync(quizBankPath)) {
  let bank;
  try {
    bank = JSON.parse(fs.readFileSync(quizBankPath, 'utf8'));
  } catch (e) {
    err(`quiz-bank: all-quizzes.json is not valid JSON — ${e.message}`);
    bank = null;
  }
  if (bank && typeof bank === 'object') {
    for (const [id, quiz] of Object.entries(bank)) {
      quizIds.add(id);
      if (!quiz || typeof quiz !== 'object') {
        err(`quiz "${id}": not an object`);
        continue;
      }
      if (!quiz.title) err(`quiz "${id}": missing title`);
      if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
        err(`quiz "${id}": must have a non-empty questions array`);
        continue;
      }
      quiz.questions.forEach((q, i) => {
        const where = `quiz "${id}" Q${i + 1}`;
        if (!q || typeof q !== 'object') return err(`${where}: not an object`);
        if (!q.question) err(`${where}: missing question text`);
        if (!Array.isArray(q.options) || q.options.length < 2) err(`${where}: needs at least 2 options`);
        if (typeof q.correctAnswer !== 'number' || !Number.isInteger(q.correctAnswer)) {
          err(`${where}: correctAnswer must be an integer index`);
        } else if (Array.isArray(q.options) && (q.correctAnswer < 0 || q.correctAnswer >= q.options.length)) {
          err(`${where}: correctAnswer ${q.correctAnswer} is out of range (0..${q.options.length - 1})`);
        }
        if (!q.explanation) err(`${where}: missing explanation`);
      });
    }
  }
} else {
  console.warn('⚠️  quiz-bank/all-quizzes.json not found — skipping quiz validation');
}

// ---------------------------------------------------------------------------
// 2. Challenge rubrics
// ---------------------------------------------------------------------------
const rubricsDir = path.join(ROOT, 'lib', 'rubrics');
const rubricIds = new Set();
const VALID_KINDS = ['design', 'capacity', 'tradeoff', 'staged'];
let rubricIndexSrc = '';
const rubricIndexPath = path.join(rubricsDir, 'index.ts');
if (fs.existsSync(rubricIndexPath)) rubricIndexSrc = fs.readFileSync(rubricIndexPath, 'utf8');

if (fs.existsSync(rubricsDir)) {
  for (const file of fs.readdirSync(rubricsDir)) {
    if (!file.endsWith('.json')) continue;
    const id = file.replace(/\.json$/, '');
    rubricIds.add(id);
    let r;
    try {
      r = JSON.parse(fs.readFileSync(path.join(rubricsDir, file), 'utf8'));
    } catch (e) {
      err(`rubric ${file}: invalid JSON — ${e.message}`);
      continue;
    }
    if (r.challengeId !== id) err(`rubric ${file}: challengeId "${r.challengeId}" must match filename "${id}"`);
    if (!VALID_KINDS.includes(r.kind)) err(`rubric ${file}: kind "${r.kind}" must be one of ${VALID_KINDS.join(', ')}`);
    if (typeof r.passThreshold !== 'number' || r.passThreshold < 0 || r.passThreshold > 1) {
      err(`rubric ${file}: passThreshold must be a number in [0,1]`);
    }
    if (typeof r.xpWeight !== 'number' || r.xpWeight <= 0) err(`rubric ${file}: xpWeight must be a positive number`);

    if (r.kind === 'design' || r.kind === 'staged') {
      if (!Array.isArray(r.criteria) || r.criteria.length === 0) err(`rubric ${file}: design rubric needs a non-empty criteria array`);
    } else if (r.kind === 'capacity') {
      if (!Array.isArray(r.bands) || r.bands.length === 0) err(`rubric ${file}: capacity rubric needs a non-empty bands array`);
    } else if (r.kind === 'tradeoff') {
      if (!Array.isArray(r.options) || r.options.length === 0) err(`rubric ${file}: tradeoff rubric needs a non-empty options array`);
      else if (!r.options.some((o) => o.accepted)) err(`rubric ${file}: tradeoff rubric must have at least one accepted option`);
    }

    // Must be registered in the server-only registry, or /api/grade will 404 it.
    if (rubricIndexSrc && !rubricIndexSrc.includes(`'${id}'`)) {
      err(`rubric ${file}: "${id}" is not registered in lib/rubrics/index.ts`);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Markdoc content — registry bodies and referenced resources must exist
// ---------------------------------------------------------------------------
const entriesDir = path.join(ROOT, 'content', 'entries');
const legacyLessonsDir = path.join(ROOT, 'content', 'lessons');
const registryPath = path.join(ROOT, 'lib', 'content-registry.ts');
const markdocConfigPath = path.join(ROOT, 'markdoc', 'config.ts');
const contentBlockRegistryPath = path.join(
  ROOT,
  'components',
  'content-blocks',
  'registry.generated.ts'
);
const ASSET_DIRECTORIES = new Set(['code', 'quiz', 'data']);

function walkMdoc(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkMdoc(full));
    else if (entry.isFile() && entry.name.endsWith('.mdoc')) out.push(full);
  }
  return out;
}

function discoverMdocBodies() {
  return walkMdoc(entriesDir)
    .filter((file) => path.basename(file) === 'index.mdoc')
    .sort();
}

function rejectLegacyMdocBodies() {
  if (!fs.existsSync(legacyLessonsDir)) return;

  let legacyBodies = [];
  try {
    if (fs.statSync(legacyLessonsDir).isDirectory()) {
      legacyBodies = walkMdoc(legacyLessonsDir);
    }
  } catch (_e) {
    // The existence check is authoritative; the path must be removed either way.
  }

  if (legacyBodies.length === 0) {
    err(
      `content ${path.relative(ROOT, legacyLessonsDir)}: legacy content path must not exist`
    );
    return;
  }

  for (const file of legacyBodies) {
    err(
      `content ${path.relative(ROOT, file)}: legacy body must be moved to ` +
        'content/entries/<section>/<slug>/index.mdoc'
    );
  }
}

function parseFrontmatter(src) {
  const match = src.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\s*\r?\n|\s*$)/);
  if (!match) return { exists: false, data: {}, body: src };

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) data[key] = value;
  }
  return { exists: true, data, body: src.slice(match[0].length) };
}

function loadContentRegistry() {
  if (!fs.existsSync(registryPath)) {
    err(`content registry: ${path.relative(ROOT, registryPath)} does not exist`);
    return [];
  }

  try {
    const ts = require('typescript');
    const source = fs.readFileSync(registryPath, 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
      fileName: registryPath,
    });
    const registryModule = new Module(registryPath, module);
    registryModule.filename = registryPath;
    registryModule.paths = Module._nodeModulePaths(path.dirname(registryPath));
    registryModule._compile(outputText, registryPath);
    if (!Array.isArray(registryModule.exports.CONTENT_REGISTRY)) {
      err('content registry: CONTENT_REGISTRY export is missing or not an array');
      return [];
    }
    return registryModule.exports.CONTENT_REGISTRY;
  } catch (e) {
    err(`content registry: could not load ${path.relative(ROOT, registryPath)} — ${e.message}`);
    return [];
  }
}

function loadMarkdocConfig() {
  if (!fs.existsSync(markdocConfigPath)) {
    err(`Markdoc config: ${path.relative(ROOT, markdocConfigPath)} does not exist`);
    return null;
  }

  try {
    const ts = require('typescript');
    const source = fs.readFileSync(markdocConfigPath, 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
      fileName: markdocConfigPath,
    });
    const configModule = new Module(markdocConfigPath, module);
    configModule.filename = markdocConfigPath;
    configModule.paths = Module._nodeModulePaths(path.dirname(markdocConfigPath));
    configModule._compile(outputText, markdocConfigPath);
    if (!configModule.exports.config) {
      err('Markdoc config: config export is missing');
      return null;
    }
    return configModule.exports.config;
  } catch (e) {
    err(
      `Markdoc config: could not load ${path.relative(ROOT, markdocConfigPath)} — ${e.message}`
    );
    return null;
  }
}

function validateMarkdocSchema(file, body, config) {
  if (!config) return;
  const rel = path.relative(ROOT, file);
  let issues;
  try {
    issues = Markdoc.validate(Markdoc.parse(body), config).filter(
      (issue) => issue.error.level === 'error' || issue.error.level === 'critical'
    );
  } catch (e) {
    err(`content ${rel}: Markdoc parse failed — ${e.message}`);
    return;
  }

  for (const issue of issues) {
    const line = issue.location?.start?.line;
    err(
      `content ${rel}${line ? `:${line}` : ''}: Markdoc ${issue.error.message}`
    );
  }
}

function loadContentBlockIds() {
  if (!fs.existsSync(contentBlockRegistryPath)) {
    err(
      `interactive blocks: ${path.relative(ROOT, contentBlockRegistryPath)} does not exist; ` +
        'run node scripts/generate-content-block-registry.cjs'
    );
    return new Set();
  }

  const source = fs.readFileSync(contentBlockRegistryPath, 'utf8');
  const list = source.match(
    /export\s+const\s+contentBlockIds\s*:[^=]+?=\s*\[([\s\S]*?)\];/
  );
  if (!list) {
    err(
      `interactive blocks: could not read contentBlockIds from ` +
        path.relative(ROOT, contentBlockRegistryPath)
    );
    return new Set();
  }

  const ids = new Set();
  const stringLiteral = /"((?:\\.|[^"\\])*)"/g;
  let match;
  while ((match = stringLiteral.exec(list[1]))) {
    try {
      ids.add(JSON.parse(`"${match[1]}"`));
    } catch (e) {
      err(`interactive blocks: invalid generated id "${match[1]}" — ${e.message}`);
    }
  }
  return ids;
}

function isFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch (_e) {
    return false;
  }
}

function isContainedPath(root, candidate) {
  const relative = path.relative(root, candidate);
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function resolveContentAsset(reference) {
  if (!reference.startsWith('/api/content/')) {
    return { error: 'must start with /api/content/' };
  }

  const assetPath = reference.slice('/api/content/'.length);
  const segments = assetPath.split('/');
  if (
    segments.length < 4 ||
    !ASSET_DIRECTORIES.has(segments[2]) ||
    segments.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        segment.includes('\\') ||
        segment.includes('\0')
    )
  ) {
    return {
      error: 'must match /api/content/<section>/<slug>/<code|quiz|data>/<file>',
    };
  }

  const root = path.join(ROOT, 'content', 'entries');
  const lesson = path.resolve(root, segments[0], segments[1]);
  const candidate = path.resolve(root, ...segments);
  if (
    isContainedPath(root, lesson) &&
    isContainedPath(lesson, candidate) &&
    isFile(candidate)
  ) {
    try {
      const realRoot = fs.realpathSync(root);
      const realLesson = fs.realpathSync(lesson);
      const realCandidate = fs.realpathSync(candidate);
      if (
        isContainedPath(realRoot, realLesson) &&
        isContainedPath(realLesson, realCandidate) &&
        isFile(realCandidate)
      ) {
        return { file: realCandidate };
      }
    } catch (_e) {
      // Missing or unreadable assets are reported through the canonical error below.
    }
  }
  return { error: 'does not exist in content/entries/' };
}

function validateRegistryBodies(registry) {
  for (const node of registry) {
    if (!node || node.status !== 'active') continue;

    const slug =
      typeof node.path === 'string'
        ? node.path.split('/').filter(Boolean).pop()
        : undefined;
    const where = `registry entry "${node.id || '(missing id)'}"`;
    if (!node.section || !slug) {
      err(`${where}: cannot determine body path without section and path`);
      continue;
    }

    const canonical = path.join(entriesDir, node.section, slug, 'index.mdoc');
    if (!isFile(canonical)) {
      err(
        `${where}: needs exactly one canonical body at ${path.relative(ROOT, canonical)}`
      );
      continue;
    }

    const rel = path.relative(ROOT, canonical);
    const frontmatter = parseFrontmatter(fs.readFileSync(canonical, 'utf8')).data;
    if (frontmatter.registryId !== node.id) {
      err(
        `${where}: body ${rel} must declare registryId "${node.id}"; ` +
          `found "${frontmatter.registryId || ''}"`
      );
    }
    for (const [field, expected] of [
      ['section', node.section],
      ['slug', slug],
    ]) {
      if (frontmatter[field] !== undefined && frontmatter[field] !== expected) {
        err(
          `${where}: body ${rel} has frontmatter ${field} "${frontmatter[field]}"; ` +
            `expected "${expected}"`
        );
      }
    }
  }
}

const challengeTagRe = /\{%\s*(?:design-challenge|capacity-challenge|tradeoff)\b[\s\S]*?challengeId="([^"]+)"/g;
const quizTagRe = /\{%\s*quiz\b([\s\S]*?)\/%\}/g;
const assetTagRe = /\{%\s*(code-block|quiz|interactive-block)\b([\s\S]*?)\/%\}/g;
const interactiveBlockTagRe = /\{%\s*interactive-block\b([\s\S]*?)\/%\}/g;
const accordionTagRe = /\{%\s*accordion(?!-)\b([\s\S]*?)%\}/g;
const accordionItemTagRe = /\{%\s*accordion-item\b([\s\S]*?)%\}/g;
const attrRe = /(\w+)="([^"]+)"/g;
const TOOL_CONTEXT_REQUIRED_ATTRIBUTES = [
  'title',
  'question',
  'definition',
  'inputs',
  'outcome',
  'experiment',
];

function parseAttrs(source) {
  const attrs = {};
  let match;
  attrRe.lastIndex = 0;
  while ((match = attrRe.exec(source))) attrs[match[1]] = match[2];
  return attrs;
}

function validateBodyTheme(file, src, frontmatter) {
  const rel = path.relative(ROOT, file);
  const where = `content ${rel}`;
  const section = path.relative(entriesDir, file).split(path.sep)[0];
  const body = (frontmatter.body || src).trimStart();
  const firstTag = body.match(/^\{%\s*([\w-]+)\b([\s\S]*?)%\}/);
  const proseWithoutFences = body
    .replace(/```[\s\S]*?```/g, '')
    .replace(/~~~[\s\S]*?~~~/g, '');

  if (/^#\s+/m.test(proseWithoutFences)) {
    err(`${where}: body must not define an H1; the shared content shell owns the page title`);
  }

  if (!firstTag) {
    err(`${where}: body must start with the shared content opening`);
    return;
  }

  if (section === 'tools') {
    if (firstTag[1] !== 'tool-context') {
      err(`${where}: tool body must start with tool-context`);
      return;
    }

    const attrs = parseAttrs(firstTag[2]);
    const missing = TOOL_CONTEXT_REQUIRED_ATTRIBUTES.filter((attribute) => !attrs[attribute]);
    if (missing.length > 0) {
      err(`${where}: opening tool-context is missing ${missing.join(', ')}`);
    }
    return;
  }

  const openingAttrs = parseAttrs(firstTag[2]);
  if (firstTag[1] !== 'section-card' || openingAttrs.tone !== 'intro') {
    err(`${where}: instructional body must start with section-card tone="intro"`);
    return;
  }

  const introEnd = body.indexOf('{% /section-card %}');
  if (introEnd === -1) {
    err(`${where}: opening intro section-card is not closed`);
    return;
  }

  const intro = body.slice(0, introEnd);
  const firstHeading = intro.match(/^##\s+(.+)$/m);
  if (!firstHeading || !/^What\s+(?:is|are)\b.*\?$/.test(firstHeading[1].trim())) {
    err(`${where}: intro must begin with a level-two "What is/are ...?" heading`);
  }

}

function validateQuestionList(where, questions) {
  if (!Array.isArray(questions) || questions.length < 4) {
    err(`${where}: must contain at least four questions`);
    return;
  }
  questions.forEach((q, i) => {
    const label = `${where} Q${i + 1}`;
    if (!q || typeof q !== 'object') return err(`${label}: not an object`);
    if (!q.question) err(`${label}: missing question text`);
    if (!Array.isArray(q.options) || q.options.length < 2) err(`${label}: needs at least 2 options`);
    if (typeof q.correctAnswer !== 'number' || !Number.isInteger(q.correctAnswer)) {
      err(`${label}: correctAnswer must be an integer index`);
    } else if (Array.isArray(q.options) && (q.correctAnswer < 0 || q.correctAnswer >= q.options.length)) {
      err(`${label}: correctAnswer ${q.correctAnswer} is out of range (0..${q.options.length - 1})`);
    }
    if (!q.explanation) err(`${label}: missing explanation`);
  });
}

const mdocBodies = discoverMdocBodies();
// Course checkpoints are supplemental assessments, never replacements for lesson quizzes.
const checkpointFiles = new Set();
const learningSessionsPath = path.join(ROOT, 'content/learning/sessions.json');
if (fs.existsSync(learningSessionsPath)) {
  try {
    const sessions = JSON.parse(fs.readFileSync(learningSessionsPath, 'utf8'));
    for (const step of Object.values(sessions)) {
      if (!step.isCheckpoint || step.kind !== 'quiz') continue;
      const reference = step.questionsFile;
      if (typeof reference !== 'string' || !/^\/api\/content\/[\w-]+\/[\w-]+\/quiz\/[\w-]+\.json$/.test(reference)) {
        err(`learning checkpoint ${step.id}: invalid quiz asset reference`); continue;
      }
      if (checkpointFiles.has(reference)) err(`learning checkpoint ${step.id}: reused checkpoint asset`);
      checkpointFiles.add(reference);
      try {
        const asset = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/entries', reference.slice('/api/content/'.length)), 'utf8'));
        validateQuestionList(`learning checkpoint ${step.id}`, asset.questions || asset);
      } catch (error) { err(`learning checkpoint ${step.id}: ${error.message}`); }
    }
  } catch (error) { err(`learning sessions: ${error.message}`); }
}
const contentRegistry = loadContentRegistry();
const contentRegistryById = new Map(
  contentRegistry
    .filter((entry) => entry && typeof entry.id === 'string')
    .map((entry) => [entry.id, entry])
);
const markdocConfig = loadMarkdocConfig();
const contentBlockIds = loadContentBlockIds();
rejectLegacyMdocBodies();
validateRegistryBodies(contentRegistry);

for (const file of mdocBodies) {
  const rel = path.relative(ROOT, file);
  const src = fs.readFileSync(file, 'utf8');
  const where = `content ${rel}`;

  // Registry metadata is authoritative; the body only needs a stable registry binding.
  const frontmatter = parseFrontmatter(src);
  if (!frontmatter.exists || !frontmatter.data.registryId) {
    err(`${where}: missing frontmatter "registryId"`);
  }
  const lessonSegments = path.relative(entriesDir, file).split(path.sep);
  const [lessonSection, lessonSlug] = lessonSegments;
  const quizDirectory = path.join(path.dirname(file), 'quiz');
  const quizFiles = fs.existsSync(quizDirectory)
    ? fs.readdirSync(quizDirectory).filter((name) => name.endsWith('.json') && !checkpointFiles.has(`/api/content/${lessonSection}/${lessonSlug}/quiz/${name}`)).sort()
    : [];
  const lessonQuizTags = [...src.matchAll(/\{%\s*quiz\b([\s\S]*?)\/%\}/g)];
  const registryEntry = contentRegistryById.get(frontmatter.data.registryId);

  if (quizFiles.length !== 1) {
    err(`${where}: needs exactly one canonical lesson quiz JSON file; found ${quizFiles.length}`);
  }
  if (lessonQuizTags.length !== 1) {
    err(`${where}: needs exactly one quiz tag; found ${lessonQuizTags.length}`);
  }
  if (registryEntry && registryEntry.hasQuiz !== true) {
    err(`${where}: registry hasQuiz must be true`);
  }
  if (quizFiles.length === 1 && lessonQuizTags.length === 1) {
    const quizAttributes = parseAttrs(lessonQuizTags[0][1]);
    const expectedQuizReference =
      `/api/content/${lessonSection}/${lessonSlug}/quiz/${quizFiles[0]}`;
    if (quizAttributes.questionsFile !== expectedQuizReference) {
      err(
        `${where}: quiz questionsFile must reference its sole co-located quiz ` +
          `"${expectedQuizReference}"`
      );
    }
  }
  validateMarkdocSchema(file, frontmatter.body, markdocConfig);
  validateBodyTheme(file, src, frontmatter);

  if (rel.startsWith(`content${path.sep}entries${path.sep}practice${path.sep}`)) {
    const accordions = [...src.matchAll(accordionTagRe)];
    const items = [...src.matchAll(accordionItemTagRe)];
    if (accordions.length !== 1) {
      err(`${where}: practice body needs exactly one shared accordion; found ${accordions.length}`);
    } else if (parseAttrs(accordions[0][1]).defaultOpen !== 'clarifying') {
      err(`${where}: practice accordion defaultOpen must be "clarifying"`);
    }
    if (items.length !== 8) {
      err(`${where}: practice body needs exactly eight accordion-item sections; found ${items.length}`);
    } else if (parseAttrs(items[0][1]).id !== 'clarifying') {
      err(`${where}: first practice accordion-item id must be "clarifying"`);
    }
  }

  let m;
  challengeTagRe.lastIndex = 0;
  while ((m = challengeTagRe.exec(src))) {
    const id = m[1];
    if (!rubricIds.has(id)) err(`${where}: references challengeId "${id}" with no rubric in lib/rubrics/`);
  }

  const assetResults = new Map();
  assetTagRe.lastIndex = 0;
  while ((m = assetTagRe.exec(src))) {
    const tag = m[1];
    const attrs = parseAttrs(m[2]);
    const attribute =
      tag === 'code-block' ? 'file' : tag === 'quiz' ? 'questionsFile' : 'dataFile';
    if (!attrs[attribute]) continue;

    const result = resolveContentAsset(attrs[attribute]);
    assetResults.set(attrs[attribute], result);
    if (result.error) {
      err(`${where}: ${tag} ${attribute} "${attrs[attribute]}" ${result.error}`);
    }
  }

  interactiveBlockTagRe.lastIndex = 0;
  while ((m = interactiveBlockTagRe.exec(src))) {
    const attrs = parseAttrs(m[1]);
    if (!attrs.id) {
      err(`${where}: interactive-block needs id`);
    } else if (!contentBlockIds.has(attrs.id)) {
      err(
        `${where}: interactive-block id "${attrs.id}" is not registered in ` +
          'components/content-blocks/registry.generated.ts'
      );
    }
  }

  quizTagRe.lastIndex = 0;
  while ((m = quizTagRe.exec(src))) {
    const attrs = parseAttrs(m[1]);
    if (!attrs.quizId && !attrs.questionsFile) {
      err(`${where}: quiz tag needs quizId or questionsFile`);
      continue;
    }
    if (attrs.quizId && quizIds.size && !quizIds.has(attrs.quizId)) {
      err(`${where}: references quizId "${attrs.quizId}" not in the quiz bank`);
    }
    if (attrs.questionsFile) {
      const result =
        assetResults.get(attrs.questionsFile) || resolveContentAsset(attrs.questionsFile);
      if (result.error) continue;
      try {
        const data = JSON.parse(fs.readFileSync(result.file, 'utf8'));
        validateQuestionList(`${where} questionsFile "${attrs.questionsFile}"`, data.questions || data);
      } catch (e) {
        err(`${where}: questionsFile "${attrs.questionsFile}" is not valid JSON — ${e.message}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
if (errors.length) {
  console.error(`\n❌ Content validation failed with ${errors.length} issue(s):\n`);
  for (const e of errors) console.error(`   • ${e}`);
  console.error('');
  process.exit(1);
}
console.log('✅ Content validation passed (themes, quizzes, rubrics, Markdoc bodies, assets, interactive blocks).');
