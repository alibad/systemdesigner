#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import Markdoc from '@markdoc/markdoc';
import { createHash } from 'node:crypto';
import { sourcePractice } from './learning-source-practice.mjs';

const check = process.argv.includes('--check');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const outline = read('content/learning/course-outline.json');
const registry = new Map(read('content/registry.json').map(entry => [entry.id, entry]));
const bank = read('lib/quiz-bank/all-quizzes.json');
const originals = [...read('content/entries/fundamentals/what-is-system-design/data/daily-design-path.json'), ...read('content/entries/fundamentals/scalability-basics/data/daily-coding-path.json')];
const coding = new Map([...originals.filter(step => step.kind === 'coding'), ...outline.codingSources.flatMap(read)].map(step => [step.id, step]));
const introSteps = new Map(originals.filter(step => step.kind === 'quiz').map(step => [step.lessonPath, step]));
const sessions = {};
const skills = [];
const revisionFor = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 12);
let stale = false;
function write(file, value) {
  const text = JSON.stringify(value, null, 2) + '\n';
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text) return;
  if (check) { console.error(`Learning catalog is stale: ${file}`); stale = true; return; }
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text);
}
function words(node) {
  if (!node) return '';
  if (node.type === 'text' || node.type === 'code') return node.attributes.content || '';
  if (node.type === 'softbreak' || node.type === 'hardbreak') return ' ';
  return (node.children || []).map(words).join('');
}
function concise(text, max = 90) {
  // A closing quote or bracket after the punctuation stays with its sentence.
  const sentences = text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+["”’)\]]*(?:\s|$)|[^.!?]+$/g) || [text];
  let result = '';
  for (const sentence of sentences) { if (result && (result + sentence).split(/\s+/).length > max) break; result += sentence; }
  return result.trim();
}
/** Intro text blocks. A paragraph that only introduces a list is merged with that list so
 * a lesson's key idea is never a dangling fragment such as “The distinction is:”. */
function blocks(container) {
  const result = [];
  for (const child of container?.children || []) {
    if (child.type === 'paragraph') result.push(words(child).replace(/\s+/g, ' ').trim());
    else if (child.type === 'list' && result.length && result.at(-1).endsWith(':')) {
      const items = child.children.map(item => words(item).replace(/\s+/g, ' ').trim().replace(/[.;:]$/, '')).filter(Boolean);
      if (items.length) result[result.length - 1] = `${result.at(-1)} ${items.join('; ')}.`;
    }
  }
  return result;
}
/** First candidate that reads as a complete thought rather than a fragment. */
const complete = candidates => candidates.find(text => text && !text.trim().endsWith(':') && text.trim().length > 40) || candidates.filter(Boolean).at(-1);
function questionsFor(step) {
  const data = step.quizId ? bank[step.quizId] : read(step.questionsFile.replace('/api/content/', 'content/entries/'));
  const questions = data?.questions || data;
  if (!Array.isArray(questions) || questions.length < 3) throw new Error(`Missing assessment: ${step.id}`);
  for (const question of questions) if (!question.question || !question.explanation || !Array.isArray(question.options) || !Number.isInteger(question.correctAnswer) || question.correctAnswer >= question.options.length) throw new Error(`Invalid assessment: ${step.id}`);
  return questions.map((question, index) => ({ ...question, id: `${step.id}:q${index}`, skillId: `skill-${step.id}`, revision: step.revision }));
}
/** Beginner-friendly foundations the learner can open before a session, from the registry graph. */
function prerequisitesFor(entry) {
  return (entry.prerequisites || []).map(id => registry.get(id)).filter(item => item && item.status === 'active').slice(0, 4).map(item => ({ title: item.title, path: item.path }));
}
function fromLesson(id) {
  const entry = registry.get(id);
  if (!entry || entry.status !== 'active') throw new Error(`Unknown lesson: ${id}`);
  if (introSteps.has(entry.path)) return { ...introSteps.get(entry.path), prerequisites: prerequisitesFor(entry) };
  const ast = Markdoc.parse(fs.readFileSync(`content/entries${entry.path}/index.mdoc`, 'utf8'));
  const nodes = [...ast.walk()];
  const intro = nodes.find(node => node.tag === 'section-card' && node.attributes.tone === 'intro');
  const heading = intro?.children.find(node => node.type === 'heading');
  const paragraphs = blocks(intro);
  const note = [...(intro?.walk() || [])].find(node => node.tag === 'callout');
  const otherParagraph = nodes.filter(node => node.type === 'paragraph').map(words).find(text => !paragraphs.includes(text) && text.length > 70);
  const quiz = nodes.find(node => node.tag === 'quiz');
  if (!intro || !heading || !paragraphs[0] || !quiz) throw new Error(`Lesson is missing an intro or quiz: ${id}`);
  const summary = concise(paragraphs[0]);
  const example = concise(complete([paragraphs[1], words(note), otherParagraph, entry.seo.metaDescription]));
  const step = {
    id: `lesson-${id}`, kind: 'quiz', title: entry.title, minutes: 6, prerequisites: prerequisitesFor(entry),
    lessonPath: entry.path, concept: words(heading), summary, example,
    exampleLabel: 'The key idea',
    takeaway: concise(complete([words(note), paragraphs[2], paragraphs[3], 'Use the full lesson’s worked examples and interactive labs to explore the trade-offs behind these questions.']), 65),
    ...(quiz.attributes.questionsFile ? { questionsFile: quiz.attributes.questionsFile } : { quizId: quiz.attributes.quizId }),
    questionCount: 4,
  };
  questionsFor(step);
  return step;
}
const courseIds = new Set();
const courses = outline.courses.map(course => {
  if (courseIds.has(course.id)) throw new Error(`Duplicate course: ${course.id}`);
  courseIds.add(course.id);
  const units = course.units.map((unit, index) => {
    const unitId = `${course.id}-${unit.id}`;
    const steps = unit.stepIds ? unit.stepIds.map(id => {
      if (!coding.has(id)) throw new Error(`Unknown coding exercise ${id}`);
      return { ...coding.get(id), preserveInputs: true };
    }) : unit.lessons.map(fromLesson);
    for (const step of steps) {
      let derivedPack;
      let exercisesFile = outline.exerciseSources?.[step.id];
      if (step.kind === 'quiz') {
        const derived = sourcePractice(step, questionsFor(step));
        step.models = derived.models;
        if (!exercisesFile) {
          exercisesFile = `/api/content${step.lessonPath}/data/daily-practice.generated.json`;
          derivedPack = derived.pack;
          write(exercisesFile.replace('/api/content/', 'content/entries/'), derived.pack);
        }
      }
      if (exercisesFile) step.exercisesFile = exercisesFile;
      const assessment = step.kind === 'coding' ? step.tests : questionsFor(step);
      const models = (step.models || []).filter(model => model.dataFile).map(model => read(model.dataFile.replace('/api/content/', 'content/entries/')));
      step.revision = revisionFor({ step, assessment, models, exercises: derivedPack || (exercisesFile ? read(exercisesFile.replace('/api/content/', 'content/entries/')) : null), ...(step.kind === 'coding' ? { starter: fs.readFileSync(step.starterFile.replace('/api/content/', 'content/entries/'), 'utf8') } : {}) });
      step.skillIds = [`skill-${step.id}`];
      skills.push({ id: step.skillIds[0], title: step.title, stepId: step.id, unitId, courseId: course.id, revision: step.revision, lessonPath: step.lessonPath });
    }
    if (!unit.stepIds) {
      const assessments = steps.map(questionsFor);
      const questions = [];
      // Cover every lesson first; small units then receive a second question per skill.
      for (let round = 0; questions.length < Math.min(8, Math.max(4, steps.length)); round++) {
        for (const quiz of assessments) { if (questions.length < Math.min(8, Math.max(4, steps.length))) questions.push(quiz[round % quiz.length]); }
      }
      const questionsFile = `/api/content${steps.at(-1).lessonPath}/quiz/path-${unitId}-checkpoint.json`;
      write(questionsFile.replace('/api/content/', 'content/entries/'), { title: `${unit.title}: checkpoint`, questions });
      steps.push({
        id: `checkpoint-${unitId}`, kind: 'quiz', isCheckpoint: true, title: `${unit.title}: checkpoint`, minutes: 7,
        lessonPath: steps.at(-1).lessonPath, concept: 'What is a unit checkpoint?',
        summary: `A checkpoint brings the unit’s ideas together. You will answer questions drawn from ${steps.map(step => step.title).join(', ')}.`,
        example: unit.description, exampleLabel: 'Your objective',
        takeaway: 'Answer every question correctly to finish the unit. You can revisit any lesson and retry as often as you need.', questionsFile,
        revision: revisionFor(questions), skillIds: steps.flatMap(step => step.skillIds),
      });
    } else steps[steps.length - 1].isCheckpoint = true;
    const placementStepIds = unit.stepIds ? steps.map(step => step.id) : [steps.at(-1).id];
    // A unit revision follows the placement assessment's own content: checkpoint questions
    // without their embedded lesson revisions, or coding tests. Improving a lesson's practice
    // invalidates that lesson's evidence but does not revoke a placement the learner earned.
    const assessmentRevision = step => step.kind === 'coding'
      ? revisionFor({ functionName: step.functionName, tests: step.tests, preserveInputs: step.preserveInputs })
      : revisionFor(questionsFor(step).map(({ revision, skillId, ...question }) => question));
    const unitRevision = revisionFor(steps.filter(step => placementStepIds.includes(step.id)).map(step => ({ id: step.id, assessment: assessmentRevision(step) })));
    const metadata = steps.map(step => {
      if (sessions[step.id]) throw new Error(`Duplicate learning step: ${step.id}`);
      sessions[step.id] = { ...step, unitId, courseId: course.id };
      const { id, kind, title, minutes, lessonPath, isCheckpoint = false, revision, skillIds } = step;
      return { id, kind, title, minutes, lessonPath, isCheckpoint, revision, skillIds, hasExercises: Boolean(step.exercisesFile) };
    });
    return { id: unitId, title: unit.title, description: unit.description, revision: unitRevision, placementStepIds, prerequisites: index ? [`${course.id}-${course.units[index - 1].id}`] : [], steps: metadata };
  });
  return { id: course.id, title: course.title, subtitle: course.subtitle, description: course.description, units };
});
const journeyParts = (outline.journeySources || [outline.firstMonthSource]).map(read);
const visited = new Set();
const dayIds = new Set();
let dayNumber = 0;
const partIds = new Set();
for (const [partIndex, part] of journeyParts.entries()) {
  if (part.version !== 1 || !part.id || !part.title || !part.description || !Array.isArray(part.days) || !part.days.length || partIds.has(part.id)) throw new Error(`Invalid journey part: ${part.id || partIndex + 1}`);
  partIds.add(part.id);
  if (partIndex === 0 && part.days.length !== 30) throw new Error('The first month must contain 30 study days.');
  for (const day of part.days) {
    dayNumber++;
    if (day.number !== dayNumber || day.id !== `day-${String(dayNumber).padStart(2, '0')}` || dayIds.has(day.id) || !day.title || !day.objective || !['practice','review','project'].includes(day.kind) || !day.stepIds.length || new Set(day.stepIds).size !== day.stepIds.length) throw new Error(`Invalid study day: ${day.id}`);
    dayIds.add(day.id);
    for (const id of day.stepIds) {
      const step = sessions[id];
      if (!step) throw new Error(`Unknown study-day session: ${id}`);
      const course = courses.find(course => course.id === step.courseId);
      const sequence = course.units.flatMap(unit => unit.steps);
      const previous = sequence.slice(0, sequence.findIndex(step => step.id === id));
      if (!previous.every(step => visited.has(step.id))) throw new Error(`Missing journey prerequisites for ${id}`);
      if (day.kind === 'review' && !visited.has(id)) throw new Error(`Review precedes practice: ${id}`);
      if (day.kind !== 'review' && visited.has(id)) throw new Error(`Repeated study day must be a review: ${id}`);
      if (day.kind === 'project' && step.kind !== 'coding') throw new Error(`A project day must build something: ${id}`);
      if (step.kind === 'quiz' && !step.isCheckpoint && !step.exercisesFile) throw new Error(`Journey lesson needs practice: ${id}`);
      visited.add(id);
    }
  }
  if (!part.days.at(-1).milestone) throw new Error(`Journey part must end with a milestone: ${part.id}`);
  if (partIndex === 0 && part.days.at(-1).kind !== 'project') throw new Error('The first month must end with a project.');
}
write('content/learning/journey.json', { version: 1, parts: journeyParts.map(part => ({ id: part.id, title: part.title, description: part.description, days: part.days })) });
write('content/learning/catalog.json', { version: outline.version, courses, skills });
write('content/learning/sessions.json', sessions);
if (stale) process.exit(1);
console.log(`${check ? 'Verified' : 'Generated'} ${courses.length} courses, ${courses.reduce((sum, c) => sum + c.units.length, 0)} units, ${Object.keys(sessions).length} learning sessions, and a ${dayNumber}-day guided journey in ${journeyParts.length} parts.`);
