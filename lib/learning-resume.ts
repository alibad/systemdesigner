import { z } from "zod";
import type { SkillExercise } from "./skill-exercise-schema";

// Store learner input, never an authoritative grade. Renderers recheck restored
// answers against the current, revision-matched assessment.
export const QuizResumeSchema = z
  .object({
    index: z.number().int().min(0).max(99),
    answers: z.array(z.number().int().min(-1).max(31)).max(100),
  })
  .strict();
export type QuizResume = z.infer<typeof QuizResumeSchema>;

export const ExerciseAnswerSchema = z
  .object({
    exerciseId: z.string().max(200),
    value: z.string().max(128),
    order: z.array(z.string().max(200)).max(32),
    hinted: z.boolean(),
    checked: z.boolean(),
    quiz: QuizResumeSchema.optional(),
  })
  .strict();
export const ExerciseResumeSchema = ExerciseAnswerSchema.extend({
  index: z.number().int().min(0).max(99),
  completed: z.array(ExerciseAnswerSchema).max(32).default([]),
});
export type ExerciseAnswer = z.infer<typeof ExerciseAnswerSchema>;
export type ExerciseResume = z.infer<typeof ExerciseResumeSchema>;

export const SessionResumeSchema = z
  .object({
    revision: z.string().min(1).max(100),
    review: z.number().int().min(0).max(100000),
    phase: z.enum(["learn", "practice", "retry"]),
    quiz: QuizResumeSchema.optional(),
    exercise: ExerciseResumeSchema.optional(),
    failedSkills: z.array(z.string().max(200)).max(16),
    lastScore: z.string().max(100),
  })
  .strict();
export type SessionResume = z.infer<typeof SessionResumeSchema>;

export function restoreQuiz(
  questions: { options: string[]; correctAnswer: number }[],
  saved?: QuizResume,
) {
  const answers = questions.map((q, index) => {
    const value = saved?.answers[index];
    return value !== undefined && value >= 0 && value < q.options.length
      ? value
      : -1;
  });
  // A manipulated/outdated cursor cannot skip unanswered questions.
  const firstMissing = answers.indexOf(-1);
  const limit = firstMissing === -1 ? questions.length - 1 : firstMissing;
  return {
    answers,
    index: Math.max(0, Math.min(saved?.index || 0, limit)),
    score: answers.reduce(
      (sum, answer, index) =>
        sum + (answer === questions[index].correctAnswer ? 1 : 0),
      0,
    ),
  };
}

export function exerciseAnswerCorrect(
  exercise: SkillExercise,
  saved?: ExerciseAnswer,
): boolean {
  if (!saved || saved.exerciseId !== exercise.id) return false;
  if (exercise.kind === "choice")
    return saved.quiz?.answers[0] === exercise.correctAnswer;
  if (!saved.checked) return false;
  if (exercise.kind === "number")
    return (
      saved.value.trim() !== "" &&
      Number.isFinite(Number(saved.value)) &&
      Number(saved.value) === exercise.answer
    );
  const expected =
    exercise.kind === "sequence"
      ? exercise.answer
      : exercise.pairs.map((pair) => pair.id);
  return JSON.stringify(expected) === JSON.stringify(saved.order);
}

export function restoreExerciseIndex(
  exercises: SkillExercise[],
  saved?: ExerciseResume,
): number {
  if (!saved) return 0;
  let index = 0;
  while (
    index < Math.min(saved.index, exercises.length - 1) &&
    exerciseAnswerCorrect(exercises[index], saved.completed[index])
  )
    index++;
  return index;
}
