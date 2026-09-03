# Continue development on another machine

This is the durable handoff for the daily-learning work. It is intended to be enough context to resume from a fresh clone without the original chat or computer.

Last updated: September 2, 2026.

## Start here

The product direction is **a Duolingo-style app for learning system design and coding**. The first working version is implemented at `/learn`. Continue from that implementation; the next priority is portable progress, followed by more curriculum.

Read these files in order:

1. [`AGENTS.md`](../AGENTS.md) — repository engineering and content rules.
2. [`ROADMAP.md`](../ROADMAP.md) — product priorities and milestone sequence; also rendered at `/roadmap`.
3. This handoff — current state, next task, and machine setup.
4. [`daily-learning-path.md`](./daily-learning-path.md) — the current learning loop, data, and runner behavior.

The development branch is `main`, and the remote is `https://github.com/alibad/systemdesigner.git`. The checkpoint containing this handoff also contains the six-step daily-learning implementation. Use `git log -5 --oneline` to locate it; the feature began from `e53c4c6e`.

## Get running

Use Node.js 20+ and pnpm 10.4.1. The checkpoint was verified using Node.js 22.22.0.

```sh
git clone https://github.com/alibad/systemdesigner.git
cd systemdesigner
git switch main
git pull --ff-only origin main
corepack enable
corepack prepare pnpm@10.4.1 --activate
pnpm install --frozen-lockfile
pnpm dev --port 3100
```

If Corepack is unavailable, install pnpm 10.4.1 using the instructions in [`DEVELOPMENT.md`](./DEVELOPMENT.md). The same Git and pnpm commands work from PowerShell once those tools are installed.

Open `http://localhost:3100/learn` to try the starter and `http://localhost:3100/roadmap` to view the roadmap. The port is a convenience, not a requirement.

Normal local development and the daily starter need no environment variables. Configure optional services only when working on the features that need them. `.env.example` documents variable names; real values belong in an ignored local environment file or the hosting provider's secret manager.

## What is implemented

- A new daily-learning hub at `/learn`, with homepage and navigation entry points.
- Independent system-design and JavaScript tracks, each with three sequential steps.
- A definition, concrete example, and takeaway before practice.
- The existing `InteractiveQuiz` in a sequential session mode with immediate explanation, retries, download recovery, and an explicit completion callback.
- A JavaScript editor with starter programs, hints, real test results, local drafts, and timeout handling.
- Completion only after all quiz answers are correct or all code tests pass.
- 20 path XP once per new step, sequential unlocking, daily goals of 1–3 steps, local-calendar streaks, and review scheduling.
- Browser-local persistence, schema validation, storage-failure handling, and cross-tab refreshes.
- A public `/roadmap` page that renders `ROADMAP.md`, with links back to the source and this handoff.
- A navigation hydration fix: experimental navigation uses the same build flag on the server and browser, including production previews on localhost.

Existing registry-backed lessons and account gamification remain available. A daily-path completion does not mark an entire in-depth lesson complete.

## Implementation map

| Area | Files |
| --- | --- |
| Entry route | `app/learn/page.tsx` |
| Path, stats, goals, review list | `components/learning/DailyLearningPath.tsx` |
| Learn → practice → retry/complete flow | `components/learning/LearningSession.tsx` |
| JavaScript editor and test output | `components/learning/CodingExercise.tsx` |
| Curriculum schemas, unlocking, streaks, reviews | `lib/learning-path.ts` |
| Browser storage integration | `hooks/useDailyLearning.ts` |
| Isolated browser code runner | `lib/coding-runner.ts` |
| Shared quiz component | `components/fundamentals/InteractiveLearning.tsx` |
| Daily system-design steps | `content/entries/fundamentals/what-is-system-design/data/daily-design-path.json` |
| Daily coding steps and test fixtures | `content/entries/fundamentals/scalability-basics/data/daily-coding-path.json` |
| Quiz data | `lib/quiz-bank/all-quizzes.json` — `daily-request-journey`, `daily-scaling-decision`, `daily-cache-decision` |
| Starter code | Co-located `code/daily-server-capacity.js`, `code/daily-round-robin.js`, and `code/daily-cache-lookup.js` under the referenced lessons |
| Unit coverage | `lib/learning-path.test.ts` |
| End-to-end browser checks | `scripts/verify-daily-learning.mjs`, run with `pnpm qa:learning-path` |
| Product roadmap source and renderer | `ROADMAP.md`, `app/roadmap/page.tsx` |

## Current limits and decisions

- The starter is six steps, not a complete system-design or coding curriculum. Python and other languages are not implemented.
- Daily-path progress uses `sd:daily-learning:v1`; code drafts use `sd:code-draft:<step-id>` in `localStorage`. Keep these keys compatible when adding migration.
- Daily-path XP is separate from account XP. The existing gamification and challenge services do not yet own these completions. Never add the same award to both stores without an idempotency plan.
- Practice counts once per distinct step per local calendar day. Any successful step or review maintains a streak; meeting the chosen daily goal is a separate measure.
- Quiz retries repeat a small fixed set. Review timing is a simple success-based schedule, not adaptive mastery or a placement system.
- Incomplete quiz sessions are not persisted. Coding drafts and completed steps are persisted.
- The code runner uses an opaque-origin iframe and Blob worker with network-blocking CSP. It has a two-second execution timeout and a five-second startup/result timeout. Results and tests are client-visible and not authoritative.
- No leaderboard, heart/life system, new notification automation, paid service, or standalone remote execution service was added.
- Instructional bodies remain in the canonical Markdoc system. The path is a practice hub, not a new set of concrete lesson pages. Reuse the shared quiz component and co-located content assets.
- Some local Codex skills used during development may not exist on a new machine. All required application source and verification scripts are in this repository; follow `AGENTS.md` and repository docs.

## Recommended next task: portable daily-path progress

Start with the first milestone in `ROADMAP.md`. Keep this work bounded: prove continuity for the six existing steps before expanding the curriculum.

1. Inspect `lib/unified-storage.ts`, `contexts/StorageContext.tsx`, `hooks/useAuth.ts`, `lib/gamification.ts`, `contexts/GamificationContext.tsx`, and the existing Firestore rules. Reuse the established account infrastructure where appropriate.
2. Define a versioned progress contract that can represent step completion, successful practice events, daily goals, review state, selected track, and coding drafts. Decide whether the next increment includes persisted in-progress quiz sessions.
3. Add an export/import backup for anonymous learners, with schema validation and a preview of what will be imported. Do not include auth data or unrelated browser storage.
4. Migrate `sd:daily-learning:v1` without losing completed steps, activity dates, or drafts. Do not silently merge one person's local data into another person's account on a shared device.
5. Add optional account sync with explicit local-to-account migration, retryable offline writes, conflict handling, and visible save status. Ensure events and XP awards are idempotent.
6. Verify reload, a fresh browser/device, offline → online, sign-in/out, account switching, duplicate submissions, corrupt import data, and day-boundary behavior.

Acceptance: the same learner completes a step on device A, resumes the correct next step on device B, and retains one completion/award after retries and offline sync. An anonymous learner can export and restore progress without an account. Account boundaries prevent another user seeing those drafts or progress.

After portable progress, author one additional unit per track and evolve the curriculum schema to support multiple units. Follow the roadmap sequence for richer exercise types and authoritative grading.

## Verification

The starter passed all of these gates before the checkpoint, including the browser suite against a production-mode server:

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

The unit suite contains 102 passing tests at this checkpoint. The build renders the existing content library and checks that co-located content assets are included in the production trace. Counts will change as the project grows.

To run browser verification on a new machine:

```sh
pnpm exec playwright install chromium
pnpm build
pnpm start --port 3100
```

In a second terminal:

```sh
pnpm qa:learning-path
```

Alternatively set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an installed Chrome executable. Set `LEARNING_QA_BASE_URL` to change the port. Screenshots are generated under `.artifacts/daily-learning/` and are intentionally ignored by Git.

The browser suite covers every starter step, retry behavior, code results and infinite loops, browser isolation, draft/progress persistence, duplicate rewards, due reviews, daily goals, storage failures, keyboard interactions, mobile overflow, homepage entry, and roadmap navigation. Run it in production mode too: development mode did not expose the previous localhost navigation hydration mismatch.

Verification remains local. Do not create, enable, or modify GitHub Actions workflows to continue this work unless explicitly requested. Follow current repository instructions for commits, pushes, and deployments; this handoff is not standing deployment authorization.

## What Git preserves before a machine reset

Pushing `main` preserves committed source, curriculum data, test scripts, this handoff, and the roadmap. Confirm the checkpoint exists on `origin/main` before discarding the old working directory.

These are separate from Git and need separate handling if you want to keep them:

- `.env`, `.env.local`, ignored secret files, and local tool authentication. Recover needed values from your secret manager or hosting settings on the new machine. Do not commit them to this public repository.
- Browser-local daily-path progress and drafts, plus other local-only learner data. The export/import feature is planned, not implemented at this checkpoint. A new clone does not restore browser storage.
- Ignored `.content-cms/` drafts or other local work, if you have any. Commit intended source changes or preserve private working data separately before erasing the machine.
- The original chat and local screenshots. This document contains the decisions needed to continue; the app does not depend on that chat or those images.

Dependencies, `.next/`, and local preview servers can be recreated with the commands above.

## Starting prompt for the next coding session

> Continue SystemDesigner's Duolingo-style system-design and coding experience. Read AGENTS.md, ROADMAP.md, docs/CONTINUE_DEVELOPMENT.md, and docs/daily-learning-path.md first. The six-step starter at /learn is implemented and tested. Start with the portable-progress milestone: preserve existing local progress and coding drafts, add a validated backup export/import path, and integrate optional account sync using the existing account infrastructure with safe migration and idempotent events. Keep anonymous/offline learning usable, test account boundaries, and use local verification. Work on main following the repository rules. Update the roadmap and handoff as work lands.
