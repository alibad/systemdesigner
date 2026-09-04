import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { ALL_STEPS, PracticeStepSchema } from "./learning-path";
import {
  emptyDailyLearning,
  parseDailyLearning,
  mergeDailyLearning,
  saveSessionResume,
  saveCodingDraft,
  exportDailyLearning,
  importDailyLearning,
  dailyProgress,
} from "./daily-learning-data";
import {
  restoreQuiz,
  restoreExerciseIndex,
  exerciseAnswerCorrect,
  type SessionResume,
  type ExerciseAnswer,
} from "./learning-resume";
import {
  SkillExercisePackSchema,
  selectSkillExercises,
} from "./skill-exercise-schema";
const step = ALL_STEPS[0];
const resume: SessionResume = {
  revision: step.revision,
  phase: "practice",
  review: 0,
  failedSkills: [],
  lastScore: "",
  quiz: { index: 1, answers: [1, -1] },
};

describe("interrupted learning", () => {
  it("migrates real v4 progress and includes sessions in backup without creating completions", () => {
    const { sessions: _s, draftHistory: _h, ...v4 } = emptyDailyLearning();
    const migrated = parseDailyLearning({ ...v4, version: 4 });
    const saved = saveSessionResume(migrated, step.id, resume);
    expect(importDailyLearning(exportDailyLearning(saved))).toEqual(saved);
    expect(dailyProgress(saved).completed).toEqual({});
  });
  it("merges independent work, converges for conflicting attempts, and keeps a completion tombstone", () => {
    const a = saveSessionResume(emptyDailyLearning(), step.id, resume);
    const b = saveSessionResume(a, step.id, {
      ...resume,
      quiz: { index: 1, answers: [1, 0] },
    });
    expect(mergeDailyLearning(a, b)).toEqual(mergeDailyLearning(b, a));
    const cleared = saveSessionResume(b, step.id, null);
    expect(mergeDailyLearning(a, cleared).sessions[step.id].value).toBeNull();
    expect(mergeDailyLearning(cleared, mergeDailyLearning(b, a))).toEqual(
      cleared,
    );
  });
  it("invalidates obsolete exercises without discarding past practice and rejects unknown or oversized input", () => {
    const saved = saveSessionResume(emptyDailyLearning(), step.id, {
      ...resume,
      revision: "obsolete",
    });
    expect(saved.sessions[step.id].value).toBeNull();
    expect(() => saveSessionResume(saved, "unknown", resume)).toThrow();
    expect(() =>
      parseDailyLearning({
        ...saved,
        sessions: {
          [step.id]: {
            value: {
              ...resume,
              quiz: { index: 0, answers: new Array(101).fill(0) },
            },
            updatedAt: 1,
          },
        },
      }),
    ).toThrow();
  });
  it("recomputes quiz scores and clamps a cursor before a missing or invalid answer", () => {
    const questions = [
      { options: ["A", "B"], correctAnswer: 1 },
      { options: ["C", "D"], correctAnswer: 0 },
    ];
    expect(restoreQuiz(questions, { index: 99, answers: [1, 99] })).toEqual({
      answers: [1, -1],
      index: 1,
      score: 1,
    });
    expect(restoreQuiz(questions, { index: 1, answers: [-1, 0] }).index).toBe(
      0,
    );
    expect(restoreQuiz(questions, { index: 1, answers: [0, 0] }).score).toBe(1);
  });
  it("regrades completed exercises before resuming a later group", () => {
    const pack = SkillExercisePackSchema.parse(
      JSON.parse(
        fs.readFileSync(
          "content/entries/fundamentals/what-is-system-design/data/skill-exercises.json",
          "utf8",
        ),
      ),
    );
    const exercises = selectSkillExercises(pack, 0);
    const first = exercises[0];
    expect(first.kind).toBe("sequence");
    const answer: ExerciseAnswer = {
      exerciseId: first.id,
      value: "",
      order: first.kind === "sequence" ? first.answer : [],
      hinted: false,
      checked: true,
    };
    const saved = { ...answer, index: 1, completed: [answer] };
    expect(exerciseAnswerCorrect(first, answer)).toBe(true);
    expect(restoreExerciseIndex(exercises, saved)).toBe(1);
    expect(
      restoreExerciseIndex(exercises, {
        ...saved,
        completed: [{ ...answer, order: [...answer.order].reverse() }],
      }),
    ).toBe(0);
    expect(restoreExerciseIndex(exercises, { ...saved, completed: [] })).toBe(
      0,
    );
  });
  it("preserves displaced local and concurrent drafts and makes a restored version the newest edit", () => {
    const base = saveCodingDraft(
      emptyDailyLearning(),
      "code-capacity",
      "original",
    );
    const a = saveCodingDraft(base, "code-capacity", "left");
    const b = saveCodingDraft(base, "code-capacity", "right");
    const merged = mergeDailyLearning(a, b);
    expect(merged).toEqual(mergeDailyLearning(b, a));
    expect(mergeDailyLearning(merged, merged)).toEqual(merged);
    expect(
      new Set([
        merged.drafts["code-capacity"].value,
        ...merged.draftHistory["code-capacity"].map((v) => v.value),
      ]),
    ).toEqual(new Set(["original", "left", "right"]));
    const restored = saveCodingDraft(merged, "code-capacity", "original");
    expect(mergeDailyLearning(b, restored).drafts["code-capacity"].value).toBe(
      "original",
    );
    expect(importDailyLearning(exportDailyLearning(restored))).toEqual(
      restored,
    );
  });
});

describe("whole curriculum practice", () => {
  const sessions = Object.values(
    JSON.parse(fs.readFileSync("content/learning/sessions.json", "utf8")),
  ).map((raw) => PracticeStepSchema.parse(raw));
  for (const session of sessions.filter(
    (step) => step.kind === "quiz" && !step.isCheckpoint,
  )) {
    it(`${session.id}: has valid mixed practice and real model references`, () => {
      if (session.kind !== "quiz") return;
      expect(session.exercisesFile).toBeTruthy();
      const pack = SkillExercisePackSchema.parse(
        JSON.parse(
          fs.readFileSync(
            session.exercisesFile!.replace("/api/content/", "content/entries/"),
            "utf8",
          ),
        ),
      );
      expect(
        pack.groups.some((group) =>
          group.variants.some((item) => item.kind !== "choice"),
        ),
      ).toBe(true);
      const ids = pack.groups.flatMap((group) =>
        group.variants.map((item) => item.id),
      );
      expect(new Set(ids).size).toBe(ids.length);
      expect(session.models?.length).toBeGreaterThan(0);
      for (const model of session.models || []) {
        if (model.kind === "interactive-block")
          expect(
            fs.existsSync(`components/content-blocks/entries/${model.id}.tsx`),
          ).toBe(true);
        const file = model.dataFile;
        if (file)
          expect(() =>
            JSON.parse(
              fs.readFileSync(
                file.replace("/api/content/", "content/entries/"),
                "utf8",
              ),
            ),
          ).not.toThrow();
      }
    });
  }
});

// Independent calculations pin the numerical teaching examples, including units,
// reserves, and whole-worker/request boundaries.
it("checks all 27 newly authored planning calculations", () => {
  const expected: Record<string, number> = {
    "cost-of-errors-1":20*4+3*120,"cost-of-errors-2":12*3+8*15,"cost-of-errors-3":15*2+4*80,
    "search-batch-wait":100-20-35-15-10,"recommendation-batch-wait":160-35-55-25-15,"image-batch-wait":90-18-30-12-15,
    "mature-label-coverage-1":425/500*100,"mature-label-coverage-2":600/800*100,"mature-label-coverage-3":1000/1250*100,
    "bounded-queue-overflow-1":18-3*(1000/250)-4,"bounded-queue-overflow-2":34-4*(1000/200)-5,"bounded-queue-overflow-3":29-3*(1000/200)-8,
    "rag-context-budget-1":Math.floor((8000-1800-1400)/650),"rag-context-budget-2":Math.floor((12000-3000-2000)/1100),"rag-context-budget-3":Math.floor((6000-1200-1200)/800),
    "compact-context-reservation":Math.floor(6/(3000*0.00012)),"balanced-context-reservation":Math.floor(8.8/(2000*0.00022)),"large-context-reservation":Math.floor(17/(4000*0.00034)),
    "multimodal-budget-1":Math.floor(Math.min(8192-1400-900,4000)/(4*256)),"multimodal-budget-2":Math.floor(Math.min(4096-800-600,3600)/(2*256)),"multimodal-budget-3":Math.floor(Math.min(6144-1500-1200,5000)/(6*256)),
    "chat-worker-headroom":Math.ceil((9000*220/720000+9000*0.00032/16)/(2*0.7)),"document-cache-worker-plan":Math.ceil((915*1800/610000+915*0.00038/4)/(2*0.7)),"multilingual-worker-plan":Math.ceil((4700*760/470000+4700*0.00046/8)/(2*0.7)),
    "redis-source-load-1":Math.round(80000*(1-.94)),"redis-source-load-2":Math.round(50000*(1-.98)),"redis-source-load-3":Math.round(45000*(1-.9)),
  };
  const outline=JSON.parse(fs.readFileSync('content/learning/course-outline.json','utf8'));
  let checked=0;
  for(const file of Object.values(outline.exerciseSources) as string[]) {
    const pack=SkillExercisePackSchema.parse(JSON.parse(fs.readFileSync(file.replace('/api/content/','content/entries/'),'utf8')));
    for(const group of pack.groups)for(const item of group.variants)if(item.kind==='number'&&item.id in expected){expect(item.answer,item.id).toBe(expected[item.id]);checked++;}
  }
  expect(checked).toBe(27);
});
