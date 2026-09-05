#!/usr/bin/env node
// Enforces the authored-practice contract so a learner cannot answer from the
// shape of an exercise instead of the lesson. Run over every pack the course
// outline registers; `pnpm validate:content` includes it.
//
// Rules, each added after a measured defect:
//   - A choice answer must not be findable by length. The correct option stays
//     under 1.6x the mean distractor, and no option is a stub beside a long one.
//   - Ordering items are stored shuffled, never in solved order.
//   - Every calculation names at least two plausible wrong values.
//   - A unit is one or two words, not a sentence.
//   - No em dashes in learner-facing prose.
import fs from "node:fs";

const OUTLINE = "content/learning/course-outline.json";
const MAX_CORRECT_RATIO = 1.6;
const STUB_LENGTH = 20;
const LONG_OPTION_LENGTH = 45;
const MAX_UNIT_LENGTH = 24;

const outline = JSON.parse(fs.readFileSync(OUTLINE, "utf8"));
const problems = [];
const seenVariantIds = new Map();
let packs = 0;
let variants = 0;

for (const [stepId, apiPath] of Object.entries(outline.exerciseSources ?? {})) {
  const file = apiPath.replace("/api/content/", "content/entries/");
  let pack;
  try {
    pack = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    problems.push(`${stepId}: cannot read ${file} (${error.message})`);
    continue;
  }
  packs += 1;
  for (const group of pack.groups ?? []) {
    for (const exercise of group.variants ?? []) {
      variants += 1;
      const where = `${file} ${exercise.id}`;
      const previous = seenVariantIds.get(exercise.id);
      if (previous) problems.push(`${where}: variant id also used in ${previous}`);
      else seenVariantIds.set(exercise.id, file);

      const prose = ["context", "prompt", "hint", "explanation"]
        .map((key) => exercise[key] ?? "")
        .join(" ");
      if (prose.includes("—")) problems.push(`${where}: em dash in learner-facing prose`);

      if (exercise.kind === "choice") {
        const lengths = exercise.options.map((option) => option.length);
        const correct = lengths[exercise.correctAnswer];
        const others = lengths.filter((_, index) => index !== exercise.correctAnswer);
        const mean = others.reduce((total, value) => total + value, 0) / others.length;
        if (correct >= MAX_CORRECT_RATIO * mean)
          problems.push(
            `${where}: correct option is ${(correct / mean).toFixed(2)}x the average distractor; lengthen the distractors into real positions`,
          );
        if (Math.min(...lengths) < STUB_LENGTH && Math.max(...lengths) > LONG_OPTION_LENGTH)
          problems.push(`${where}: a stub option sits beside a much longer one; make every option a full position`);
        if (new Set(exercise.options).size !== exercise.options.length)
          problems.push(`${where}: duplicate options`);
      }

      if (exercise.kind === "number") {
        if ((exercise.mistakes ?? []).length < 2)
          problems.push(`${where}: name at least two plausible wrong values`);
        for (const mistake of exercise.mistakes ?? [])
          if (mistake.value === exercise.answer)
            problems.push(`${where}: a listed mistake equals the answer`);
        if ((exercise.unit ?? "").length > MAX_UNIT_LENGTH)
          problems.push(`${where}: unit should be one or two words`);
      }

      if (exercise.kind === "sequence") {
        const order = exercise.items.map((item) => item.id);
        if (order.join() === (exercise.answer ?? []).join())
          problems.push(`${where}: items are stored in solved order; shuffle them for display`);
      }
    }
  }
}

if (problems.length) {
  console.error(`Authored practice contract failed (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`Authored practice contract holds across ${packs} packs and ${variants} variants.`);
