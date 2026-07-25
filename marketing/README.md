# System Designer - Marketing Site

Marketing website for System Designer, built based on the Founding Hypothesis research.

## Key Messaging

**Core Value Prop:** "Learn to Think Like Senior Engineers"

**The Insight:** System design is the PRIMARY MODE OF WORK for senior engineers (60-65% of their time), yet all resources teach interview tricks. We teach "design mode thinking"—the actual job skill.

## Tech Stack

- **Framework:** Next.js 15 with App Router
- **Styling:** Tailwind CSS
- **TypeScript:** Full type safety
- **Port:** 3026 (dev), configurable for production

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Main app URL

# Production
NEXT_PUBLIC_APP_URL=https://systemdesigner.net
```

## Development

```bash
# Install dependencies
pnpm install

# Run development server (port 3026)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## Pages

- `/` - Landing page with dual-track value prop
- `/pricing` - Pricing tiers ($19 individual, $49 team)
- `/features` - Architecture Decision Trainer details
- `/about` - Our story (discovery of design mode gap)
- `/vs/bytebytego` - Comparison page
- `/vs/design-gurus` - Comparison page

## Key Content from Hypothesis

**Target Customer:** Mid-level engineers (L4/SDE2, 3-5 years) getting down-leveled in senior interviews

**Problem:** $70-145K salary loss from down-leveling. Resources either too shallow, too dense, or too expensive.

**Solution:** Dual-track strategy
- Track 1: Interview-ready in 2-3 months (acquisition)
- Track 2: Design thinking mastery (retention)

**Differentiation:**
1. Teaches "design mode thinking" (no competitor does this)
2. AI-guided systematic process
3. Real trade-off data (cloud pricing)
4. Export to Google Docs (production use)

**Success Metrics:**
- 75%+ pass L5+ interviews
- 60%+ apply to production work within 6 months
- $145K average salary increase

## Deployment

This site can be deployed separately from the main app:
- **Vercel:** Separate project for marketing site
- **Domain:** Can use subdomain or separate domain
- **Environment:** References main app via `NEXT_PUBLIC_APP_URL`

## Content Source

Launch-positioning source notes are maintained outside the public repository.
Keep this site focused on public copy, implementation details, and deployment
instructions.
