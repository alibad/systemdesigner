import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DailyLearningStore,
  type DailyLearningCloud,
} from "./daily-learning-store";
import {
  dailyStorageKey,
  emptyDailyLearning,
  mergeDailyLearning,
  type DailyLearningData,
} from "./daily-learning-data";
import {
  completePathStep,
  emptyPathProgress,
  PATH_STORAGE_KEY,
  ALL_SKILLS, LEARNING_TRACKS,
} from "./learning-path";

const stores: DailyLearningStore[] = [];
afterEach(() => {
  stores.forEach((store) => store.stop());
  stores.length = 0;
  vi.useRealTimers();
});
function fixture() {
  const disk = new Map<string, string>();
  const remote = new Map<string, DailyLearningData>();
  const watchers = new Map<string, Set<(data: DailyLearningData) => void>>();
  const cloud: DailyLearningCloud = {
    watch: (uid, receive) => {
      const group = watchers.get(uid) || new Set();
      group.add(receive);
      watchers.set(uid, group);
      return () => {
        group.delete(receive);
      };
    },
    merge: vi.fn(async (uid, data) => {
      const merged = mergeDailyLearning(
        remote.get(uid) || emptyDailyLearning(),
        data,
      );
      remote.set(uid, merged);
      return merged;
    }),
  };
  const storage = {
    getItem: (key: string) => disk.get(key) ?? null,
    setItem: (key: string, value: string) => {
      disk.set(key, value);
    },
  };
  function create(diskStorage = storage) {
    const store = new DailyLearningStore(diskStorage, cloud, () => {});
    stores.push(store);
    return store;
  }
  return { disk, remote, cloud, storage, create, watchers };
}
const practice = (
  store: DailyLearningStore,
  owner: string | null,
  id = "request-journey",
  day = "2026-09-02",
) => store.update(owner, (p) => completePathStep(p, id, day));

describe("daily learning storage and sync boundaries", () => {
  it("restores interrupted sessions across devices and rejects writes from a previous account", async () => {
    const f = fixture(), a = f.create();
    const skill = ALL_SKILLS[0];
    const saved = { revision: skill.revision, phase: "practice" as const, review: 0, failedSkills: [], lastScore: "", quiz: {index:0,answers:[1]} };
    a.setOwner('alice'); a.saveSession('alice',skill.stepId,saved); await a.sync();
    const b = f.create(); b.setOwner('alice'); await b.sync();
    expect(b.snapshot.data.sessions[skill.stepId].value).toEqual(saved);
    b.setOwner('bob'); b.saveSession('alice',skill.stepId,saved);
    expect(b.snapshot.data.sessions).toEqual({});
    b.setOwner(null); expect(b.snapshot.data.sessions).toEqual({});
  });

  it("syncs the guided journey and rejects enrollment or task writes after an account switch", async () => {
    const f = fixture(), a = f.create();
    a.setOwner('alice');
    a.enroll('alice', 'guided');
    a.update('alice', progress => completePathStep(progress, 'request-journey'));
    a.finishJourneyTask('alice', 'day-01', 'request-journey');
    await a.sync();
    const b = f.create(); b.setOwner('alice'); await b.sync();
    expect(b.snapshot.data.journey).toEqual(a.snapshot.data.journey);
    b.setOwner('bob');
    b.enroll('alice', 'guided');
    b.finishJourneyTask('alice', 'day-01', 'request-journey');
    expect(b.snapshot.data.journey).toEqual(emptyDailyLearning().journey);
  });
  it("syncs placement and recall evidence while rejecting late writes from another account", async () => {
    const f=fixture(), a=f.create();
    const skill=ALL_SKILLS[0],unit=LEARNING_TRACKS[0].units[0];
    a.setOwner('alice');
    a.recordAttempt('alice',{skillId:skill.id,revision:skill.revision,correct:false,day:'2026-09-01',at:1});
    a.placeUnit('alice',unit.id,unit.placementStepIds,unit.revision);
    await a.sync();
    const b=f.create();b.setOwner('alice');await b.sync();
    expect(b.snapshot.data.evidence).toEqual(a.snapshot.data.evidence);
    expect(b.snapshot.data.placements).toEqual(a.snapshot.data.placements);
    b.setOwner('bob');
    b.recordAttempt('alice',{skillId:skill.id,revision:skill.revision,correct:true,passed:true});
    expect(()=>b.placeUnit('alice',unit.id,unit.placementStepIds,unit.revision)).toThrow('account changed');
    expect(b.snapshot.data.evidence).toEqual({});expect(b.snapshot.data.placements).toEqual({});
    b.setOwner(null);expect(b.snapshot.data.evidence).toEqual({});expect(b.snapshot.data.placements).toEqual({});
  });
  it("migrates v1 once, survives reload, and keeps the legacy copy intact", () => {
    const f = fixture();
    const legacy = completePathStep(
      emptyPathProgress(),
      "request-journey",
      "2026-09-02",
    );
    f.disk.set(PATH_STORAGE_KEY, JSON.stringify(legacy));
    f.disk.set("sd:code-draft:code-capacity", "my draft");
    const a = f.create();
    a.setOwner(null);
    expect(a.progress()).toEqual(legacy);
    expect(a.snapshot.data.drafts["code-capacity"].value).toBe("my draft");
    a.update(null, (p) => ({ ...p, dailyGoal: 2 }));
    const b = f.create();
    b.setOwner(null);
    expect(b.progress().dailyGoal).toBe(2);
    expect(f.disk.get(PATH_STORAGE_KEY)).toBe(JSON.stringify(legacy));
  });

  it("requires explicit guest import and isolates drafts through sign-out and account switches", () => {
    const f = fixture();
    const store = f.create();
    store.setOwner(null);
    practice(store, null);
    store.saveDraft(null, "code-capacity", "guest");
    store.setOwner("alice");
    expect(store.progress().completed).toEqual({});
    expect(store.snapshot.data.drafts).toEqual({});
    store.import("alice", store.guestProgress()!);
    store.saveDraft("alice", "code-capacity", "alice private");
    store.setOwner("bob");
    expect(store.progress().completed).toEqual({});
    expect(store.snapshot.data.drafts).toEqual({});
    practice(store, "alice");
    store.saveDraft("alice", "code-capacity", "stale");
    expect(() => store.import("alice", emptyDailyLearning())).toThrow(
      "account changed",
    );
    expect(store.snapshot.data.drafts).toEqual({});
    store.setOwner(null);
    expect(store.snapshot.data.drafts["code-capacity"].value).toBe("guest");
    store.setOwner("alice");
    expect(store.snapshot.data.drafts["code-capacity"].value).toBe(
      "alice private",
    );
  });

  it("syncs a completion and draft to a fresh device and retains one reward after repeated uploads", async () => {
    const f = fixture();
    const a = f.create();
    a.setOwner("alice");
    practice(a, "alice");
    a.saveDraft("alice", "code-capacity", "return 3");
    await a.sync();
    await a.sync();
    const freshDisk = new Map<string, string>();
    const b = f.create({
      getItem: (key) => freshDisk.get(key) ?? null,
      setItem: (key, value) => {
        freshDisk.set(key, value);
      },
    });
    b.setOwner("alice");
    await b.sync();
    expect(Object.keys(b.progress().completed)).toEqual(["request-journey"]);
    expect(b.snapshot.data.drafts["code-capacity"].value).toBe("return 3");
    expect(b.snapshot.status).toBe("saved");
    expect(freshDisk.has(dailyStorageKey("alice"))).toBe(true);
  });

  it("keeps offline writes across reload and merges on reconnect", async () => {
    const f = fixture();
    const a = f.create();
    a.setOnline(false);
    a.setOwner("alice");
    practice(a, "alice");
    expect(a.snapshot.status).toBe("offline");
    expect(f.cloud.merge).not.toHaveBeenCalled();
    a.stop();
    const b = f.create();
    b.setOnline(false);
    b.setOwner("alice");
    expect(Object.keys(b.progress().completed)).toHaveLength(1);
    b.setOnline(true);
    await b.sync();
    expect(b.snapshot.status).toBe("saved");
    expect(f.remote.get("alice")?.practice["2026-09-02"]).toEqual([
      "request-journey",
    ]);
  });

  it("discards late network results after switching accounts", async () => {
    const f = fixture();
    let resolve!: (data: DailyLearningData) => void;
    f.cloud.merge = vi.fn(
      () =>
        new Promise<DailyLearningData>((done) => {
          resolve = done;
        }),
    );
    const store = f.create();
    store.setOwner("alice");
    practice(store, "alice");
    const aliceData = store.snapshot.data;
    const saving = store.sync();
    store.setOwner("bob");
    resolve(aliceData);
    await saving;
    expect(store.snapshot.owner).toBe("bob");
    expect(store.progress().completed).toEqual({});
    expect(JSON.parse(f.disk.get(dailyStorageKey("bob"))!).practice).toEqual(
      {},
    );
  });

  it("resends edits made while a write is in flight", async () => {
    vi.useFakeTimers();
    const f = fixture();
    let resolve!: (data: DailyLearningData) => void;
    f.cloud.merge = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      )
      .mockImplementation(async (_uid, data) => data);
    const store = f.create();
    store.setOwner("alice");
    practice(store, "alice");
    const submitted = store.snapshot.data;
    const saving = store.sync();
    practice(store, "alice", "scale-a-service");
    resolve(submitted);
    await saving;
    expect(store.snapshot.status).toBe("syncing");
    await vi.advanceTimersByTimeAsync(701);
    expect(Object.keys(store.progress().completed)).toHaveLength(2);
    expect(store.snapshot.status).toBe("saved");
    expect(f.cloud.merge).toHaveBeenCalledTimes(2);
  });

  it("retains changes and retries after a transient failure", async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.cloud.merge = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockImplementation(async (_uid, data) => data);
    const store = f.create();
    store.setOwner("alice");
    practice(store, "alice");
    await store.sync();
    expect(store.snapshot.status).toBe("error");
    await vi.advanceTimersByTimeAsync(2_001);
    expect(store.snapshot.status).toBe("saved");
    expect(Object.keys(store.progress().completed)).toHaveLength(1);
  });

  it("merges other tabs and realtime updates without dropping local work", () => {
    const f = fixture();
    const a = f.create();
    const b = f.create();
    a.setOwner(null);
    b.setOwner(null);
    practice(a, null);
    practice(b, null, "code-capacity");
    a.refresh();
    expect(Object.keys(a.progress().completed)).toHaveLength(2);
    a.setOwner("alice");
    practice(a, "alice");
    const incoming = {
      ...emptyDailyLearning(),
      practice: { "2026-09-02": ["code-capacity"] },
    };
    f.watchers.get("alice")?.forEach((receive) => receive(incoming));
    expect(Object.keys(a.progress().completed)).toHaveLength(2);
  });

  it("keeps a usable, exportable visit when storage fails and never overwrites corrupt data on load", () => {
    const f = fixture();
    const a = f.create({
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    });
    a.setOwner(null);
    practice(a, null);
    a.saveDraft(null, "code-capacity", "draft");
    a.refresh();
    expect(a.snapshot.storageAvailable).toBe(false);
    expect(Object.keys(a.progress().completed)).toHaveLength(1);
    expect(a.snapshot.data.drafts["code-capacity"].value).toBe("draft");
    f.disk.set(dailyStorageKey("alice"), "{broken");
    const b = f.create();
    b.setOwner("alice");
    expect(b.snapshot.storageAvailable).toBe(false);
    expect(f.disk.get(dailyStorageKey("alice"))).toBe("{broken");
  });
});
