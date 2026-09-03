# Daily learning path

Resuming on another machine? Read [Continue development](./CONTINUE_DEVELOPMENT.md) for the handoff and [the product roadmap](../ROADMAP.md) for priorities. The app shows that same roadmap at `/roadmap`.

`/learn` is the daily practice entry point. The homepage and main navigation link to it. The first release includes two beginner units: three system-design sessions and three JavaScript exercises. The existing registry-backed lessons remain the source for deeper reading.

## Learning loop

1. Read a short definition, concrete example, and takeaway.
2. Answer three questions or complete a JavaScript function.
3. Get an explanation or actual test output. Retry without a limit.
4. Answer every question correctly or pass every code test to complete a step.
5. Earn 20 path XP once, unlock the next step, and schedule a review.

The two tracks unlock independently. Reviews are due after 1, 3, 7, then 14 days. A successful review reschedules the skill. A step counts toward the daily goal once per local calendar day; repeat completions never add XP. Streaks include yesterday until today ends, so learners do not lose a streak before they have a chance to practice.

## Content and state

- Track/session data: `content/entries/fundamentals/what-is-system-design/data/daily-design-path.json` and `content/entries/fundamentals/scalability-basics/data/daily-coding-path.json`.
- Questions: the canonical quiz bank, served by the existing quiz API and rendered by `InteractiveQuiz` in sequential session mode. Existing lesson quiz behavior is preserved.
- Starter programs: co-located `code/daily-*.js` assets served by the content API. Test cases and hints live in the coding data file.
- The path is a practice hub, not a replacement lesson route. No concrete content pages or duplicate Markdoc bodies are added.
- Progress, track selection, daily goal, and coding drafts are stored in this browser. They do not yet sync to an account. Path XP is separate from account XP; it is local practice feedback, not a verified credential.
- Progress is schema-validated on load. Unknown step IDs are dropped. Storage failures keep the current visit usable and display a persistence notice.

## JavaScript execution

The runner creates a sandboxed iframe with `allow-scripts` only, then executes the submitted function in a Blob worker. The worker inherits a CSP that blocks network access, and has no access to the application window or its storage. A two-second worker timeout terminates infinite loops; a five-second outer timeout handles startup failures. Closing the exercise removes the runner, and editing the code clears previous test results.

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
```

The browser script uses Playwright's Chromium. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use an installed Chrome executable, or install Playwright Chromium locally. Set `LEARNING_QA_BASE_URL` for another port. Screenshots are written to `.artifacts/daily-learning/`.

The checks cover every starter step, wrong answers and retries, unlocking, repeat completion, local-day streaks and reviews, coding failures and infinite-loop termination, editor isolation, draft persistence, storage quota failure, goal changes, keyboard completion, mobile overflow, and homepage navigation.

## Product expansion

The next units should build on the same sequence: databases and indexing, queues and retries, then complete service design. Coding can extend those concepts with deduplication, rate limits, and queue processing. Before adding leagues or competitive scores, add account-backed progress and authoritative grading. Before claiming adaptive mastery, add question variations and evidence from delayed recall; passing the same small question set is only an introductory checkpoint.
