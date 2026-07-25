# Content Guide — How to Suggest & Improve Content

Welcome! This is the single most important guide for anyone who wants to make
**[SystemDesigner](https://systemdesigner.net)** better. Whether you spotted a typo,
want to add a real-world example, sharpen a quiz question, or write a brand-new lesson,
this page walks you through it step by step.

You do **not** need to be an expert to contribute. If you understand a topic well enough
to explain it to a friend, you can improve a lesson. Every fix — however small — helps
thousands of learners. Thank you for being here. 🙌

> **New to the project?** Skim the top-level [README](../README.md) and
> [CONTRIBUTING](../CONTRIBUTING.md) first, then come back here for the content-specific
> details. For the exhaustive authoring standards, see [AGENTS.md](../AGENTS.md).

---

## Two ways in

There are exactly two paths, depending on how big your change is. Pick whichever fits.

### (A) Tiny improvements — **zero setup**

Perfect for typos, a clearer sentence, a broken link, a better example, or a quiz tweak.
You never have to install anything.

**From the live site (easiest):**

1. Open the lesson on [systemdesigner.net](https://systemdesigner.net).
2. Click **"Edit this page on GitHub"** — it deep-links straight to the lesson body at
   `content/entries/<section>/<slug>/index.mdoc` in GitHub's file editor.
3. Make your edit in the browser, then click **"Propose changes"** — GitHub creates a fork
   and a pull request for you automatically.

**Or, if it's not a wording change but a suggestion:**

- Click **"Suggest an improvement"** on the lesson. This opens a **prefilled GitHub issue**
  (the Content improvement form) with the page already filled in. Describe what's wrong or
  what you'd add, and submit. A maintainer or another contributor can pick it up.

**Or directly on GitHub:**

1. Browse to the file at
   [github.com/alibad/systemdesigner](https://github.com/alibad/systemdesigner).
2. Click the ✏️ **Edit** (pencil) icon on any file.
3. Edit in the web UI and **open a pull request**.

That's it. No clone, no `pnpm install`, no local server. CI will validate your change for you.

### (B) Bigger changes / new lessons — **clone & run locally**

Choose this when you're adding a new lesson, changing the content registry, adding code
examples or a calculator, or touching more than one file.

```bash
# 1. Fork the repo on GitHub, then clone your fork
git clone https://github.com/<your-username>/systemdesigner.git
cd systemdesigner

# 2. Install dependencies (Node 20+, pnpm 10.4.1)
pnpm install

# 3. Start the dev server — runs with NO env vars at all
pnpm dev
# open http://localhost:3000

# 4. Create a branch
git checkout -b content/my-new-lesson
```

> The app runs **fully anonymous** with zero configuration. You only need environment
> variables for your own deployment/fork (see [docs/DEVELOPMENT.md](./DEVELOPMENT.md) for
> the full list). For just writing content, you need none.

---

## Anatomy of a lesson

Every lesson flows through the same pipeline. Understanding it makes contributing easy,
because each piece has exactly one home.

```
lib/content-registry.ts          ← (1) the registry entry (source of truth)
content/entries/<section>/<slug>/index.mdoc  ← (2) the lesson body
content/entries/<section>/<slug>/code/*      ← (3) co-located code examples
content/entries/<section>/<slug>/quiz/*.json ← (4) the lesson quiz
content/entries/<section>/<slug>/data/*      ← (5) other structured lesson data
```

Here's the end-to-end flow.

### 1. Add an entry to `lib/content-registry.ts`

The registry (`CONTENT_REGISTRY: ContentNode[]`) is the **single source of truth** for all
425 content entries. Navigation, sitemaps, learning paths, and SEO all generate from it.
**Always add the registry entry first** — before creating the body.

```ts
{
  id: 'rate-limiting',
  title: 'Rate Limiting',
  path: '/fundamentals/rate-limiting',     // MUST match the entry directory
  section: 'fundamentals',                  // one of the 8 sections (see table below)
  level: 'intermediate',                    // 'beginner' | 'intermediate' | 'advanced'
  duration: '20 min',
  hasQuiz: true,
  renderMode: 'mdoc',
  prerequisites: ['load-balancing'],        // ids learners should know first
  related: ['api-gateway', 'caching'],      // complementary topics
  tags: ['scaling', 'reliability', 'apis'],
  seo: {
    metaDescription: 'Learn how rate limiting protects services from overload using token bucket, leaky bucket, and sliding-window algorithms.', // <= 160 chars
    keywords: ['rate limiting', 'token bucket', 'throttling', 'api'],
    priority: 0.7,
    changeFreq: 'monthly',
    lastModified: new Date(),
  },
  status: 'active',
}
```

**Field rules that trip people up:**

- `path` must be exactly `/<section>/<slug>` and must match the entry directory.
- `id` is usually the slug (e.g. `rate-limiting`).
- `seo.metaDescription` must be **≤ 160 characters**. The validator enforces this.
- `prerequisites` and `related` must reference **ids that already exist** in the registry.

### 2. Run the validator

This is the gate. CI runs it on every PR, so run it locally first:

```bash
node scripts/validate-content-registry.cjs
```

It checks for duplicate ids/paths, broken `prerequisites`/`related` references, broken
`nextInSequence` chains, over-length SEO descriptions, and missing tags. Fix anything it
flags before moving on.

### 3. Create `content/entries/<section>/<slug>/index.mdoc`

The section's dynamic `[slug]` route supplies the header, layout, completion controls,
navigation, and metadata. The body contains only instructional content.

```md
---
registryId: rate-limiting
---

{% section-card tone="intro" %}
## What is Rate Limiting?

Rate limiting caps how many requests a client can make in a time window. It keeps a
busy service from being overwhelmed by traffic spikes or abuse.
{% /section-card %}

{% section-card %}
## Why It Matters

Now introduce the mechanics and trade-offs through progressive disclosure.

{% code-block
   file="/api/content/fundamentals/rate-limiting/code/token-bucket.py"
   language="python"
   title="Token Bucket Implementation" /%}
{% /section-card %}

{% quiz
   questionsFile="/api/content/fundamentals/rate-limiting/quiz/rate-limiting-review.json"
   lessonSlug="rate-limiting"
   title="Test Your Understanding" /%}
```

Do not add `app/<section>/<slug>/page.tsx`. Concrete content routes bypass the shared
renderer and are rejected by the content audit.

### 4. Co-locate code examples under `code/`

Real code lives in files, **not** inside large Markdoc fences or React template literals — this avoids parsing bugs
and gives you full editor support. Put examples next to the entry body:

```
content/entries/fundamentals/rate-limiting/
├── index.mdoc
└── code/
    └── token-bucket.py
```

Reference them with the `file` attribute on `code-block`, pointing at the content API route:

```md
{% code-block
  file="/api/content/fundamentals/rate-limiting/code/token-bucket.py"
  language="python"
  title="Token Bucket Implementation"
/%}
```

Use descriptive names (`token-bucket.py`, not `code1.py`) and the right extension
(`.py`, `.ts`, `.yaml`, `.sql`, `.json`, …). These files are excluded from TypeScript
compilation, so they're treated as content, not code.

### 5. Co-locate quiz questions under `quiz/`

New lesson quizzes live beside the lesson at
`content/entries/<section>/<slug>/quiz/<descriptive-name>.json`. Existing entries
that already use the shared quiz bank may continue using `quizId`, but do not add
inline questions to a body or component.

The co-located schema is:

```json
{
  "title": "Rate Limiting Review",
  "questions": [
    {
      "question": "Which algorithm allows short bursts above the average rate?",
      "options": [
        "Fixed window counter",
        "Token bucket",
        "Leaky bucket",
        "Sliding window log"
      ],
      "correctAnswer": 1,
      "explanation": "Token bucket accumulates tokens up to a cap, so an idle client can briefly burst above the steady rate."
    }
  ]
}
```

**Quiz rules:**

- `correctAnswer` is a **zero-based index** into `options`.
- Always include a helpful `explanation` — it teaches even when the learner guessed.
- Use a descriptive kebab-case filename rather than `questions.json`.
- Reference it with `questionsFile="/api/content/<section>/<slug>/quiz/<file>.json"`.
- Run `pnpm validate:content` after editing it.

### 6. Validate + lint

```bash
node scripts/validate-content-registry.cjs   # registry gate
pnpm lint                                     # code/style checks
```

### 7. Open a pull request

```bash
git add -A
git commit -m "feat: add rate limiting lesson"
git push origin content/my-new-lesson
```

Open the PR on GitHub and fill in the
[PR template](../.github/PULL_REQUEST_TEMPLATE.md). CI will validate the content registry,
lint, and build. Once green, a maintainer reviews and merges. 🎉

---

## The golden rule: explain before you dive deep

> **Every concept opens with a plain-language "What is [Concept]?" intro that a beginner can
> grasp in 15–30 seconds — _then_ progressive disclosure into trade-offs.**

This is the heart of SystemDesigner's editorial voice. Never start a section with
trade-offs, comparisons, or implementation details before the reader knows what the thing
even is. (The classic anti-pattern: opening with "CAP Theorem Trade-offs" before ever
saying what CAP theorem is.)

Use the intro section-card at the top of any new concept:

```md
{% section-card tone="intro" %}
## What is [Concept]?

Clear, concise, jargon-free explanation of the fundamental idea before any detail,
comparison, or trade-off.
{% /section-card %}
```

The order is always: **What is it? → Why does it matter? → Core principles → Deep dive.**

---

## Choosing the right section

SystemDesigner has **8 sections** (425 entries total). Put your content where learners
expect to find it:

| Section | Count | What belongs here |
|---|---|---|
| **technology** | 136 | Specific tools & frameworks (databases, caches, queues, search, etc.) |
| **genai** | 76 | Generative AI & LLM systems — RAG, agents, prompting, evals |
| **ml-systems** | 61 | ML engineering & infrastructure — feature stores, training, serving, monitoring |
| **fundamentals** | 50 | Core distributed-systems concepts (load balancing, sharding, CAP, caching) |
| **practice** | 29 | End-to-end design exercises (URL shortener, chat, recommendation, RAG, etc.) |
| **reference** | 27 | Quick reference, cheat sheets, back-of-envelope numbers |
| **tools** | 26 | Interactive calculators & utilities |
| **case-studies** | 20 | Real-world system breakdowns of how companies built things |

**Rules of thumb:**

- A *concept* that applies broadly → **fundamentals**, **genai**, or **ml-systems**.
- A *named product* (PostgreSQL, Kafka, Redis) → **technology** (follow the MySQL template).
- A *"design X" exercise* → **practice** (use the structured interview template).
- A *"how Company built X" story* → **case-studies**.

---

## Improving an existing lesson

Most contributions improve what's already there. Here's exactly where each kind of fix goes.

| You want to… | Edit this | How |
|---|---|---|
| Fix a typo / factual error in prose | `content/entries/<section>/<slug>/index.mdoc` | Use **"Edit this page on GitHub"** (zero setup) |
| Clarify a confusing explanation | `content/entries/<section>/<slug>/index.mdoc` | Add or expand the intro `section-card`; apply the golden rule |
| Add a real-world example or analogy | `content/entries/<section>/<slug>/index.mdoc` | Add a `section-card`; banking/social/e-commerce analogies preferred |
| Add or fix a code example | `content/entries/<section>/<slug>/code/*` | Add a file under `code/`, reference it via `code-block file=…` |
| Fix a wrong quiz answer / explanation | `content/entries/<section>/<slug>/quiz/*.json` or the existing bank entry | Correct `correctAnswer` (zero-based) or `explanation` |
| Improve a quiz question | The quiz JSON referenced by the lesson's `quiz` tag | Edit `question`/`options`; keep one clearly-correct answer |
| Add a diagram | `content/entries/<section>/<slug>/index.mdoc` | Use an approved content tag or a focused interactive block; keep it dark-mode friendly |
| Suggest something you can't write yet | — | Click **"Suggest an improvement"** to open the Content improvement issue |

For small text or quiz-JSON edits, you don't need a local clone at all — use the in-app
**"Edit this page on GitHub"** button or edit the file directly in GitHub's web UI and open
a PR. For anything involving the registry or new files, clone and run locally (path B above).

---

## Validation & quality checklist

Run through this before you open a PR. It's exactly what reviewers (and CI) look for.

- [ ] **Registry passes** — `node scripts/validate-content-registry.cjs` is clean
- [ ] **Registry entry exists first**, uses `renderMode: 'mdoc'`, and its `path` matches the entry directory
- [ ] **Canonical body** — content lives at `content/entries/<section>/<slug>/index.mdoc`; no concrete content `page.tsx` exists
- [ ] **Beginner context** — every concept opens with a "What is [Concept]?" intro card
- [ ] **Markdoc syntax** — literal source syntax appears in inline code or fenced code blocks
- [ ] **Quiz wiring** — `quiz` loads co-located JSON through `questionsFile` (or an existing bank entry through `quizId`); questions are never inline
- [ ] **External code files** — examples live in `code/` and load via `code-block file=…`
- [ ] **Focused islands** — interactive blocks contain only user-controlled behavior, never the whole lesson
- [ ] **SEO description** ≤ 160 characters; tags present
- [ ] **Required gates pass** — `pnpm audit:content`, `pnpm validate:registry --strict`, `pnpm validate:content`, `pnpm typecheck`, and `pnpm build`

---

## Style guide

**Voice.** Warm, encouraging, and concrete. Write to a smart reader who is new to *this*
topic. Prefer "you" and active voice ("You can scale this by…") over passive, academic
phrasing. Short sentences win.

**Analogies.** Anchor abstract ideas in familiar, real-world domains — **banking**
(transactions, consistency), **social media** (feeds, fan-out), and **e-commerce**
(carts, inventory, checkout) are the go-to examples used across the site. A good analogy
is worth a paragraph of definitions.

**Accuracy.** Don't invent numbers, benchmarks, or quotes. If you're estimating, say so and
show your back-of-envelope math. When you cite a real system's behavior, make sure it's
current. When in doubt, keep it general rather than wrong.

**Citing sources.** When you reference a paper, engineering blog, or docs, link to the
primary source. This builds trust and helps learners go deeper.

**Progressive disclosure.** Simple explanation first → technical detail second →
implementation/trade-offs last. (See "the golden rule" above.)

**Dark mode.** Every UI element you add must look right in dark mode — use the
`dark:` Tailwind variants shown in the templates. Avoid native `<select>`, `confirm()`,
`alert()`, and `prompt()`.

---

## Where to go next

- **[CONTRIBUTING.md](../CONTRIBUTING.md)** — overall contribution workflow & PR process
- **[docs/DEVELOPMENT.md](./DEVELOPMENT.md)** — local setup, env vars, scripts
- **[docs/ARCHITECTURE.md](./ARCHITECTURE.md)** — how the app is wired together
- **[AGENTS.md](../AGENTS.md)** — the exhaustive authoring standards
  (templates, component rules, edge cases)
- **GitHub Issues** — filter by **`good first issue`** for a friendly starting point
- **GitHub Discussions** — ask questions, float ideas, get unstuck
- **Community mailing list** — [system-designer@googlegroups.com](mailto:system-designer@googlegroups.com)
- **Maintainer** — [alibadereddin@gmail.com](mailto:alibadereddin@gmail.com)

---

## Licensing of your contribution

SystemDesigner is dual-licensed:

- **Code** is **MIT** — see [LICENSE](../LICENSE).
- **Content** (lessons, quizzes, written docs, illustrations) is
  **Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)** —
  see [LICENSE-CONTENT](../LICENSE-CONTENT). Reuse is welcome; attribute
  **"SystemDesigner (systemdesigner.net)"** and link back.

By opening a pull request, you agree to license your contribution under these terms.

Thank you for helping make system design education free and excellent for everyone. 💙
