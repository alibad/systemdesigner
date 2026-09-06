# Daily learning path

Resuming on another machine? Read [Continue development](./CONTINUE_DEVELOPMENT.md) for the handoff and [the product roadmap](../ROADMAP.md) for priorities. The app shows that same roadmap at `/roadmap`.

`/learn` is the daily practice entry point. The homepage and main navigation link to it. The course expansion includes four courses, 45 units, and 272 sessions: 202 sessions adapted from existing lessons, 37 mixed quiz checkpoints, and 33 JavaScript exercises. The existing registry-backed lessons remain the source for deeper reading.

## Learning loop

1. Read a short definition, concrete example, and takeaway.
2. Complete an authored ordering, calculation, or decision task; answer a short question set (normally four) or mixed checkpoint; or complete a JavaScript function.
3. Get an explanation or actual test output. Retry without a limit.
4. Answer every question correctly or pass every code test to complete a step.
5. Earn 20 path XP once, unlock the next step, and schedule a review.

The four courses unlock independently. Within each course, complete every session in a unit—including its final checkpoint—or pass that unit's placement assessment to unlock the next unit. The final coding exercise in each unit combines its earlier skills. Existing completions remain reviewable if the curriculum expands around them. A step counts toward the daily goal once per local calendar day; repeat completions never add XP. Placement grants no lesson completions, XP, or activity. Streaks include yesterday until today ends, so learners do not lose a streak before they have a chance to practice.

## Guided journey and mobile app

The guided journey has 15 parts and 325 study days. `content/learning/first-month.json` defines the opening 30 days (26 distinct sessions, eight review tasks, four milestones, and the `code-link-service` capstone). `second-month.json`, `third-month.json`, `fourth-month.json`, and `fifth-part.json` continue through day 130 for design and coding. Nine further parts, named for their subject (`build-with-language-models.json` through `apply-machine-learning.json`), continue through day 325 and cover every GenAI and ML session, including eight coding exercises for those courses. Across the whole journey each session appears exactly once in course order, with 53 review days (106 review tasks), 25 milestones, and six coding projects: one closing each of the first four months, one closing the first GenAI part, and one closing the journey. The outline lists the sources under `journeySources`; the generator validates part IDs, continuous day numbers, known sessions, course-order prerequisites, review-after-practice, project days that build code, a milestone at the end of every part, and writes the combined `content/learning/journey.json` that `lib/learning-journey.ts` loads. Day IDs run `day-01` to `day-325`.

`lib/learning-journey.ts` derives the first incomplete day across all parts. Ordinary days accept completed practice or valid unit placement; review days need a recorded full session at the current revision. `FirstMonth.tsx` renders the current chapter (the days up to the next milestone), a compact streak and daily-goal signal once the learner has practiced, the full path grouped by part, per-part progress, and the overall day count. The heading uses the part title for a part’s opening chapter and the milestone name afterwards. After day 130 the trail offers the Generative AI and Machine learning courses. Milestones require every earlier day, including reviews. There are no calendar locks: a study day describes curriculum progress rather than elapsed time.

V4 adds `journey.enrollment` (a preference with an edit timestamp) and bounded `journey.tasks` keyed by day/session. Tasks merge by current content revision and then timestamp. Completing a review task does not award a second completion or extra XP. Account changes close active sessions; enrollment and task writes carry the same owner guard as other progress.

The `/learn` shell omits the reference sidebar and global floating tools. Phone navigation stays at the bottom; lesson and placement dialogs fill the viewport with a compact header, scrollable content, and persistent actions. `LearningInstall.tsx` registers the production-only service worker and exposes browser installation instructions inside settings. Browser installation does not create an App Store or Play Store release.

## Authored practice and placement

Every one of the 202 lesson sessions now has a hand-authored pack: 202 packs, 961 groups, and 2,883 variants across the system-design, GenAI, and ML courses. Each session presents three to five exercises drawn from calculation, ordering, matching, and scenario-decision tasks whose answer keys were checked against the lesson sources. No generated practice remains in the curriculum. `lib/skill-exercise-schema.ts` validates numeric answers, complete ordering permutations, matching pairs, and choice answers with option-specific feedback. `SkillPractice.tsx` renders numbers, keyboard-operable ordering, and role matching; scenario choices use the existing shared `InteractiveQuiz`. Concept context precedes every task, hints remain optional, and normal practice allows unlimited retries. Reviews rotate the chosen variant. Derived practice is explicitly marked with its source; it is not counted as newly hand-authored content.

`PlacementTest.tsx` starts at the first unfinished/unplaced unit and checks units sequentially. The generated `placementStepIds` reference a mixed checkpoint for noncoding units or all runnable tasks for a coding unit. Generation and tests ensure the checkpoint includes every skill in its unit. Every answer must be correct; coding requires each task to pass its first test run. Assessment answers are locked, quiz explanations are withheld, and coding hints are disabled. A failure or “I’m not sure yet” directs the learner to the relevant unit and lessons. Closing an unfinished assessment grants nothing; completed unit grants persist.

The course map labels placed units separately, counts them toward course coverage, and keeps their lessons available for practice. `recordUnitPlacement` requires every assessment part, a matching unit revision, and satisfied prerequisites. Assessment runs in the browser and is guidance for self-study, not trusted certification.

## Skill evidence and adaptive reviews

All 202 lesson sessions and 25 coding tasks have stable skill IDs. Checkpoints report evidence against the underlying lesson skills, so they do not create duplicate review cards. `lib/learning-evidence.ts` merges attempts and derives the review queue. Every answer, code run, or requested hint contributes evidence. A separate full-pass flag requires a completed practice set or successful assessment; correct partial answers alone cannot strengthen recall.

| Latest evidence | Next review |
| --- | --- |
| Incorrect or unfinished practice | Today |
| Full pass after a mistake or hint | Tomorrow |
| First clean full pass | In 3 days |
| Clean full pass on or after its due date | Prior interval × 2.2, rounded up; minimum 3 days, maximum 30 |
| Clean practice before the due date | Keep the interval; schedule from the practice date |

Daily evidence preserves any mistake or hint, even when the learner retries, hides a hint, or merges another device's progress. Duplicate same-day passes cannot extend the interval. The review view prioritizes skills needing practice, then overdue checks, and explains why each is due. When more than five skills are due, the Practice tab and the trail’s recall banner present a bounded daily set of five in that priority order, with the full queue one tap away; the queue itself is unchanged. Unfinished unlocked skills can enter the queue. Previously completed sessions without new evidence retain their legacy review date until the next attempt supplies evidence.

“Building recall” and “Strong recall” describe this scheduling heuristic, not measured proficiency probabilities. The retained evidence is bounded to four recent dates per skill; it does not retain answer text, code, or a complete attempt history. Future work includes finer skill boundaries, misconception diagnosis, and validation with learners.

## Content and state

- Course organization: `content/learning/course-outline.json`. `pnpm generate:learning` reads the referenced registry entries, Markdoc introductions, assessment references, and coding data sources. It generates `catalog.json` (lightweight course/unit/step metadata), `sessions.json` (full session content), and co-located `quiz/path-*-checkpoint.json` files. Never edit generated outputs directly.
- Session API: `/api/learning/sessions/[id]` validates and serves one full session at a time. The client course map does not import the full collection of introductions, questions, or coding tests.
- Compatibility: the six original step IDs and their data sources are preserved. The original three design sessions retain their authored introductions; later lesson summaries come from source Markdoc.
- Skills and revisions: the catalog has 227 explicit skills. The generator hashes lesson, assessment, and exercise sources into skill revisions. A unit revision hashes only its placement assessment's own content (checkpoint questions without their embedded lesson revisions, or coding tests), so improving a lesson's practice invalidates that lesson's evidence without revoking a placement the learner earned; changing the assessment itself still does. Existing lesson completions remain intact after content changes.
- Prerequisites: each lesson session carries up to four registry prerequisites (title and path). The lesson's “Go a little deeper” disclosure lists them before the full-lesson link.
- Rich exercises: co-located `data/skill-exercises.json` files are referenced by the outline's `exerciseSources`. Author sources, then run `pnpm generate:learning` to refresh session references and revisions.
- Questions: source lesson quiz files or the canonical quiz bank, rendered by shared `InteractiveQuiz` in sequential session mode. Non-checkpoint sessions normally use four questions; successful reviews advance through the source question set. Full lesson quizzes retain their existing behavior. Course checkpoints contain 4–8 questions drawn across their unit. The content gate requires one canonical lesson quiz and separately validates explicitly referenced course checkpoints.
- Starter programs: co-located `code/daily-*.js` and `code/code-*.js` assets served by the content API. The 22 additional exercises have `.solution.js` reference implementations. Hints, requirements, and fixtures live in co-located `data/learning-code-challenges.json` files listed by the course outline. Reference solutions are validated against every fixture.
- UI: course map and Continue action on the main view, reviews in a separate tab, custom Radix popup course/goal menus, and account/backup utilities inside the learning-settings dialog.
- The path is a practice hub, not a replacement lesson route. No concrete content pages or duplicate Markdoc bodies are added.
- Progress, track selection, daily goal, and coding drafts save locally, can be exported/imported, and sync to an optional account. Path XP stays separate from account XP; it is practice feedback, not a verified credential.
- Progress is schema-validated on load. Unknown step IDs are dropped. Storage failures keep the current visit usable and display a persistence notice.

## JavaScript execution

The runner creates a sandboxed iframe with `allow-scripts` only, then executes the submitted function in a Blob worker. The worker inherits a CSP that blocks network access, and has no access to the application window or its storage. A two-second worker timeout terminates infinite loops; a five-second outer timeout handles startup failures. Closing the exercise removes the runner, and editing the code clears previous test results. Results use structural equality, preserving types and array order while ignoring object property order. Each test receives a cloned argument list; an exercise that requires preserved inputs fails if its function mutates those arguments.

This is browser-based self-assessment with visible tests. Do not use its results for competitive rankings or trusted account rewards without an authoritative grading service. Other languages and production service exercises would need a separate execution environment.

Relevant browser behavior: [iframe sandboxing](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#sandbox), [worker CSP inheritance](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy#csp_in_workers).

## Local verification

Run the repository gates:

```sh
pnpm audit:content
pnpm validate:registry --strict
pnpm validate:content
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

With the app running on port 3100 (`pnpm dev --port 3100` or, after building, `pnpm start --port 3100`), run:

```sh
pnpm qa:learning-path
pnpm qa:adaptive-learning
pnpm qa:first-month
pnpm qa:learning-journey
```

The browser scripts use Playwright's Chromium. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use an installed Chrome executable, or install Playwright Chromium locally. Set `LEARNING_QA_BASE_URL` for another port. Screenshots are written to `.artifacts/daily-learning/` and `.artifacts/adaptive-learning/`, and `.artifacts/first-month/`.

The checks cover the first design unit and its checkpoint, every coding exercise through the real worker, all 202 lesson sessions through the curriculum sweep, session/quiz load retries, wrong answers, unit unlocking, repeat completion, delayed review question rotation, coding input mutation, infinite-loop termination, editor isolation, draft/backup restoration, storage quota failure, popup menus, keyboard navigation, mobile dark mode, and homepage/roadmap navigation. The adaptive suite adds placement across all four courses, failures/cancel/retry, first-unit coding assessment, authored variants, retained assistance, review priority/recovery, no fabricated placement completions, and legacy migration into v5. Continuity checks exercise partial answers, feedback, completed groups, quiz cursors, and code history through reloads. Unit tests traverse every course, validate all practice packs, and check placement coverage for all 45 units.

The first-month browser suite completes every day through the visible UI, checks mistakes and hints, reloads a partially completed review day, rejects an incorrect cache-invalidation project, restores its draft, verifies all four milestones, and confirms the trail continues into part two. The journey suite seeds a completed first month as data (never graded answers), then completes the first chapter of part two (days 31–38) through authored practice, a coding task, a review day, and the checkpoint milestone, checking prerequisite links, the streak signal, per-part progress, and the full-path listing. Against a production server, `LEARNING_QA_OFFLINE=1 pnpm qa:first-month` additionally checks offline reload and exercise execution. Real-device home-screen installation and retention studies are separate checks.

## Product expansion

Expand authored exercises beyond the first three design units, refine skills where lesson-level evidence is too broad, and add debugging/output-prediction interactions. Most of the course map still uses generated summaries and source assessments. Validate placement difficulty and review intervals with learners before making proficiency claims. See the roadmap for sequencing.

## Portable progress contract

`lib/daily-learning-data.ts` defines version 5. Successful practice is a set of `(local calendar day, step ID)` pairs. Completion, XP, streaks, and legacy review dates are derived from that set, so merging the same success repeatedly never adds an award. Distinct offline practice days are retained. Daily goals, selected track, and each coding draft carry independent monotonically increasing edit revisions. Newer revisions win; equal revisions use a deterministic value comparison so devices converge. Drafts are limited to 20,000 characters. Displaced drafts are retained in a bounded history: up to four recent values per coding exercise, within a shared 64 KB budget. The editor can preview and restore them as a new edit. Export remains the way to preserve an unlimited snapshot.

The v3 fields remain: `evidence` (skill/day rollups with revision, timestamp, latest correctness, any mistake, any hint, and any full pass) and `placements` (unit revision, day, timestamp). Same-day merges preserve mistake/hint/pass flags; the latest timestamp decides correctness, with incorrect winning a timestamp tie. Evidence retains four recent dates per skill and filters obsolete content revisions. Placement merges prefer the current revision, then the newer timestamp, with a deterministic tie-break. Neither record creates a lesson completion.

The browser keeps the existing namespace `sd:daily-learning:v2:guest` and `sd:daily-learning:v2:user:<uid>` intentionally: v2 documents migrate in place to schema v5, with empty evidence, placement, journey, session, and draft-history records. Existing `sd:daily-learning:v1` and `sd:code-draft:<step-id>` values migrate into the guest document once; the old keys remain untouched as recovery copies. V3 documents gain an empty journey; v4 documents gain empty sessions and draft history. V5 is authoritative afterward. Backup envelope version 1 accepts v2, v3, v4, and v5 payloads. Account sign-in never implicitly imports guest data. The learner can review the anonymous copy and confirm adding it to the account. This is a copy, so that original guest work remains visible when signed out; progress created only in an account never flows into guest storage or another account.

`lib/daily-learning-store.ts` owns scoped local caches, realtime reconciliation, retry/backoff, and generation guards. A change of account immediately invalidates pending UI sessions and network callbacks. The whole local document acts as a durable pending-write snapshot: reopening or reconnecting merges it with the server again. Browser storage failures retain an exportable in-memory visit and show a warning. Corrupt or future cloud schemas fail closed instead of being overwritten.

`lib/daily-learning-cloud.ts` uses the existing Firebase Auth identity and the `dailyLearning` field on `users/{uid}`. It only updates that field, preserving profile and account gamification data. Existing owner-only user rules apply; no rule deployment is required. A transaction reads and merges the current server state before writing; concurrent changes trigger retries. Realtime snapshots bring other-device changes into the local document. See [Firebase transactions](https://firebase.google.com/docs/firestore/manage-data/transactions) and [snapshot listeners](https://firebase.google.com/docs/firestore/query-data/listen).

Backup files contain only the learning contract, format/version, and export time. They contain no UID, profile, tokens, or unrelated storage. Imports enforce schemas, known IDs, real calendar dates, draft lengths, and a 750 KB file limit. A preview lists completed sessions, placed units, evidence records, drafts, extra XP, resulting preferences, and conflict behavior before applying a merge.

Offline support retains local practice/drafts and queues account updates for the next connection. In production, `learning-sw.js` prepares an anonymous `/learn` shell plus hashed application assets, and caches previously fetched public session, exercise, quiz, and starter resources. It excludes authentication, Firestore, and other account requests. `learningRevision` query keys separate exercise versions; session responses must match the loaded catalog. New downloads need a connection. Unfinished quizzes and exercises are persisted alongside completed review-day parts and coding drafts. Coding results remain client-side self-assessment.

## Local account-sync verification

The regular test suite covers the merge contract, v1/v2/v3 migration, two-device restoration, sign-out/account switches, stale callbacks, offline reload/reconnect, edits during an active upload, retries, cross-tab refresh, storage failures, and evidence/placement ownership. The browser scripts also cover backup download, import preview/cancel/confirm, fresh-browser restore, draft continuity, duplicate import, corrupt input, and offline local changes.

For actual Auth, Firestore transactions, realtime updates, and ownership-rule checks, install Firebase CLI and Java 21+ and run this isolated demo environment:

```sh
firebase emulators:start --only auth,firestore --project demo-systemdesigner-learning --config firebase.learning-emulators.json
```

In a second terminal:

```sh
pnpm qa:learning-sync
```

The integration suite connects only to local ports 9099 (Auth) and 8080 (Firestore) and the `demo-systemdesigner-learning` project. It does not use the app's configured Firebase project. These six tests are skipped in the default unit run unless explicitly enabled by the verification script. They include v2 server migration and concurrent evidence/placement updates. Emulator rules come from the unchanged repository `firestore.rules`.

## Selected visual direction and interactive models

The Learn tab uses the approved chapter trail: a current lesson, completed and upcoming nodes, a fixed primary action, and direct continuation after finishing. Courses and Practice remain available in the bottom navigation. Placement is an optional entry, and settings hold account and backup controls.

`LearningLab` introduces request flow, capacity under failure, and cache freshness before grading. `ExerciseScene` uses optional scene metadata from the shared exercise schema; all 27 first-unit variants have scenes. The model state is exploratory and never awards progress. Only the existing graded practice completion does that. The pure capacity and cache transitions live in `lib/learning-lab.ts`; tests check their behavior and model/answer consistency. Original session IDs are preserved.

Feedback is focused and scrolled into view above the fixed action footer. Multiple-choice authored practice advances directly after feedback. Numeric and ordering answers still require an explicit check. Completed challenges update the lesson progress bar; completing the lesson retains the existing evidence/XP contract. Illustration assets are included in the public-only offline cache. See root `design-qa.md` for visual comparisons and the final verification scope.

## Whole-curriculum practice and resume

Every noncoding lesson now has a hand-authored exercise pack: 202 packs and 2,883 variants. Matching asks learners to connect a part with its job; it never treats optional or parallel process steps as a mandatory sequence. Ordering steps are shuffled for display rather than listed in solved order, choice options are written so their length carries no signal about the answer, and hints nudge the method instead of naming the answer. Short descriptions remain linked to the complete source explanation. Source questions and explanations are retained in review rotation. Larger source models load individually on request; the guided lesson remains the main flow.

Session snapshots store learner input, the current review variant, hints, phase, and completed exercise inputs. Quiz scores and completed exercise groups are recomputed on restoration. Unknown/oversized inputs fail validation; changed content revisions clear obsolete attempts without erasing historical practice. Per-session edit revisions merge deterministically; null is a completion/reset marker that survives older snapshots. Guest/account ownership guards apply to every save. Placement deliberately starts fresh and never resumes an old assessment.

Use `pnpm qa:learning-continuity` for browser interruption/recovery checks and `pnpm qa:learning-curriculum` for all 202 lesson completions. The regular test suite verifies every pack and source-model reference, migration, restored-input validation, and numerical planning examples.
