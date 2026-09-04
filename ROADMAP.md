# Product roadmap

SystemDesigner is becoming a substantial learning platform for engineering: connected courses, daily practice, immediate feedback, and progression toward building complete systems. The goal is a Duolingo-style learning habit across a large curriculum.

Last reviewed: September 3, 2026. These are priorities, not promised release dates. The milestones through “practice throughout the curriculum” were deployed to SystemDesigner.net in release `d67a2ec0`; the guided journey beyond the first month and the second-month authored practice are implemented and verified locally in the development checkout. The remaining product and validation work is described below.

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

All 202 noncoding lesson sessions now use the shared exercise engine. Twenty-three lessons have 69 hand-authored exercise groups with 207 variants. The other 179 lessons derive practice from their existing authored models and assessments: learners match components to responsibilities, then make scenario decisions. Across both sources there are 785 groups and 2,009 variants. These counts include reused source material; they are not a claim that every variant was newly authored or independently calibrated.

The catalog references 400 existing interactive models. Later daily lessons expose their source models on demand; the opening three retain their compact request, capacity, and cache models. The short lesson and its main action stay visible; larger models open individually for exploration. Model interaction itself never grants completion. Optional reminders keep repeated concept text out of the main matching task, and mobile matching presents one responsibility at a time.

Version 5 learning progress resumes interrupted exercises and mixed quizzes, including selected inputs, hints, locked feedback, completed exercise groups, and review variants. Restored answers are checked against the current content revision. A completed session leaves a durable reset marker so an older sync cannot reopen it. Recent displaced coding drafts are recoverable inside the editor, including alternatives retained during sync. Existing v2/v3/v4 documents and backups migrate in place.

## Implemented: a guided journey through every design and coding session

The guided path no longer ends at day 30. Five parts and 130 study days connect all 77 system-design sessions and 25 coding exercises in course order:

| Part | Days | Covers | Closes with |
| --- | ---: | --- | --- |
| Build your first system | 1–30 | Request flow, capacity, caching, performance, storage; coding units 1–2 | The link-service project |
| Serve data at scale | 31–60 | Replication and sharding, hashing, distributed stores, caches, search, object storage, the edge, APIs and contracts; API-boundary coding | The expiring-cache project |
| Keep services running | 61–90 | Queues, streams, event-driven design, workflows, proxies, limits, breakers, concurrency, chaos; traffic-control and safe-state coding | The exactly-once event applier |
| Ship complete systems | 91–120 | Containers, orchestration, observability, identity, secrets, web security, five complete designs; job-processing coding | The bounded worker plan |
| Learn from real systems | 121–130 | WhatsApp, Netflix, GitHub, and Uber case studies with reviews that connect earlier designs and builds | The real-systems checkpoint |

Twenty-eight review days revisit 56 earlier sessions at the current content revision, sixteen milestones mark chapter ends, and every 30-day month ends with a coding project. The trail keeps the approved chapter view, adds a compact streak and daily-goal signal once a learner has practiced, lists the full path by part with per-part progress, and hands off to the Generative AI and Machine learning courses when the journey is complete. Existing day IDs and journey tasks are unchanged.

Ten lessons that open the second month (replication and sharding, consistent hashing, SSTables, Cassandra, DynamoDB, Memcached, Elasticsearch, Lucene, object storage, and CloudFront) now have hand-authored practice: 47 groups and 141 variants of capacity and cost calculations, ordered protocols, and scenario decisions whose answers were checked against the lesson sources. Authored practice now totals 33 packs, 116 groups, and 348 variants. The 169 remaining derived packs name the lesson section each matching task comes from, give hints that recall the lesson’s key idea instead of listing the answer, and explain each part’s responsibility after checking. Every lesson session links its registry prerequisites from “Go a little deeper”.

Unit placement now survives practice improvements: a unit revision follows its assessment content alone, so authoring better exercises for a lesson refreshes that lesson’s review evidence without revoking a placement the learner earned. This first regeneration reset earlier placement grants and practice evidence once; historical completions were unaffected.

## Next: validate learning outcomes and the experience on real devices

The implemented web experience has local browser verification across the full curriculum. Production releases publish the verified `main` branch through the existing Vercel project. The remaining device checks require physical iOS/Android devices and a live signed-in two-device smoke test. Native app-store distribution is a separate product decision.

Curriculum improvement continues with real learner evidence: check placement difficulty, evaluate retention and transfer, refine broad lesson-level skills, and keep replacing derived matching and recognition tasks with authored calculations, diagnoses, and trade-offs. The service-interfaces, asynchronous-systems, and resilient-services units that fill months two and three are the next authoring targets. The current review scheduler remains an explainable heuristic rather than a calibrated proficiency estimate. Matching a source model is useful practice, but does not establish mastery of its whole subject.

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
