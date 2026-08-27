---
name: typescript-standards
description: >-
  Strict TypeScript guidelines for .ts modules and type-only .tsx work. This
  skill should be used when writing, reviewing, or tightening TypeScript to
  ensure sound typing and conventions. Prefer `unknown` + guards, immutability,
  and inference over `any` or escape hatches. Triggers on types, interfaces,
  naming, imports, control flow, async composition, JSDoc, or “make it stricter.”
---

# TypeScript Skills

Strict TypeScript for `.ts` (and type-only `.tsx`): naming, typing, immutability,
escape hatches, imports, functions, control flow, async, and JSDoc. Prefer
inference over silencing the typechecker.

**Domain:** TypeScript language rules in `.ts` and type-only `.tsx`.
**Owns:** naming, typing, immutability, escape hatches, imports, functions,
control flow, async composition, JSDoc.
**Does not own:** React component and hook patterns, CSS, HTTP contracts, or
runtime data-access.

## When to activate

- Writing or reviewing `.ts` modules, or type-only work in `.tsx`
- Defining or tightening types, interfaces, or narrowing boundaries
- Replacing `any` / unsafe `as` / `!`, or fixing naming and imports
- Reshaping async waterfalls, control flow, or redundant annotations
- Adding or reviewing JSDoc / TSDoc on exports

## Core Concepts

### Write vs review

- Pick one mode from the user ask — don’t mix output shapes
- **Write** (implement, fix, refactor): apply these defaults in the `.ts`; no review report unless asked
- **Review**: named scope only; report concrete misses in this skill’s domain
- Skip findings outside that domain

### Naming

Descriptive `camelCase`; `is…` / `has…` booleans; plurals; `SCREAMING_SNAKE` constants. Verb-noun functions; `PascalCase` types (no `I`). See [naming.md](references/naming.md).

### Typing

No `any`. Prefer `unknown` + guards, `as const`, `satisfies`, discriminated unions. See [typing.md](references/typing.md).

### Immutability

Prefer immutable updates — spread over in-place mutation. See [immutability.md](references/immutability.md).

### Escape hatches

Narrow or parse at the boundary — no `as` / `!` / `@ts-ignore` to silence. See [escape-hatches.md](references/escape-hatches.md).

### Imports

Path alias + `import type`. See [imports.md](references/imports.md).

### Functions

`export function` for exported multi-step; `const` arrows for locals/one-liners. See [functions.md](references/functions.md).

### Control flow

Early `return` / `throw`; prefer `??` over `||`; use `?.`; blank line before guards and before the happy-path `return`. See [control-flow.md](references/control-flow.md).

### Async

Avoid request waterfalls. Parallelize independent work; defer `await` until the branch that needs it. See [async.md](references/async.md).

### Noise to skip

Omit obvious annotations and wrappers. See [noise-to-skip.md](references/noise-to-skip.md).

### JSDoc

Short purpose-first docs: what it does, args, return with links to types. Don’t restate types TypeScript already shows, and skip comments on small internal helpers when the signature is clear enough. See [jsdoc.md](references/jsdoc.md).

### Common mistakes

| ❌ Incorrect | ✅ Correct |
| --- | --- |
| `any` / `as` / `!` to silence the checker | `unknown` + a guard, or parse at the boundary |
| `export const` + chained `&&` for multi-step | `export function` + early returns |
| Annotate what TypeScript already infers | Omit the noise; document purpose on exports |

## Practice areas

Read the reference for the task — don’t load every file.

| Area | Reference |
| --- | --- |
| Naming / booleans / constants | [naming.md](references/naming.md) |
| Typing / guards / unions | [typing.md](references/typing.md) |
| Immutability / spread | [immutability.md](references/immutability.md) |
| Escape hatches (`as` / `!`) | [escape-hatches.md](references/escape-hatches.md) |
| Imports / `import type` | [imports.md](references/imports.md) |
| Functions / export vs arrow | [functions.md](references/functions.md) |
| Control flow / early return / `??` | [control-flow.md](references/control-flow.md) |
| Async waterfalls / deferred await | [async.md](references/async.md) |
| Noise to skip / inference | [noise-to-skip.md](references/noise-to-skip.md) |
| JSDoc / TSDoc on exports | [jsdoc.md](references/jsdoc.md) |
