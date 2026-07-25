# Roadmap

A living view of where SystemDesigner is headed. This isn't a promise of dates —
it's a shared sense of priorities so contributors know where help is most
valuable. The roadmap is shaped in the open: propose and debate items in
[Discussions](https://github.com/alibad/systemdesigner/discussions) and
[Issues](https://github.com/alibad/systemdesigner/issues).

## Vision

Make world-class system design education **free, hands-on, and open** — covering
classic distributed systems, modern GenAI systems, and ML systems engineering,
with every concept explained from first principles before the trade-offs.

## Where we are today

- **425 content entries** across 8 sections: technology (136), genai (76),
  ml-systems (61), fundamentals (50), practice (29), reference (27), tools (26),
  case-studies (20).
- **413 interactive quizzes** in a centralized quiz bank.
- Interactive calculators, a tldraw diagramming sandbox, learning paths, and
  progress tracking.

## Near-term priorities

These are the areas where contributions move the needle most right now:

1. **Fill the content graph.** The content registry references many prerequisite
   and related lessons that don't exist yet. Running
   `node scripts/validate-content-registry.cjs` lists every
   referenced-but-missing topic (currently ~740 unique ids). Each one is a
   ready-made lesson idea — see "Great first contributions" below.
2. **Deepen quizzes & calculators.** Add or improve quiz questions and
   interactive calculators for existing lessons.
3. **Strengthen the editorial bar.** Audit lessons that jump into trade-offs
   without a *"What is [Concept]?"* intro and add the missing context.
4. **Polish & accessibility.** Dark-mode consistency, keyboard navigation, and
   mobile layout fixes.

## Great first contributions

Looking for somewhere to start? Any of these is a self-contained, high-value PR:

- **Write a missing lesson.** Pick a topic from the validator's
  "dangling relationship references" list, then follow
  [docs/CONTENT_GUIDE.md](./docs/CONTENT_GUIDE.md) to add it. This shrinks the
  backlog *and* improves cross-linking across the whole site.
- **Improve an existing lesson** via the in-app "Edit this page on GitHub" /
  "Suggest an improvement" links at the bottom of any lesson.
- **Add a quiz** to a lesson that's missing strong questions.
- **Fix a `good first issue`** —
  [browse them here](https://github.com/alibad/systemdesigner/labels/good%20first%20issue).

## Later / exploratory

Bigger bets we'd like to explore (discussion welcome before code):

- **Internationalization (i18n).** A sanctioned path for translated content so
  the platform reaches a global audience.
- **Richer practice mode.** More guided, interview-style walkthroughs with
  feedback.
- **Visual learning-path explorer.** Navigate prerequisite chains as a graph.
- **Community content review tooling** to scale the editorial bar as the project
  grows.

## Non-goals

- Becoming a closed/paywalled product — SystemDesigner stays free and open
  (MIT code, CC BY-SA 4.0 content).
- Vendor lock-in or required paid services to run it locally — the app must keep
  running with zero configuration.

---

Want to influence the roadmap? Open a
[Discussion](https://github.com/alibad/systemdesigner/discussions) — the best
ideas here come from people learning and teaching with the platform.
