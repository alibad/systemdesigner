# Open-Source Readiness Audit

This checklist records the repository areas that should be reviewed before making the project public. It is intentionally separate from the contributor docs: contributor onboarding should stay simple, while this file captures maintainer release hygiene.

## Current Status

- Current-file secret scan: `pnpm scan:secrets`
- Git-history secret scan: `pnpm scan:secrets:history`
- Content registry validation: `pnpm validate:registry`
- Content asset validation: `pnpm validate:content`
- Full local gate: `pnpm check`

## Secrets And Runtime Configuration

- Normal development requires no secrets. The app runs with an inert local Firebase config unless all six core `NEXT_PUBLIC_FIREBASE_*` values are supplied.
- Firebase web keys are public identifiers, not secrets. Production access control must rely on `firestore.rules`, `storage.rules`, and Firebase App Check.
- Server-only credentials must stay out of git: `OPENAI_API_KEY`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_PRIVATE_KEY_PATH` targets, GitHub App ids/install ids when considered private for a deployment, deployment tokens, and local service-account files.
- `.env`, `.env.local`, `secrets/`, build output, root-level `screenshots/`, root-level `archive/`, `todo/`, `docs/knowledge-base/`, and `docs/research/` are ignored for future local artifacts.

## Paths Requiring Maintainer Review Before Public Release

These paths did not scan as secrets, but they may contain internal strategy, planning, research, or licensing-sensitive material. They have been removed from the current public tree or require source review before publication.

| Path | Why review it | Suggested action |
| --- | --- | --- |
| `docs/knowledge-base/**` | Product hypotheses, requirements, customer/market notes, competitor analysis, and planning artifacts. | Removed from the current public tree; keep future source notes outside the repo unless rewritten as contributor-facing docs. |
| `todo/**` | Changelog/planning notes; may expose internal work sequencing or decisions. | Removed from the current public tree; use GitHub issues/projects or release notes for public planning. |
| `docs/research/**` | Research summaries, roadmap notes, and third-party-source derivatives with unclear redistribution/license status. | Removed from the current public tree; keep source notes outside the repo unless rewritten with clear provenance and license compatibility. |
| `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `SUPPORT.md` | Public contact addresses are intentionally visible. | Confirm the maintainer email and community list are the desired public channels. |

## Firebase Rules Review

- Firestore diagram reads no longer allow all unauthenticated reads. Public diagram/page reads are direct `get` operations only; list/query access is owner/admin scoped.
- Storage feedback uploads require Firebase auth and are limited to 15 MB per file. Public reads remain enabled so issue embeds can resolve.
- Before deploying a public fork, enable Firebase App Check on Storage and review Firestore indexes/rules against the features enabled in that fork.

## Release Checklist

Before pushing a public release:

1. Run `pnpm scan:secrets` and `pnpm scan:secrets:history`.
2. Confirm removed internal paths are not reintroduced.
3. If publishing this repository's existing history, rewrite or freshly export history so removed internal paths are not reachable from public commits. See `docs/MAINTAINER_RELEASE.md`.
4. Verify `pnpm check` passes with no local `.env` or `.env.local`.
5. Confirm `LICENSE`, `LICENSE-CONTENT`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`, `SUPPORT.md`, and `GOVERNANCE.md` match the intended public governance model.
6. Verify the public contact channels and issue templates point to the correct GitHub repo and maintainer accounts.
