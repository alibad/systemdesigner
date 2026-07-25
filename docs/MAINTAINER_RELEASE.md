# Maintainer Release Guide

This guide is for maintainers preparing a public release. Contributor setup
lives in `README.md`, `CONTRIBUTING.md`, and `docs/DEVELOPMENT.md`.

## Release Goal

Publish a repository that is useful to contributors and does not expose private
planning notes, local secrets, generated build output, or third-party source
material with unclear redistribution rights.

Normal contributors do not need secrets. The app must keep building and running
with no `.env` or `.env.local`.

## Recommended Path: Fresh Public Export

Use a fresh public export when the private repository history contains files
that should not be public. This creates a clean repository from the current
working tree without carrying old commits forward.

```bash
pnpm create:public-export ../systemdesigner-public
cd ../systemdesigner-public
corepack enable
corepack prepare pnpm@10.4.1 --activate
pnpm install --frozen-lockfile
pnpm check
git init -b main
git add .
git commit -m "chore: initial public release"
```

Then create the public GitHub repository and push that new history.

The export script intentionally skips:

- `.env*` files except `.env.example`
- `secrets/`
- `todo/`
- `docs/knowledge-base/`
- `docs/research/`
- root-level `screenshots/` and `archive/`
- dependency caches, build output, logs, and private key file extensions

## Alternative: Rewrite Existing History

Only rewrite history if every collaborator understands the impact and the
repository has not already been published in places you cannot control.

One possible approach is `git filter-repo`:

```bash
git filter-repo \
  --path docs/knowledge-base \
  --path docs/research \
  --path todo \
  --invert-paths
```

After filtering, rerun:

```bash
pnpm scan:secrets:history
pnpm check
```

Force-push only after confirming protected branches, collaborators, deploy keys,
and automation are ready for rewritten history.

## Pre-Publish Checklist

1. Confirm no local `.env` or `.env.local` is needed to run `pnpm check`.
2. Run `pnpm scan:secrets`.
3. Run `pnpm scan:secrets:history` if publishing this repository's current
   history.
4. Confirm `docs/knowledge-base/`, `docs/research/`, and `todo/` are absent
   from the public tree.
5. Confirm public contact channels in `README.md`, `SECURITY.md`, `SUPPORT.md`,
   issue templates, and `CODEOWNERS`.
6. Confirm `LICENSE`, `LICENSE-CONTENT`, `GOVERNANCE.md`, and
   `CODE_OF_CONDUCT.md` match the intended governance model.
7. Push the release and confirm GitHub Actions pass on the public repository.
