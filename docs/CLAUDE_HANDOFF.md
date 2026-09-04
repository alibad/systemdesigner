# Claude handoff: complete the SystemDesigner learning product

Prepared September 3, 2026, after the production release, and updated the same day after the journey-continuation work described below. Read this as a continuation of the existing product, not a request to scaffold a replacement.

## Mission and user expectations

The user wants a substantial Duolingo-style learning experience for system design, coding, GenAI, and ML: excellent UX, meaningful practice, progression, retention, and projects. They repeatedly rejected a dashboard that merely listed content and asked for actual walkthroughs and testing. A working implementation is now deployed, but passing its tests does not establish Duolingo-level product quality or educational effectiveness. Continue the remaining work instead of telling the user the entire long-term vision is already finished.

Keep SystemDesigner.net and this repository as the product. The user approved visual direction **1 or 2, not 3**. The implementation combines direction 1's learning trail with direction 2's interactive system models. Preserve the actual app logo, focused lesson flow, and custom keyboard-accessible dropdowns. Keep account sync, export/import, and other utilities inside settings. Do not bring back the placeholder “S” logo, prominent backup controls, or a three-step starter presented as the whole curriculum.

The latest user request is to prepare a new Claude session to complete the remaining work. Start by using the live experience, identify concrete shortcomings, and implement improvements. Do not stop at an audit, a plan, or superficial visual changes. Ask for clarification only where missing information materially prevents progress. Distinguish work that can be completed in the repository from checks that need a physical device, an authenticated user, or real learner evidence.

## Verified checkpoint

- Repository: `https://github.com/alibad/systemdesigner`
- Local checkout: `/Users/alibadereddin/Code/GitHub/systemdesigner`
- Branch: `main` — repository instructions require direct work on this branch unless the user explicitly asks otherwise.
- Released commit: `041b246bfe4ba4b36ded58e6b737d04beb22e3d6` (`docs: record the journey-continuation push in the handoff`), which sits on `9cd7feab` (`feat: extend the guided journey to 130 days and author second-month practice`). Both are pushed to `origin/main`. The earlier release `d67a2ec0` remains the rollback candidate before it.
- Live app: `https://www.systemdesigner.net/learn`
- Vercel deployment: `dpl_DRT6oQduQth6ppk5LLQya9Jj9x9n`
- Immutable deployment URL: `https://systemdesigner-5ihxzxjsd-alibads-projects.vercel.app`
- Vercel reported `READY` with `www.systemdesigner.net` and `systemdesigner.net` among its aliases. Deployment completed September 4 at 06:49 UTC, September 3 at 23:49 in Los Angeles. The build used pnpm 10.4.1 from the `packageManager` pin and Node 24.x, the same as the previous release.
- Previous release: `dpl_WEwitRbFix4S1anvzZQgG9G29JZq` for `d67a2ec0` (`https://systemdesigner-bqw0qay6y-alibads-projects.vercel.app`).
- Project: `systemdesigner`, team `alibads-projects`; project ID `prj_zPPUzQrD2kSVZWCOAoPmmrddOHG5`. Production branch is `main`; pushing it automatically deploys.
- After the release, a second local session extended the guided journey to 130 days, authored ten second-month practice packs, improved derived practice and generated lesson copy, and made unit placement survive practice changes. That work is committed on `main` (`9cd7feab` and `041b246b`), was pushed to `origin/main` on September 3 with the user's go-ahead, and deployed through the Vercel Git integration as recorded above. Live verification is recorded below. Inspect `git status` before editing or pulling.

The earlier previous-machine checkpoint `a5d66b2d` was only a six-step starter. Do not resume from it or overwrite the released implementation.

## Read first

1. Applicable `AGENTS.md` instructions and repository `CLAUDE.md`.
2. `ROADMAP.md` — also rendered by the public `/roadmap` page.
3. `docs/CONTINUE_DEVELOPMENT.md` — architecture map, boundaries, commands.
4. `docs/daily-learning-path.md` — progression, evidence, persistence, and offline contracts.
5. `design-qa.md` — selected directions, resolved UX bugs, evidence, and limitations. Its earlier 166-test section is historical; use the later completion section.
6. `docs/first-month-verification.md` and the actual tests/scripts relevant to the next change.

`CLAUDE.md` contains a workspace-instructions path from the old Windows machine. Apply the instructions available on the actual machine; do not assume that Windows path exists on this Mac. If available, the local `modernize-systemdesigner-lessons` skill provides the repository's lesson-authoring workflow and quality bar.

## What exists already

| Course | Units | Sessions |
| --- | ---: | ---: |
| System design | 12 | 77 |
| Coding | 6 | 25 |
| Generative AI | 14 | 90 |
| Machine learning | 11 | 72 |

Total: **43 units, 264 sessions, 227 explicit skills**. There are 202 lesson sessions, 37 mixed checkpoints, and 25 runnable JavaScript sessions. The broader reference library contains 425 entries.

- A 130-study-day guided design/coding journey in five parts (`content/learning/first-month.json`, `second-month.json`, `third-month.json`, `fourth-month.json`, `fifth-part.json`, combined into generated `journey.json`). It covers all 102 design and coding sessions exactly once in course order, with 28 review days (56 review tasks), 16 milestones, and a coding project closing each 30-day month; part five is a ten-day case-study finale. Day IDs are stable. The trail shows the current chapter, per-part progress, the full path by part, a streak/goal chip once the learner has practiced, and a hand-off to the GenAI and ML courses at the end.
- A mobile learning trail, real branding, fullscreen lessons, fixed actions, direct continuation, Learn/Courses/Practice navigation, dark mode, and custom Radix menus.
- Beginner definition → example/model → graded practice → explanation/retry → completion.
- Three compact request/capacity/cache labs and 27 first-unit illustrated exercise variants.
- Mixed practice in all 202 lesson sessions. **33 hand-authored packs** contain 116 groups and 348 variants; the ten newest cover the data-at-scale and fast-reads units that open month two (calculations, ordered protocols, scenario decisions checked against the lesson sources). **169 source-derived packs** reuse existing responsibilities and source questions, now with section-specific prompts, non-revealing hints, and per-part explanations. Combined: **792 groups, 2,040 variants**. These are not 2,040 newly written or independently reviewed exercises.
- Every lesson session carries up to four registry prerequisites, shown under “Go a little deeper”. Generated key ideas and takeaways are complete sentences (an introducing paragraph is merged with its list).
- Matching, ordering, numeric, and choice interactions with hints and retries. Source-derived matching associates parts with responsibilities; it does not assume a process diagram specifies a mandatory execution order.
- The catalog contains 400 existing model references. Later lessons expose source models on demand; the first three retain their compact labs. Do not claim 400 newly built or individually browser-tested models.
- Placement across all four courses, unit gating, and adaptive review based on mistakes, hints, and delayed recall. Placement grants no invented completions, XP, or daily activity. Unit revisions hash assessment content only, so authoring better practice no longer revokes earned placements (the September 3 regeneration reset earlier grants and evidence once).
- Once-only 20 path XP per new session, local-day goals/streaks, and rotating reviews.
- Version 5 local/account data with legacy migration, interruption/resume, regrading of restored inputs, bounded code history, owner-safe sync, and backup preview/import in settings.
- PWA installation support and offline access to prepared shell/previously visited public content. This is not a native mobile app or a full-curriculum offline download.

## Remaining work: prioritize outcomes over counts

These are continuation priorities, not claims that the following features already exist or that every roadmap idea is required for the next release.

1. **Use and improve the complete learner experience.** The September 3 walkthrough fixed the post-month dead end, revealing hints, fragment key ideas, the duplicated “deeper” paragraph, and the missing streak signal (see `design-qa.md`). Continue with the returning-learner case where many reviews are due at once (the recall banner and Practice tab can show 20+ due skills after a break; consider a bounded daily review set), the review-day flow with two tasks, later-part chapters on phones, keyboard focus in the full-path disclosure, loading and error states, and interaction pacing. Make a concrete list, fix, and repeat the affected journeys.
2. **Raise curriculum depth across the remaining units.** 169 derived packs remain. The next authoring targets are the units the journey reaches next: service interfaces (days 50–57), asynchronous systems and resilient services (month three), then production, security, and the design lab. Follow the pattern in `content/entries/technology/*/data/skill-exercises.json` from September 3: three to five groups, three variants each, calculation/ordering/decision mixes, option-specific feedback, hints that do not reveal, IDs namespaced by lesson, answers checked against the lesson source, registered in `exerciseSources`, stale generated file deleted. Do not inflate counts or relabel generated content “authored.”
3. **Develop progression further.** The design/coding journey is complete through day 130 and verified in the browser for its first second-month chapter and in unit tests for every day. Remaining: a guided GenAI/ML foundations path (those courses have no coding steps, so a project convention is needed), stronger capstones than unit-final exercises for months two to four, and learner evidence on pacing. Do not replace a connected path with another oversized list of content.
4. **Strengthen skills and assessment.** Current skills are broad lesson-level identifiers, and the review scheduler is a heuristic, not calibrated mastery. Improve skill mapping and diagnostic tasks; validate placement difficulty and retained application with learner evidence. Never invent retention or proficiency claims from test results. Preserve existing IDs/progress or provide explicit migrations.
5. **Finish device and account validation.** Check actual iOS/Android installation, safe areas, virtual keyboards, editor usability, screen readers, and reduced-motion behavior. Exercise real signed-in progress on two devices, offline edits/reconnect, interrupted lessons, concurrent drafts, and account switching with an authorized test account. The Firebase emulator checks and desktop viewport tests do not replace these checks. Record unavailable hardware/access honestly and continue all other useful work.
6. **Expand coding and projects thoughtfully.** Current execution supports small JavaScript functions and an in-memory final project. Add meaningful multi-step/multi-file service tasks and stronger project assessment where it advances the curriculum. Python execution, authoritative server grading, leaderboards, reminders, native app-store distribution, and full offline packs are future product choices, not shipped capabilities. Do not introduce them as a substitute for finishing the core learning experience.

Treat completion as a coherent, usable learning journey with reviewed content, robust progress, relevant regression coverage, and explicit evidence for remaining external checks. Do not use “100% complete” to describe an unvalidated educational product.

## Implementation boundaries to preserve

- Author organization in `content/learning/course-outline.json`; guided days live in the part files listed under `journeySources` (`first-month.json` through `fifth-part.json`), combined into generated `content/learning/journey.json`. Preserve existing session/step and day IDs. Each part ends with a milestone; project days must be coding steps; every session appears once in course order. Run `pnpm generate:learning` after changing sources, then `pnpm validate:learning`.
- Generated outputs: `content/learning/catalog.json`, `content/learning/sessions.json`, `content/learning/journey.json`, checkpoints, and co-located `data/daily-practice.generated.json`. Do not hand-edit generated practice. `exerciseSources` in the outline selects authored `data/skill-exercises.json` overrides; delete the lesson's stale generated file when adding one. Variant IDs must be unique across every pack.
- Shared exercise schema/renderer: `lib/skill-exercise-schema.ts`, `components/learning/SkillPractice.tsx`; source generation: `scripts/learning-source-practice.mjs`. Reuse the shared quiz renderer in `components/fundamentals/InteractiveLearning.tsx`.
- New full lessons follow the registry-first Markdoc workflow in `AGENTS.md`, with external code/quiz/data assets and generalized content shells. Do not create duplicate concrete lesson `page.tsx` files.
- Session orchestration: `DailyLearningPath.tsx`, `FirstMonth.tsx` (the trail, now journey-wide), `LearningSessionLoader.tsx`, `LearningSession.tsx`, `SourceExploration.tsx`, `CodingExercise.tsx`, and `app/api/learning/sessions/[id]/route.ts`. Journey logic: `lib/learning-journey.ts` (`JOURNEY`, `JOURNEY_DAYS`, `FIRST_MONTH` = part one).
- Persistence: `lib/daily-learning-data.ts`, `daily-learning-store.ts`, `daily-learning-cloud.ts`, `learning-resume.ts`, and `hooks/useDailyLearning.ts`.
- Schema is **v5**, but storage keys intentionally remain `sd:daily-learning:v2:guest` and `sd:daily-learning:v2:user:<uid>` for migration. Do not rename them casually.
- Session resume is revision-aware and regrades stored inputs; never trust a saved score. A null session value is a durable completion/reset marker. Historical completions survive curriculum revisions.
- Code history retains up to four displaced versions per session within a shared 64 KB budget. Backup input is bounded at 750 KB. Preserve guest/account separation and owner guards.
- Coding runs inside an opaque iframe/worker with network-blocking CSP, input-mutation checks, and execution timeouts. Client-visible answers/tests are self-assessment, not trusted competitive grading.
- The service worker caches explicitly allowed public resources only. Never cache account/auth/Firestore responses. Session/content revision checks prevent mismatched practice.
- Preserve fixes for fullscreen dialog entrance animation, footer overlap, final-unit access, feedback focus/scroll, and hydration resetting early navigation. `design-qa.md` explains the regressions. Do not reintroduce the initial owner-reset race.

## Verification of the journey continuation (September 3, later session)

- Unit tests: 377 passed, including a walk of all 130 study days through real prerequisite gates and coverage/ordering checks for every part.
- Repository gates and production build passed (493 pages, 2,229 traced assets).
- Browser, against the rebuilt local production server: the new `qa:learning-journey` suite (seeded first month, days 31–38 through authored practice, coding, a review day, and a checkpoint milestone), the full 202-lesson curriculum sweep, course/coding, adaptive/placement, continuity, and offline model suites passed. `LEARNING_QA_OFFLINE=1 pnpm qa:first-month` (corrected to expect the trail to continue into part two): all 30 days, 26 unique completions, eight review tasks, four milestones, partial-day restore, capstone failure and draft recovery, small-screen dark mode, offline reload, visited-exercise execution, uncached-lesson recovery, public-only cache, and stale-revision rejection passed; after day 30 the trail shows “Study day 31 of 130” and the part-two heading.
- Hands-on: fresh learner, seeded end-of-journey state and course hand-off, and an iOS 26 Safari simulator rendering check of the live site and the local build (rendering only; no taps).
- On the live production domain after deployment: `/learn`, `/roadmap`, manifest, service worker, and illustrations returned 200; an unknown session returned 404 and a stale revision 409; the replication-and-sharding session served the new revision, its authored pack, its prerequisite link, and a complete key idea; a derived pack served the section-named prompt and non-revealing hint; the `code-cache-ttl` project served its five tests; the roadmap page rendered the journey milestone. `pnpm qa:learning-journey` then passed against `https://www.systemdesigner.net` as a guest: days 31–38 through the live UI with the isolated coding runner, the review day, and the checkpoint milestone. Log: `.artifacts/journey-continuation/qa-learning-journey-production.log`.
- Not done: the Firebase emulator suite (sync contract unchanged), physical devices, screen readers, and a live signed-in two-device session.

## Verification actually performed for the `d67a2ec0` release

**Local release gates:** 376 unit tests passed; six account integration tests were separately run and passed with real Firebase Auth/Firestore emulators. Strict content/registry/catalog/block checks, secret scan, type checking, lint, and production build passed. Build generated 493 pages and traced 2,229 canonical content assets.

**Local browser coverage:** all 202 lesson sessions were completed through actual grading; all 25 coding sessions ran in the real isolated runner; the complete 30-study-day journey passed. Placement/adaptive review, retries, hints, restore, backups, storage failure, menus, focus, mobile/dark layouts, and offline cases passed. Six source models were exercised on phone and desktop viewports. These are automated walkthroughs, not user research or an independent accuracy audit of every lesson/model.

**On the live production domain after deployment:**

- Representative session responses exactly matched the released catalog revisions, with source assets loading for design, coding, Redis, GenAI, ML, and the final project.
- `/learn`, `/roadmap`, manifest, service worker, and illustrations returned successful responses; unknown sessions returned 404 and stale revisions 409.
- A coding exercise passed all four behavioral tests in the deployed worker and saved one completion.
- Partial ordering/matching, hints, feedback, completed groups, quiz cursor, wrong-answer retry, and code-history recovery survived reloads.
- Six Redis/LLM/ML models responded at mobile and desktop widths, and a visited model loaded offline.
- No uncaught page errors appeared in these live browser checks. Live signed-in two-device sync was **not** tested.

Evidence on this machine is under ignored `.artifacts/learning-redesign/`: `completion-*.log`, `production-build.log`, `production-deployment.json`, `production-smoke.log`, `production-continuity.log`, `production-models.log`, and production screenshots. Other browser screenshots are under their corresponding `.artifacts/` directories. Ignored evidence and local secrets do not travel through Git. Durable verification scripts are committed under `scripts/`.

## Local commands and delivery

Node 22.22.0 and pnpm 10.4.1 were used. Another project uses port **3100** on this Mac; SystemDesigner uses **3101**. Inspect process ownership before stopping anything. Never run a Next dev server and a build concurrently against the same `.next` directory.

```sh
pnpm install --frozen-lockfile
pnpm dev --port 3101
```

Before a release, run the required local gates:

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

After building, `pnpm start --port 3101`. In another terminal:

```sh
export LEARNING_QA_BASE_URL=http://localhost:3101
export PLAYWRIGHT_CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
pnpm qa:learning-path
pnpm qa:adaptive-learning
pnpm qa:learning-continuity
pnpm qa:learning-curriculum
LEARNING_QA_OFFLINE=1 pnpm qa:learning-models
LEARNING_QA_OFFLINE=1 pnpm qa:first-month
pnpm qa:learning-journey
```

Use an appropriate Chrome path on another machine. Rerun suites relevant to changed behavior; do not repeatedly run the whole curriculum without a concrete reason. Close browser contexts before closing the browser in test harnesses so successful scripts terminate cleanly.

For account integration, Java 21+ must be on `PATH` as well as configured with `JAVA_HOME`. This Mac's default Java was 17; Temurin 23 is available under `/Library/Java/JavaVirtualMachines/temurin-23.jdk/Contents/Home`. Use the demo project only:

```sh
firebase emulators:exec --only auth,firestore \
  --project demo-systemdesigner-learning \
  --config firebase.learning-emulators.json 'pnpm qa:learning-sync'
```

Work on `main`, inspect the diff, and keep roadmap/handoff notes current. Follow the user's local-verification preference; do not create, enable, or modify GitHub Actions workflows without an explicit request. Existing workflows were already enabled when the last release was inspected; no workflow or permission changes were made in that release.

Production uses the existing Vercel Git integration. Do not create a second project, change the domain, or trigger redundant manual deployments. Keep the standard build machine and follow the usage rules in `CLAUDE.md`. The user explicitly approved the release documented here; this handoff does not grant unlimited authorization for unrelated future production changes. Never commit environment files, credentials, private keys, or ignored browser artifacts.

## First action for the new session

Confirm the checkout and production version, read the above documents, then use `/learn` as a new and returning learner. Produce a short evidence-based list of the highest-impact gaps and start fixing them. Preserve the already working flows, strengthen the weak curriculum and progression, verify each affected journey, and keep a clear distinction between shipped functionality, observed problems, and external validation still needed.
