# Product roadmap

SystemDesigner is becoming a daily learning app for system design and coding: short lessons, meaningful practice, immediate feedback, and a clear next step. The goal is a Duolingo-style learning habit, with engineering decisions and working code at its center.

Last reviewed: September 2, 2026. These are priorities, not promised release dates.

## Available now: the daily learning starter

The daily learning path at `/learn` has two beginner units:

- **System design:** follow a request, scale a service, and read through a cache.
- **JavaScript coding:** calculate server capacity, route requests round-robin, and implement a cache lookup.

Each step introduces the concept before practice. Design steps use the shared quiz system; coding steps run a function against test cases and show the result. Learners can use hints and retry without a penalty.

Successful practice earns 20 path XP per new step, unlocks the next step, and counts toward a daily goal. Streaks use local calendar days. Completed skills return for spaced review after 1, 3, 7, and then 14 days. Repeating a completed step does not inflate XP.

The starter saves progress and coding drafts in the current browser. Account syncing for this new daily path is still to come. The existing library of 425 registry-backed entries, architecture tools, quizzes, and design practice remains available for deeper study.

## Next: make progress portable

Learning should survive a new browser or a new device.

- Connect daily-path progress, goals, review history, and coding drafts to the existing optional account system.
- Keep anonymous learning usable, including when offline.
- Let learners export and import a progress backup.
- Merge existing local progress safely when a learner signs in. Prevent duplicate rewards and recover interrupted syncs.
- Make saved, syncing, and offline states understandable.

This milestone is complete when a learner can finish a step on one device, resume on another, and keep their work through offline use and sign-in changes.

## Then: build a curriculum that grows

Expand the two starter units into a sequence of small, connected skills.

- **System design:** databases and indexes; caches and invalidation; load balancing and capacity; queues and retries; replication and consistency; then complete service designs.
- **Coding:** functions and collections; maps and sets; input validation; deduplication and idempotency; rate limits; queue processing; then small service components.
- Pair concepts across tracks so a learner can understand a design decision and implement the relevant behavior.
- Make units, prerequisites, completion requirements, and content versions explicit in the curriculum model.
- Give each unit a checkpoint and a small project that combines earlier skills.

The next small content milestone is one additional unit in each track, using the shared components and the existing registry-backed lessons.

## Then: teach through more kinds of practice

Multiple-choice questions are a starting point. Engineering learning also needs decisions, debugging, and construction.

- Predict an output or failure before running a model.
- Estimate capacity, identify a bottleneck, or choose a trade-off under stated constraints.
- Trace a request or arrange the parts of a small architecture.
- Debug a short program and test edge cases.
- Return to missed concepts with fresh question variants and explanations tied to the learner's mistake.

A richer exercise should reuse an existing content primitive when it fits and show a visible consequence of the learner's decision.

## Then: make mastery and coding assessment stronger

A completed starter step is an introductory checkpoint. Deeper mastery should depend on recall, transfer, and work the learner can reproduce later.

- Record attempts and concepts, then use delayed recall to choose useful reviews.
- Add placement and optional checkpoint-based skipping for experienced learners.
- Introduce authoritative grading before using results for competitive rankings or trusted account rewards.
- Evaluate an isolated execution service before adding Python, other languages, or larger programs.
- Use deterministic tests where possible. If AI feedback is added, explain its role and evaluate its accuracy and cost.

The current JavaScript runner is browser-based self-assessment with visible tests. It is not a trusted grading service.

## Later: motivation and broader access

- Weekly goals, milestones, and encouraging completion feedback.
- Optional reminders and social features, with learner control over notifications and visibility.
- Accessible mobile interactions, screen-reader support, and reduced motion throughout.
- Translated content and stronger community review tools.
- GenAI and ML systems tracks built on the same learning loop once the core experience is established.

Leagues and leaderboards come after portable progress and trustworthy assessment. Learning quality comes first.

## Ongoing work

Keep improving the existing lessons for beginner-friendly context, technical accuracy, useful examples, explicit trade-offs, and production behavior. Improve quizzes, calculators, contributor tooling, and the prerequisite graph as the curriculum grows.

Good first contributions are a focused lesson improvement, a stronger assessment, an accessibility fix, or clearer setup documentation. See the repository's [good first issues](https://github.com/alibad/systemdesigner/labels/good%20first%20issue).

## Principles to preserve

- SystemDesigner stays free and open: MIT code and CC BY-SA 4.0 content.
- Start every concept from first principles and link to deeper lessons.
- Reward demonstrated practice; keep retries available.
- Keep anonymous local learning available without required paid services.
- Show real progress and be clear about the limits of an assessment.

## Continuing development

For the implementation map, current limitations, verification commands, and an exact starting prompt for another coding session, read [Continue development](docs/CONTINUE_DEVELOPMENT.md). The [daily learning technical notes](docs/daily-learning-path.md) describe the current behavior.

The roadmap is maintained in this repository and also shown in the app. Propose changes through [Discussions](https://github.com/alibad/systemdesigner/discussions) or [Issues](https://github.com/alibad/systemdesigner/issues).
