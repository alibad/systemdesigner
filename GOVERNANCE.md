# Project Governance

This document explains how SystemDesigner is run: who decides what, how
contributions are reviewed, and how you can take on more responsibility over
time. The goal is to be transparent and welcoming so that contributing feels
worthwhile and predictable.

## Roles

### Contributors
Anyone who opens an issue, improves a lesson, fixes a bug, reviews a PR, or helps
someone in [Discussions](https://github.com/alibad/systemdesigner/discussions) is
a contributor. No permission or commitment is required to start — see
[CONTRIBUTING.md](./CONTRIBUTING.md).

### Maintainers
Maintainers review and merge pull requests, triage issues, shepherd releases, and
safeguard the project's direction and quality bar. The current lead maintainer is
**[@alibad](https://github.com/alibad)**.

Maintainers are responsible for:

- Keeping the content accurate and aligned with the editorial standard
  (["explain before you dive deep"](./docs/CONTENT_GUIDE.md))
- Upholding the [Code of Conduct](./CODE_OF_CONDUCT.md)
- Reviewing PRs fairly and within a reasonable time
- Protecting the single source of truth (`lib/content-registry.ts`,
  `lib/quiz-bank/`) — see [.github/CODEOWNERS](./.github/CODEOWNERS)

## How decisions are made

We aim for **lazy consensus**: most changes don't need a formal vote. If a PR or
proposal sits without objection, it can move forward.

- **Small/uncontroversial changes** (content fixes, typos, new lessons that fit
  existing sections, bug fixes): one maintainer review and a green CI run is
  enough to merge.
- **Larger changes** (new sections, architectural shifts, dependency or licensing
  changes, anything that affects many pages): open a
  [Discussion](https://github.com/alibad/systemdesigner/discussions) or an issue
  first so the approach can be agreed before code is written. The lead maintainer
  makes the final call when consensus isn't reached.

## Content review standard

Because this is an educational project, content is held to a specific bar. A
content PR is merged when it:

1. Passes CI (`node scripts/validate-content-registry.cjs` + lint + build).
2. Opens with a beginner-friendly *"What is [Concept]?"* introduction before any
   trade-offs (the golden rule in [CONTENT_GUIDE.md](./docs/CONTENT_GUIDE.md)).
3. Is technically accurate, ideally with a cited source for non-obvious claims.
4. Follows the layout/component conventions in [AGENTS.md](./AGENTS.md) and
   [CONTENT_GUIDE.md](./docs/CONTENT_GUIDE.md).

## Becoming a maintainer

There's a clear path:

1. Make several quality contributions (content or code) over time.
2. Help review others' PRs and answer questions in Discussions.
3. An existing maintainer may then invite you, granting triage and eventually
   merge rights. We'd love to grow the maintainer team — sustained, thoughtful
   participation is all it takes.

## Scope & non-goals

SystemDesigner is a free, open learning platform for system design across classic
distributed systems, GenAI systems, and ML systems. Contributions should serve
that mission. See [ROADMAP.md](./ROADMAP.md) for current priorities and
[CONTRIBUTING.md](./CONTRIBUTING.md) for how to get involved.

## Changing this document

Governance evolves with the community. Propose changes via a PR to this file,
opened for discussion like any larger change.
