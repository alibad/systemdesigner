import { z } from "zod";
import {
  ALL_SKILLS,
  ALL_STEPS,
  ALL_UNITS,
  localDay,
  shiftDay,
  stepIsUnlocked,
  unitForStep,
  unitIsPlaced,
  type PathProgress,
  type LearningStep,
} from "./learning-path";

const skills = new Map(ALL_SKILLS.map((skill) => [skill.id, skill]));
const units = new Map(ALL_UNITS.map((unit) => [unit.id, unit]));
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T12:00:00Z`);
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  });
const revision = z.string().regex(/^[a-f0-9]{12}$/);
const stamp = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER - 1);
export const SkillEvidenceSchema = z
  .object({
    skillId: z.string().refine((id) => skills.has(id)),
    revision,
    day: date,
    at: stamp,
    correct: z.boolean(),
    mistake: z.boolean(),
    hinted: z.boolean(),
    passed: z.boolean().default(false),
  })
  .strict();
export type SkillEvidence = z.infer<typeof SkillEvidenceSchema>;
export const PlacementSchema = z
  .object({ revision, day: date, at: stamp })
  .strict();
export type UnitPlacement = z.infer<typeof PlacementSchema>;
export const EvidenceRecordSchema = z
  .record(z.string(), SkillEvidenceSchema)
  .superRefine((value, ctx) => {
    for (const [key, item] of Object.entries(value))
      if (key !== evidenceKey(item))
        ctx.addIssue({
          code: "custom",
          message: "Evidence key does not match its skill and day",
        });
  });
export const PlacementRecordSchema = z.record(
  z.string().refine((id) => units.has(id)),
  PlacementSchema,
);

export type AttemptEvidence = {
  skillId: string;
  revision: string;
  correct: boolean;
  hinted?: boolean;
  passed?: boolean;
  day?: string;
  at?: number;
};
export type SkillReviewState = {
  skillId: string;
  reviewOn: string;
  lastPracticedOn: string;
  interval: number;
  status: "needs-practice" | "building" | "strong";
  reason: string;
  practiceDays: number;
};
export const evidenceKey = (item: Pick<SkillEvidence, "skillId" | "day">) =>
  `${item.skillId}:${item.day}`;

/** Daily evidence is monotone: retries cannot erase a mistake or a requested hint. */
export function mergeEvidence(
  a: Record<string, SkillEvidence>,
  b: Record<string, SkillEvidence>,
): Record<string, SkillEvidence> {
  const merged = { ...a };
  for (const [key, value] of Object.entries(b)) {
    const prior = merged[key];
    if (!prior) {
      merged[key] = value;
      continue;
    }
    if (prior.revision !== value.revision) {
      merged[key] =
        value.revision === skills.get(value.skillId)?.revision ? value : prior;
      continue;
    }
    const newest = value.at > prior.at ? value : prior;
    merged[key] = {
      ...newest,
      correct:
        value.at === prior.at ? value.correct && prior.correct : newest.correct,
      mistake: value.mistake || prior.mistake,
      hinted: value.hinted || prior.hinted,
      passed: value.passed || prior.passed,
    };
  }
  // Four recent practice dates per skill keep account documents bounded. Content
  // revisions invalidate evidence, while historical completions stay untouched.
  const kept = new Map<string, number>();
  return Object.fromEntries(
    Object.entries(merged)
      .filter(
        ([, value]) => value.revision === skills.get(value.skillId)?.revision,
      )
      .sort(
        ([ka, a], [kb, b]) =>
          b.day.localeCompare(a.day) || ka.localeCompare(kb),
      )
      .filter(([, value]) => {
        const count = kept.get(value.skillId) || 0;
        kept.set(value.skillId, count + 1);
        return count < 4;
      })
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

export function attemptEvidence(
  attempt: AttemptEvidence,
  now = Date.now(),
): SkillEvidence {
  return SkillEvidenceSchema.parse({
    ...attempt,
    day: attempt.day || localDay(),
    at: attempt.at ?? now,
    hinted: Boolean(attempt.hinted),
    mistake: !attempt.correct,
  });
}

export function deriveSkillReviews(
  evidence: Record<string, SkillEvidence>,
): Record<string, SkillReviewState> {
  const result: Record<string, SkillReviewState> = {};
  for (const item of Object.values(evidence).sort(
    (a, b) => a.day.localeCompare(b.day) || a.at - b.at,
  )) {
    if (item.revision !== skills.get(item.skillId)?.revision) continue;
    const prior = result[item.skillId];
    const delayed = !prior || item.day >= prior.reviewOn;
    let interval = prior?.interval || 3;
    if (!item.correct || !item.passed) interval = 0;
    else if (item.mistake || item.hinted) interval = 1;
    else if (prior && delayed)
      interval = Math.min(30, Math.max(3, Math.ceil(prior.interval * 2.2)));
    const practiceDays = (prior?.practiceDays || 0) + 1;
    result[item.skillId] = {
      skillId: item.skillId,
      lastPracticedOn: item.day,
      reviewOn: shiftDay(item.day, interval),
      interval,
      practiceDays,
      status:
        !item.correct || item.mistake || item.hinted
          ? "needs-practice"
          : interval >= 7
            ? "strong"
            : "building",
      reason: !item.correct
        ? "Your last attempt needs another try."
        : !item.passed
          ? "Finish the practice to check this skill."
          : item.mistake
            ? "An earlier mistake needs a fresh check."
            : item.hinted
              ? "Try recalling this without a hint."
              : interval >= 7
                ? "Check what you remember after a longer gap."
                : "Build recall with a fresh practice set.",
    };
  }
  return result;
}

export function adaptiveReviewQueue(
  progress: PathProgress,
  today = localDay(),
): Array<{
  step: LearningStep;
  reviewOn: string;
  reason: string;
  status: SkillReviewState["status"];
}> {
  return ALL_SKILLS.flatMap((skill) => {
    const step = ALL_STEPS.find((step) => step.id === skill.stepId)!;
    if (!stepIsUnlocked(progress, step.id)) return [];
    const state = progress.skillReview?.[skill.id];
    const legacy = progress.completed[step.id];
    const placed = unitIsPlaced(progress, unitForStep(step.id)!);
    const due =
      state?.reviewOn || legacy?.reviewOn || (placed ? today : undefined);
    if (!due || due > today) return [];
    return [
      {
        step,
        reviewOn: due,
        reason:
          state?.reason ||
          (placed
            ? "Check the skills you demonstrated in placement."
            : "Check your recall with a fresh practice set."),
        status: state?.status || ("building" as const),
      },
    ];
  }).sort(
    (a, b) =>
      Number(b.status === "needs-practice") -
        Number(a.status === "needs-practice") ||
      a.reviewOn.localeCompare(b.reviewOn) ||
      a.step.id.localeCompare(b.step.id),
  );
}

export function placementIsValid(
  unitId: string,
  passedStepIds: string[],
  revision: string,
): boolean {
  const unit = units.get(unitId);
  return Boolean(
    unit &&
    unit.revision === revision &&
    unit.placementStepIds.every((id) => passedStepIds.includes(id)),
  );
}
