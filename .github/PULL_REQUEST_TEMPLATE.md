<!--
Thanks for contributing to SystemDesigner (https://systemdesigner.net)!
Please fill out the sections below. Small, focused PRs are easiest to review and merge.
New here? Read ./CONTRIBUTING.md and ./docs/CONTENT_GUIDE.md first.
-->

## Summary

<!-- What does this PR do, and why? 1-3 sentences. Link the lesson/section if relevant. -->



## Type of change

<!-- Check all that apply. -->

- [ ] 📝 Content fix (improve an existing lesson, quiz, or reference)
- [ ] ✨ New content (new lesson, quiz, calculator, or case study)
- [ ] 🐛 Bug fix (fixes broken behavior)
- [ ] 🚀 Feature (new app capability)
- [ ] 📚 Docs (README, guides, or other documentation)
- [ ] 🧹 Refactor (no functional/content change)

## Related issue

<!-- Link the issue this PR addresses. Use "Closes #123" so the issue auto-closes on merge. -->

Closes #

## Screenshots

<!-- For UI or content changes, add before/after screenshots or a short clip so reviewers can see the result.
     Light + dark mode is appreciated. Delete this section if not applicable. -->



## Checklist

<!-- Tick each box once done. CI runs secret scanning, content validation, tests, lint, and build on every PR. -->

- [ ] Ran `pnpm check` locally, or explained below why a slower step was skipped
- [ ] Ran `pnpm validate:registry` and it passes (this is the content gate; CI runs it too)
- [ ] Ran `pnpm scan:secrets` after touching config, docs examples, or environment setup
- [ ] `pnpm lint` passes
- [ ] Followed the authoring standards in [AGENTS.md](../AGENTS.md)
- [ ] Added/updated co-located quiz JSON (or the existing bank entry) and ran `pnpm validate:content` (if the page has a quiz)
- [ ] Added content under `content/entries/<section>/<slug>/index.mdoc` without a concrete content `page.tsx`
- [ ] Kept interactive React blocks focused on user-controlled behavior instead of wrapping whole lessons
- [ ] Updated docs ([README.md](../README.md), [docs/CONTENT_GUIDE.md](../docs/CONTENT_GUIDE.md), etc.) if behavior or structure changed
- [ ] My content follows the "Explain before you dive deep" principle — every concept opens with a plain-language "What is [Concept]?" intro

---

By submitting this PR I agree my code is contributed under the [MIT License](../LICENSE) and my content under
[CC BY-SA 4.0](../LICENSE-CONTENT). See [CONTRIBUTING.md](../CONTRIBUTING.md) for details.
