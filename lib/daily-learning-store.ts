import type { SessionResume } from "./learning-resume";
import {
  ALL_STEPS,
  PATH_STORAGE_KEY,
  type PathProgress,
} from "./learning-path";
import {
  applyDailyProgress,
  dailyProgress,
  dailyStorageKey,
  emptyDailyLearning,
  hasDailyLearning,
  mergeDailyLearning,
  migrateDailyLearning,
  nextDailyRevision,
  parseDailyLearning,
  recordDailyAttempt,
  recordJourneyTask,
  recordUnitPlacement,
  saveSessionResume,
  saveCodingDraft,
  type DailyLearningData,
} from "./daily-learning-data";
import type { AttemptEvidence } from "./learning-evidence";

export interface DailyLearningCloud {
  watch: (
    owner: string,
    receive: (data: DailyLearningData) => void,
    failed: () => void,
  ) => () => void;
  merge: (owner: string, data: DailyLearningData) => Promise<DailyLearningData>;
}
type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
export type DailySaveStatus =
  | "loading"
  | "local"
  | "syncing"
  | "saved"
  | "offline"
  | "error";
export interface DailyLearningSnapshot {
  owner: string | null | undefined;
  data: DailyLearningData;
  ready: boolean;
  storageAvailable: boolean;
  status: DailySaveStatus;
}
const same = (a: DailyLearningData, b: DailyLearningData) =>
  JSON.stringify(a) === JSON.stringify(b);

/** One owner per instance; asynchronous work is invalidated before changing owners. */
export class DailyLearningStore {
  snapshot: DailyLearningSnapshot = {
    owner: undefined,
    data: emptyDailyLearning(),
    ready: false,
    storageAvailable: true,
    status: "loading",
  };
  private generation = 0;
  private unsubscribe?: () => void;
  private timer?: ReturnType<typeof setTimeout>;
  private inFlight = false;
  private online = true;
  private retryDelay = 2_000;
  private cacheReadable = true;
  // Keep unsaved visits isolated in memory, including across sign-in/out.
  private memory = new Map<string, DailyLearningData>();

  constructor(
    private storage: Storage,
    private cloud: DailyLearningCloud,
    private changed: (snapshot: DailyLearningSnapshot) => void,
  ) {}

  private emit(patch: Partial<DailyLearningSnapshot> = {}) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.changed(this.snapshot);
  }

  private read(owner: string | null): DailyLearningData {
    const key = dailyStorageKey(owner);
    const memory = this.memory.get(key) || emptyDailyLearning();
    try {
      const raw = this.storage.getItem(key);
      if (raw)
        return mergeDailyLearning(memory, parseDailyLearning(JSON.parse(raw)));
      if (owner === null) {
        const drafts: Record<string, string> = {};
        for (const step of ALL_STEPS.filter((item) => item.kind === "coding")) {
          const draft = this.storage.getItem(`sd:code-draft:${step.id}`);
          if (draft !== null) drafts[step.id] = draft;
        }
        return mergeDailyLearning(
          memory,
          migrateDailyLearning(this.storage.getItem(PATH_STORAGE_KEY), drafts),
        );
      }
    } catch {
      if (owner !== this.snapshot.owner)
        throw new Error("Could not read anonymous browser progress.");
      // Do not replace unreadable/corrupt storage on load. A backup remains possible.
      this.cacheReadable = false;
      this.snapshot = { ...this.snapshot, storageAvailable: false };
    }
    return memory;
  }

  private persist(data: DailyLearningData): boolean {
    const owner = this.snapshot.owner;
    if (owner === undefined) return false;
    this.memory.set(dailyStorageKey(owner), data);
    try {
      if (!this.cacheReadable)
        throw new Error("Existing progress could not be read");
      this.storage.setItem(dailyStorageKey(owner), JSON.stringify(data));
      this.emit({ data, storageAvailable: true });
      return true;
    } catch {
      this.emit({ data, storageAvailable: false });
      return false;
    }
  }

  setOwner(owner: string | null) {
    if (this.snapshot.ready && owner === this.snapshot.owner) return;
    this.stop();
    this.cacheReadable = true;
    this.snapshot = {
      owner,
      data: emptyDailyLearning(),
      ready: false,
      storageAvailable: true,
      status: "loading",
    };
    const data = this.read(owner);
    this.persist(data);
    this.emit({
      ready: true,
      status: owner === null ? "local" : this.online ? "syncing" : "offline",
    });
    if (owner !== null) {
      this.listen();
      this.schedule(0);
    }
  }

  private listen() {
    const owner = this.snapshot.owner;
    if (owner == null) return;
    this.unsubscribe?.();
    const generation = this.generation;
    this.unsubscribe = this.cloud.watch(
      owner,
      (remote) => {
        if (generation !== this.generation) return;
        try {
          const merged = mergeDailyLearning(this.snapshot.data, remote);
          if (!same(merged, this.snapshot.data)) this.persist(merged);
          if (!same(merged, remote)) this.schedule();
        } catch {
          this.emit({ status: "error" });
        }
      },
      () => {
        if (generation === this.generation)
          this.emit({ status: this.online ? "error" : "offline" });
      },
    );
  }

  private schedule(delay = 700) {
    if (this.snapshot.owner == null) return;
    if (!this.online) {
      this.emit({ status: "offline" });
      return;
    }
    if (this.timer) clearTimeout(this.timer);
    this.emit({ status: "syncing" });
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.sync();
    }, delay);
  }

  async sync() {
    const owner = this.snapshot.owner;
    if (owner == null || !this.online || this.inFlight) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    const generation = this.generation;
    const submitted = this.snapshot.data;
    this.inFlight = true;
    this.emit({ status: "syncing" });
    try {
      const remote = await this.cloud.merge(owner, submitted);
      if (generation !== this.generation) return;
      const merged = mergeDailyLearning(this.snapshot.data, remote);
      this.persist(merged);
      this.retryDelay = 2_000;
      this.inFlight = false;
      if (!same(merged, remote)) this.schedule();
      else this.emit({ status: this.online ? "saved" : "offline" });
    } catch {
      if (generation !== this.generation) return;
      this.inFlight = false;
      this.emit({ status: this.online ? "error" : "offline" });
      if (this.online) {
        this.timer = setTimeout(() => {
          this.timer = undefined;
          void this.sync();
        }, this.retryDelay);
        this.retryDelay = Math.min(this.retryDelay * 2, 60_000);
      }
    }
  }

  setOnline(online: boolean) {
    this.online = online;
    if (this.snapshot.owner == null) return;
    if (online) this.retry();
    else this.emit({ status: "offline" });
  }

  retry() {
    this.refresh();
    if (this.snapshot.owner != null) {
      this.listen();
      this.schedule(0);
    }
  }

  refresh() {
    if (this.snapshot.owner === undefined) return;
    const merged = this.read(this.snapshot.owner);
    if (!same(merged, this.snapshot.data)) {
      this.persist(mergeDailyLearning(this.snapshot.data, merged));
      this.schedule();
    }
  }

  update(
    owner: string | null | undefined,
    change: (value: PathProgress) => PathProgress,
  ) {
    if (!this.snapshot.ready || owner !== this.snapshot.owner)
      return this.snapshot.data;
    this.refresh();
    const next = applyDailyProgress(this.snapshot.data, change);
    if (!same(next, this.snapshot.data)) {
      this.persist(next);
      this.schedule();
    }
    return next;
  }

  saveDraft(owner: string | null | undefined, id: string, value: string) {
    if (!this.snapshot.ready || owner !== this.snapshot.owner) return;
    this.refresh();
    const current = this.snapshot.data;
    if (current.drafts[id]?.value === value) return;
    const next = saveCodingDraft(current, id, value);
    this.persist(next);
    this.schedule();
  }

  saveSession(
    owner: string | null | undefined,
    id: string,
    value: SessionResume | null,
  ) {
    if (!this.snapshot.ready || owner !== this.snapshot.owner) return;
    this.refresh();
    if (
      JSON.stringify(this.snapshot.data.sessions[id]?.value) ===
      JSON.stringify(value)
    )
      return;
    this.persist(saveSessionResume(this.snapshot.data, id, value));
    this.schedule();
  }

  recordAttempt(owner: string | null | undefined, attempt: AttemptEvidence) {
    if (!this.snapshot.ready || owner !== this.snapshot.owner) return;
    this.refresh();
    this.persist(recordDailyAttempt(this.snapshot.data, attempt));
    this.schedule();
  }

  placeUnit(
    owner: string | null | undefined,
    unitId: string,
    passedStepIds: string[],
    revision: string,
  ) {
    if (!this.snapshot.ready || owner !== this.snapshot.owner)
      throw new Error("The account changed. Please restart placement.");
    this.refresh();
    this.persist(
      recordUnitPlacement(this.snapshot.data, unitId, passedStepIds, revision),
    );
    this.schedule();
  }

  enroll(owner: string | null | undefined, value: "guided" | "courses") {
    if (!this.snapshot.ready || owner !== this.snapshot.owner) return;
    this.refresh();
    const data = this.snapshot.data;
    this.persist(
      parseDailyLearning({
        ...data,
        journey: {
          ...data.journey,
          enrollment: { value, updatedAt: nextDailyRevision(data) },
        },
      }),
    );
    this.schedule();
  }

  finishJourneyTask(
    owner: string | null | undefined,
    dayId: string,
    stepId: string,
  ) {
    if (!this.snapshot.ready || owner !== this.snapshot.owner) return;
    this.refresh();
    this.persist(recordJourneyTask(this.snapshot.data, dayId, stepId));
    this.schedule();
  }

  guestProgress(): DailyLearningData | null {
    if (this.snapshot.owner == null) return null;
    const guest = this.read(null);
    return hasDailyLearning(guest) ? guest : null;
  }

  import(owner: string | null | undefined, data: DailyLearningData) {
    if (!this.snapshot.ready || owner !== this.snapshot.owner)
      throw new Error("The account changed. Please review the backup again.");
    this.refresh();
    const next = mergeDailyLearning(
      this.snapshot.data,
      parseDailyLearning(data),
    );
    this.persist(next);
    this.schedule();
  }

  progress() {
    return dailyProgress(this.snapshot.data);
  }

  stop() {
    this.generation++;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.inFlight = false;
  }
}
