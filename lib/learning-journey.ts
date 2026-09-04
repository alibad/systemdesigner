import { z } from "zod";
import source from "@/content/learning/journey.json";
import { ALL_STEPS, stepIsSatisfied, type PathProgress } from "./learning-path";

const DaySchema = z.object({
  id: z.string(),
  number: z.number().int(),
  title: z.string(),
  objective: z.string(),
  kind: z.enum(["practice", "review", "project"]),
  stepIds: z.array(z.string()).min(1),
  milestone: z.string().optional(),
});
/** The guided journey: the first month plus the parts that continue its numbering. */
export const JOURNEY = z
  .object({
    version: z.number(),
    parts: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          description: z.string(),
          days: z.array(DaySchema).min(1),
        }),
      )
      .min(1),
  })
  .parse(source);
export type JourneyPart = (typeof JOURNEY.parts)[number];
export type JourneyDay = JourneyPart["days"][number];
export const JOURNEY_DAYS: JourneyDay[] = JOURNEY.parts.flatMap(
  (part) => part.days,
);
/** The opening 30 study days keep their original IDs; later parts continue them. */
export const FIRST_MONTH = JOURNEY.parts[0];
export const JOURNEY_MILESTONES = JOURNEY_DAYS.filter((day) => day.milestone);
export function journeyPartFor(day: JourneyDay): JourneyPart {
  return JOURNEY.parts.find((part) =>
    part.days.some((candidate) => candidate.id === day.id),
  )!;
}
const taskKeys = new Set(
  JOURNEY_DAYS.flatMap((day) => day.stepIds.map((id) => `${day.id}:${id}`)),
);
const stamp = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER - 1);
export const JourneyStateSchema = z
  .object({
    enrollment: z
      .object({
        value: z.enum(["guided", "courses"]).nullable(),
        updatedAt: stamp,
      })
      .strict(),
    tasks: z.record(
      z.string().refine((key) => taskKeys.has(key)),
      z
        .object({
          day: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .refine((value) => {
              const date = new Date(`${value}T12:00:00Z`);
              return (
                Number.isFinite(date.getTime()) &&
                date.toISOString().slice(0, 10) === value
              );
            }),
          revision: z.string(),
          at: stamp,
        })
        .strict(),
    ),
  })
  .strict();
export type JourneyState = z.infer<typeof JourneyStateSchema>;
export const emptyJourney = (): JourneyState => ({
  enrollment: { value: null, updatedAt: 0 },
  tasks: {},
});

export function journeyTaskDone(
  progress: PathProgress,
  journey: JourneyState,
  day: JourneyDay,
  stepId: string,
) {
  const step = ALL_STEPS.find((step) => step.id === stepId)!;
  if (day.kind !== "review") return stepIsSatisfied(progress, step);
  return journey.tasks[`${day.id}:${stepId}`]?.revision === step.revision;
}
export function journeyDayDone(
  progress: PathProgress,
  journey: JourneyState,
  day: JourneyDay,
) {
  return day.stepIds.every((id) => journeyTaskDone(progress, journey, day, id));
}
export function currentJourneyDay(
  progress: PathProgress,
  journey: JourneyState,
) {
  return JOURNEY_DAYS.find((day) => !journeyDayDone(progress, journey, day));
}
export function mergeJourney(a: JourneyState, b: JourneyState): JourneyState {
  const choose = <T extends { at: number }>(left: T, right: T) =>
    left.at > right.at
      ? left
      : right.at > left.at
        ? right
        : JSON.stringify(left) >= JSON.stringify(right)
          ? left
          : right;
  const tasks = { ...a.tasks };
  for (const [key, value] of Object.entries(b.tasks)) {
    const previous = tasks[key];
    const current = ALL_STEPS.find(
      (step) => step.id === key.slice(key.indexOf(":") + 1),
    )?.revision;
    tasks[key] = !previous
      ? value
      : previous.revision === current && value.revision !== current
        ? previous
        : value.revision === current && previous.revision !== current
          ? value
          : choose(previous, value);
  }
  const left = a.enrollment,
    right = b.enrollment;
  return {
    enrollment:
      left.updatedAt > right.updatedAt
        ? left
        : right.updatedAt > left.updatedAt
          ? right
          : JSON.stringify(left) >= JSON.stringify(right)
            ? left
            : right,
    tasks: Object.fromEntries(
      Object.entries(tasks).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
}
