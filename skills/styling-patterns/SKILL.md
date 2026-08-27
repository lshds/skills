---
name: styling-patterns
description: >-
  CSS and utility styling guidelines for web and mobile UI. This skill should
  be used when writing, reviewing, or refactoring styles, themes, or branded
  UI to ensure tokens, layout, and look stay modern — not deprecated stacks
  or generic AI defaults. Prefer native CSS, Tailwind v4, and NativeWind v5
  CSS-first on greenfield (match existing NativeWind v4). Triggers on CSS,
  SCSS, Sass, CSS modules, Tailwind, `@theme`, NativeWind, tokens, theme,
  container queries, className, or motion.
---

# Styling Skills

Stack-aware styling for tokens, layout, cascade, motion, and visual direction
across CSS / SCSS / Sass, Tailwind, and NativeWind. Prefer current platform
defaults and the repo’s design tokens when they exist.

**Domain:** how UI is styled — tokens, cascade, layout, motion, and stack
choice — across CSS, Tailwind, and NativeWind.
**Owns:** one styling system per feature; design tokens and `@theme`; compact
design plan on a free visual axis; layout ladder; cascade and structure;
motion gating; syntax conventions.
**Does not own:** component structure and state; keyboard, ARIA, and focus-trap
depth; React Native layout primitives beyond `className`.

## When to activate

- Writing or reviewing stylesheets, CSS modules, or SCSS / Sass partials
- Adding Tailwind or NativeWind `className` utilities (detect NativeWind v4 vs v5)
- Defining or using design tokens, `@theme`, themes, or spacing scales
- Building responsive layout (intrinsic, container queries, breakpoints)
- Adding animation or transition with reduced-motion gating
- Greenfield, branded, or marketing UI when the visual look is not already locked
- Refactoring mixed styling systems toward one stack per feature

## Core Concepts

### Write vs review

- Pick one mode from the user ask — don’t mix output shapes
- **Write** (implement, fix, refactor): apply these defaults in styles; no review report unless asked
- **Review**: named scope only; report concrete misses in this skill’s domain
- Skip findings outside that domain

### Match the repo

One styling system per feature; don’t migrate stacks (or NativeWind majors)
unless asked. Greenfield = CSS-first (Tailwind v4 / NativeWind v5). Reuse the
repo’s theme tokens when they exist. Stack-specific tooling and examples →
Practice areas.

### Design plan (free visual axis)

When the look is not already locked (greenfield, new branded surface, marketing
page with no design system), write a **compact design plan before styling
code**. Cover four decisions only:

1. **Color** — one primary, one surface, one text/foreground; name them as
   semantic tokens, not raw hex at call sites
2. **Type** — one display face + one body face (or the repo’s pair); avoid
   default UI stacks when the brand needs character
3. **Layout** — how the first viewport and sections compose (one job per
   section; intrinsic flex/grid before breakpoint spam)
4. **Signature** — one memorable visual idea (motif, crop, texture, motion
   beat) that would still identify the product if the logo were removed

Then do a **second pass**: revise anything that still reads like a generic
template rather than this plan. Skip the two-pass when the task is token-locked
or a small style fix inside an existing system — just match what is there.

### Avoid generic AI aesthetics

Generic defaults erase brand. Prefer the design plan (or repo tokens) over
looks that cluster in unguided generation:

- Purple-on-white or purple→indigo gradient themes
- Warm cream canvas + high-contrast serif + terracotta accent as a default trio
- Broadsheet pastiche (hairline rules, zero radius, dense newspaper columns)
- Always-on dark mode, glow/neon, pill clusters, multi-layer shadows, emoji as
  decoration
- Flat single-color pages with no atmosphere when the surface is meant to feel
  placed (gradient, image, or subtle pattern — still tokenized)
- Card chrome everywhere, or floating badges/stickers on hero media

### Motion

Intentional hierarchy, not noise — gate decorative motion (reduced-motion /
`motion-safe:` / repo helper). Details in the stack ref under Practice areas.

### Design tokens

Primitive → semantic CSS custom properties (or the repo’s theme/`@theme` scale)
for color, space, and type. No magic hex/px in features. Prefer kebab-case token
names. On a free visual axis, derive tokens from the design plan so utilities
and CSS share one vocabulary.

### Layout ladder

Intrinsic flex/grid first (`auto-fill` / `minmax`, wrap + `gap`). Container
queries for reusable components. Viewport media queries for page chrome —
mobile-first when MQ is needed.

### Cascade and structure

Prefer `@layer` / scoped modules / `:where()` over specificity wars, IDs, or
`!important`. Naming matches the repo; greenfield class CSS uses kebab-case, not
`block__element--modifier` unless the repo already uses that convention.

### Syntax conventions

Prefer modern color functions (`oklch` first on greenfield), no hand vendor
prefixes, `0` without unit, `::` pseudo-elements, and kebab-case names. Avoid
deprecated CSS properties and at-rules. Full syntax rules → CSS practice area.

### Common mistakes

| ❌ Incorrect | ✅ Correct |
| --- | --- |
| Mix StyleSheet + NativeWind / CSS + Tailwind in one feature | One styling system per feature |
| Hand prefixes, `0px`, `:before`, camelCase classes | Unprefixed modern CSS; `0`, `::before`, kebab-case |
| Dynamic `className={\`text-${x}\`}` / `@tailwind` / JS theme config / `cssInterop` | Complete class names; CSS-first `@import` + `@theme`; `styled()` |
| Code first on a free visual axis; purple/cream-serif/glow defaults | Two-pass design plan (color, type, layout, signature), then tokenized styles |
| Always-on decorative motion | Gate with reduced-motion / `motion-safe:` / repo helper |

## Workflow

1. Detect the styling stack and whether a design system / theme already locks
   the look (Match the repo).
2. If the visual axis is free: write the compact design plan, then revise
   generic AI defaults (Design plan + Avoid generic AI aesthetics). If locked,
   skip to tokens already in the repo.
3. Open only the matching Practice areas ref — don’t load every file.
4. Implement or review against Core Concepts and Common mistakes; express color /
   type / space as tokens, not one-off magic values.

## Practice areas

Read the reference for the task — don’t load every file.

| Area | Reference |
| --- | --- |
| CSS / SCSS / Sass | [css-scss-sass.md](references/css-scss-sass.md) |
| Tailwind | [tailwind.md](references/tailwind.md) |
| NativeWind | [nativewind.md](references/nativewind.md) |
