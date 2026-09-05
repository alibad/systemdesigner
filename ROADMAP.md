# Product roadmap

SystemDesigner is becoming a substantial learning platform for engineering: connected courses, daily practice, immediate feedback, and progression toward building complete systems. The goal is a Duolingo-style learning habit across a large curriculum.

Last reviewed: September 4, 2026. These are priorities, not promised release dates. Every implemented milestone below, including the 130-day guided journey and hand-authored practice for all 202 lessons, is deployed to SystemDesigner.net (release `441aa5a4`); live guest checks passed. The remaining product and validation work is described below.

## Implemented: four connected courses

The learning hub at `/learn` organizes 264 sessions into 43 units:

| Course | Units | Sessions | Scope |
| --- | ---: | ---: | --- |
| System design | 12 | 77 | Request flow, capacity, storage, caching, service interfaces, queues, reliability, operations, security, and complete designs |
| Coding | 6 | 25 | JavaScript functions, collections, validation, traffic control, safe state changes, and job processing |
| Generative AI | 14 | 90 | Model foundations, prompting, retrieval, adaptation, evaluation, safety, agents, multimodal systems, and operations |
| Machine learning | 11 | 72 | Foundations, features, training, evaluation, efficient models, operations, and complete ML systems |

Each course has a visible unit map and a clear next session. Complete a unit's lessons and checkpoint, or demonstrate its skills in placement, to unlock the next unit. Courses progress independently, and the full reference lessons remain available at any time.

The curriculum draws from 202 existing registry-backed lessons. Most short sessions introduce a concept and use a subset of its source assessment; 37 mixed checkpoints bring the units together. Coding has 25 runnable exercises, including a combined task at the end of each unit. Explicit skill IDs and content revisions connect assessment evidence to all 227 lesson and coding skills.

The main experience focuses on continuing a course, seeing progress, and maintaining a daily habit. Course and goal selection use keyboard-accessible popup menus. Reviews have their own view. Account sync and backup utilities live in learning settings.

## Implemented: practice and portable progress

- Definition, example or key idea, practice, explanatory feedback, retry, and completion.
- Shared lesson assessments, short question sets, and reviews that rotate through source questions.
- JavaScript execution in an isolated worker, hints, edge-case tests, execution timeouts, and saved drafts. Object answers compare by content; exercises enforce preserving input arguments.
- All answers or coding tests must pass to complete a session. New sessions earn 20 path XP once; successful reviews do not inflate XP.
- Local-day goals, streaks, and adaptive reviews based on mistakes, hints, and delayed recall.
- Browser persistence and optional account sync, with safe separation between guest and account data.
- Validated backup import/export in settings, explicit preview before merging, and retries for pending account changes.

The broader library of 425 entries, interactive labs, architecture tools, quizzes, and design practice remains available for deeper study. The learning app can be added to a home screen. After an online visit prepares the app, previously opened exercises remain available offline; first-time content downloads and account sync need a connection.

## Implemented: richer exercises, placement, and adaptive review

Fourteen lessons across the first three system-design units now have 42 authored exercises with three variants each (126 variants). Learners trace requests, calculate capacity and performance, reason about failure domains, model ownership, choose indexes, handle transactions, and design document boundaries. Shared ordering, numeric, and scenario-choice interactions give explanations and optional hints. Reviews rotate scenarios or numbers.

Placement checks one unit at a time across all four courses. Noncoding assessments cover every skill in the unit; coding requires every runnable task. A successful check unlocks the next unit and labels the assessed unit as placed out. It does not invent lesson completions, XP, or daily-goal activity. Learners can stop after any unit and begin studying there.

Adaptive review prioritizes skills that need another attempt, then overdue recall checks. Unfinished practice stays due; a full pass after a mistake or hint returns the next day. A clean full pass starts at three days, and clean delayed recall can extend the interval up to 30 days. Repeated attempts on the same day cannot erase a mistake or increase recall strength. This is a transparent scheduling heuristic, not a calibrated proficiency score.

Version 5 progress preserves existing completions, preferences, and drafts with bounded evidence, revision-aware placement, guided-journey progress, unfinished sessions, and recoverable recent code versions. Existing browser data, backups, and account documents migrate automatically. Placement and recall evidence must match the current content revision; historical lesson completions remain intact.

## Implemented: a mobile first month

SystemDesigner.net remains the product and the full library remains available. The guided entry at `/learn` serves aspiring and early-career engineers learning coding and system design. GenAI and ML remain separate courses for later exploration. The first month is now the opening part of a longer guided journey, described below.

- A choice of starting with foundations or using placement, followed by 30 study days at the learner’s own pace.
- A connected sequence through requests, capacity, caching, performance, data modeling, and safe updates, interleaved with JavaScript practice.
- Four explicit review days, four milestones, and a final link-service model with executable tests for cache hits, missing keys, updates, and invalidation.
- Full-screen lessons, a compact header, persistent actions, phone bottom navigation, dark mode, safe-area spacing, and desktop layouts.
- Saved enrollment and partial review-day progress that merge across devices. Placement covers familiar lessons; review days still require practice.
- Home-screen installation and offline access to the prepared learning shell and previously opened public exercises. Content revisions keep cached practice aligned with the curriculum.

This milestone supplies 26 distinct sessions and eight review tasks. It is a first-month learning journey, with a small in-memory project. Native app distribution, real-device installation checks, and learner validation remain release work.

## Implemented: a learning trail and interactive systems

The Learn view now puts a chapter path and one next action first. Completed lessons remain available, upcoming steps stay visible, and learners can continue directly into the next study day. Courses and adaptive practice retain their own navigation; account utilities remain in settings.

The opening request, capacity, and caching lessons include interactive models: follow a request and response, add servers and simulate a failure, and observe cache misses, hits, stale reads, and invalidation. All 27 exercise variants in that unit have visual models tied to the authored parameters. Feedback moves into view, successful challenges advance the progress bar, and multiple-choice practice no longer adds a redundant confirmation screen.

This implements the selected learning-trail direction, with interactive systems inside lessons. The curriculum-wide practice milestone below extends the learning loop into later units.

## Implemented: practice throughout the curriculum and session continuity

All 202 noncoding lesson sessions now use the shared exercise engine with hand-authored practice: 202 packs, 961 groups, 2,883 variants. Each group is one skill with three variants that differ in substance, so the first, second, and third review are different problems. These counts are exercises written against the lesson sources; they are not a claim that every variant has been independently calibrated against learner data.

The catalog references 400 existing interactive models. Later daily lessons expose their source models on demand; the opening three retain their compact request, capacity, and cache models. The short lesson and its main action stay visible; larger models open individually for exploration. Model interaction itself never grants completion. Optional reminders keep repeated concept text out of the main matching task, and mobile matching presents one responsibility at a time.

Version 5 learning progress resumes interrupted exercises and mixed quizzes, including selected inputs, hints, locked feedback, completed exercise groups, and review variants. Restored answers are checked against the current content revision. A completed session leaves a durable reset marker so an older sync cannot reopen it. Recent displaced coding drafts are recoverable inside the editor, including alternatives retained during sync. Existing v2/v3/v4 documents and backups migrate in place.

## Implemented: a guided journey through every design and coding session

The guided path no longer ends at day 30. Fourteen parts and 317 study days connect all 264 sessions across the four courses in course order:

| Part | Days | Covers | Closes with |
| --- | ---: | --- | --- |
| Build your first system | 1–30 | Request flow, capacity, caching, performance, storage; coding units 1–2 | The link-service project |
| Serve data at scale | 31–60 | Replication and sharding, hashing, distributed stores, caches, search, object storage, the edge, APIs and contracts; API-boundary coding | The expiring-cache project |
| Keep services running | 61–90 | Queues, streams, event-driven design, workflows, proxies, limits, breakers, concurrency, chaos; traffic-control and safe-state coding | The exactly-once event applier |
| Ship complete systems | 91–120 | Containers, orchestration, observability, identity, secrets, web security, five complete designs; job-processing coding | The bounded worker plan |
| Learn from real systems | 121–130 | WhatsApp, Netflix, GitHub, and Uber case studies with reviews that connect earlier designs and builds | The real-systems checkpoint |

Twenty-eight review days revisit 56 earlier sessions at the current content revision, sixteen milestones mark chapter ends, and every 30-day month ends with a coding project. The trail keeps the approved chapter view, adds a compact streak and daily-goal signal once a learner has practiced, lists the full path by part with per-part progress, and hands off to the Generative AI and Machine learning courses when the journey is complete. Existing day IDs and journey tasks are unchanged.

Every system-design lesson on the guided journey now has hand-authored practice. Forty-nine packs written on September 3 and 4 cover data at scale, fast reads, service interfaces, asynchronous systems, resilient services, production, security, the design lab, and the four case studies: capacity, quorum, budget, fan-out, lease, and cost calculations; ordered protocols such as the idempotency handshake, WebSocket admission and resume, the outbox publish path, the SQS lease, the Kubernetes reconciliation loop, PKCE, JWT validation, the protected-merge path, and the regional ride request; and scenario decisions with option-specific feedback, all checked against the lesson sources. Every lesson session links its registry prerequisites from “Go a little deeper”.

A returning learner with many due skills now sees a bounded daily review set of five, mistakes first and then the longest-overdue checks, on both the trail and the Practice tab; the full queue stays one tap away.

Unit placement now survives practice improvements: a unit revision follows its assessment content alone, so authoring better exercises for a lesson refreshes that lesson’s review evidence without revoking a placement the learner earned. This first regeneration reset earlier placement grants and practice evidence once; historical completions were unaffected.

### Hand-authored practice for every lesson, and an answer-shaped defect removed

All 202 lesson sessions now use hand-authored practice: 202 packs, 961 groups, and 2,883 variants covering the GenAI and ML courses as well as system design. Each group is one skill with three variants that differ in substance, so a learner's first, second, and third review are different problems rather than the same problem with a renamed noun.

A measured defect was removed at the same time. Across the existing multiple-choice exercises the correct option was the longest one most of the time and averaged more than twice the length of its alternatives, so a learner could score well by measuring text instead of understanding the lesson. Distractors were rewritten into specific, plausible wrong positions, padded correct answers were tightened, and every pack is now checked against a contract: options whose length carries no signal, ordering steps shuffled rather than listed in solved order, at least two named mistakes on every calculation, and hints that nudge the method without naming the answer.

### One guided path through all four courses

The journey used to stop at day 130, after system design and coding, and hand the learner off to a course page with 162 GenAI and ML sessions and no order. It now continues: 14 parts and 317 study days cover every session in the curriculum exactly once, in course order, with 53 review days and 25 milestones. Parts six to ten walk generative AI from token prediction through retrieval, agents, serving, evaluation, and safety. Parts eleven to fourteen walk machine learning from problem framing through data, training, efficiency, operations, and applications.

Course pages and placement still work as before, so a learner who wants to jump straight to a topic can. What changed is that following the path no longer runs out.

### Every calculation checked a second time

The 540 calculation exercises were each written by one author and never verified. All of them were independently re-derived from the prompt alone. No stored answer was wrong. The audit did surface smaller defects and fixed them: prompts that depended on a convention stated only in the hint, distractor values that no plausible error reaches, feedback naming a different error than its value encodes, an explanation instructing a unit conversion the prompt never required, and units written as sentences.

## Next: validate learning outcomes and the experience on real devices

The implemented web experience has local browser verification across the full curriculum. Production releases publish the verified `main` branch through the existing Vercel project. The remaining device checks require physical iOS/Android devices and a live signed-in two-device smoke test. Native app-store distribution is a separate product decision.

Curriculum improvement now continues with real learner evidence rather than more authoring: check placement difficulty, evaluate retention and transfer, and refine broad lesson-level skills. All four courses are fully authored, so the next gains come from calibration, not coverage. The current review scheduler remains an explainable heuristic rather than a calibrated proficiency estimate. Answering an exercise correctly is useful practice, but does not establish mastery of its whole subject.

## Then: stronger coding and project assessment

- Add multi-file tasks and larger service components with meaningful behavioral tests.
- Evaluate isolated execution for Python and other languages.
- Introduce authoritative grading before competitive rankings or trusted account rewards. Current coding results are browser-based self-assessment with visible tests.
- If AI feedback is introduced, define its role, assess its accuracy, and control its cost.

## Later: motivation and broader access

- Weekly goals and richer feedback after completing a unit or course.
- Optional reminders and social features with learner control over notifications and visibility.
- Downloadable offline content packs, further screen-reader testing, and native apps if learner demand warrants them.
- Translations and contributor tools for reviewing course coverage and practice quality.

## Principles to preserve

- Free and open: MIT code and CC BY-SA 4.0 content.
- Start from first principles, introduce context, and link to deeper lessons.
- Keep anonymous learning available and retries unlimited.
- Keep utilities out of the primary learning flow.
- Show real progress and state assessment limits accurately.
- Run verification and deployment locally; no hosted automation without an explicit request.

For the current implementation and next development task, read [Continue development](docs/CONTINUE_DEVELOPMENT.md) and the [learning technical notes](docs/daily-learning-path.md). The app's `/roadmap` page renders this document directly.
