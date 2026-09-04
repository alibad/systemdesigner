# Agents Content Development Guidelines

## Continuing the Daily Learning Experience
- When continuing the gamified system-design or coding experience, read `ROADMAP.md`, `docs/CONTINUE_DEVELOPMENT.md`, and `docs/daily-learning-path.md` before changing its architecture or curriculum.
- `/learn` has four courses, 43 units, 264 sessions, and 227 explicit skills. Placement and adaptive review span every course; a 30-study-day guided journey connects design and coding with four review days and a final build. All 202 lesson sessions have mixed practice: 23 hand-authored packs and 179 packs derived from existing lesson content, totaling 785 groups and 2,009 variants. Use the shared exercise schema; authored packs override generated practice through the course outline. Version 5 progress restores interrupted attempts and retains bounded coding draft history. Keep learning and progression primary; account sync and backups belong in settings.
- Author course organization in `content/learning/course-outline.json`, preserve existing step IDs, and run `pnpm generate:learning` after changing course sources or assessments. `pnpm validate:learning` checks generated catalog/session/checkpoint drift.
- Keep `ROADMAP.md` and the handoff current when milestones change. The app's `/roadmap` page renders the root roadmap directly.

## Git Delivery Workflow
- `main` is the official and default development branch for this repository.
- Work directly on `main` unless the user explicitly requests a separate branch.
- Do not create or switch to `codex/*` or other feature branches by default.
- When the user explicitly requests a production push, validate the changes, commit them on `main`, and push `origin/main`.

## Core Learning Principles
- Always introduce every technical concept with clear context before any deep dive: explain what it is, why it matters, core principles, then details.
- Never assume prior knowledge. Even familiar topics must begin with a "What is [Concept]?" intro card and a plain-language summary that a beginner can follow in 15–30 seconds.
- Use progressive disclosure: simple explanation → detailed mechanics → implementation examples.
- Link readers to prerequisite lessons when extra foundations are needed.

## Required Authoring Flow
1. Add the new entry to `lib/content-registry.ts` with full metadata (prerequisites, related items, `nextInSequence`, SEO data) and `renderMode: 'mdoc'`.
2. Run `node scripts/validate-content-registry.cjs --strict` and fix any errors before creating the body.
3. Create the body at `content/entries/[section]/[lesson-slug]/index.mdoc`. Never create a concrete content `page.tsx`; the section's `[slug]` route renders registry content.
4. Co-locate supporting assets:
   - `content/entries/[section]/[lesson-slug]/code/` for code examples.
   - `content/entries/[section]/[lesson-slug]/quiz/` for quiz JSON files.
   - `content/entries/[section]/[lesson-slug]/data/` for other structured content data.
5. Reference assets via `/api/content/[section]/[lesson-slug]/code|quiz|data/...` from Markdoc tags.
6. Keep reusable calculators in `components/calculators/`. Put route-specific interactive islands in `components/content-blocks/entries/`, render them with `interactive-block`, and run `pnpm generate:content-blocks`.

## Layout & Component Standards
- `GeneralizedContentPage` owns the header, container, completion controls, navigation, and section-specific shell. Do not reproduce that chrome in content bodies.
- Use `section-card` for lesson sections and `section-card tone="intro"` for the required opening definition.
- Technology entries follow the MySQL template: "What is..." intro first, then calculator where applicable, real-world examples, best practices, code, and quiz.
- Practice problems and case studies use the shared Markdoc accordion and the generalized practice/case-study shells.
- Use canonical Markdoc tags (`code-block`, `quiz`, `callout`, `tabs`, `accordion`, and `interactive-block`); do not create custom quiz components or page-sized interactive islands.

## Practice Problem Templates
- **System Design Practice** pages ship with an accordion flow that covers eight sections in order: clarifying requirements (functional, non-functional, scope), scale and constraints calculations, high-level architecture, data model and storage, deep dives on critical components, scalability and reliability plans, trade-offs and alternatives, wrap-up with risks and extensions.
- **ML Systems Practice** pages reuse the same accordion pattern but adapt the eight sections to ML specifics: clarify the ML problem and business context, back-of-envelope data/compute estimates, formal ML framing, end-to-end architecture (data, training, serving), deep dive on model/feature work, evaluation and QA strategy, operations and retraining plan, trade-offs and future improvements.
- **GenAI Systems Practice** pages follow the GenAI template: clarify use case and guardrails, token budget and throughput math, high-level architecture and model tiering, deep dive into RAG/prompting/safety subsystems, evaluation and safety metrics, cost-control and governance, scaling and reliability, wrap-up and forward-looking extensions.
- Set the first accordion item id to `clarifying` and use `defaultOpen="clarifying"` on the shared accordion. Preserve the author-checklist intent in the actual section content. Do not add HTML comments to Markdoc bodies because the renderer can expose them as visible lesson text.

## External File & API Requirements
- `code-block` must load code via its `file` attribute; never inline large source files.
- Use descriptive kebab-case filenames for code and quiz files; include real extensions (`.py`, `.ts`, `.yaml`, `.json`, etc.).
- Ensure TypeScript exclusion patterns are respected by keeping examples inside the `code/` folder.
- Quiz data lives in JSON files or the canonical quiz bank and is loaded by the `quiz` tag. Never inline quiz questions in a body or component.

## Content Quality Checklist
- Every section starts with an explicit definition and beginner-friendly context.
- The generalized renderer owns layout; bodies contain instructional content only.
- Markdoc parses cleanly; literal source syntax belongs in inline code or fenced code blocks.
- Code examples live in external files and use the `code-block` tag.
- Calculators come from `components/calculators/` and are reused, not duplicated.
- Registry validation passes and navigation relationships (`prerequisites`, `related`, `nextInSequence`) are accurate.
- Quizzes load from JSON files or the quiz bank, and `pnpm audit:content`, `pnpm validate:registry --strict`, `pnpm validate:content`, `pnpm typecheck`, and `pnpm build` stay green.
