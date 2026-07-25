# Contributing to SystemDesigner

First off — **thank you**. 🎉 SystemDesigner is a free, open platform for learning system design end-to-end: 300+ structured lessons, 413 interactive quizzes, hands-on calculators, a tldraw diagramming sandbox, and learning-path progress tracking. Every fix, lesson, and idea you contribute helps thousands of people learn to design real systems — classic distributed systems, modern GenAI systems, and ML systems engineering.

You don't need to be an expert to help. Fixing a typo, clarifying a confusing paragraph, or adding one good quiz question is genuinely valuable — and a great way to learn the material more deeply yourself.

- 🌐 Live site: <https://systemdesigner.net>
- 💬 Questions & ideas: [GitHub Discussions](https://github.com/alibad/systemdesigner/discussions) or the community mailing list <system-designer@googlegroups.com>
- 📜 Please read our [Code of Conduct](./CODE_OF_CONDUCT.md) before participating.

---

## Ways to contribute

There's a path here for everyone, whatever your background:

| You want to… | Do this | Start with |
| --- | --- | --- |
| ✏️ **Improve a lesson** | Fix errors, clarify wording, add examples or diagrams to existing content | [docs/CONTENT_GUIDE.md](./docs/CONTENT_GUIDE.md) |
| 📚 **Add a lesson** | Propose and write a new lesson, quiz, or calculator | [docs/CONTENT_GUIDE.md](./docs/CONTENT_GUIDE.md) |
| 🐛 **Fix a bug** | Squash something broken in the app | [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) |
| 🛠️ **Build a feature** | Improve the diagramming sandbox, calculators, navigation, accessibility, etc. | [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) + [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) |
| 🧭 **Triage** | Reproduce bugs, label issues, answer questions, review PRs | [Issues](https://github.com/alibad/systemdesigner/issues) |
| 🌍 **Translate** | Help localize content (coordinate first via Discussions) | [Discussions](https://github.com/alibad/systemdesigner/discussions) |

> 💡 Most of the platform is **content**, not code. If your strength is explaining hard concepts clearly, you are exactly who we need — head to the [Content Guide](./docs/CONTENT_GUIDE.md).

---

## Quick links

- 🧱 **Set up your environment** → [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)
- 📝 **Write or edit lessons, quizzes, calculators** → [docs/CONTENT_GUIDE.md](./docs/CONTENT_GUIDE.md)
- 🏛️ **Understand how it all fits together** → [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- 📐 **Authoring standards (authoritative)** → [CLAUDE.md](./CLAUDE.md) and [AGENTS.md](./AGENTS.md)
- 🆘 **Need help?** → [SUPPORT.md](./SUPPORT.md)
- 🔒 **Found a security issue?** → [SECURITY.md](./SECURITY.md) (please don't open a public issue)

---

## Your first contribution

The fastest, friendliest way to start:

1. **Browse [`good first issue`](https://github.com/alibad/systemdesigner/labels/good%20first%20issue) issues.** These are scoped to be approachable and well-described. Comment to claim one so we don't double up.
2. **Or fix something you noticed while learning.** Every lesson page on the live site has two shortcuts built in:
   - **"Edit this page on GitHub"** — deep-links straight to the canonical lesson body, e.g.
     `https://github.com/alibad/systemdesigner/edit/main/content/entries/<section>/<slug>/index.mdoc`.
     Make your edit in GitHub's web UI, and it opens a pull request for you. No local setup needed for small text fixes.
   - **"Suggest an improvement"** — opens a prefilled GitHub issue (the **Content improvement** form) so you can flag a problem even if you'd rather not edit it yourself.
3. **Open a Discussion** if you have a question or a half-formed idea — that's what it's for.

Don't worry about getting everything perfect. Open the PR or issue, and a maintainer will help you get it across the line.

---

## Local setup (the short version)

For anything beyond a one-line text fix, run the app locally. Full details — including the content system, scripts, and troubleshooting — live in [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md).

**Prerequisites:** [Node 20+](https://nodejs.org) and [pnpm 10.4.1](https://pnpm.io).

```bash
# 1. Fork on GitHub, then clone your fork
git clone https://github.com/<your-username>/systemdesigner.git
cd systemdesigner

# 2. Install dependencies
pnpm install

# 3. Start the dev server
pnpm dev
# → http://localhost:3000
```

> ✅ **The app runs locally with no environment variables at all.** Do not set up secrets for normal content, quiz, calculator, UI, or bug-fix work. Env vars are only for specific cloud-backed features: Firebase auth/sync, admin screens on your fork, feedback-to-GitHub, optional AI helpers, or deployment verification. See [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) for the canonical list.

---

## Project conventions

A few light conventions keep the project tidy and reviews fast:

### Branch naming

Work on a branch off `main` (never commit directly to `main`):

```
feat/diagram-export-png
fix/quiz-score-rounding
docs/clarify-cap-theorem
content/add-vector-db-lesson
```

### Conventional Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) for clear history:

```
feat:     a new feature or new content
fix:      a bug fix
docs:     documentation / lesson prose changes
refactor: code change that neither fixes a bug nor adds a feature
chore:    tooling, deps, config
```

Examples:

```
feat: add interactive sharding calculator to fundamentals
fix: escape < and > in load-balancing quiz options
docs: add "What is a Bloom filter?" intro to reference page
```

### Change notes

Use the pull request description as the public change note. Focus on impact, not file lists: describe what changed for learners or contributors, how you tested it, and any follow-up work reviewers should know about.

### Keep PRs focused

One logical change per pull request. A focused PR is easier to review, faster to merge, and easier to revert if something goes wrong. If you find yourself fixing three unrelated things, that's three PRs.

---

## Before you open a PR

Run through this checklist locally — it's the same gate CI enforces, so passing it here means a smooth review:

- [ ] **Run the full local check:** `pnpm check` (secret scan, content validation, tests, lint, build).
- [ ] **Validate the content registry:** `pnpm validate:registry` (this is the content gate — it must pass).
- [ ] **Lint:** `pnpm lint` is clean.
- [ ] **Follow the authoring standards** in [CLAUDE.md](./CLAUDE.md) and [AGENTS.md](./AGENTS.md).
- [ ] **Use canonical content:** the body lives at `content/entries/[section]/[slug]/index.mdoc`, has no concrete content `page.tsx`, and matches the registry path.
- [ ] **Keep interactivity focused:** React islands contain only behavior that cannot be expressed with shared Markdoc tags.
- [ ] **For new quizzes:** regenerate the bank with `node scripts/generate-quiz-bank.cjs` and reference it with the `quiz` tag.
- [ ] **Write a clear PR summary** that explains user/contributor impact and testing.
- [ ] **Link the issue** your PR addresses (e.g. `Closes #123`).

> Tip: the content registry validation catches duplicate IDs/paths, broken prerequisite/related references, over-long SEO descriptions, and missing tags — run it early and often while authoring.

---

## Pull request process

1. **Open your PR against `main`** and fill out the [PR template](./.github/PULL_REQUEST_TEMPLATE.md) — describe the change, the motivation, and how you tested it.
2. **CI runs automatically.** It must pass: **secret scan + content validation + tests + lint + build**. If a check is red, open the logs, fix it, and push again.
3. **One maintainer review.** A maintainer will review for accuracy, clarity, and adherence to the standards. We aim to be quick, kind, and specific — expect questions and small suggestions, not gatekeeping.
4. **Iterate and merge.** Address feedback by pushing more commits to the same branch. Once it's green and approved, a maintainer merges it. 🚀

If your PR sits without a response, a gentle nudge on the PR or in [Discussions](https://github.com/alibad/systemdesigner/discussions) is always welcome.

---

## Code standards

The **authoritative** standards live in two files in the repo root — read them before writing code or content:

- 📐 [CLAUDE.md](./CLAUDE.md) — UI standards, content system, page templates, layout rules, quiz bank, calculators.
- 📐 [AGENTS.md](./AGENTS.md) — companion authoring and automation standards.

The top rules to internalize:

1. **"Explain before you dive deep."** Every concept opens with a plain-language **"What is [Concept]?"** intro a beginner can grasp in 15–30 seconds, then uses progressive disclosure into trade-offs and details. Never start with a comparison table the reader has no context for.
2. **The content registry is the single source of truth.** Add new content to [`lib/content-registry.ts`](./lib/content-registry.ts) first; pages must match the registered `path`. Quizzes are centralized in [`lib/quiz-bank/all-quizzes.json`](./lib/quiz-bank/all-quizzes.json) and referenced by `quizId`.
3. **Use the shared components.** `CodeBlock` from `@/components/shared/CodeBlock` (named import, `file=` prop), `InteractiveQuiz` from `@/components/fundamentals/InteractiveLearning` (`quizId` prop), `LessonHeader` from `@/components/fundamentals/LessonHeader`, and calculators in `components/calculators/`.
4. **Use shadcn/ui components, never native browser primitives.** No `confirm()`, `alert()`, `prompt()`, or native `<select>` — they break dark mode. Use Dialog / Select / Toast instead.
5. **Escape `<` and `>` in JSX text** (`&lt;` / `&gt;`), and always use the standard wide layout `max-w-[1200px] mx-auto px-4 md:px-6 py-8`.
6. **Never commit secrets.** Keep `.env.local`, GitHub App private keys, OpenAI keys, and Firebase service-account files out of git. Run `pnpm scan:secrets` before opening a PR if you touched config or docs with examples.

When in doubt, copy the structure of an existing, well-built page in the same section.

---

## Code of Conduct

Participation in this project is governed by our [Code of Conduct](./CODE_OF_CONDUCT.md). In short: be kind, be patient, assume good intent, and help newcomers. Harassment of any kind is not tolerated. Report concerns to <alibadereddin@gmail.com>.

---

## License of contributions

SystemDesigner is **dual-licensed**, so it's important to know which license your contribution falls under:

- 💻 **Code** (components, scripts, app logic) is licensed under the **MIT License** — see [LICENSE](./LICENSE).
- 📖 **Content** (lessons, quizzes, written docs, illustrations) is licensed under **Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)** — see [LICENSE-CONTENT](./LICENSE-CONTENT). When reusing content, attribute **"SystemDesigner (systemdesigner.net)"** and link back.

By submitting a contribution, you agree to license your code under MIT and your content under CC BY-SA 4.0, and you confirm you have the right to do so.

---

Thank you for helping make system design education free and excellent for everyone. We can't wait to see what you build. 💙

— The SystemDesigner maintainers
