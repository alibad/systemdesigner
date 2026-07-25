# System Design Studio - Content Strategy

## Vision
Transform the app into a comprehensive, interactive system design learning resource that takes users from foundational concepts to real-world implementation expertise.

## Current State
- **Reference**: Basic "napkin math" numbers (latencies, CDN, data sizes)
- **Practice**: Minimal quiz functionality
- **Learn**: Restored with a landing page and guided path entry

## Proposed Content Architecture

### 1. FUNDAMENTALS (New Section)
**Target**: Complete beginners to system design
- **Scalability Basics**: Vertical vs horizontal scaling, when to use each
- **Reliability Patterns**: Redundancy, failover, circuit breakers
- **Consistency Models**: ACID, CAP theorem, eventual consistency
- **Performance Metrics**: Latency, throughput, availability (SLIs/SLOs)
- **Security Fundamentals**: Auth, encryption, HTTPS, CORS

### 2. REFERENCE (Expanded)
**Current**: Napkin math numbers
**Add**: 
- **Design Patterns**: Load balancing strategies, caching layers, message queues
- **Database Patterns**: Sharding, replication, indexing strategies
- **Architecture Patterns**: Microservices, event-driven, CQRS, saga patterns
- **Technology Comparison**: SQL vs NoSQL, REST vs GraphQL vs gRPC
- **Trade-off Analysis**: Consistency vs availability, latency vs throughput

### 3. CASE STUDIES (New Section)
**Real-world examples with interactive breakdowns**:
- **Netflix**: Content delivery, recommendation engine, microservices
- **Uber**: Real-time matching, geospatial indexing, surge pricing
- **WhatsApp**: Message delivery, presence, 2 billion users on minimal servers
- **Zoom**: Video streaming, auto-scaling during COVID
- **Instagram**: Photo storage, feed generation, Stories architecture
- **GitHub**: Git hosting, CI/CD pipelines, collaborative features

### 4. DESIGN WORKSHOP (New Section)
**Interactive design exercises**:
- **Step-by-step Design Process**: Requirements → Scale → Components → Deep dive
- **Capacity Planning Calculator**: Interactive tools for storage, bandwidth, QPS
- **Architecture Simulator**: Drag-and-drop components, see trade-offs
- **Bottleneck Analyzer**: Input your design, get performance predictions

### 5. PRACTICE (Enhanced)
**Current**: Basic quizzes
**Enhance**:
- **Interview Problems**: Design Twitter, Uber, URL shortener with guided solutions
- **Scale Challenges**: "You have 1M users, now 100M - what breaks first?"
- **Trade-off Scenarios**: Multiple choice on architectural decisions
- **Code Reviews**: Real system design code with performance issues to identify

### 6. TOOLS & CALCULATORS (New Section)
**Interactive utilities**:
- **Bandwidth Calculator**: Data transfer costs across regions
- **Database Sizing**: Storage requirements for different data models
- **Cache Hit Rate Simulator**: See performance impact of different caching strategies
- **Load Testing Predictor**: Input traffic patterns, predict infrastructure needs
- **Cost Estimator**: AWS/GCP/Azure pricing for different architectures

## Content Delivery Strategy

### Phase 1: Foundation (Reference Enhancement)
1. Expand current Reference with design patterns and trade-offs
2. Add interactive visualizations for each concept
3. Include "When to use" decision trees

### Phase 2: Learning Paths — IN PROGRESS
1. Create Fundamentals section with progressive difficulty
   - Status: Fundamentals pages exist; linked from new `/learn` landing (DONE)
2. Add guided tutorials with embedded quizzes
   - Status: Partially — quizzes exist; need inline checks inside lessons (TODO)
3. Build case study breakdowns with interactive diagrams
   - Status: Case study pages exist; need interaction pass (TODO)

### Phase 3: Interactive Tools
1. Capacity planning calculators
2. Architecture design canvas
3. Performance simulation tools

### Phase 4: Community & Practice
1. Enhanced practice problems with detailed solutions
2. Community-contributed designs and reviews
3. Integration with popular system design interview prep

## Success Metrics
- **Engagement**: Time spent on each section, completion rates
- **Learning**: Quiz scores, progression through difficulty levels
- **Practical Application**: Downloads of calculators, bookmarks of reference
- **Community**: Shared designs, discussion engagement

## Technical Implementation Notes
- Each section needs its own navigation hierarchy
- Interactive tools require client-side state management
- Case studies need rich media (diagrams, videos, interactive flows)
- Practice section needs progress tracking and personalization
- Mobile-responsive design for on-the-go learning

## Content Sources & Research
- System design interview books (Designing Data-Intensive Applications, System Design Interview)
- Engineering blogs (High Scalability, Netflix Tech Blog, Uber Engineering)
- Academic papers on distributed systems
- Open source architecture documentation
- Real incident post-mortems and lessons learned

This transforms the app from a "napkin math reference" into a comprehensive system design education platform.

---

## TODO Roadmap (product + engineering)

### P1 — Whiteboard share links + evaluator mode
- [ ] Data models: `boards` (id, ownerId, title, json, thumbnailUrl, isPublic, shareToken, createdAt), `reviews` (id, boardId, reviewer, scores {reqs, arch, data, scale, rel, tradeoffs}, notes, createdAt)
- [ ] API routes: POST/GET `/api/boards`, GET `/api/boards/:id`, POST `/api/boards/:id/reviews`
- [ ] Storage choice and wiring (Supabase or Vercel KV + S3)
- [ ] Whiteboard: Share button → save JSON + thumbnail, produce `/whiteboard/share/[id]`
- [ ] Read-only viewer route renders board; disable edits; load reviews
- [ ] Evaluator panel with weighted rubric + submit; export CSV/PDF of reviews

### P2 — Interview Gym MVP
- [ ] Seed `prompts` (10): id, title, prompt, starterTemplate, duration
- [ ] `/gym` route: pick prompt → start timer (45–60m), autosave to `sessions`
- [ ] Notes panel (markdown), “Insert starter diagram” on whiteboard
- [ ] Submit: generate export (thumbnail + notes + rubric sheet) via PDF endpoint
- [ ] Session history page with downloads

### P3 — One‑click deploy (v1 managed providers)
- [ ] Pattern presets: API + Postgres + Redis
- [ ] Providers: Vercel (API), Neon (Postgres), Upstash (Redis) integration
- [ ] Deploy modal: collect config → create projects via provider APIs → set envs
- [ ] Health check + endpoint verification; teardown instructions
- [ ] Cost card: estimate per plan from pricing sheets

### P4 — Performance Simulator MVP
- [ ] Build queueing model lib (service nodes: λ/μ, caches: hit%, networks: latency)
- [ ] Whiteboard “Simulate” panel: workload sliders, per-node capacities
- [ ] Results: utilization, p50/p95 latency, bottlenecks, recommendations
- [ ] Overlays on nodes (green/amber/red); save scenarios with board

### Cross‑cutting
- [ ] Minimal auth (GitHub OAuth or magic link) for board ownership
- [ ] Telemetry for shares, reviews, sessions, deploys
- [ ] Documentation for deploys + teardown + costs
---

Current step: Phase 2 — Learning Paths (homepage aligned to two clear actions).

Recent edits impacting IA:
- Homepage simplified to an inspiring hero plus two actions: “Start Guided Path” and “Design a System Now”.
- `/learn` landing implemented; links into Fundamentals and Case Studies.

Potentially redundant/overlapping areas to review next:
- Sandbox vs Tools vs Whiteboard naming. Proposal: keep Sandbox as “Design Studio”, nest Tools within it; add redirects. (Not implemented yet.)
- Design Workshop vs Practice challenges. Decide whether Workshop belongs under Design or Practice to avoid duplication.