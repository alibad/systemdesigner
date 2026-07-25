# Security Policy

Thank you for helping keep SystemDesigner and its users safe.

## Reporting a Vulnerability

**Please do not open a public issue for security vulnerabilities.**

Instead, report it privately through either channel:

- **GitHub Security Advisories** — go to the
  [Security tab](https://github.com/alibad/systemdesigner/security/advisories/new)
  and click **"Report a vulnerability"** (preferred — keeps the report private and tracked).
- **Email** — write to **alibadereddin@gmail.com** with the subject line
  `SECURITY: <short summary>`.

### What to include

To help us triage quickly, please include:

- A clear description of the issue and its potential impact
- Steps to reproduce (proof-of-concept, requests, or a minimal example)
- Affected URL(s), route(s), or component(s)
- Any suggested remediation, if you have one

### What to expect

- **Acknowledgement** within **72 hours**.
- An initial assessment and severity rating shortly after.
- Regular updates as we work on a fix, and credit in the release notes once
  resolved (unless you prefer to remain anonymous).

Please give us a reasonable window to address the issue before any public
disclosure. We will work with you to coordinate timing.

## Scope & Notes

- **Firebase web API keys are public by design.** The values in
  `NEXT_PUBLIC_FIREBASE_*` are client identifiers, not
  secrets — access is controlled by Firestore and Storage **security rules**
  (`firestore.rules`, `storage.rules`), not by key secrecy. Reports that simply
  point out "the Firebase API key is exposed" are **not** considered
  vulnerabilities. Reports of overly-permissive **security rules**, however, are.
- The open-source app does not default to the production Firebase project. Cloud
  features stay disabled until a deployment supplies its own complete Firebase
  web config.
- Feedback media uploads require Firebase auth and are size-limited in
  `storage.rules`. Public deployments should still enable Firebase App Check on
  Storage to reduce scripted abuse.
- Server-only secrets (e.g. `OPENAI_API_KEY`, `GITHUB_APP_PRIVATE_KEY`) must
  never be committed. If you discover one in the git history or a deployment,
  report it privately right away.

## Supported Versions

SystemDesigner is a continuously deployed web application; security fixes are
applied to the latest `main` and the live site. There are no long-term
supported older releases.

| Version            | Supported |
| ------------------ | --------- |
| `main` (latest)    | ✅        |
| Older commits      | ❌        |

Thank you for practicing responsible disclosure. 💛
