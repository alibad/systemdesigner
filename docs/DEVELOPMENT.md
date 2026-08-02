# Development & Deployment Guide

Welcome! This guide gets **SystemDesigner** running on your machine in about a minute, then walks you through the optional pieces (Firebase, the in-app feedback widget, deployment) at your own pace.

The best part: **the app runs with zero configuration**. No accounts, no API keys, no secrets. You clone, install, and start learning (or building). Everything below the "Run in 60 seconds" section is *optional* and only matters when you want sign-in, cross-device sync, or your own deployment.

> New to the project? Skim [README.md](../README.md) for the big picture, then come back here. Want to write a lesson? Head to [docs/CONTENT_GUIDE.md](./CONTENT_GUIDE.md). Curious how it all fits together? See [docs/ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | 20 or newer | [Download](https://nodejs.org). Check with `node -v`. |
| **pnpm** | 10.4.1 (pinned) | The only supported package manager. Easiest install is via Corepack (below). |
| **git** | any recent | To clone the repo and open PRs. |

### Installing pnpm with Corepack

Corepack ships with Node 20+ and installs the exact pnpm version the repo expects — no global install needed:

```bash
corepack enable
corepack prepare pnpm@10.4.1 --activate
pnpm -v   # should print 10.4.1
```

> Prefer not to use Corepack? `npm install -g pnpm@10.4.1` works too. Just avoid `npm`/`yarn` for installing dependencies — the lockfile is pnpm's.

---

## Run in 60 seconds

```bash
git clone https://github.com/alibad/systemdesigner.git
cd systemdesigner
pnpm install
pnpm dev
```

Open **http://localhost:3000** — that's it. 🎉

You're now running the full platform: 425 content entries, interactive quizzes across the curriculum, calculators, and the tldraw diagramming sandbox.

### Windows and PowerShell

Run the same setup from PowerShell:

```powershell
git clone https://github.com/alibad/systemdesigner.git
Set-Location systemdesigner
corepack enable
corepack prepare pnpm@10.4.1 --activate
pnpm install
pnpm dev
```

Normal development still needs no environment file. If you are working on an optional cloud-backed feature, create the ignored local file with:

```powershell
Copy-Item .env.example .env.local
```

If PowerShell reports that `corepack` is not recognized, install the current Corepack shim with `npm install --global corepack@latest`, open a new terminal, and rerun `corepack enable`. If it blocks `pnpm.ps1` because script execution is disabled, use `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` for that terminal session, or follow your organization's managed PowerShell policy. These steps still install project dependencies only with pnpm.

### What works with no env vars?

**Everything you need to learn and contribute content.** The app runs fully in **local anonymous mode** unless you explicitly configure Firebase:

- ✅ All lessons, references, quizzes, and calculators
- ✅ The tldraw diagramming sandbox (diagrams kept in the browser)
- ✅ Learning-path progress — **stored locally** in your browser
- Sign-in, cross-device progress sync, feedback media uploads, and saved-to-cloud diagrams are **disabled** until you configure Firebase (see below). The UI gracefully hides, skips, or reports those cloud-only features rather than touching a shared backend.

So if you're here to fix a typo, write a lesson, or add a quiz, you can stop reading after this section. Firebase and the rest are only for people running their own deployment or working on auth/sync/upload features.

---

## Available scripts

Run these from the repo root.

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Start the Next.js dev server with hot reload at http://localhost:3000. |
| `pnpm build` | Production build. CI runs this; run it before a PR if you touched app code. |
| `pnpm start` | Serve the production build (run `pnpm build` first). |
| `pnpm lint` | Run ESLint across the project. |
| `pnpm test` | Run the unit test suite with Vitest. |
| `pnpm audit:content` | Enforce canonical bodies, shared dynamic routes, and zero concrete content pages. |
| `pnpm validate:registry` | **The content gate.** Validates `lib/content-registry.ts`: no duplicate ids/paths, valid prerequisites & related links, SEO descriptions ≤ 160 chars, and more. **CI runs this — your PR must pass it.** |
| `pnpm validate:content` | Validate quiz JSON, challenge rubrics, and lesson references. |
| `pnpm scan:secrets` | Scan tracked text files for common private key and token formats before a PR. |
| `pnpm scan:secrets:history` | Scan all commits reachable from local git refs for common private key and token formats before publishing the repo. |
| `pnpm check` | Run the full local pre-PR gate: secret scan, strict content audit, registry/content validation, typecheck, tests, lint, and production build. |
| `node scripts/generate-quiz-bank.cjs` | Regenerate the centralized quiz bank at `lib/quiz-bank/all-quizzes.json`. |

> Tip: after any change to `lib/content-registry.ts`, run `pnpm validate:registry` before committing. It's fast and catches the most common contribution mistakes.

---

## Environment variables

You only need these for **specific cloud-backed features or your own deployment** — normal local development needs none.

Most contributors should skip this section. You do **not** need secrets to run the app, edit lessons, add quizzes, build calculators, run tests, or open a PR.

| Working on... | Env setup needed? |
|---------------|-------------------|
| Lessons, quizzes, calculators, docs, UI fixes | No |
| Auth, cross-device progress, saved diagrams | Firebase web config (`NEXT_PUBLIC_FIREBASE_*`) |
| Admin analytics on your fork | `NEXT_PUBLIC_ADMIN_EMAILS` + Firebase web config |
| Admin content editing (local) | Admin setup above; saves to the working tree |
| Admin content editing (Vercel) | Admin setup + GitHub App credentials |
| Feedback widget creating GitHub issues | GitHub App credentials |
| Optional reader AI / maintainer content tooling | `OPENAI_API_KEY` |
| Production SEO verification | `GOOGLE_SITE_VERIFICATION` |

When you do need env vars, copy the template and fill in only the feature you are working on:

```bash
cp .env.example .env.local
```

`.env.local` is gitignored. Fill in only the variables for the features you want. A quick mental model:

- **Public (`NEXT_PUBLIC_*`)** — bundled into the browser build, safe to expose. Firebase web keys are *designed* to be public; your data is protected by Firestore security rules, not by hiding the key.
- **Server-only** — never prefix these with `NEXT_PUBLIC_`. They stay on the server and must never reach the client.

Before opening a PR, run `pnpm scan:secrets`. It intentionally scans only tracked text files; local files such as `.env.local` and `secrets/` stay ignored and should never be committed.

### Public variables (`NEXT_PUBLIC_*`)

| Variable | Required? | What it does | Example |
|----------|-----------|--------------|---------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Optional* | Firebase web API key. | `AIzaSy...` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Optional* | Firebase Auth domain. | `your-app.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Optional* | Firebase project id. | `your-app` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Optional* | Cloud Storage bucket (saved diagrams, uploads). | `your-app.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Optional* | Firebase messaging sender id. | `1234567890` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Optional* | Firebase app id. | `1:1234567890:web:abc123` |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Optional | Google Analytics measurement id. | `G-XXXXXXXXXX` |
| `NEXT_PUBLIC_ADMIN_EMAILS` | Optional | Comma-separated admin emails (unlocks maintainer/admin UI). | `you@example.com,teammate@example.com` |
| `NEXT_PUBLIC_GITHUB_REPO` | Optional | Repo used by "Edit this page" / "Suggest an improvement" links. | `alibad/systemdesigner` |
| `NEXT_PUBLIC_GITHUB_BRANCH` | Optional | Branch those edit links target. Defaults to `main`. | `main` |
| `NEXT_PUBLIC_APP_URL` | Optional | Canonical site URL (used in SEO/metadata). | `https://systemdesigner.net` |

\* The six core `NEXT_PUBLIC_FIREBASE_*` keys are **all required together** *only if* you want sign-in and cloud sync. Leave them all empty to run in anonymous mode.

When those six keys are absent, `lib/site-config.ts` uses an inert local Firebase config and `lib/firebase.ts` returns a local anonymous stub for auth helpers. That keeps local development away from the production Firebase project by default.

### Server-only variables (never `NEXT_PUBLIC`)

| Variable | Required? | What it does | Example |
|----------|-----------|--------------|---------|
| `GITHUB_REPO_OWNER` | Optional | Owner of the repo where the feedback widget opens issues. Defaults to `alibad`. | `your-username` |
| `GITHUB_REPO_NAME` | Optional | Repo name for those issues. Defaults to `systemdesigner`. | `systemdesigner` |
| `GITHUB_APP_ID` | Optional | GitHub App ID — lets the in-app feedback form open issues automatically (see below). | `123456` |
| `GITHUB_APP_INSTALLATION_ID` | Optional | Installation ID of that App on your repo. | `987654` |
| `GITHUB_APP_PRIVATE_KEY` | Optional | The App's private key — a raw PEM **or** base64-encoded PEM (good for hosting env vars). | `-----BEGIN...` |
| `GITHUB_APP_PRIVATE_KEY_PATH` | Optional | Alternative to the above for local dev: a path to the `.pem` file. | `./secrets/app.pem` |
| `ADMIN_CONTENT_PERSISTENCE` | Optional | Force admin saves to `filesystem` or `github`; defaults to GitHub on Vercel and filesystem elsewhere. | `github` |
| `GITHUB_CMS_DRAFT_BRANCH` | Optional | Dedicated branch for Content Studio drafts; must differ from the public content branch. | `cms-drafts` |
| `OPENAI_API_KEY` | Optional | Reader-facing AI and maintainer content-generation tooling. **Never required to run the app.** | `sk-...` |
| `OPENAI_MODEL` | Optional | Model id for that tooling. | `gpt-5.5` |
| `OPENAI_CHAT_MODEL` | Optional | Model id for the reader-facing "Ask AI" chat. Defaults to `gpt-4o-mini`. | `gpt-4o-mini` |
| `GOOGLE_SITE_VERIFICATION` | Optional | Google Search Console verification token (SEO). | `abc123...` |

> **Bottom line:** every variable above is optional. The app runs locally with **none** of them set.

---

## Setting up your own Firebase (optional)

Want sign-in, cross-device progress sync, and cloud-saved diagrams in your fork? Stand up a free Firebase project:

1. **Create a project** at the [Firebase Console](https://console.firebase.google.com) → *Add project*.
2. **Enable Authentication** → *Sign-in method* → turn on **Google** and **Email/Password**.
3. **Enable Firestore Database** (start in production mode — you'll deploy the bundled rules in step 6).
4. **Enable Storage** (for saved diagrams and feedback attachments).
5. **Register a Web app** (the `</>` icon in *Project settings*) and copy its config into your `.env.local`:

   ```bash
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-app
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```

6. **Set yourself as admin** so you can reach the maintainer UI:

   ```bash
   NEXT_PUBLIC_ADMIN_EMAILS=you@example.com
   ```

7. **Deploy the security rules and indexes.** The repo ships with `firestore.rules`, `firestore.indexes.json`, and `storage.rules` **at the repo root**. After installing the [Firebase CLI](https://firebase.google.com/docs/cli) (`npm i -g firebase-tools`) and running `firebase login`, deploy them:

   ```bash
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```

> ⚠️ **Don't skip step 7.** Undeployed rules and indexes cause silent permission errors and queries that never return — easily an hour of confused debugging. Whenever you change `firestore.rules`, `firestore.indexes.json`, or `storage.rules`, redeploy immediately.

Restart `pnpm dev` after editing `.env.local` so Next.js picks up the new variables.

---

## Enabling feedback and production content editing (optional)

Every lesson has an in-app feedback widget, and the admin area includes a Markdoc editor. Configure a **GitHub App** when you want feedback to open issues or Vercel-hosted admin edits to create durable repository commits (the App only has access to the repo where you install it, and tokens are short-lived and auto-rotated):

1. Create a GitHub App at *Settings → Developer settings → GitHub Apps → New GitHub App*.
   - **Repository permissions → Issues: Read and write** for feedback.
   - **Repository permissions → Contents: Read and write** for admin content saves.
   - Generate and download a **private key** (`.pem`).
2. **Install** the App on your fork (*Install App* → choose your repo). Note the **Installation ID** (it's in the install URL: `…/installations/<id>`).
3. Add these server-only variables to your deployment (or `.env.local`):

   ```bash
   GITHUB_APP_ID=123456
   GITHUB_APP_INSTALLATION_ID=987654
   GITHUB_APP_PRIVATE_KEY_PATH=./secrets/app.pem   # local dev
   # …or, for hosting platforms, paste the key directly (raw PEM or base64):
   # GITHUB_APP_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...
   GITHUB_REPO_OWNER=your-username
   GITHUB_REPO_NAME=systemdesigner
   GITHUB_CMS_DRAFT_BRANCH=cms-drafts              # optional; this is the default
   ```

If the App isn't configured, nothing breaks for readers: the feedback widget links to the repository's GitHub issue form instead of pretending an in-app submission succeeded. Content Studio writes drafts and published content to the local working tree in local/self-hosted development. Local draft state and publish snapshots live under the ignored `.content-cms/` directory. Vercel content editing requires the App because its runtime filesystem is not durable. Keep the private key **server-side only**; never prefix it with `NEXT_PUBLIC_`, and never commit the `.pem`.

Content Studio is available at `/admin/content/editor`. It provides durable autosaved drafts, structured block and source editing, rendered preview, explicit publishing, conflict recovery, and revision restore. With GitHub persistence, drafts are isolated on `GITHUB_CMS_DRAFT_BRANCH` (default `cms-drafts`) and publishing writes validated Markdoc to `NEXT_PUBLIC_GITHUB_BRANCH` (default `main`). Every request presents the signed-in user's Firebase ID token to the server. The server resolves the Firebase account, requires a verified email in `NEXT_PUBLIC_ADMIN_EMAILS`, validates Markdoc, and refuses a publish if the public lesson changed after the draft was based on it.

> Note that the public "Edit this page on GitHub" and "Suggest an improvement" links need **no** credentials at all — they just deep-link to GitHub's editor and prefilled issue forms. Those work on any fork out of the box.

---

## Deploying

### Vercel (recommended)

SystemDesigner is a standard Next.js 14 App Router app, so Vercel is the smoothest path:

1. Push your fork to GitHub and **import the repo** in the [Vercel dashboard](https://vercel.com/new). Vercel auto-detects Next.js — no build config needed (`pnpm build` runs automatically).
2. In **Project Settings → Environment Variables**, add the variables you need from the [tables above](#environment-variables). For a full-featured deploy that's the six `NEXT_PUBLIC_FIREBASE_*` keys, `NEXT_PUBLIC_ADMIN_EMAILS`, `NEXT_PUBLIC_APP_URL`, and optionally the GitHub App variables (`GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`).
3. Deploy. Set `NEXT_PUBLIC_APP_URL` to your production URL so SEO metadata and canonical links resolve correctly.
4. If you enabled auth, add your Vercel domain to **Firebase Console → Authentication → Settings → Authorized domains**.

> You can also deploy with **no env vars at all** — you'll get a fully working anonymous-mode site (no sign-in, local-only progress). Great for a quick public mirror.

### Firebase Hosting (alternative)

If you'd rather keep everything in Firebase, you can deploy the Next.js app to **Firebase Hosting** with the Firebase CLI (`firebase init hosting`, then `firebase deploy`). Remember to deploy your Firestore/Storage rules alongside it:

```bash
firebase deploy --only hosting,firestore:rules,firestore:indexes,storage
```

---

## Troubleshooting

**`pnpm: command not found` or wrong version**
Run `corepack enable && corepack prepare pnpm@10.4.1 --activate`. Confirm with `pnpm -v` (expect `10.4.1`).

**Install fails or behaves oddly**
Check your Node version with `node -v` — you need **20+**. Then try a clean install:
```bash
rm -rf node_modules
pnpm install
```

**Firebase "Missing or insufficient permissions" / queries hang**
You almost certainly haven't deployed your rules and indexes. Run:
```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```
A composite-index error usually links straight to the Console where you can create the index, or add it to `firestore.indexes.json` and redeploy. **Undeployed infrastructure is broken infrastructure.**

**Auth works locally but not on my deployed site**
Add your production domain to **Firebase Console → Authentication → Settings → Authorized domains**.

**Changed `.env.local` but nothing updated**
Environment variables are read at startup. Stop and restart `pnpm dev`.

**`node scripts/validate-content-registry.cjs` fails**
Read the error — it pinpoints the offending entry: duplicate `id`/`path`, a `prerequisites`/`related` id that doesn't exist, or an SEO `metaDescription` over 160 characters. Fix it in `lib/content-registry.ts` and re-run. See [docs/CONTENT_GUIDE.md](./CONTENT_GUIDE.md) for the full schema.

**`pnpm scan:secrets` fails**
Treat the finding as sensitive until proven otherwise. Move real tokens to `.env.local` or your hosting provider's secret manager, rotate anything that was committed, then rerun the scan. Firebase web API keys with a `NEXT_PUBLIC_` prefix are public identifiers, but server tokens such as `OPENAI_API_KEY` and GitHub App private keys must never be committed.

**Editor shows phantom TypeScript errors after editing many files**
Restart the TS server in VS Code: open the Command Palette and run **"TypeScript: Restart TS Server"**.

**Still stuck?**
Open a question in [GitHub Discussions](https://github.com/alibad/systemdesigner/discussions), check [SUPPORT.md](../SUPPORT.md), or email the maintainer at alibadereddin@gmail.com. You can also join the community list: system-designer@googlegroups.com.

---

## Next steps

- 📝 **Write or fix content** → [docs/CONTENT_GUIDE.md](./CONTENT_GUIDE.md)
- 🏗️ **Understand the codebase** → [docs/ARCHITECTURE.md](./ARCHITECTURE.md)
- 🤝 **Make your first contribution** → [CONTRIBUTING.md](../CONTRIBUTING.md)

Happy hacking — and thank you for helping make system design education free and open for everyone. 💙
