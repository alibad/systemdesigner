# First-month verification

Verified locally on September 3, 2026 against the production build at `http://localhost:3101/learn`. This records the first-month release verification; the later journey continuation (days 31–130) and its evidence are recorded in `design-qa.md` and `docs/CONTINUE_DEVELOPMENT.md`.

The learner starts the chapter trail or chooses placement, follows 30 study days, completes authored practice and executable coding tasks, revisits earlier skills, and finishes a link-service model. Progress flows from the learning UI through the shared learning store to local storage and optional owner-scoped Firebase sync. Public lesson content comes from the session and canonical content APIs.

| Boundary | Result | Evidence |
| --- | --- | --- |
| Curriculum | Pass | Four courses, 43 units, 264 sessions, 227 skills; 30 valid study days with satisfied prerequisites; 23 hand-authored and 179 source-derived packs, totaling 785 groups and 2,009 variants |
| UI → practice APIs → feedback | Pass | The full curriculum browser sweep completed all 202 lessons; final continuity, course/coding, adaptive, and first-month production suites passed without uncaught page errors; source-loading failure, retry, and wrong-answer cases exercised |
| Complete first month | Pass | All 30 days completed through the UI, 26 distinct completions, eight review tasks, four milestones; partial review-day reload and final completion reload preserved progress |
| Coding execution | Pass | Every one of the 25 coding sessions passed its reference solution in the actual isolated browser runner; bad output, mutation, and timeout cases rejected |
| Final project | Pass | Eight behavioral fixtures cover cache hits/misses, updates, invalidation, unsupported methods, object-name keys, and unchanged inputs; a deliberately broken invalidation implementation failed and its edited draft survived reload |
| Progress contracts | Pass | 376 unit tests; v1/v2/v3/v4 migration, schema-v5 backups, deterministic merges, duplicate rewards, ownership changes, review-day progression, revision-aware unfinished attempts, and bounded coding draft recovery |
| Actual account integration | Pass | Six isolated Firebase Auth/Firestore emulator tests, including migration, two clients completing different parts of a review day, v5 unfinished attempts, concurrent code drafts, durable completion reset, and ownership rules |
| Offline access | Pass | Service worker prepared the anonymous learning shell and public assets; offline page reload and a previously opened exercise worked; an unopened lesson showed retry and recovered online; stale session revisions returned 409 |
| Phone and desktop presentation | Pass within browser coverage | Automated 390×844 and 320×568 checks, dark mode, desktop screenshots, fixed-action bounds, menu bounds, and horizontal overflow checks; hands-on in-app browser review of onboarding, first lesson, course menu, requirements folding, code editor, and installation settings |
| Repository gates | Pass | Content structure audit, strict registry validation, canonical content validation, generated-catalog validation, type checking, unit tests, lint, secret scan, and production build; build trace includes 2,229 canonical content assets |

The selected visual redesign and its additional request, capacity, cache, focus, animation, and illustration checks are documented in [Design QA](../design-qa.md). The complete production first-month run passes after the trail redesign, including the new model controls and offline images.

## Reproduce

Run the local gates documented in [Continue development](CONTINUE_DEVELOPMENT.md). Stop the development server before building, then start the production app:

```sh
pnpm build
pnpm start --port 3101
```

In another terminal, set `LEARNING_QA_BASE_URL=http://localhost:3101` and, if Playwright Chromium is not installed, `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an installed Chrome executable. Run:

```sh
pnpm qa:learning-path
pnpm qa:adaptive-learning
pnpm qa:learning-continuity
pnpm qa:learning-curriculum
pnpm qa:learning-models
LEARNING_QA_OFFLINE=1 pnpm qa:first-month
```

Screenshots and logs are in ignored `.artifacts/first-month/`, `.artifacts/daily-learning/`, and `.artifacts/adaptive-learning/`. The course and adaptive suites disable service-worker registration in their isolated test context so network-failure assertions remain deterministic. The first-month production suite exercises the real service worker.

## Remaining release validation

The first-month implementation is ready for learner testing. Physical iPhone/Android installation, virtual-keyboard behavior on actual phones, assistive-technology testing, a live production signed-in two-device smoke test, and learning-outcome validation remain to be done. Desktop viewport emulation does not substitute for those checks.

All 202 lesson sessions now have mixed practice. The 179 derived packs reuse existing source explanations and questions; they are not newly hand-authored lessons. Six existing source models were exercised on phone and desktop viewports, including visited-model offline loading. These checks establish functioning interactions, not comprehensive curriculum accuracy or learning outcomes. Native app distribution, full offline curriculum downloads, and authoritative competitive grading are outside this milestone. This record covers local verification; production release status is tracked by the Vercel deployment associated with the `main` commit.
