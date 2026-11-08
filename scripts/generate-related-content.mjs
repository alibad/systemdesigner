#!/usr/bin/env node
// Builds content/related-content.json: for every registry entry, the other pages a reader
// (and a crawler) should see next. Lesson pages render these as plain links under the body,
// after the hand-picked prerequisites and `related` ids from content/registry.json.
//
// Similarity is TF-IDF cosine over the Markdoc body, plus the entry's title, tags and SEO
// keywords. A balancing pass then gives every page at least MIN_INBOUND incoming links, so
// no lesson is reachable only from its section's sidebar.
//
// Run after adding, removing or substantially rewriting lessons:
//   pnpm generate:related
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'content', 'related-content.json');
const PER_PAGE = 6;
const MAX_PER_PAGE = 8;
const MIN_INBOUND = 2;

const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'registry.json'), 'utf8'))
  .filter((entry) => entry.status === 'active');
const byId = new Map(registry.map((entry) => [entry.id, entry]));

const STOP = new Set(
  ('the a an and or of to in for is are on with by as at from that this it be can you your we our ' +
    'these those which what how why when use used using into than more most such each per not no its ' +
    'their them they will has have was were but if then also all any one two between across only must ' +
    'should would could may might does do did own same other another every both many much very').split(' ')
);

function tokens(text) {
  return (text.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) || []).filter((word) => !STOP.has(word));
}

function bodyText(entry) {
  const slug = entry.path.split('/').filter(Boolean).pop();
  const file = path.join(ROOT, 'content', 'entries', entry.section, slug, 'index.mdoc');
  if (!fs.existsSync(file)) return '';
  return fs
    .readFileSync(file, 'utf8')
    .replace(/^---[\s\S]*?---/, ' ')
    .replace(/\{%[\s\S]*?%\}/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ');
}

const docs = registry.map((entry) => {
  const meta = [entry.title, ...entry.tags, ...entry.seo.keywords].join(' ');
  const words = [...tokens(bodyText(entry)), ...tokens(meta), ...tokens(meta), ...tokens(meta)];
  const tf = new Map();
  for (const word of words) tf.set(word, (tf.get(word) || 0) + 1);
  const terms = new Set([...entry.tags, ...entry.seo.keywords].map((term) => term.toLowerCase().trim()));
  return { entry, tf, terms };
});

const df = new Map();
for (const doc of docs) for (const word of doc.tf.keys()) df.set(word, (df.get(word) || 0) + 1);
const termDf = new Map();
for (const doc of docs) for (const term of doc.terms) termDf.set(term, (termDf.get(term) || 0) + 1);

for (const doc of docs) {
  doc.vector = new Map();
  let norm = 0;
  for (const [word, count] of doc.tf) {
    const weight = (1 + Math.log(count)) * Math.log(docs.length / df.get(word));
    if (weight <= 0) continue;
    doc.vector.set(word, weight);
    norm += weight * weight;
  }
  doc.norm = Math.sqrt(norm) || 1;
}

function cosine(a, b) {
  const [small, large] = a.vector.size < b.vector.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [word, weight] of small.vector) {
    const other = large.vector.get(word);
    if (other) dot += weight * other;
  }
  return dot / (a.norm * b.norm);
}

function termOverlap(a, b) {
  let score = 0;
  for (const term of a.terms) if (b.terms.has(term)) score += Math.log(docs.length / termDf.get(term));
  return Math.min(score / 10, 0.3);
}

const scores = docs.map((doc) =>
  docs
    .filter((other) => other !== doc)
    .map((other) => ({
      id: other.entry.id,
      score:
        cosine(doc, other) +
        termOverlap(doc, other) +
        (doc.entry.section === other.entry.section && doc.entry.category && doc.entry.category === other.entry.category ? 0.03 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
);

const handPicked = new Map(
  registry.map((entry) => [
    entry.id,
    new Set([...entry.prerequisites, ...entry.related, entry.nextInSequence].filter((id) => id && byId.has(id) && id !== entry.id)),
  ])
);

const lists = new Map();
docs.forEach((doc, index) => {
  const picked = handPicked.get(doc.entry.id);
  const list = scores[index].filter((candidate) => !picked.has(candidate.id)).slice(0, PER_PAGE).map((candidate) => candidate.id);
  lists.set(doc.entry.id, list);
});

function inboundCounts() {
  const counts = new Map(registry.map((entry) => [entry.id, 0]));
  for (const [id, list] of lists) {
    for (const target of new Set([...list, ...handPicked.get(id)])) counts.set(target, (counts.get(target) || 0) + 1);
  }
  return counts;
}

// Balance: pages that few others point to get added to the lists of the pages most similar
// to them, so every lesson earns contextual links from somewhere other than the sidebar.
let counts = inboundCounts();
docs.forEach((doc, index) => {
  const id = doc.entry.id;
  for (const candidate of scores[index]) {
    if (counts.get(id) >= MIN_INBOUND) break;
    const host = lists.get(candidate.id);
    if (!host || host.length >= MAX_PER_PAGE || host.includes(id) || handPicked.get(candidate.id).has(id)) continue;
    host.push(id);
    counts.set(id, counts.get(id) + 1);
  }
});
counts = inboundCounts();

const entries = Object.fromEntries([...lists.entries()].sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(
  OUT,
  `${JSON.stringify({ generatedBy: 'scripts/generate-related-content.mjs', perPage: PER_PAGE, entries }, null, 2)}\n`
);

const inbound = [...counts.values()].sort((a, b) => a - b);
console.log(
  `related-content.json: ${lists.size} pages, inbound min ${inbound[0]}, median ${inbound[Math.floor(inbound.length / 2)]}, ` +
    `pages under ${MIN_INBOUND}: ${inbound.filter((count) => count < MIN_INBOUND).length}`
);
