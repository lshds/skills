<!-- Template for new skill reference files. Copy → skills/<name>/references/<topic>.md → fill placeholders.
     KEEP the Example HTML block at the bottom of THIS file so AI/authors see the shape.
     When producing a real reference (references/naming.md), delete this comment,
     the duplicate-block comment, and the Example — ship only filled content.

     Filename: kebab-case, one topic (`escape-hatches.md`). English only.
     One topic per file. Do not link to other references, skills, or headings —
     the agent must apply this file alone.
     Detail lives here, not in SKILL.md. SKILL.md stays the index; this file
     is the worked default. Duplicate the ## block for each section.
     Prefer one default; don’t list option menus. Exceptions go last
     (“When X is OK”), not mixed into the default.
     Stay on ## — don’t nest ###. Typical file: 2–10 headings.
     Don’t merge distinct rules to hit a lower count.
     At the cap, say to apply the matching heading — no TOC, no heading links.
     Examples must be complete and concrete — no “etc.” / ellipsis placeholders.
     After shipping: add a Practice areas row on the parent SKILL.md.

     Title: topic name only — match the filename (naming.md → # Naming,
     escape-hatches.md → # Escape Hatches). 1–4 words. Title Case for short
     names. Not a slogan, not a file path, not “Topic Skills”, not a question,
     not numbered.

     Intro: under the title, before the first ##. 1–7 sentences / ~80–550 chars.
     Don’t drop match-vs-migrate, when-to-load, or stack-default just to hit
     a lower count.
     Prefer [PATTERN] over [ANTI_PATTERN] so [IMPACT]. Impact is what breaks,
     in plain words — not “cannot X” or “stay [abstract]”. Later sentences may
     name scope, types (e.g. reflected / stored / DOM XSS), or when to load
     sibling files — still not a heading. Not a link list. Not the SKILL.md
     wording verbatim.
     State the default the agent should apply unless the repo already
     contradicts it.

     Section: one idea per ##. Heading names the rule (`Narrow or parse`,
     `Exported multi-step`) — not “Overview”, “Notes”, or a question.
     More than one code block under the same ## is OK when they share the
     rule but differ by language (CSS vs JS).

     Why: 1–2 sentences before the code or list. Name the failure mode
     (what breaks if you skip the rule), not a restatement of the heading,
     not “This section covers…”. Domain words, not meta (“the agent should”).

     Code: language tag required (typescript, tsx, html, css, sql, yaml, text,
     bash, dockerfile, json). Never a bare ``` with no language.
     Pick the language the snippet actually is — tsx for JSX, typescript for
     .ts, text for trees, sql for SQL.
     ❌ Incorrect before ✅ Correct in the same block when they contrast.
     Always a described marker: // ❌ Incorrect: reason / // ✅ Correct: reason
     Never a bare // ❌ or // ✅. Use that language’s comment style
     (//, #, --, /* */, or HTML comments).
     The reason after the colon is specific (what fails), not “bad” / “good”.
     Several ❌ or ✅ lines in one block are fine when they share one rule.
     ✅ alone is allowed when showing only what to do (allow-lists).
     Incorrect and preferred must be the same scenario, different choice.
     Include the imports, types, and names the snippet needs to stand alone.
     Identifiers should reveal intent (no `foo`, `data`, `tmp`).
     Full concrete snippets — no “etc.”, “…”, or truncated bodies.

     List: rules that need no snippet. One bullet = one rule, in enough
     detail that the agent can apply it (what to do, and what fails if you
     don’t). Backticks for identifiers. Don’t restate a snippet in prose.
     A section may be list-only — omit the code fence then. Omit the whole
     list if unused. If a follow-up needs a snippet, it is a new ##, not a
     bullet. A small table is OK only when two valid choices depend on a
     condition (not as a substitute for ❌ / ✅). -->

# Topic title

Prefer [PATTERN] over [ANTI_PATTERN] so [IMPACT].

<!-- Duplicate this ## block for each section. Omit the code fence and/or the list if unused. -->

## Section name

[Why this section matters — one or two sentences.]

<!-- Optional code fence (language tag required). Omit if unused. -->

- [What to do, and what fails if you don’t. Backticks for identifiers.]
- [Another rule. One bullet = one rule. Delete unused bullets. Delete this list if unused.]

<!-- Example — delete this whole comment when producing a real reference:

# Functions

Use `export function` for exported multi-step logic. Use `const` arrows for nested/local helpers and one-liners.

## Exported multi-step

A chained `export const` arrow with several `&&` checks is hard to debug and hard to extend — you cannot return early from a single expression.

- Export a named `function` when the body has more than one step or guard. A `const` arrow is for nested/local helpers and one-liners, not for that export.
- Put each failed guard in its own early `return` (`return false`, or the matching failure value). Don’t chain the checks with `&&` in one expression.
- Keep the happy path as the last statement, un-nested. Prefer early `return` over nested `if` when that path is long.
-->
