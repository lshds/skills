<!-- Template for new skills. Copy → skills/<name>/SKILL.md → fill placeholders.
     KEEP the Example HTML block at the bottom of THIS file so AI/authors see the shape.
     When producing a real skill (skills/react-patterns/SKILL.md), delete this
     comment, the section comments, unused optional blocks, and the Example —
     ship only filled content.

     Directory: skills/<name>/ with SKILL.md at the root. Name = kebab-case,
     usually `topic-patterns` (`react-patterns`, `typescript-standards`).
     English only. SKILL.md is the index. Worked defaults live in
     references/<topic>.md (copy _template_reference.md). Do not link to
     other skills, agents, rules, or headings — the agent must apply this
     file alone. Prefer one default; don’t list option menus. Exceptions
     go last (“When X is OK”), not mixed into the default.
     Typical filled file: 80–200 lines. An Output Format reply/doc template
     may push past 200 — don’t cut it to hit the range. Don’t paste JSON or
     code catalogs here; that is the reference file’s job. One short fence
     with a language tag is OK when the default will not fit in prose.
     After shipping: one Practice areas row per new reference; a Skill
     index row on the owning agent; a README row if the skill is new.

     Frontmatter:
     - name: lowercase + hyphens; match the folder; max 64 chars
     - description: folded YAML (`>-`). 4–8 lines. Third person.
       Shape: (1) what it is — “[Kind] guidelines for [surface]”,
       (2) when — “This skill should be used when writing, reviewing, or
       refactoring [work] to ensure [outcome]”,
       (3) one prefer/default,
       (4) “Triggers on [word], [word], or [word].”
       Include the words that should load it. Not first person. Not
       “Use when” / “Use whenever”. Not the intro wording verbatim.

     Title: `# Topic Skills` — topic + “Skills” is the usual shape
     (TypeScript Skills, React Skills). 1–4 words. Title Case. Not a
     slogan, not a file path, not a question. Omit “Skills” only when the
     topic is already a noun phrase (API Design, Folder Structure).

     Intro: under the title, before Domain / the first ##. 1–2 sentences.
     Name the surfaces and the default. Not a link list — `references/`
     links belong on the matching ###. Not the description wording
     verbatim.

     Domain block: three bold lines. Include when another skill could
     claim the same work (in this repo: almost always). Delete the three
     lines only when there is no overlap to draw.
     - Domain: the surface in one clause
     - Owns: decisions this skill makes (comma-separated)
     - Does not own: neighboring work — name the surface in plain words,
       never another skill folder name. No cross-links.

     When to activate: 4–8 bullets. Real tasks (“Writing or reviewing X”),
     not a restated description. The agent uses these as a second trigger
     pass after description.

     Core Concepts: one ### per concept. Heading names the rule (Naming,
     Escape hatches) — not “Overview” or a question. Body: the default in
     plain English, 1–4 sentences or short bullets. Link
     [topic.md](references/topic.md) only when the worked example will
     not fit here. Duplicate the ### block per concept.

     Optional first ### when the skill both implements and reviews (or
     designs, audits, places, blueprints). Name it for the modes this
     skill actually uses — Write vs review, Write vs audit, Place vs
     blueprint, or Design vs review. Don’t add a ## for those modes
     before Core Concepts.

     Optional ### Match the repo when greenfield defaults differ from
     brownfield. Follow the existing stack; apply the greenfield default
     only when the tree does not contradict it; ask before migrating.
     Rename the heading when the rule is more specific (Generation).

     Common mistakes: optional table. Same scenario, different choice.
     Last ### under Core Concepts. Delete the subsection if empty.

     Section order after Core Concepts: optional ## Workflow, then
     optional ## Output Format, then ## Practice areas last.
     Workflow / Output Format: add only when the skill owns a procedure
     (write vs audit, place vs blueprint) or a reply/doc shape. Don’t
     restate Core Concepts as steps.

     Practice areas: last section. Always the “Read the reference…” line.
     Column header is Area, not Example. Area = searchable words, not
     only the filename. One row per file under references/. Omit the
     whole section when there are no reference files. -->

<!-- Frontmatter: fill name + description. See the shape in the comment above. -->

---
name: topic-patterns
description: >-
  [Kind] guidelines for [surface]. This skill should be used when writing,
  reviewing, or refactoring [work] to ensure [outcome]. Prefer [default]
  over [anti-pattern]. Triggers on [word], [word], or [word].
---

<!-- Title + intro: 1–2 sentences. Surfaces + default. Not the description.
     No references/ links here. -->

# Topic Skills

[What this covers, in one or two sentences. Not a repeat of description.]

<!-- Domain block: delete these three lines only when no other skill could
     claim the same work. Does not own: surface names, not skill folders. -->

**Domain:** [the surface in one clause]
**Owns:** [decisions this skill makes]
**Does not own:** [neighboring work this skill does not decide — name the surface, not another skill file]

<!-- When to activate: 4–8 real tasks. Gerunds. Not a restated description. -->

## When to activate

- [A real task this skill should handle]
- [Another real task]
- [A third real task]
- [A fourth real task]

<!-- Core Concepts: duplicate the ### block per concept.
     Heading names the rule. One default. Link a reference only if the
     extra detail will not fit here.

     Optional first ### — rename to the modes this skill uses
     (Write vs review / Write vs audit / Place vs blueprint /
     Design vs review):

### Write vs review

- Pick one mode from the user ask — don’t mix output shapes
- **Write** (implement, fix, refactor): apply these defaults; no review report unless asked
- **Review**: named scope only; report concrete misses in this skill’s domain
- Skip findings outside that domain

     Optional ### when greenfield defaults differ from brownfield.
     Rename when the rule is more specific (Generation). Delete when
     unused.

### Match the repo

Follow the stack and helpers already in the tree. Apply the greenfield
default only when nothing contradicts it. If you find an older way to
do the same work, say so and ask before replacing it.
-->

## Core Concepts

### [Concept name]

[The rule, in plain English. One default. Link a file under `references/` only if the extra detail will not fit here.]

<!-- Optional. Last ### under Core Concepts. Delete this subsection if empty. -->

### Common mistakes

| ❌ Incorrect | ✅ Correct |
| --- | --- |
| [Bad pattern] | [What to do instead] |

<!-- Optional. Add ## Workflow only when the skill owns a procedure
     (write vs audit, place vs blueprint). Short numbered steps.
     Don’t restate Core Concepts. Delete this comment when unused.

## Workflow

1. [Pick the mode / detect the case]
2. Open only the matching Practice areas ref — don’t load every file.
3. [Write or review against Core Concepts]

     Optional. Add ## Output Format only when the skill owns a reply or
     doc shape. Place it after Workflow and before Practice areas.
     A reply template here may push the file past 200 lines — keep it.
     Delete this comment when unused.

## Output Format

[Reply or doc shape the skill owns]
-->

<!-- Practice areas: last section. One row per references/*.md. Omit
     the whole section when there are no reference files. After adding
     a reference, add a row. Column is Area; words a search would use. -->

## Practice areas

Read the reference for the task — don’t load every file.

| Area | Reference |
| --- | --- |
| [Searchable words for this topic] | [concept.md](references/concept.md) |

<!-- Example — delete this whole comment when producing a real skill:

---
name: functions-patterns
description: >-
  Function and export guidelines for TypeScript modules. This skill should
  be used when writing, reviewing, or refactoring functions to keep exported
  multi-step logic readable. Prefer `export function` and early returns over
  chained arrow exports. Triggers on export function, arrow, early return,
  or “make this a named function.”
---

# Functions Skills

Exported multi-step logic and local helpers in `.ts`. Prefer `export function`
with early returns; use `const` arrows for nested or one-line helpers.

**Domain:** how functions are declared and exported in TypeScript modules.
**Owns:** `export function` vs `export const` arrows; early returns vs nested
conditionals; local helper shape.
**Does not own:** type annotations, naming of identifiers, or control-flow
operators such as `??` / `?.`.

## When to activate

- Writing or reviewing exported functions in `.ts`
- Replacing a chained `export const` with a named function
- Choosing a local arrow helper vs an exported function
- Tightening a long happy path that nests conditionals

## Core Concepts

### Exported multi-step

Use `export function` for exported multi-step logic. Early `return` over
nested conditionals when the happy path is long. See
[functions.md](references/functions.md).

### Local helpers

`const` arrows for nested or one-line helpers that stay inside the module.

### Common mistakes

| ❌ Incorrect | ✅ Correct |
| --- | --- |
| `export const` + chained `&&` for multi-step | `export function` + early returns |
| Nested conditionals on a long happy path | Guard clauses, then the happy path |

## Practice areas

Read the reference for the task — don’t load every file.

| Area | Reference |
| --- | --- |
| Exported multi-step / early return | [functions.md](references/functions.md) |
-->
