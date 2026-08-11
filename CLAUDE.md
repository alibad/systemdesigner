# System Designer — Claude Code guidance

Follow the workspace-wide instructions in `C:\Users\Admin\Code\CLAUDE.md` and the repository documentation in `docs/`.

## Vercel cost safety

- Keep this project and the `alibads-projects` team on the `standard` build machine. `enhanced` or `turbo` requires explicit user approval after stating the price difference.
- A Git push is the deployment mechanism. Never also run a Vercel CLI deployment for the same commit.
- Do not deploy or redeploy unless explicitly requested in the current conversation.
- Before a requested production deployment, check `vercel usage --scope alibads-projects` and report whether on-demand charges are active.
- Batch related changes and never enable automatic production pausing without explicit approval, because a spend-cap pause returns HTTP 503.
