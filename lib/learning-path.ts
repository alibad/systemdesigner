import { z } from "zod";
import designPath from "@/content/entries/fundamentals/what-is-system-design/data/daily-design-path.json";
import codingPath from "@/content/entries/fundamentals/scalability-basics/data/daily-coding-path.json";

const common = {
  id: z.string().min(1),
  title: z.string().min(1),
  minutes: z.number().positive(),
  lessonPath: z.string().startsWith("/"),
  concept: z.string().min(1),
  summary: z.string().min(1),
  example: z.string().min(1),
  takeaway: z.string().min(1),
};

export const PracticeStepSchema = z.discriminatedUnion("kind", [
  z.object({ ...common, kind: z.literal("quiz"), quizId: z.string().min(1) }),
  z.object({
    ...common,
    kind: z.literal("coding"),
    starterFile: z.string().startsWith("/api/content/"),
    functionName: z.string().regex(/^[a-zA-Z_$][\w$]*$/),
    instruction: z.string().min(1),
    hint: z.string().min(1),
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
]);

export type PracticeStep = z.infer<typeof PracticeStepSchema>;
export type CodingStep = Extract<PracticeStep, { kind: "coding" }>;
export type TrackId = "design" | "coding";
export const LEARNING_TRACKS = [
  {
    id: "design" as const,
    title: "System design",
    subtitle: "Think in systems",
    unit: "Your first scalable system",
    description:
      "Follow a request, handle more traffic, and make reads faster.",
    steps: z.array(PracticeStepSchema).parse(designPath),
  },
  {
    id: "coding" as const,
    title: "Coding",
    subtitle: "Build with JavaScript",
    unit: "Small functions. Real systems.",
    description: "Write and test the building blocks behind a working service.",
    steps: z.array(PracticeStepSchema).parse(codingPath),
  },
];
export const ALL_STEPS = LEARNING_TRACKS.flatMap((track) => track.steps);
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
  track: z.enum(["design", "coding"]),
  dailyGoal: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  completed: z.record(z.string(), completionSchema),
  activity: z.record(z.string(), z.array(z.string())),
});
export type PathProgress = z.infer<typeof progressSchema>;
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
  const track = LEARNING_TRACKS.find((item) =>
    item.steps.some((step) => step.id === id),
  );
  if (!track) return false;
  const index = track.steps.findIndex((step) => step.id === id);
  return track.steps
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
): PracticeStep[] {
  return ALL_STEPS.filter(
    (step) => progress.completed[step.id]?.reviewOn <= today,
  );
}
