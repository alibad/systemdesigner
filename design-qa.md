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

## Journey continuation and second-month practice

Date: September 3, 2026, after the `d67a2ec0` release. Scope: use `/learn` as a new and returning learner, fix concrete shortcomings, extend the guided journey past day 30, and replace the weakest source-derived practice on the path with authored exercises.

The walkthrough used the released production build on desktop and phone viewports, the live site in an iOS 26 Safari simulator, and the code paths behind each screen. The trail, first lesson, models, matching practice, checkpoint, coding, and settings behaved as documented. The problems were in what happened after the first month, in the derived practice’s wording, and in generated lesson copy.

| Severity | Finding | Resolution |
| --- | --- | --- |
| P1 | After day 30 the primary Learn tab ended in “Your first month is complete” with a single button to the course list. Seventy-six design and coding sessions had no guided continuation. | The journey now has five parts and 130 study days covering every design and coding session in course order, with 28 review days, 16 milestones, and a coding project closing each month. The trail keeps the approved chapter view, shows per-part progress and the full path by part, and hands off to the GenAI and ML courses at the end. Day IDs and stored tasks are unchanged. |
| P1 | Derived practice hints listed the full answer key (every matching pair, or the question’s explanation), so “Need a hint?” was a reveal button. | Hints now give a strategy plus the lesson’s takeaway or key idea. Prompts name the lesson section the matching task comes from, and the post-check explanation restates each part’s responsibility. |
| P1 | The “key idea” shown before practice was a dangling fragment in 13 lessons (“The distinction is the first invariant:”, “Cassandra matters when a workload needs:”) and the takeaway in 7, because the generator took a paragraph that only introduced a bullet list. Four more were a lone quotation mark from the sentence splitter. | The generator merges an introducing paragraph with its list, skips fragments, and keeps closing quotes with their sentence. Every lesson session now opens with a complete sentence. |
| P2 | The ten lessons that open the second month had only derived matching and three source questions each, with 20% of matching pairs leaking their label into the description. | Ten authored packs (47 groups, 141 variants) add capacity, quorum, movement, cost, and read-unit calculations, ordered protocols, and scenario decisions with option-specific feedback, checked against the lesson sources. Variant IDs are namespaced by lesson. |
| P2 | Regenerating practice changed every unit revision, which would have revoked earned placements even though the placement assessments were unchanged. | Unit revisions now hash the assessment content alone (checkpoint questions without embedded lesson revisions, or coding tests). Practice changes refresh a lesson’s review evidence without revoking placement. This regeneration reset earlier grants once. |
| P2 | “Go a little deeper” repeated the key-idea paragraph verbatim and offered only the full-lesson link. | It now lists up to four registry prerequisites (“Foundations first”) before the full-lesson link. 176 sessions carry prerequisites. |
| P2 | The Learn tab showed no streak or daily-goal signal; both lived only on the Courses and Practice headers. | A compact streak and “n/goal today” chip appears in the trail heading once the learner has practiced. |
| P3 | The backup preview and first-month script still described the plan as “all 30 days complete”. | Copy and scripts follow the journey length; the first-month suite now asserts the trail continues into part two. |

### Intentional adaptations

- Parts two to four keep 30 study days each with six or seven review days; part five is a ten-day finale of case studies and cross-cutting reviews that ends with the real-systems checkpoint rather than a coding project, because the case-study unit has no coding steps. The generator requires a milestone at the end of every part and a coding step for every project day.
- The first chapter of each part takes its heading from the part title; later chapters keep the milestone-name heading used since the first release.
- Derived packs remain derived: the generator changes improve wording and hints, not the depth of the tasks. Authored replacement continues unit by unit, and the counts distinguish the two.

### Evidence

- `pnpm test`: 377 passed; six emulator integration tests remain excluded from the default run and were not rerun (the sync contract and adapter did not change). New unit coverage walks all 130 study days through real prerequisite gates (102 distinct completions, 56 review tasks), checks that every design and coding session appears exactly once in course order, that every part ends with a milestone and every project day is a coding step, and that all 33 authored packs validate with unique variant IDs and rotating review variants.
- Repository gates: secret scan, strict content audit, strict registry validation, content/block/catalog/journey validation, type checking, lint, and the production build (493 pages, 2,229 traced content assets) passed.
- `pnpm qa:learning-journey` (new, 390×844): a seeded complete first month lands on “Study day 31 of 130” with the part-two heading, part-one listed as 30/30 in the full path, and day 32 locked; days 31–38 then completed through the real UI, including a wrong answer and a hint in the new authored packs, the `code-validate-limit` coding task in the isolated runner, the two-task review day, and the checkpoint milestone. Prerequisite links, the streak chip, per-part progress, and the next chapter heading were asserted. No uncaught page errors.
- `pnpm qa:learning-curriculum`: all 202 lesson sessions completed through real grading against the reworked derived packs and the ten authored packs, with representative wrong-answer retries and persisted completion state; no uncaught errors.
- `pnpm qa:learning-path`, `pnpm qa:adaptive-learning`, `pnpm qa:learning-continuity`, and `LEARNING_QA_OFFLINE=1 pnpm qa:learning-models` passed unchanged against the rebuilt app.
- `LEARNING_QA_OFFLINE=1 pnpm qa:first-month` (corrected to expect the trail to continue into part two): all 30 days, 26 unique completions, eight review tasks, four milestones, partial-day restore, capstone failure and draft recovery, small-screen dark mode, offline reload, visited-exercise execution, uncached-lesson recovery, public-only cache, and stale-revision rejection passed; after day 30 the trail shows “Study day 31 of 130” and the part-two heading.
- Hands-on: the fresh-learner trail, first lesson, and practice on desktop and phone viewports; the seeded end-of-journey state (trophy, “You built complete systems”, GenAI and ML hand-off buttons, all parts complete) and the Generative AI hand-off landing on the Courses tab with its first unit. The live production site and the rebuilt local app were opened in an iOS 26 Safari simulator (iPhone 17): the trail, safe areas, primary action, and bottom navigation rendered correctly. The simulator check is a rendering check only; the native simulator integration was unavailable (Xcode selection), so no taps or keyboard input were exercised there.

- Production, after deployment `dpl_DRT6oQduQth6ppk5LLQya9Jj9x9n` (commit `041b246b`) reported READY with the production domains aliased: `/learn`, `/roadmap`, manifest, service worker, and illustrations returned 200; unknown session 404; stale revision 409; the replication-and-sharding session served revision `caf7deabc8ce`, its authored pack, its prerequisite link, and a complete key idea; a derived pack served the section-named prompt and non-revealing hint; the coding project served its tests; the roadmap page rendered the new milestone. The journey suite then passed against `https://www.systemdesigner.net` as a guest (days 31–38 through the live UI, including the isolated coding runner, the review day, and the checkpoint). No uncaught page errors.

Logs and captures: `.artifacts/journey-continuation/` (suite logs including the production run, build log, simulator captures) and `.artifacts/learning-journey/` (phone and desktop screenshots from the journey suite).

### Limits

The second-month chapter is browser-verified end to end; days 39–130 are verified by unit tests over the real prerequisite gates and by the curriculum sweep of every lesson, not by a browser walk of each study day. Authored practice covers the first five design units and selected later lessons; the remaining 169 packs are still derived. The streak chip, hand-off buttons, and full-path listing were reviewed at 390×844 and 1440×1000 in light mode; dark-mode captures of the new elements come from the existing suites’ small-screen dark check. Physical devices, screen readers, and a live signed-in two-device session remain unverified.

## Month-two and month-three practice and a bounded review set

Date: September 4, 2026, after release `041b246b`. Scope: the open items from the previous section that could be completed in the repository: authored practice for the next units the journey reaches, and the returning-learner review overload.

| Severity | Finding | Resolution |
| --- | --- | --- |
| P2 | Journey days 50–57 (service interfaces) and 61–72 (asynchronous systems) still used derived matching plus three source questions each, so the second and third months dropped back to recognition tasks right after the authored data-at-scale chapter. | Thirteen authored packs (65 groups, 195 variants): page-limit, resolver fan-out, deadline-budget, gateway-fleet, queue-backlog and drain, retained-bytes, quorum, and recovery-window calculations; ordered protocols for the contract, idempotency, WebSocket admission and resume, HTTP/2 streams, partition planning, the outbox path, and the SQS lease; scenario decisions with option-specific feedback. Answers were checked against the lesson sources, including the RFC 9218 urgency scale, Chrome 106 push default, SQS visibility bounds, and Raft majority rule stated there. |
| P2 | A learner returning after a break saw “23 skills are ready to revisit” on the trail and 23 cards on the Practice tab, with no suggested first step beyond the top card. | Both surfaces present a bounded daily set of five in the existing priority order (mistakes first, then longest overdue) and a “Show all” toggle. The queue, evidence, and scheduling are unchanged; the bound is display-only. |

### Intentional adaptations

- The review set bound is five because a lesson session is three to seven minutes and the daily goal maximum is three sessions; five reviews plus one new lesson keeps a day under an hour. The number is a product default, not a calibrated value.
- Derived packs remain derived and are counted separately: 46 authored, 156 derived.

### Evidence

- `pnpm test`: 377 passed. Pack validation now covers 46 authored packs with unique variant IDs and rotating review variants.
- Repository gates: type checking, lint, content/block/catalog/journey validation, and the production build passed.
- `pnpm qa:learning-journey` (extended, 390×844): with 26 due skills after a seeded first month, the trail banner reads “Today’s set: 5 of 26 due skills”, the Practice tab shows five cards, “Show all 26 due skills” reveals the rest, and “Show today’s set” collapses them; days 31–38 then completed through the real UI as before. No uncaught page errors.
- `pnpm qa:learning-curriculum`: all 202 lesson sessions completed through real grading, including the thirteen new authored packs, with representative wrong-answer retries and persisted completion state.
- `pnpm qa:adaptive-learning` and `pnpm qa:learning-path` passed unchanged (review priority and recovery with fewer than five due skills, all 25 coding sessions, placement across four courses).
- Hands-on: the Practice tab capture with the bounded set and toggle was reviewed at 390×844.

Logs and captures: `.artifacts/practice-depth/` and `.artifacts/learning-journey/phone-review-set.png`.

### Limits

Days 50–57 and 61–72 are verified through the per-lesson curriculum sweep, not a browser walk of each study day. The first-month and offline suites were not rerun; the trail change is a text branch inside the recall banner and the journey suite renders the same component. Not pushed or deployed in this round.

## Authored practice for the whole design course

Date: September 4, 2026, second round, after release `3089d150`. Scope: finish hand-authored practice for every system-design lesson on the guided journey.

| Severity | Finding | Resolution |
| --- | --- | --- |
| P2 | Twenty-six design lessons on journey days 73–130 (resilient services, production, security, the design lab, and the case studies) still used derived matching plus three source questions each. | Twenty-six authored packs (130 groups, 390 variants): socket and connection math, token-bucket envelopes, breaker trip math, blast-radius sizing, extraction capacity, Docker rebuild counts, Kubernetes headroom, etcd quorum, Prometheus series budgets, Grafana query pressure, JWT time windows, Keycloak SSO counts, Vault lease math, interview estimates, and the capacity models from the URL-shortener, chat, cache, payment, notification, WhatsApp, Netflix, GitHub, and Uber walkthroughs; ordered protocols for the proxied request, trusted hops, the distributed limiter, resilience controls, chaos experiments, the strangler migration, the Docker delivery path, the reconciliation loop, list-and-watch, PKCE, JWT validation, the Keycloak login, the Vault lifecycle, the authority path, the interview framework, the redirect path, the chat send and reconnect paths, the notification pipeline, private message delivery, video ingest, the protected merge, and the regional ride request; scenario decisions with option-specific feedback. Answers were checked against the lesson text, including the RFC 9218 urgency scale, the Chrome 106 push default, etcd majority arithmetic, the Prometheus 1–2 bytes-per-sample estimate, and the lesson’s own capacity envelopes. |

### Intentional adaptations

- The case-study packs use the lessons’ illustrative planning envelopes (450M WhatsApp users, 18K GitHub events per second, 900 Uber requests per minute) and say so in their context; they are not claims about production fleets.
- Authored practice was complete for the design course only at this point. The GenAI and ML courses still used derived packs: 72 authored, 130 derived. This was finished later the same day; see the final section.

### Evidence

- `pnpm test`: 377 passed; pack validation covers 72 authored packs with unique variant IDs and rotating review variants.
- Repository gates: content/block/catalog/journey validation, secret scan, and the production build passed (493 pages, 2,229 traced assets).
- `pnpm qa:learning-curriculum`: all 202 lesson sessions completed through real grading, including the 26 new authored packs, with representative wrong-answer retries and persisted completion state; no uncaught errors.
- `pnpm qa:learning-journey`, `pnpm qa:adaptive-learning`, and `pnpm qa:learning-path` passed unchanged against the rebuilt app.
- A production smoke check and the journey suite against the live domain are recorded in `docs/CLAUDE_HANDOFF.md` after deployment.

Logs: `.artifacts/design-course-practice/`.

### Limits

Days 39–130 are verified through the per-lesson curriculum sweep and unit tests over the real prerequisite gates, not a browser walk of each study day.

## Hand-authored practice for every lesson, and the answer-length defect

Date: September 4, 2026, after the `00cbd003` docs commit. Scope: finish authored practice for the GenAI and ML courses, then audit the whole exercise corpus for shortcuts a learner could exploit without understanding the lesson.

### What the audit found

Three defects, measured across every pack rather than sampled:

- **The longest answer usually won.** Of 681 multiple-choice exercises, the correct option was the longest in 85% of cases, and averaged well over twice the length of its alternatives. Distractors were frequently one-word stubs ("Yes.", "Never.", "None.", "Job.") beside a full, specific correct sentence. A learner could score well by measuring text.
- **Ordering steps were listed in solved order.** Sequence items were stored, and therefore displayed, in the correct order, so the answer was the order already on screen.
- **Some groups repeated one exercise three times.** Several groups differed only by a renamed noun or an incremented version number, which wasted two of the three spaced repetitions.

A fourth check found one hint that stated its own answer; every other hint across the corpus was clean.

### What changed

- All 202 lesson sessions now use hand-authored practice: 202 packs, 961 groups, 2,883 variants (990 ordering, 1,068 decision, 540 calculation, 285 matching). No `daily-practice.generated.json` files remain.
- Every choice exercise was rebalanced. The correct option is now 1.07 times the average distractor on average, with a maximum of 1.59 and zero exercises failing the contract. Where the correct answer stays longest it now wins by a few characters rather than by a sentence.
- All 990 ordering exercises are shuffled deterministically for display; none are listed in solved order.
- The three packs behind the interactive models were rebuilt with genuinely different variants while keeping their visual scenes and their nine-exercise contract.

### Verification

- Unit tests: 377 passed, 6 Firebase emulator tests skipped. Content validation, the content-block registry check, the learning-catalog drift check, and the secret scan passed. The production build passed and traced 2,229 canonical content assets.
- Browser, against the rebuilt local production server on port 3101: `qa:learning-curriculum` completed all 202 lesson sessions with real grading against every authored pack, including matching, ordering, calculation, and choice exercises, with representative wrong-answer retries and persisted completion; `qa:learning-journey`, `qa:adaptive-learning`, `qa:learning-path`, `LEARNING_QA_OFFLINE=1 qa:first-month`, and `qa:learning-models` all passed. No uncaught page errors.

### Limits

- The browser sweep exercises the first variant of each group. Variants two and three are schema-validated and were reviewed by their authors, but have not been walked in a browser.
- Difficulty is not calibrated against learner outcomes. These are exercises written against the lesson sources, not items with measured discrimination.
- Practice content changed for most lessons, so per-skill review evidence for those steps resets once. Unit placements survive, because a unit revision is derived from assessment content only.
- Physical-device installation, screen-reader testing, and a live signed-in two-device sync check remain outstanding external checks.

## One guided path, and a second reading of every calculation

Date: September 4, 2026, after the `d8a1ee2c` release. Scope: close the gaps that release left open. The guided journey stopped at day 130 while 162 generative-AI and machine-learning sessions had authored practice but no order; the 540 calculation answers had each been written once and never checked; and only the first variant of each practice group had ever run in a browser.

### The journey now reaches every session

325 study days in 14 parts cover all 272 sessions exactly once in course order, with 53 review days (106 review tasks) and 25 milestones. Parts one to five are unchanged. Parts six to ten add generative AI over 103 days; parts eleven to fourteen add machine learning over 84 days. A coding project still closes each of the first four months; the later parts end on unit checkpoints, which the generator already permits.

Day IDs stay stable, so a learner mid-journey keeps their tasks. The end-of-journey screen used to offer "Start Generative AI" and "Start Machine learning"; both are now inside the path, so it points at the full path instead.

The journey remains one ordered sequence rather than per-course tracks. That keeps the progress model and day IDs intact, and course pages plus placement still let a learner study out of order.

### Every calculation was re-derived

All 540 `number` exercises were re-derived from `context` and `prompt` alone, by a reader other than the author, before the stored answer was looked at.

**No stored answer was wrong.** Fourteen exercises were changed for other reasons:

- Four prompts depended on a convention stated only in the hint or the lesson, so a learner using the standard reading was marked wrong. The quantity now appears in the prompt. The clearest case was three sharding exercises whose "keep 30% headroom" meant "plan for 30% above peak", a rule that lived only in the hint.
- Six distractors named an error their value does not encode, or sat on a value no plausible error reaches. One told a learner who had answered wrongly to use the method that produces the correct answer.
- Three explanations or units were wrong for their own numbers, including three latency exercises whose explanation instructed a millisecond conversion no prompt required.

### Later variants now run in a browser

`pnpm qa:practice-variants` seeds prior completions so each lesson opens at its second or third review, then answers those exercises through the real interface with grading. Every group's variants differ in answerable content, so a passing run is evidence the intended variant rendered, not a coincidence.

Getting it to pass took three attempts, and every failure was in the harness rather than the app. The instructive one: `locator.isVisible()` does not wait, so a readiness check written with it returned false the instant a view had not yet rendered, and the sweep concluded the lesson would not open. Instrumenting the click showed the session opening normally. The sweep now waits with `waitFor`, confirms the first exercise heading is on screen, and reopens from a reloaded page if it is not. No product defect was found here, and the earlier note in this file claiming one was withdrawn.

### Verification

- Unit tests 377 passed, including a walk of all 325 study days through real prerequisite gates. Typecheck, lint, content validation, the authored-practice contract, and the secret scan passed. The production build passed and traced 2,229 canonical content assets.
- Browser, against a clean local production build: journey, adaptive and placement, learning path, offline first-month, models, and the full 202-lesson curriculum sweep all passed. The new later-variant sweeps then passed at both review levels, each walking all 202 lessons and answering 961 exercises. With the curriculum sweep's first variants, all 2,883 authored exercises have now been rendered and graded through the real interface.

### Limits

- Review-day density in the new parts is 13%, against 22% in the design course, because several units have only three or four lessons and a review can be neither the first nor the last day of a unit.
- The journey is one linear path. A learner who wants only machine learning uses course pages and placement rather than the trail.
- Difficulty is still not calibrated against learner outcomes.
- An earlier run of the browser suites failed with a chunk-load error that looked like a code regression. It was a half-written build left by a rebuild that was killed mid-flight. Re-running against a clean build passed. Stopping a local server by process-name pattern also stopped unrelated projects' dev servers on the same machine; target the port instead.

## Hands-on building for the last two courses

Date: September 6, 2026, after the `1607a66b` release. Scope: the coding course stopped where system design did, so the 187 journey days covering generative AI and machine learning had nothing to implement.

### What was added

Eight coding exercises in two units. **Build GenAI request paths**: budget a context window after reserving instructions and the answer, fuse two ranked lists by rank rather than raw score, plan overlapping chunks from a stride, and assemble an evidence packet that filters for authorization and freshness, drops repeated sources, and refuses when nothing survives. **Judge and ship a model**: report precision, recall and F1 against their own denominators, split records chronologically with an embargo, find the largest distribution shift by share, and decide whether a canary is promoted, held, or rolled back.

Each ships a starter and a reference solution. The existing contract test runs every solution against every fixture and checks it does not mutate its inputs, so a broken exercise fails the suite rather than a learner.

### The decision that shaped the layout

The obvious placement was next to the lessons each exercise draws on. That was implemented and then reverted, because journey day IDs are positional: inserting a day renumbers every day after it, saved journey tasks are keyed `day-NNN:stepId`, and the task schema rejects a key it does not recognize. A learner past day 130 would have had their stored path treated as unreadable. The documentation also promises day IDs are stable.

The eight exercises are a closing fifteenth part instead. Days 1 to 317 are byte-identical to the released journey, verified by diffing against `HEAD`. The journey now ends by building something rather than on a checkpoint.

### What was fixed

The drift exercise originally asked for the largest share change between two buckets. With two buckets the shares always move by the same amount in opposite directions, so the answer was decided by which floating-point subtraction happened to round higher. Gaps are now rounded before comparison and ties break by bucket name, and the fixtures use three buckets with a clear winner.

Two hard-coded counts in the learning-path suite (`31` completed steps, "all 25 coding sessions") are now derived from the catalog, so adding coding exercises no longer requires editing the suite.

### Verification

Unit tests 385 passed, including the eight new reference solutions. Typecheck, lint, content validation, the authored-practice contract, the secret scan, and the production build passed. Browser suites against a clean local build: journey, adaptive and placement, learning path including a walk of all 33 coding sessions to course completion, offline first-month, models, and the 202-lesson curriculum sweep.

### Limits

- The new exercises are single functions, like the existing 25. Genuinely multi-file service tasks would need a different execution model in the runner.
- The closing part has no review days, so the eight exercises are practised once on the path rather than revisited.

## Multi-step exercises and Next.js 15

Date: September 6, 2026, after the `693950c2` release. Scope: the remaining open items, namely a coding model limited to one function per exercise, and 113 dependency advisories.

### The runner can now compose

An exercise used to be one function called once, which confines a task to a pure computation. An exercise can now declare the functions it expects and drive them as an ordered sequence, so a later call observes what an earlier one left behind. The functions are rebuilt for every test so state cannot leak between cases. Single-call exercises are unchanged and all 33 existing ones still pass.

The closing capstone uses it: an inference gateway where admission reserves a slot against both a tenant token budget and a capacity limit, refusals name which limit applied, completion returns the slot, and a report has to agree with the whole sequence. It sits in its own closing unit, because inserting it mid-list would have renumbered later study days.

### Next.js 15

Twelve advisories stood against 14.2.35, including three denial-of-service and three server-side request forgery issues, all fixed only on the 15 line. Advisories drop from 113 to 92; the rest are transitive and mostly build tooling.

Four mechanical changes were needed: promise-shaped route params across 33 files, a placeholder route with no handler, the removal of `request.ip`, and a clean build to regenerate types the previous major left behind. The whole upgrade was developed and verified in a throwaway worktree before the working tree was touched, and committed separately from the coding work so it can be reverted on its own.

### Verification

386 unit tests, typecheck, lint, content validation, the authored-practice contract, the secret scan, and the production build. Browser suites on a clean local Next 15 build: journey, adaptive and placement, learning path, offline first-month, models, and the 202-lesson curriculum sweep. Every dynamic page and API route answered 200 by direct request. After release, the journey and learning-path suites passed against the live site and the trail reported 326 study days.

### Limits

- **The Firebase emulator suite still cannot run here.** `firebase-tools` now requires Java 21 and this machine has 17, so the sync contract remains verified only by its unit tests. This is unchanged by the upgrade and is an environment gap, not a code one.
- Next 15 no longer caches `fetch` or GET route handlers by default. Nothing regressed in the suites and the offline walk still passes, but that is the behaviour to watch after release.
- Exercises are still single-file. A learner writes several functions in one editor rather than several modules.
