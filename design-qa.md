# Learning trail and interactive systems QA

Date: September 3, 2026. Scope: local `/learn` redesign in the existing SystemDesigner app.

## Approved direction

The user selected “one or 2 - not 3.” Implementation uses direction 1 for the learning trail and direction 2's interactive systems inside lessons. Direction 3 was not used. The existing Inter typography, real app logo, course/progress contracts, and shared quiz renderer were retained. Raster browser/service/database assets were generated against the selected references; Lucide supplies UI icons.

Reference captures (normalized to a 390-pixel width for comparison):

- `.artifacts/learning-redesign/reference-trail.png`
- `.artifacts/learning-redesign/reference-system.png`

Rendered states include mobile home, introduction, answer feedback, retry, completion, capacity, tablet home, desktop home, and narrow-phone home in `.artifacts/learning-redesign/`.

## Comparison and fixes

Source and rendered screenshots were opened together in the same comparison inputs. The review covered typography, margins, vertical rhythm, cyan/neutral state colors, image proportions, icon consistency, buttons, responsive states, and interactions.

| Severity | Finding | Resolution |
| --- | --- | --- |
| P2 | The first production lesson capture exposed an inherited centered-dialog entrance animation on the fullscreen lesson. | The first override was superseded by generated utility variants. Use the more specific dialog-role/state selector so a fullscreen lesson opens in place; repeat the immediate-open capture after rebuilding. |
| P1 | Long sequence feedback appeared partly behind the fixed action bar on a phone. | Both authored and shared quiz feedback receive focus and scroll into view; the full explanation and next action were checked together. |
| P1 | The floating desktop navigation covered the last collapsed course unit and prevented opening it. | Reserve bottom space for all learning views and scroll padding for focused content. The full coding-course walkthrough verifies access to the final unit. |
| P2 | An authored multiple-choice exercise needed a redundant final confirmation after showing its feedback. | Shared quiz `finishLabel` advances directly to the next exercise, completes practice, or retries a wrong answer. The first-lesson wrong-answer and completion paths were manually exercised. |
| P2 | A successful checked challenge still showed zero completed challenges until the next click. | The progress indicator now updates when the answer passes, without awarding a lesson completion early. |
| P2 | Closing a guided lesson targeted a hidden course button instead of the current trail step. | Restore focus to the visible course step or the current trail step. Manual close returned to “Start: Size your first service.” |
| P2 | Remove-action buttons and header targets were too small on a phone. | Give sequence removal, hint, brand, library, and account controls at least 44px of height; retain visible keyboard focus. |
| P2 | Repeated quiz counters/instructions competed with the authored exercise heading. | Suppress the redundant single-question heading/badge; remove the session emoji and incorrect “choose Next” wording. |
| P2 | The current-node label wrapped awkwardly on desktop. | Use the shorter “Next up” label. |
| P2 | The cyan primary action needed more legible white text. | Use a darker cyan and 19px bold text; retain a darker lower border for the pressed-button treatment. |
| P2 | New system images were absent from the offline resource allowlist. | Include only the public `/learning/` assets and verify decoded images during offline practice. |

## Intentional adaptations

- This is the existing functional Next.js app, not a separate mobile prototype. Desktop and tablet retain the same focused trail at a comfortable reading width.
- Navigation is Learn, Courses, Practice; the account menu remains in the header. This preserves access to all four courses and avoids creating a redundant profile destination.
- The real first chapter has seven study days, including coding and a checkpoint. The reference's shortened five-node illustration is not the curriculum source. Full course and session counts remain unchanged.
- A quiet placement entry appears for new learners. It disappears after enrolling; the next lesson remains the primary action.
- Direction 2 is adapted to a focused full-screen lesson: required beginner definition first, then a controllable model, followed by graded practice. Nodes are arranged horizontally to accommodate controls, captions, and narrow screens. The static reference's exploratory labels are replaced by real request, failure, and cache actions.
- Completing a lesson reports the actual practiced capability and preserves existing XP/evidence behavior. Model exploration alone does not mark anything complete.

## Original visual milestone verification

- Default suite: 166 tests (including three new model/metadata tests); the five emulator integration tests are deliberately excluded from the default run. The unchanged account contract passed those emulator checks in the preceding milestone.
- Schema validation covers all 126 authored variants; every first-unit scene is present and numeric parameters agree with the answer key.
- Complete 30-study-day journey: 26 distinct session completions, eight review tasks, four milestones, partial-day recovery, final project failure and draft restoration.
- All four courses: checkpoint gating, all 25 coding exercises in the real isolated runner, load recovery, wrong answers, timeouts, input immutability, backups, storage failure, keyboard menus, placement, and adaptive review.
- Manual in-app walkthrough: first request model, sequence answers, wrong storage decision/retry, completion, direct next-day continuation, server failure and recovery, cache hit/miss/stale-read/invalidation, and keyboard return to the trail.
- Viewports: 390×844, 320×568, 768×1024, and 1440×1000; light/dark states and responsive controls checked.

## Comparison history and final checks

Initial full-view comparison: original 853×1845 direction-1 reference against the 390×844 mobile home; original direction-2 reference against the 390×844 lesson. Both were reviewed together. The intended home hierarchy and cyan path were present. The lesson uses the explicitly documented horizontal-model adaptation, with readable interactive controls and beginner context.

The source captures were then normalized to 390px width without cropping for the final comparison. Desktop evidence is 1440×1000; tablet is 768×1024; narrow phone is 320×568. Screenshots contain app content without a device bezel. The in-app browser reduced some home captures (390×844 CSS became 379×820 pixels; 320×568 became 309×548). These are not treated as pixel-exact comparisons. The final production browser-test captures use 390×844 pixels at device scale 1 against the normalized 390×843 references; the one-pixel source height difference is ignored. The raster assets were opened at source size to inspect their actual appearance; illustrations are not improvised CSS artwork.

The five required surfaces were reviewed explicitly:

- Typography: retained the product's Inter family; 30–38px trail title, 20–24px lesson headings, 15–16px body copy, and compact labels. The hierarchy is heavier than the reference's small-screen title but remains readable without truncation. The narrow phone wraps the title naturally. The redundant one-question badge/heading was removed.
- Spacing: the trail replaces dashboard cards, keeps the active step beside its model, and reserves space for the fixed primary action and navigation. The placement link adds a row for new learners; the seven-day chapter scrolls. The lesson model is intentionally horizontal. Final course-unit access and feedback clearance are behaviorally verified.
- Colors: warm neutral home, white lesson canvas, cyan active/primary states, green completed/success states, amber corrective feedback, and muted upcoming steps. The primary action uses darker cyan and larger bold white text than the image reference. This review does not claim a complete contrast audit of the broader app.
- Assets and icons: real app logo, generated silver/cyan browser/service/database rasters, and consistent Lucide icons. Objects preserve aspect ratios and remain sharp at their display sizes. The cache uses a standard memory icon. Full-view normalized images make the labels and controls readable; separate detail crops were unnecessary. Original raster files were also opened at source resolution.
- Copy: introductory definitions remain beginner-readable; model instructions name a concrete action and consequence. Completion names the practiced capability. Next-step and answer actions match what they do. Single-read grammar and the current-node label were corrected.

The initial feedback screenshot (`mobile-feedback.png`) showed the obscured explanation. The corrected same-viewport state (`mobile-feedback-fixed.png`) shows the full feedback, incremented progress, and next action. `mobile-choice-retry.png` records the wrong-answer explanation and retry; `mobile-completion.png` records the practiced capability and direct continuation. The broader course walkthrough caught and then passed the desktop final-unit overlap regression.

Narrow-screen header verification: in-app DOM measurements confirm all three header controls are 44px tall at a 320×568 CSS viewport with no horizontal overflow. `small-phone-final.png` shows the shorter current-node label. Final production build: passed, including type/lint gates, 493 generated pages, and 2,041 traced content assets. The complete 30-day production/offline suite passed before the final entrance-animation/copy adjustment. A focused final-production run then repeated first-lesson mistakes/retries, direct continuation, all three interactive models, 44px header targets, exact fullscreen bounds and no entrance animation, mobile/tablet/desktop/dark states, and offline lesson/image loading. No uncaught page errors were observed.

Final comparison used `final-mobile-home.png` and `final-mobile-lesson.png` (390×844) alongside the normalized source images in the same input. `final-tablet-home.png` (768×1024), `final-desktop-home.png` (1440×1000), and `final-small-dark.png` (320×568) were also opened. The first-frame lesson is opaque, aligned to the viewport, and stationary. All earlier actionable findings are resolved within the documented combined-direction scope. The intentional layout, curriculum, and navigation adaptations remain as stated above.

Logs: `.artifacts/learning-redesign/build.log`, `first-month-production.log`, and `final-production.log`. The final focused script is `.artifacts/learning-redesign/verify-final.mjs`; the durable regression suites remain under `scripts/`.

Original visual milestone result: passed

## Curriculum and continuity completion

The September 3 completion extends the selected design across all 202 lesson sessions. There are 23 hand-authored exercise packs (69 groups, 207 variants) and 179 packs derived from existing lesson content: 785 groups and 2,009 variants overall. Matching tasks associate parts with their responsibilities; source process diagrams are not assumed to specify a mandatory execution order. Existing source questions and feedback remain intact. The catalog contains 400 model references; the first three lessons use their compact introductory labs, and subsequent lessons can open source models on demand.

Version 5 saves unfinished exercises, quizzes, hints, feedback, and completed groups. Restoration rechecks learner inputs against the current revision rather than trusting a stored score. Completed sessions leave a durable reset marker. Recent displaced code versions are recoverable in the editor, with four versions per session and a shared 64 KB budget.

| Finding | Resolution and verification |
| --- | --- |
| Long source descriptions and repeated definitions crowded matching on a phone. | Keep the reminder collapsed, present one role at a time, use the source's first sentence for each choice, and preserve full explanations in feedback. `matching-ready-mobile.png` shows the complete two-role decision at 390×844 with visible actions. |
| A startup owner effect could undo a tab selection made during hydration. | Skip the initial owner-reset effect; preserve resets on real account changes and disable navigation until local data is ready. Final continuity, course, adaptive, and first-month suites pass against the rebuilt app. |
| Earlier browser expectations always required the introduction after reopening a coding draft. | Verify the saved revision and practice phase, then expect the resumed editor. First-month capstone recovery and all coding exercises still run through the actual worker. |
| Generic RAG accordion headings claimed unsupported accuracy ranges. | Remove the ranges while retaining the named approaches. Production HTML was checked for the corrected headings. |
| Two browser harnesses left Chrome contexts open after all assertions passed. | Close each test context before browser shutdown and rerun the suites; log errors before cleanup. |

### Final evidence

- `pnpm test`: 376 passed; six integration tests are excluded from the default run. All six passed separately against isolated Firebase Auth/Firestore emulators, including unfinished attempt sync, concurrent draft recovery, and completion resets.
- `pnpm qa:learning-curriculum`: all 202 lesson sessions completed through real matching, ordering, numeric, and choice grading. The sweep includes representative wrong-answer retries and validates persisted completion/reset state; it seeds prerequisites, not graded answers.
- `pnpm qa:learning-path`: all 25 coding sessions in the isolated runner, all four courses, checkpoints, wrong answers, timeouts, input mutation, loading recovery, menus, keyboard navigation, mobile dark mode, backups, storage failure, and navigation passed.
- `pnpm qa:adaptive-learning`: placement pass/fail/cancel/retry across four courses, executable coding placement, no invented placement XP, next-unit navigation, hints/mistakes, review priority/recovery, backups, migration, and mobile placement passed.
- `pnpm qa:learning-continuity`: partial sequence/matching input, hints, checked feedback, completed groups, choice retries, checkpoint cursors, and code-history recovery survive reload. Completing once produces one reward and clears the attempt.
- `LEARNING_QA_OFFLINE=1 pnpm qa:first-month`: all 30 study days, 26 unique completions, eight review tasks, four milestones, capstone failure/recovery, mobile/dark states, offline reload/execution, missing-content recovery, and stale-revision rejection passed.
- `pnpm qa:learning-models`: six Redis, LLM, and ML models responded to controls at 390×844 and 1440×1000 without horizontal overflow; a visited model reloaded offline. No uncaught page errors were observed in the browser suites.
- Repository gates passed: strict content audit, strict registry validation, content/block/catalog validation, secret scan, type checking, lint, unit tests, production build, and diff whitespace check. The final build includes 493 pages and traces 2,229 canonical content assets.

Hands-on in-app checks covered partial sequence restoration with hints, matching and feedback, and the final learning home. The final matching capture was opened at its actual 390×844 resolution: heading hierarchy, reminder disclosure, role card, readable choices, hint, and fixed footer are visible without overlap. The sampled LLM model capture was also inspected. Broader responsive/reference comparisons remain documented above; this extension does not substitute programmatic overflow checks for a visual review of every model.

Logs: `.artifacts/learning-redesign/completion-{build,tests,sync,curriculum,models,continuity,learning-path,adaptive,first-month}.log`. Screenshots: `.artifacts/learning-continuity/`, `.artifacts/learning-curriculum/`, `.artifacts/learning-models/`, `.artifacts/daily-learning/`, `.artifacts/adaptive-learning/`, and `.artifacts/first-month/`. Earlier failure captures are historical evidence; the completion logs identify the final runs.

Local implementation and verification result: passed.

## Limits

This record describes the local verification completed before the subsequently requested production release. Release status is tracked by the Vercel deployment associated with the `main` commit. The compact illustrated labs cover three opening concepts and 27 exercise variants; later lessons expose existing source models. Derived exercises do not establish that every source claim has been independently reviewed. Physical-phone installation and virtual keyboards, assistive-technology testing, live production account smoke testing, and learning-outcome validation remain separate work. Browser screenshots and test passes do not establish educational effectiveness or comprehensive accessibility conformance.
