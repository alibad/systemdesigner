import { z } from "zod";
import { SessionResumeSchema, type SessionResume } from "./learning-resume";
import {
  ALL_STEPS,
  TRACK_IDS,
  emptyPathProgress,
  readPathProgress,
  shiftDay,
  localDay,
  stepIsUnlocked,
  type PathProgress,
} from "./learning-path";
import {
  EvidenceRecordSchema,
  PlacementRecordSchema,
  deriveSkillReviews,
  mergeEvidence,
  attemptEvidence,
  evidenceKey,
  placementIsValid,
  type AttemptEvidence,
} from "./learning-evidence";
import {
  FIRST_MONTH,
  JourneyStateSchema,
  emptyJourney,
  mergeJourney,
  currentJourneyDay,
} from "./learning-journey";
import { ALL_UNITS } from "./learning-path";

export const DAILY_STORAGE_PREFIX = "sd:daily-learning:v2:";
export const MAX_BACKUP_BYTES = 750_000;
export const MAX_DRAFT_LENGTH = 20_000;
const ids = new Set(ALL_STEPS.map((step) => step.id));
const codingIds = new Set(
  ALL_STEPS.filter((step) => step.kind === "coding").map((step) => step.id),
);
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T12:00:00Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Invalid calendar date");
const stamp = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER - 1);
const setting = <T extends z.ZodTypeAny>(value: T) =>
  z.object({ value, updatedAt: stamp }).strict();
const V2LearningSchema = z
  .object({
    version: z.literal(2),
    // (calendar day, step ID) is the idempotency key, on every device.
    practice: z.record(
      day,
      z.array(z.string().refine((id) => ids.has(id))).max(ALL_STEPS.length),
    ),
    track: setting(z.enum(TRACK_IDS)),
    dailyGoal: setting(z.union([z.literal(1), z.literal(2), z.literal(3)])),
    drafts: z.record(
      z.string().refine((id) => codingIds.has(id)),
      setting(z.string().max(MAX_DRAFT_LENGTH)),
    ),
  })
  .strict();
const V3LearningSchema = V2LearningSchema.extend({
  version: z.literal(3),
  evidence: EvidenceRecordSchema,
  placements: PlacementRecordSchema,
});
const V4LearningSchema = V3LearningSchema.extend({
  version: z.literal(4),
  journey: JourneyStateSchema,
});
export const DailyLearningSchema = V4LearningSchema.extend({
  version: z.literal(5),
  sessions: z.record(
    z.string().refine((id) => ids.has(id)),
    setting(SessionResumeSchema.nullable()),
  ),
  draftHistory: z.record(
    z.string().refine((id) => codingIds.has(id)),
    z.array(setting(z.string().max(MAX_DRAFT_LENGTH))).max(4),
  ),
});
export type DailyLearningData = z.infer<typeof DailyLearningSchema>;

export function emptyDailyLearning(): DailyLearningData {
  return {
    version: 5,
    sessions: {},
    draftHistory: {},
    journey: emptyJourney(),
    practice: {},
    track: { value: "design", updatedAt: 0 },
    dailyGoal: { value: 1, updatedAt: 0 },
    drafts: {},
    evidence: {},
    placements: {},
  };
}

function sorted<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => a.localeCompare(b)),
  );
}

export function parseDailyLearning(input: unknown): DailyLearningData {
  const version = (input as { version?: number } | null)?.version;
  const migrated =
    version === 2
      ? {
          ...V2LearningSchema.parse(input),
          version: 5,
          sessions: {},
          draftHistory: {},
          evidence: {},
          placements: {},
          journey: emptyJourney(),
        }
      : version === 3
        ? {
            ...V3LearningSchema.parse(input),
            version: 5,
            sessions: {},
            draftHistory: {},
            journey: emptyJourney(),
          }
        : version === 4
          ? {
              ...V4LearningSchema.parse(input),
              version: 5,
              sessions: {},
              draftHistory: {},
            }
          : input;
  const result = DailyLearningSchema.parse(migrated);
  result.practice = sorted(
    Object.fromEntries(
      Object.entries(result.practice)
        .filter(([, steps]) => steps.length)
        .map(([date, steps]) => [date, [...new Set(steps)].sort()]),
    ),
  );
  result.drafts = sorted(result.drafts);
  result.draftHistory = normalizeDraftHistory(
    result.draftHistory,
    result.drafts,
  );
  result.sessions = sorted(
    Object.fromEntries(
      Object.entries(result.sessions).map(([id, entry]) => [
        id,
        entry.value &&
        entry.value.revision !==
          ALL_STEPS.find((step) => step.id === id)?.revision
          ? { ...entry, value: null }
          : entry,
      ]),
    ),
  );
  result.evidence = mergeEvidence({}, result.evidence);
  result.placements = sorted(result.placements);
  result.journey = mergeJourney(emptyJourney(), result.journey);
  if (
    new TextEncoder().encode(JSON.stringify(result)).length >
    MAX_BACKUP_BYTES - 256
  )
    throw new Error("Progress backup is too large.");
  return result;
}

type DraftVersion = { value: string; updatedAt: number };
function normalizeDraftHistory(
  history: Record<string, DraftVersion[]>,
  drafts: Record<string, DraftVersion> = {},
): Record<string, DraftVersion[]> {
  const entries = Object.entries(history)
    .flatMap(([id, versions]) => {
      const unique = new Map<string, DraftVersion>();
      for (const version of versions) {
        if (version.value === drafts[id]?.value) continue;
        const prior = unique.get(version.value);
        if (!prior || version.updatedAt > prior.updatedAt)
          unique.set(version.value, version);
      }
      return [...unique.values()].map((version) => ({ id, version }));
    })
    .sort(
      (a, b) =>
        b.version.updatedAt - a.version.updatedAt ||
        (b.id === a.id ? 0 : b.id > a.id ? 1 : -1) ||
        (b.version.value === a.version.value ? 0 : b.version.value > a.version.value ? 1 : -1),
    );
  const result: Record<string, DraftVersion[]> = {};
  let bytes = 0;
  for (const { id, version } of entries) {
    const size = new TextEncoder().encode(version.value).length;
    if ((result[id]?.length || 0) >= 4 || bytes + size > 64000) continue;
    (result[id] ||= []).push(version);
    bytes += size;
  }
  return sorted(result);
}

function latest<T>(
  a: { value: T; updatedAt: number },
  b: { value: T; updatedAt: number },
) {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  return JSON.stringify(a.value) >= JSON.stringify(b.value) ? a : b;
}

/** Set union plus deterministic per-field revisions makes retries/order irrelevant. */
export function mergeDailyLearning(
  a: DailyLearningData,
  b: DailyLearningData,
): DailyLearningData {
  const practice = { ...a.practice };
  for (const [date, steps] of Object.entries(b.practice))
    practice[date] = [...new Set([...(practice[date] || []), ...steps])];
  const drafts = { ...a.drafts };
  for (const [id, draft] of Object.entries(b.drafts))
    drafts[id] = drafts[id] ? latest(drafts[id], draft) : draft;
  const sessions = { ...a.sessions };
  for (const [id, entry] of Object.entries(b.sessions))
    sessions[id] = sessions[id] ? latest(sessions[id], entry) : entry;
  return parseDailyLearning({
    version: 5,
    sessions,
    draftHistory: normalizeDraftHistory(
      Object.fromEntries(
        [
          ...new Set([
            ...Object.keys(a.drafts),
            ...Object.keys(b.drafts),
            ...Object.keys(a.draftHistory),
            ...Object.keys(b.draftHistory),
          ]),
        ].map((id) => [
          id,
          [
            ...(a.draftHistory[id] || []),
            ...(b.draftHistory[id] || []),
            ...(a.drafts[id] ? [a.drafts[id]] : []),
            ...(b.drafts[id] ? [b.drafts[id]] : []),
          ],
        ]),
      ),
      drafts,
    ),
    journey: mergeJourney(a.journey, b.journey),
    practice,
    drafts,
    track: latest(a.track, b.track),
    dailyGoal: latest(a.dailyGoal, b.dailyGoal),
    evidence: mergeEvidence(a.evidence, b.evidence),
    placements: Object.fromEntries(
      [
        ...new Set([
          ...Object.keys(a.placements),
          ...Object.keys(b.placements),
        ]),
      ].map((id) => {
        const left = a.placements[id],
          right = b.placements[id];
        if (!left || !right) return [id, left || right];
        const current = ALL_UNITS.find((unit) => unit.id === id)?.revision;
        if (left.revision !== right.revision)
          return [
            id,
            left.revision === current
              ? left
              : right.revision === current
                ? right
                : left.at > right.at
                  ? left
                  : left.at < right.at
                    ? right
                    : JSON.stringify(left) >= JSON.stringify(right)
                      ? left
                      : right,
          ];
        return [
          id,
          left.at > right.at
            ? left
            : left.at < right.at
              ? right
              : JSON.stringify(left) >= JSON.stringify(right)
                ? left
                : right,
        ];
      }),
    ),
  });
}

export function dailyProgress(data: DailyLearningData): PathProgress {
  const progress = {
    ...emptyPathProgress(),
    track: data.track.value,
    dailyGoal: data.dailyGoal.value,
    activity: data.practice,
  };
  if (Object.keys(data.placements).length)
    (progress as PathProgress).placements = data.placements;
  if (Object.keys(data.evidence).length)
    (progress as PathProgress).skillReview = deriveSkillReviews(data.evidence);
  for (const [date, steps] of Object.entries(data.practice).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    for (const id of steps) {
      const prior = progress.completed[id];
      const reviews = prior ? prior.reviews + 1 : 0;
      progress.completed[id] = {
        completedOn: prior?.completedOn || date,
        lastPracticedOn: date,
        reviews,
        reviewOn: shiftDay(date, [1, 3, 7, 14][Math.min(reviews, 3)]),
      };
    }
  }
  return progress;
}

export function nextDailyRevision(data: DailyLearningData, now = Date.now()) {
  return Math.max(
    now,
    data.track.updatedAt + 1,
    data.dailyGoal.updatedAt + 1,
    ...Object.values(data.drafts).map((draft) => draft.updatedAt + 1),
    ...Object.values(data.sessions).map((entry) => entry.updatedAt + 1),
    ...Object.values(data.evidence).map((item) => item.at + 1),
    ...Object.values(data.placements).map((item) => item.at + 1),
    data.journey.enrollment.updatedAt + 1,
    ...Object.values(data.journey.tasks).map((item) => item.at + 1),
  );
}

export function applyDailyProgress(
  data: DailyLearningData,
  change: (progress: PathProgress) => PathProgress,
): DailyLearningData {
  const prior = dailyProgress(data);
  const next = change(prior);
  const revision = nextDailyRevision(data);
  return mergeDailyLearning(data, {
    ...data,
    practice: next.activity,
    track:
      next.track === prior.track
        ? data.track
        : { value: next.track, updatedAt: revision },
    dailyGoal:
      next.dailyGoal === prior.dailyGoal
        ? data.dailyGoal
        : { value: next.dailyGoal, updatedAt: revision },
  });
}

/** Legacy dates have no edit timestamp, so they cannot overwrite newer account drafts. */
export function migrateDailyLearning(
  raw: string | null,
  drafts: Record<string, string>,
): DailyLearningData {
  const progress = readPathProgress(raw);
  const practice = { ...progress.activity };
  for (const [id, completion] of Object.entries(progress.completed)) {
    for (const date of [completion.completedOn, completion.lastPracticedOn])
      practice[date] = [...new Set([...(practice[date] || []), id])];
  }
  return parseDailyLearning({
    version: 5,
    sessions: {},
    draftHistory: {},
    journey: emptyJourney(),
    evidence: {},
    placements: {},
    practice,
    track: { value: progress.track, updatedAt: 1 },
    dailyGoal: { value: progress.dailyGoal, updatedAt: 1 },
    drafts: Object.fromEntries(
      Object.entries(drafts)
        .filter(([id]) => codingIds.has(id))
        .map(([id, value]) => [id, { value, updatedAt: 1 }]),
    ),
  });
}

const BackupSchema = z
  .object({
    format: z.literal("systemdesigner-daily-learning"),
    version: z.literal(1),
    exportedAt: z.string().datetime(),
    data: z.union([
      DailyLearningSchema,
      V4LearningSchema,
      V3LearningSchema,
      V2LearningSchema,
    ]),
  })
  .strict();

export function exportDailyLearning(data: DailyLearningData): string {
  return JSON.stringify({
    format: "systemdesigner-daily-learning",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: parseDailyLearning(data),
  });
}

export function importDailyLearning(raw: string): DailyLearningData {
  if (new TextEncoder().encode(raw).length > MAX_BACKUP_BYTES)
    throw new Error("Choose a progress backup smaller than 750 KB.");
  try {
    return parseDailyLearning(BackupSchema.parse(JSON.parse(raw)).data);
  } catch {
    throw new Error(
      "This is not a valid SystemDesigner daily-learning backup. Nothing was imported.",
    );
  }
}

export function hasDailyLearning(data: DailyLearningData): boolean {
  return (
    Object.values(data.sessions).some((entry) => entry.value !== null) ||
    Object.keys(data.practice).length > 0 ||
    Object.keys(data.drafts).length > 0 ||
    Object.keys(data.evidence).length > 0 ||
    Object.keys(data.placements).length > 0 ||
    data.journey.enrollment.value !== null ||
    Object.keys(data.journey.tasks).length > 0 ||
    data.dailyGoal.value !== 1 ||
    data.track.value !== "design"
  );
}

export function dailyStorageKey(owner: string | null) {
  return DAILY_STORAGE_PREFIX + (owner === null ? "guest" : `user:${owner}`);
}

export function recordDailyAttempt(
  data: DailyLearningData,
  attempt: AttemptEvidence,
): DailyLearningData {
  const item = attemptEvidence(attempt, nextDailyRevision(data));
  return mergeDailyLearning(data, {
    ...data,
    evidence: { [evidenceKey(item)]: item },
  });
}

export function recordUnitPlacement(
  data: DailyLearningData,
  unitId: string,
  passedStepIds: string[],
  revision: string,
  dayValue = new Date(),
): DailyLearningData {
  if (!placementIsValid(unitId, passedStepIds, revision))
    throw new Error("Finish every part of this unit assessment first.");
  const unit = ALL_UNITS.find((unit) => unit.id === unitId)!;
  // Assessments must follow the course prerequisites, just like normal practice.
  const progress = dailyProgress(data);
  if (
    !unit.prerequisites.every((id) => {
      const previous = ALL_UNITS.find((value) => value.id === id)!;
      return (
        progress.placements?.[id]?.revision === previous.revision ||
        previous.steps.every((step) => progress.completed[step.id])
      );
    })
  )
    throw new Error("Complete or assess the earlier units first.");
  const day = `${dayValue.getFullYear()}-${String(dayValue.getMonth() + 1).padStart(2, "0")}-${String(dayValue.getDate()).padStart(2, "0")}`;
  return mergeDailyLearning(data, {
    ...data,
    placements: { [unitId]: { revision, day, at: nextDailyRevision(data) } },
  });
}

export function recordJourneyTask(
  data: DailyLearningData,
  dayId: string,
  stepId: string,
): DailyLearningData {
  const day = FIRST_MONTH.days.find((day) => day.id === dayId);
  const step = ALL_STEPS.find((step) => step.id === stepId);
  const progress = dailyProgress(data);
  const active = currentJourneyDay(progress, data.journey);
  if (
    !day ||
    !step ||
    !day.stepIds.includes(stepId) ||
    !stepIsUnlocked(progress, stepId) ||
    (active && day.number > active.number)
  )
    throw new Error("Complete the earlier study days first.");
  if (!data.practice[localDay()]?.includes(stepId))
    throw new Error("Finish this practice before recording it.");
  return mergeDailyLearning(data, {
    ...data,
    journey: {
      ...data.journey,
      tasks: {
        [`${dayId}:${stepId}`]: {
          day: localDay(),
          revision: step.revision,
          at: nextDailyRevision(data),
        },
      },
    },
  });
}

/** Null is a durable completion/reset marker, so an old device cannot revive it. */
export function saveSessionResume(
  data: DailyLearningData,
  id: string,
  value: SessionResume | null,
): DailyLearningData {
  if (!ids.has(id)) throw new Error("Unknown learning session");
  return parseDailyLearning({
    ...data,
    sessions: {
      ...data.sessions,
      [id]: { value, updatedAt: nextDailyRevision(data) },
    },
  });
}

export function saveCodingDraft(
  data: DailyLearningData,
  id: string,
  value: string,
): DailyLearningData {
  const drafts = {
    ...data.drafts,
    [id]: { value, updatedAt: nextDailyRevision(data) },
  };
  return parseDailyLearning({
    ...data,
    drafts,
    draftHistory: normalizeDraftHistory(
      {
        ...data.draftHistory,
        [id]: [
          ...(data.draftHistory[id] || []),
          ...(data.drafts[id] ? [data.drafts[id]] : []),
        ],
      },
      drafts,
    ),
  });
}
