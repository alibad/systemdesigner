# Continue development on another machine

Last updated: September 3, 2026.

For the next Claude session, start with [`CLAUDE_HANDOFF.md`](CLAUDE_HANDOFF.md). The verified production release is `dd26a9bd6a359fb005e6495aaeea5dd222ccf8da`, deployed to `https://www.systemdesigner.net/learn` as Vercel deployment `dpl_CXX4HZeCzDqSVruWrnQWT4UdkEo1` on September 4, 2026 (after `cc175c2d` and `00cbd003` earlier the same day). Live guest checks passed for the content API on newly authored GenAI and ML packs, the retired generated-practice path, and the second-month journey chapter through the live UI. Physical-device and live signed-in two-device checks remain outstanding.

The product direction is a substantial Duolingo-style engineering learning platform. `/learn` has four courses, 43 units, 264 sessions, and 227 skills. Every one of its 202 noncoding lesson sessions now uses hand-authored practice: 202 packs, 961 groups, 2,883 variants, across all four courses. No generated practice remains. The guided journey covers every design and coding session across 130 study days in five parts. The catalog links 400 source-model references; later lessons open their models on demand, while the opening three use their compact models. The opening trail and its request/capacity/cache models remain the approved visual direction. Version 5 adds revision-aware quiz/exercise resume and recoverable recent coding drafts. Placement, adaptive review, the 130-study-day journey, and offline visited content remain available.

Read `AGENTS.md`, `ROADMAP.md`, and `docs/daily-learning-path.md` before changing architecture or curriculum. The public `/roadmap` page renders `ROADMAP.md` directly.

## Checkpoint and delivery

- Work directly on `main`, remote `https://github.com/alibad/systemdesigner.git`.
- The previous-machine checkpoint is `a5d66b2d` (`feat: add daily learning starter and continuation roadmap`). It contained six steps.
- Portable progress, the four-course expansion, richer practice/placement/adaptive review, and the mobile first month were continued locally from that checkpoint. Check `git status` and recent commits for the latest delivery state. This document is not authorization to push or deploy.
- Production deployments were authorized after the September 3 local verification (release `d67a2ec0`), for the journey continuation (release `041b246b`), and for the September 4 practice rounds (releases `3089d150` and `cc175c2d`). Releases use `main` and the existing Vercel project `systemdesigner` in `alibads-projects`, with `www.systemdesigner.net` as the production domain. Check the deployment associated with the latest commit for its actual release status. Account integration uses isolated Firebase emulators locally; a live signed-in two-device smoke check remains device validation.

## Get running

Use Node.js 20+ (verified with 22.22.0) and pnpm 10.4.1:

```sh
pnpm install --frozen-lockfile
pnpm dev --port 3100
```

Open `http://localhost:3100/learn` and `http://localhost:3100/roadmap`. Inspect local changes before pulling. See `docs/DEVELOPMENT.md` for cloning, Corepack, and PowerShell setup. Run the production build only after stopping the dev server so they do not share `.next` writes.

On the current machine, another project occupies port 3100. SystemDesigner uses port 3101. Verify the process and its working directory before stopping a server; do not stop the other project.

Anonymous learning needs no environment variables. Optional account sync uses the existing Firebase configuration and sign-in UI. Secrets and authentication do not travel through Git.

## Implemented behavior

| Course | Units | Sessions |
| --- | ---: | ---: |
| System design | 12 | 77 |
| Coding | 6 | 25 |
| Generative AI | 14 | 90 |
| Machine learning | 11 | 72 |

- 202 sessions adapted from registry-backed lessons, 37 mixed unit checkpoints, and 25 coding exercises. The broader library still has 425 entries.
- Definition → example/key idea → practice → feedback/retry → completion. Most adapted lesson assessments select four source questions.
- Unit prerequisites and checkpoint gating; courses progress independently. Placement can satisfy a unit without adding lesson completions, XP, or daily activity. Locked sessions still link to their full lessons. Stable original completion IDs are preserved.
- All 202 lessons have hand-authored packs: 961 groups and 2,883 variants across the design, GenAI, and ML courses. Each group is one skill with three variants that differ in substance rather than in wording, so a learner's first, second, and third review are different problems. Lesson sessions link their registry prerequisites.
- A 130-study-day guided journey in five parts covers every design and coding session in course order: the first month blends the first three design units with the first two coding units (26 sessions, eight review tasks, four milestones, the link-service capstone); parts two to five add the remaining 76 sessions, 28 review days, 12 milestones, and a coding project at the end of each month. Day IDs are stable, and the trail hands off to the GenAI and ML courses at the end.
- Onboarding offers foundations or placement. Ordinary days accept valid placement; review days still require practice. Study days follow progress rather than the calendar.
- A chapter path with completed/current/locked nodes, direct next-day continuation, and an optional placement entry. Three introductory models and 27 authored exercise scenes make request flow, capacity/failure, and caching visible. Scene metadata is validated against the exercise schema; numeric model parameters are checked against the authored answers.
- A compact learning shell, full-screen lesson/placement dialogs, fixed action footers, phone bottom navigation, safe-area spacing, and dark mode.
- Home-screen installation support and a public-resource service worker for the prepared shell and previously visited practice. Account data never enters the page cache; new content and sync need a connection.
- Placement assesses each unit in sequence. Noncoding checkpoints represent every skill; coding requires all tasks to pass their first test run, without hints. Failed or abandoned assessments never grant a unit. Passing an earlier unit remains valid if the learner stops later.
- Custom Radix course and goal menus, keyboard-operable Learn/Courses/Practice tabs, weekly activity, course progress, and a Continue action.
- The last coding exercise in each unit combines previous skills. The 22 additional exercises have external starter/reference files and edge-case fixtures. Every exercise runs in an isolated browser worker.
- Structural result comparison and input-mutation checks, hints, timeout protection, and saved drafts.
- All answers/tests must pass. Each new session earns 20 path XP once, separately from account gamification.
- Local-day goals (1–3 sessions), streaks, rotating review variants, and adaptive scheduling across all 227 skills. Full passes earn a delay; mistakes/hints return sooner. Partial answers do not increase recall strength.
- Version 5 learning data, deterministic merging, v1/v2/v3/v4 migration, revision-aware placement, bounded daily evidence, optional account sync, and explicit backup preview/import inside settings.
- Separate guest/account caches, safe account switching, durable pending changes, retries, and realtime reconciliation. Guest work is copied to an account only after explicit review.

## Implementation map

| Area | Files |
| --- | --- |
| Course map and menus | `app/learn/page.tsx`, `components/learning/DailyLearningPath.tsx` |
| Session loading and UI | `app/api/learning/sessions/[id]/route.ts`, `LearningSessionLoader.tsx`, `LearningSession.tsx`, `CodingExercise.tsx` under `components/learning/` |
| Curriculum source | `content/learning/course-outline.json`; journey parts `first-month.json`, `second-month.json`, `third-month.json`, `fourth-month.json`, `fifth-part.json` |
| Interactive systems | `components/learning/LearningLab.tsx`, `SystemScene.tsx`, `ExerciseScene.tsx`, `lib/learning-lab.ts`, `public/learning/` |
| Guided month and milestones | `lib/learning-journey.ts`, `components/learning/FirstMonth.tsx` |
| Phone installation and offline caching | `components/learning/LearningInstall.tsx`, `public/learning-sw.js`, `public/manifest.json`, `lib/learning-assets.ts` |
| Generated catalog, sessions, and journey | `content/learning/catalog.json`, `content/learning/sessions.json`, `content/learning/journey.json`, `scripts/generate-learning-catalog.mjs` |
| Checkpoints and coding sources | Co-located lesson `quiz/path-*-checkpoint.json`, `data/learning-code-challenges.json`, and `code/code-*.js` files |
| Rich exercise sources and renderer | Co-located `data/skill-exercises.json` and `daily-practice.generated.json`, `scripts/learning-source-practice.mjs`, `lib/skill-exercise-schema.ts`, `components/learning/SkillPractice.tsx` |
| Existing lesson models in practice | `components/learning/SourceExploration.tsx`, generated session `models` references |
| Placement and adaptive review UI | `components/learning/PlacementTest.tsx`, `components/learning/AdaptiveReviewPanel.tsx` |
| Progression, evidence, and scheduling | `lib/learning-path.ts`, `lib/learning-evidence.ts`, `lib/learning-quiz.ts` |
| Versioned data, migration, merge, backups | `lib/daily-learning-data.ts`, `lib/learning-resume.ts` |
| Local persistence and sync lifecycle | `lib/daily-learning-store.ts`, `lib/daily-learning-cloud.ts`, `hooks/useDailyLearning.ts` |
| Settings utilities | `components/learning/LearningProgressControls.tsx` |
| JavaScript isolation and comparison | `lib/coding-runner.ts` |
| Shared quizzes | `components/fundamentals/InteractiveLearning.tsx` |
| Core tests | `lib/learning-path.test.ts`, `lib/learning-exercises.test.ts`, `lib/learning-evidence.test.ts`, `lib/daily-learning-*.test.ts` |
| Browser verification | `scripts/verify-daily-learning.mjs`, `scripts/verify-adaptive-learning.mjs`, `scripts/verify-first-month.mjs`, `scripts/verify-learning-journey.mjs`, `scripts/verify-learning-continuity.mjs`, `scripts/verify-learning-curriculum.mjs`, `scripts/verify-learning-models.mjs`, shared `scripts/learning-browser-helpers.mjs` |
| Account integration | `firebase.learning-emulators.json`, `scripts/verify-daily-learning-sync.mjs` |

Author the course outline, journey parts, and co-located sources, then run `pnpm generate:learning`. Do not hand-edit generated outputs (`catalog.json`, `sessions.json`, `journey.json`, checkpoints, or `daily-practice.generated.json`). `pnpm validate:learning` checks for drift and is included in `pnpm validate:content`. A new full lesson still requires the registry-first authoring workflow. Adding a course session around an existing lesson does not require a duplicate registry entry or body. To replace a derived pack, write `data/skill-exercises.json` beside the lesson, add it to `exerciseSources`, delete the stale generated file, and regenerate; variant IDs must be unique across all packs.

## Limits and next milestone

All lesson sessions now have hand-authored practice and model access, so no `data/daily-practice.generated.json` files remain in the tree. `scripts/learning-source-practice.mjs` is still wired into the generator and would derive a placeholder pack for any new lesson added without an `exerciseSources` entry; that is a fallback, not the shipped state.

`lib/learning-resume.ts` validates learner inputs and rechecks restored quizzes and completed exercise groups. `DailyLearningData.sessions` retains a per-session current value or null reset marker; revisions invalidate obsolete attempts. `draftHistory` keeps up to four displaced values per coding session, with a shared 64 KB retention budget. It is a recovery convenience, not an unlimited history. Importing progress does not award completion for unfinished work.

Continue in this repository and keep SystemDesigner.net as the product. Physical-phone installation and a live signed-in smoke test remain external checks. The September 3 release was explicitly requested; future releases still require authorization. Validate learning outcomes before making proficiency claims.
Preserve these boundaries:

- Schema version is 5, while browser keys intentionally remain `sd:daily-learning:v2:guest` and `sd:daily-learning:v2:user:<uid>` for in-place migration. V1 progress and old draft keys remain as recovery copies.
- Unit revisions hash placement-assessment content only (checkpoint questions without embedded lesson revisions, or coding tests). Lesson step revisions still include practice packs, models, and prerequisites. The September 3 regeneration changed every unit and lesson revision once.
- Evidence retains the four most recent practice dates per skill. Same-day mistakes and hints survive retries and merges. Current content revisions invalidate old evidence and placement grants, while preserving historical completions.
- Guest data is shared within a browser profile. Copying it into an account does not erase the original guest work. Account-only work must never leak back into guest mode or another account.
- Successful practice, completed review-day parts, and unfinished attempts are portable. Coding drafts retain bounded recent alternatives inside the editor.
- The production service worker caches the anonymous learning shell, hashed application assets, and explicitly allowed public practice assets. First-time downloads require a connection. Content revisions separate cached practice versions, and session details must match the catalog. This is not a predownload of the whole curriculum.
- Coding uses an opaque iframe and worker with network-blocking CSP, a two-second execution timeout, and a five-second outer timeout. Visible client-side tests are self-assessment, not trusted competitive grading.
- Authoritative rewards, a Python service, reminders, and a leaderboard have not been added.

## Verification

The journey-continuation and practice-depth work passes 377 unit tests (the six Firebase emulator tests were last run for the September 3 release; the sync contract did not change). The browser curriculum sweep completed all 202 noncoding lessons with actual grading against the reworked derived packs and 23 new authored packs, with no uncaught page errors. The journey suite also checks the bounded daily review set. The new journey suite completes the first chapter of part two through the real UI, and the first-month suite now asserts the trail continues into part two. Six source models were exercised at 390×844 and 1440×1000, including an offline model reload. The continuity, all-25-coding, adaptive/placement, models, journey, and 30-day/offline suites pass against the rebuilt app; evidence and limits are recorded in `design-qa.md` (“Journey continuation and second-month practice”). A startup hydration/navigation race found during the browser walk-through was corrected. The production build passes type/lint gates and traces 2,229 canonical content assets. Physical-device installation and production signed-in checks remain external release checks.

Run all local gates before delivery:

```sh
pnpm scan:secrets
pnpm audit:content
pnpm validate:registry --strict
pnpm validate:content
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

After building, run `pnpm start --port 3101`, then `pnpm qa:learning-path`, `pnpm qa:adaptive-learning`, `pnpm qa:learning-continuity`, `pnpm qa:learning-curriculum`, `pnpm qa:learning-models`, `pnpm qa:learning-journey`, and `LEARNING_QA_OFFLINE=1 pnpm qa:first-month` in another terminal with `LEARNING_QA_BASE_URL=http://localhost:3101`. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an installed Chrome executable or install Chromium with `pnpm exec playwright install chromium`. Screenshots go under ignored `.artifacts/daily-learning/`, `.artifacts/adaptive-learning/`, `.artifacts/first-month/`, `.artifacts/learning-continuity/`, `.artifacts/learning-curriculum/`, and `.artifacts/learning-models/`.

Browser checks cover all 25 coding sessions through the actual worker; design-unit/checkpoint completion; representative GenAI/ML sessions; load failures; wrong answers; unit unlocking; rotating reviews; keyboard/menu behavior; mobile dark mode; draft/backup restore; offline settings; storage failure; and navigation.

The adaptive suite adds exercise variants, retained hints and mistakes, priority and recovery, placement pass/fail/cancel/load retry across all four courses, all four first-unit coding tasks, no invented placement XP, next-unit navigation, v5 backup restore, v2 migration, and mobile placement. Unit tests validate every practice pack and assessment coverage for all 43 units.

For actual Firebase Auth, transactions, realtime updates, and ownership rules, use Firebase CLI with Java 21+:

```sh
firebase emulators:start --only auth,firestore --project demo-systemdesigner-learning --config firebase.learning-emulators.json
```

Then run `pnpm qa:learning-sync`. Ports are 9099 (Auth) and 8080 (Firestore). The six integration tests are skipped during regular unit runs and never use production account data. Repeat them after changing the sync contract or adapter.

Before a machine reset, preserve intended source changes in Git. Separately preserve ignored environment files, credentials, Content Studio drafts, and anonymous learner progress (learning settings → Export backup). No GitHub Actions changes are required or authorized by this handoff.

## Completion verification added

`pnpm qa:learning-continuity` exercises partial ordering and matching, retained hints and feedback, completed-group regrading, mixed-quiz cursor restoration, single completion, and code-history recovery through reloads. `pnpm qa:learning-curriculum` completes all 202 noncoding lessons through the real learner UI using isolated prerequisite fixtures. It does not skip grading or inject assessment answers into state. Check the latest logs under `.artifacts/learning-redesign/` and the completion section of `design-qa.md` for actual run results.
