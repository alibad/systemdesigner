import { z } from "zod";
import catalog from "@/content/learning/catalog.json";
import type { SkillReviewState, UnitPlacement } from "./learning-evidence";

export const TRACK_IDS = ["design", "coding", "genai", "ml"] as const;
export const LearningModelSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("interactive-block"),
    id: z.string().min(1),
    dataFile: z.string().startsWith("/api/content/").optional(),
    title: z.string().min(1),
  }),
  z.object({
    kind: z.literal("topology-lab"),
    dataFile: z.string().startsWith("/api/content/"),
    title: z.string().min(1),
  }),
  z.object({
    kind: z.literal("traffic-split"),
    dataFile: z.string().startsWith("/api/content/"),
    title: z.string().min(1),
  }),
]);
export type LearningModel = z.infer<typeof LearningModelSchema>;
const common = {
  id: z.string().min(1),
  title: z.string().min(1),
  minutes: z.number().positive(),
  lessonPath: z.string().startsWith("/"),
  concept: z.string().min(1),
  summary: z.string().min(1),
  example: z.string().min(1),
  takeaway: z.string().min(1),
  exampleLabel: z.string().optional(),
  lab: z.enum(["request", "capacity", "cache"]).optional(),
  models: z.array(LearningModelSchema).optional(),
  success: z.string().optional(),
  isCheckpoint: z.boolean().optional(),
  unitId: z.string().optional(),
  courseId: z.enum(TRACK_IDS).optional(),
  revision: z.string().min(1),
  skillIds: z.array(z.string()).min(1),
};

export const PracticeStepSchema = z
  .discriminatedUnion("kind", [
    z.object({
      ...common,
      kind: z.literal("quiz"),
      quizId: z.string().min(1).optional(),
      questionsFile: z.string().startsWith("/api/content/").optional(),
      questionCount: z.number().int().min(1).max(8).optional(),
      exercisesFile: z.string().startsWith("/api/content/").optional(),
    }),
    z.object({
      ...common,
      kind: z.literal("coding"),
      starterFile: z.string().startsWith("/api/content/"),
      functionName: z.string().regex(/^[a-zA-Z_$][\w$]*$/),
      instruction: z.string().min(1),
      hint: z.string().min(1),
      preserveInputs: z.boolean().optional(),
      tests: z
        .array(
          z.object({
            label: z.string(),
            args: z.array(z.unknown()),
            expected: z.unknown(),
          }),
        )
        .min(1),
    }),
  ])
  .refine(
    (step) =>
      step.kind === "coding" ||
      Boolean(step.quizId) !== Boolean(step.questionsFile),
    {
      message: "Quiz sessions must have exactly one assessment source",
    },
  );

export type PracticeStep = z.infer<typeof PracticeStepSchema>;
export type CodingStep = Extract<PracticeStep, { kind: "coding" }>;
export type TrackId = (typeof TRACK_IDS)[number];
const StepMetadataSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["quiz", "coding"]),
  title: z.string().min(1),
  minutes: z.number().positive(),
  lessonPath: z.string().startsWith("/"),
  isCheckpoint: z.boolean(),
  revision: z.string().min(1),
  skillIds: z.array(z.string()).min(1),
  hasExercises: z.boolean(),
});
export type LearningStep = z.infer<typeof StepMetadataSchema>;
const UnitSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  prerequisites: z.array(z.string()),
  steps: z.array(StepMetadataSchema).min(1),
  revision: z.string().min(1),
  placementStepIds: z.array(z.string()).min(1),
});
export type LearningUnit = z.infer<typeof UnitSchema>;
const CourseSchema = z.object({
  id: z.enum(TRACK_IDS),
  title: z.string(),
  subtitle: z.string(),
  description: z.string(),
  units: z.array(UnitSchema).min(1),
});
export const LEARNING_TRACKS = z
  .array(CourseSchema)
  .parse(catalog.courses)
  .map((course) => ({
    ...course,
    steps: course.units.flatMap((unit) => unit.steps),
  }));
export const ALL_UNITS = LEARNING_TRACKS.flatMap((course) => course.units);
export const ALL_STEPS = LEARNING_TRACKS.flatMap((course) => course.steps);
export const ALL_SKILLS = z
  .array(
    z.object({
      id: z.string(),
      title: z.string(),
      stepId: z.string(),
      unitId: z.string(),
      courseId: z.enum(TRACK_IDS),
      revision: z.string(),
      lessonPath: z.string(),
    }),
  )
  .parse(catalog.skills);
export type LearningSkill = (typeof ALL_SKILLS)[number];

export function unitIsPlaced(
  progress: PathProgress,
  unit: LearningUnit,
): boolean {
  return progress.placements?.[unit.id]?.revision === unit.revision;
}
export function unitIsSatisfied(
  progress: PathProgress,
  unit: LearningUnit,
): boolean {
  return unitIsComplete(progress, unit) || unitIsPlaced(progress, unit);
}
export function stepIsSatisfied(
  progress: PathProgress,
  step: LearningStep,
): boolean {
  return (
    Boolean(progress.completed[step.id]) ||
    Boolean(
      unitForStep(step.id) && unitIsPlaced(progress, unitForStep(step.id)!),
    )
  );
}

export function unitForStep(id: string): LearningUnit | undefined {
  return ALL_UNITS.find((unit) => unit.steps.some((step) => step.id === id));
}
export function unitIsComplete(
  progress: PathProgress,
  unit: LearningUnit,
): boolean {
  return unit.steps.every((step) => Boolean(progress.completed[step.id]));
}
export function unitIsUnlocked(
  progress: PathProgress,
  unit: LearningUnit,
): boolean {
  return unit.prerequisites.every((id) => {
    const prerequisite = ALL_UNITS.find((candidate) => candidate.id === id);
    return prerequisite ? unitIsSatisfied(progress, prerequisite) : false;
  });
}
export const PATH_STORAGE_KEY = "sd:daily-learning:v1";
export const STEP_XP = 20;

const completionSchema = z.object({
  completedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lastPracticedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reviewOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reviews: z.number().int().nonnegative(),
});
const progressSchema = z.object({
  version: z.literal(1),
  track: z.enum(TRACK_IDS),
  dailyGoal: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  completed: z.record(z.string(), completionSchema),
  activity: z.record(z.string(), z.array(z.string())),
});
export type PathProgress = z.infer<typeof progressSchema> & {
  placements?: Record<string, UnitPlacement>;
  skillReview?: Record<string, SkillReviewState>;
};
export const emptyPathProgress = (): PathProgress => ({
  version: 1,
  track: "design",
  dailyGoal: 1,
  completed: {},
  activity: {},
});

export function readPathProgress(raw: string | null): PathProgress {
  try {
    const parsed = progressSchema.parse(JSON.parse(raw || "null"));
    const ids = new Set(ALL_STEPS.map((step) => step.id));
    return {
      ...parsed,
      completed: Object.fromEntries(
        Object.entries(parsed.completed).filter(([id]) => ids.has(id)),
      ),
      activity: Object.fromEntries(
        Object.entries(parsed.activity).map(([day, idsForDay]) => [
          day,
          [...new Set(idsForDay.filter((id) => ids.has(id)))],
        ]),
      ),
    };
  } catch {
    return emptyPathProgress();
  }
}

/** Local calendar days keep the streak correct at midnight and across DST. */
export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function shiftDay(day: string, amount: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return localDay(new Date(year, month - 1, date + amount, 12));
}

export function stepIsUnlocked(progress: PathProgress, id: string): boolean {
  const unit = unitForStep(id);
  if (!unit) return false;
  // Existing completions stay reviewable when the curriculum grows around them.
  if (progress.completed[id]) return true;
  if (unitIsPlaced(progress, unit)) return true;
  if (!unitIsUnlocked(progress, unit)) return false;
  const index = unit.steps.findIndex((step) => step.id === id);
  return unit.steps
    .slice(0, index)
    .every((step) => Boolean(progress.completed[step.id]));
}

export function completePathStep(
  progress: PathProgress,
  id: string,
  today = localDay(),
): PathProgress {
  if (!stepIsUnlocked(progress, id)) return progress;
  const prior = progress.completed[id];
  if (prior?.lastPracticedOn === today) return progress;
  const reviews = prior ? prior.reviews + 1 : 0;
  const interval = [1, 3, 7, 14][Math.min(reviews, 3)];
  return {
    ...progress,
    completed: {
      ...progress.completed,
      [id]: {
        completedOn: prior?.completedOn || today,
        lastPracticedOn: today,
        reviewOn: shiftDay(today, interval),
        reviews,
      },
    },
    activity: {
      ...progress.activity,
      [today]: [...new Set([...(progress.activity[today] || []), id])],
    },
  };
}

export function pathStreak(progress: PathProgress, today = localDay()): number {
  let day = progress.activity[today]?.length ? today : shiftDay(today, -1);
  let streak = 0;
  while (progress.activity[day]?.length) {
    streak++;
    day = shiftDay(day, -1);
  }
  return streak;
}

export function duePathSteps(
  progress: PathProgress,
  today = localDay(),
): LearningStep[] {
  return ALL_STEPS.filter(
    (step) => progress.completed[step.id]?.reviewOn <= today,
  );
}
