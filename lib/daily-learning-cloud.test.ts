import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  setDoc,
  terminate,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import { createDailyLearningCloud } from "./daily-learning-cloud";
import {
  applyDailyProgress,
  dailyProgress,
  emptyDailyLearning,
  recordDailyAttempt, recordUnitPlacement, parseDailyLearning, recordJourneyTask, saveSessionResume, saveCodingDraft,
} from "./daily-learning-data";
import { completePathStep, ALL_SKILLS, LEARNING_TRACKS } from "./learning-path";
import { FIRST_MONTH, currentJourneyDay } from './learning-journey';

// Opt-in only: all writes go to the local demo emulators, never a configured project.
const enabled = process.env.LEARNING_EMULATOR_TESTS === "1";
describe.skipIf(!enabled)(
  "daily learning against Firebase Auth + Firestore emulators",
  () => {
    const clients: { app: FirebaseApp; auth: Auth; db: Firestore }[] = [];
    let owner = "";
    let otherOwner = "";
    beforeAll(async () => {
      const run = Date.now();
      for (let index = 0; index < 3; index++) {
        const app = initializeApp(
          { apiKey: "demo-api-key", projectId: "demo-systemdesigner-learning" },
          `learning-${run}-${index}`,
        );
        const auth = getAuth(app);
        connectAuthEmulator(auth, "http://127.0.0.1:9099", {
          disableWarnings: true,
        });
        const db = getFirestore(app);
        connectFirestoreEmulator(db, "127.0.0.1", 8080);
        clients.push({ app, auth, db });
      }
      const email = `learner-${run}@example.test`;
      owner = (
        await createUserWithEmailAndPassword(
          clients[0].auth,
          email,
          "local-test-password",
        )
      ).user.uid;
      await signInWithEmailAndPassword(
        clients[1].auth,
        email,
        "local-test-password",
      );
      otherOwner = (
        await createUserWithEmailAndPassword(
          clients[2].auth,
          `other-${run}@example.test`,
          "local-test-password",
        )
      ).user.uid;
      await setDoc(doc(clients[0].db, "users", owner), {
        uid: owner,
        isAdmin: false,
        displayName: "Learning test",
      });
      await setDoc(doc(clients[2].db, "users", otherOwner), {
        uid: otherOwner,
        isAdmin: false,
      });
    }, 30_000);
    afterAll(async () => {
      await Promise.all(
        clients.map(async (client) => {
          await terminate(client.db);
          await deleteApp(client.app);
        }),
      );
    });

    it("converges concurrent devices, delivers realtime changes, and awards a completion once", async () => {
      const a = createDailyLearningCloud(clients[0].auth, clients[0].db);
      const b = createDailyLearningCloud(clients[1].auth, clients[1].db);
      const data = applyDailyProgress(emptyDailyLearning(), (p) =>
        completePathStep(p, "request-journey", "2026-09-02"),
      );
      const reviewed = applyDailyProgress(data, (p) =>
        completePathStep(p, "request-journey", "2026-09-03"),
      );
      await Promise.all([a.merge(owner, data), b.merge(owner, reviewed)]);
      await a.merge(owner, data);
      const restored = await b.merge(owner, emptyDailyLearning());
      expect(Object.keys(dailyProgress(restored).completed)).toEqual([
        "request-journey",
      ]);
      expect(dailyProgress(restored).completed["request-journey"].reviews).toBe(
        1,
      );
      const received = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          unsubscribe();
          reject(new Error("Realtime update did not arrive"));
        }, 10_000);
        const unsubscribe = b.watch(
          owner,
          (incoming) => {
            if (incoming.drafts["code-capacity"]?.value === "synced draft") {
              clearTimeout(timer);
              unsubscribe();
              resolve();
            }
          },
          () => {
            clearTimeout(timer);
            unsubscribe();
            reject(new Error("Realtime listener failed"));
          },
        );
      });
      await a.merge(owner, {
        ...restored,
        drafts: {
          "code-capacity": { value: "synced draft", updatedAt: Date.now() },
        },
      });
      await received;
      expect(
        (await getDoc(doc(clients[0].db, "users", owner))).data()?.displayName,
      ).toBe("Learning test");
    }, 30_000);

    it("enforces ownership for reading and writing and rejects a mismatched active account", async () => {
      await expect(
        getDoc(doc(clients[2].db, "users", owner)),
      ).rejects.toMatchObject({ code: "permission-denied" });
      await expect(
        updateDoc(doc(clients[2].db, "users", owner), {
          dailyLearning: emptyDailyLearning(),
        }),
      ).rejects.toMatchObject({ code: "permission-denied" });
      await expect(
        createDailyLearningCloud(clients[2].auth, clients[2].db).merge(
          owner,
          emptyDailyLearning(),
        ),
      ).rejects.toThrow("account changed");
    });

    it("syncs interrupted v5 sessions, preserves concurrent code and propagates completion resets", async () => {
      await updateDoc(doc(clients[0].db, "users", owner), {dailyLearning: emptyDailyLearning()});
      const a=createDailyLearningCloud(clients[0].auth,clients[0].db), b=createDailyLearningCloud(clients[1].auth,clients[1].db);
      const skill=ALL_SKILLS[0];
      const session={revision:skill.revision,phase:"practice" as const,review:1,failedSkills:[skill.id],lastScore:"",quiz:{index:1,answers:[1,-1]}};
      const left=saveSessionResume(saveCodingDraft(emptyDailyLearning(),'code-capacity','left device'),skill.stepId,session);
      const right=saveCodingDraft(emptyDailyLearning(),'code-capacity','right device');
      await Promise.all([a.merge(owner,left),b.merge(owner,right)]);
      const merged=await b.merge(owner,emptyDailyLearning());
      expect(merged.sessions[skill.stepId].value).toEqual(session);
      expect(new Set([merged.drafts['code-capacity'].value,...merged.draftHistory['code-capacity'].map(v=>v.value)])).toEqual(new Set(['left device','right device']));
      const done=saveSessionResume(merged,skill.stepId,null);
      await a.merge(owner,done);
      expect((await b.merge(owner,left)).sessions[skill.stepId].value).toBeNull();
      expect(dailyProgress(merged).completed).toEqual({});
    },30_000);

    it("migrates v2 cloud progress and merges concurrent placement and skill evidence", async () => {
      const reference=doc(clients[0].db,'users',owner);
      const {evidence:_e,placements:_p,journey:_j,sessions:_s,draftHistory:_h,...base}=emptyDailyLearning();
      const legacy={...base,version:2,practice:{'2026-09-01':['request-journey']}};
      await updateDoc(reference,{dailyLearning:legacy});
      const a=createDailyLearningCloud(clients[0].auth,clients[0].db),b=createDailyLearningCloud(clients[1].auth,clients[1].db);
      const skill=ALL_SKILLS[0],unit=LEARNING_TRACKS[0].units[0];
      const failed=recordDailyAttempt(parseDailyLearning(legacy),{skillId:skill.id,revision:skill.revision,correct:false,day:'2026-09-03',at:1});
      let placed=recordUnitPlacement(parseDailyLearning(legacy),unit.id,unit.placementStepIds,unit.revision,new Date(2026,8,3));
      placed=recordDailyAttempt(placed,{skillId:skill.id,revision:skill.revision,correct:true,passed:true,day:'2026-09-03',at:2});
      await Promise.all([a.merge(owner,failed),b.merge(owner,placed)]);
      const restored=await a.merge(owner,emptyDailyLearning());
      expect(restored.version).toBe(5);expect(restored.placements[unit.id].revision).toBe(unit.revision);
      expect(Object.values(restored.evidence)[0]).toMatchObject({correct:true,mistake:true,passed:true});
      expect(dailyProgress(restored).completed['request-journey'].completedOn).toBe('2026-09-01');
      expect(dailyProgress(restored).skillReview?.[skill.id].interval).toBe(1);
      expect((await getDoc(reference)).data()?.displayName).toBe('Learning test');
    },30_000);

    it("migrates v3 accounts and merges two devices finishing different parts of a review day", async () => {
      let seed = emptyDailyLearning();
      for (const day of FIRST_MONTH.days.slice(0,8)) for (const id of day.stepIds)
        seed = applyDailyProgress(seed, progress => completePathStep(progress,id));
      const {journey:_,sessions:_s,draftHistory:_h,...legacy} = seed;
      await updateDoc(doc(clients[0].db,'users',owner), {dailyLearning:{...legacy,version:3}});
      const a = createDailyLearningCloud(clients[0].auth,clients[0].db);
      const b = createDailyLearningCloud(clients[1].auth,clients[1].db);
      const migrated = await a.merge(owner,emptyDailyLearning());
      expect(migrated.version).toBe(5);
      let left = applyDailyProgress(migrated,progress=>completePathStep(progress,'request-journey'));
      left = recordJourneyTask(left,'day-09','request-journey');
      left.journey.enrollment = {value:'guided',updatedAt:Date.now()};
      let right = applyDailyProgress(migrated,progress=>completePathStep(progress,'cache-a-read'));
      right = recordJourneyTask(right,'day-09','cache-a-read');
      await Promise.all([a.merge(owner,left),b.merge(owner,right)]);
      const restored = await b.merge(owner,emptyDailyLearning());
      expect(Object.keys(restored.journey.tasks)).toHaveLength(2);
      expect(restored.journey.enrollment.value).toBe('guided');
      expect(currentJourneyDay(dailyProgress(restored),restored.journey)?.number).toBe(10);
      expect(Object.keys(dailyProgress(restored).completed)).toHaveLength(8);
    },30_000);

    it("fails closed on a newer cloud schema without erasing it", async () => {
      await updateDoc(doc(clients[2].db, "users", otherOwner), {
        dailyLearning: { version: 99 },
      });
      await expect(
        createDailyLearningCloud(clients[2].auth, clients[2].db).merge(
          otherOwner,
          emptyDailyLearning(),
        ),
      ).rejects.toThrow();
      expect(
        (await getDoc(doc(clients[2].db, "users", otherOwner))).data()
          ?.dailyLearning,
      ).toEqual({ version: 99 });
    });
  },
);
