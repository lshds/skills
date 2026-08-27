# Master checklist — to create

Skills and agents still to ship. Each skill stands alone: own domain, own scope. No cross-links to other skills.

When an item is done, remove it from this list and add it under What’s in the repo in [README.md](README.md) if needed.

### 1. `storybook-patterns`

**Scope:** Storybook — CSF, controls, addons, where stories live. Wait until a repo actually uses Storybook. Not design tokens, not a UI kit/component API, not general CSS, not deep a11y.

- [ ] `skills/storybook-patterns/SKILL.md`
- [ ] Description triggers: Storybook, CSF, stories, controls, addons
- [ ] Core concepts to cover:
  - [ ] CSF: match the repo’s story format; colocate or `stories/` as the project already does
  - [ ] Controls for the props that matter; don’t snapshot every permutation
  - [ ] Addons the repo already uses (a11y addon if present) — don’t add a parallel docs stack
- [ ] Optional refs: `references/csf.md`, `references/addons.md`
- [ ] Agent: Frontend — row for “Storybook”
- [ ] Create only when Storybook is in the repo — otherwise it’s fluff

---

### 2. `writing-patterns`

**Scope:** How to write docs, explanations, README, issue/MR text, and skill/rule prose. Readability without cutting depth. No ban on academic or hard words and sentences. Do not simplify by shortening or dumbing down.

- [ ] `skills/writing-patterns/SKILL.md`
- [ ] Description triggers: writing, wording, explanation, prose, copy, README, “how to explain”
- [ ] Core concepts to cover:
  - [ ] Write so the reader gets the point without rereading
  - [ ] Keep detail, nuance, and clarity — readability must not mean less content
  - [ ] Academic / hard words and sentences are allowed — no hard rule against them
  - [ ] Word choice and sentence length are free; short or simple sentences are not a goal
  - [ ] Structure so the takeaway is easy to find; no filler
- [ ] Optional refs: `references/tone.md`, `references/structure.md`
- [ ] Agents: all four — row for “docs / explanations / wording”
