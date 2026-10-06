---
name: typescript-standards
description: >-
  Strict TypeScript guidelines for .ts modules, type-only .tsx work, and
  tsconfig. This skill should be used when writing, reviewing, or tightening
  TypeScript to ensure sound typing and conventions. Prefer `unknown` + guards,
  immutability, and inference over `any` or escape hatches. Triggers on types,
  interfaces, naming, imports, control flow, guards, null/undefined checks,
  async composition, JSDoc, tsconfig, strict, TypeScript 7, or “make it
  stricter.”
---

# TypeScript Skills

Strict TypeScript for `.ts` (and type-only `.tsx`): naming, typing, immutability,
escape hatches, imports, functions, control flow, async, JSDoc, and compiler
options. Prefer inference over silencing the typechecker.

**Domain:** TypeScript language rules in `.ts` and type-only `.tsx`.
**Owns:** naming, typing, immutability, escape hatches, imports, functions,
control flow, async composition, JSDoc, and tsconfig compiler options.
**Does not own:** bundler and lint configuration.

## When to activate

- Writing or reviewing `.ts` modules, or type-only work in `.tsx`
- Defining or tightening types, interfaces, or narrowing boundaries
- Replacing `any` / unsafe `as` / `!`, or fixing naming and imports
- Reshaping async waterfalls, control flow, or redundant annotations
- Adding or reviewing JSDoc / TSDoc on exports
- Writing or reviewing `tsconfig.json`

## Core Concepts

### Write vs review

- Pick one mode from the user ask — don’t mix output shapes
- **Write** (implement, fix, refactor): apply these defaults in the `.ts`; no review report unless asked
- **Review**: named scope only; report concrete misses in this skill’s domain
- Skip findings outside that domain

### Match the repo

Read installed versions from `package.json` and the lockfile (plus `tsconfig.json`). Follow the patterns already in the tree; greenfield defaults apply only where nothing contradicts them. When code lags behind what the installed version supports, finish the task in the existing style, then propose the migration once — old → new, why, file count, risk — and wait for a yes. Never fold it into the current change. In review, report the gap as a finding instead.

Version signals:

- `baseUrl` + `paths` → `paths` relative to the tsconfig (deprecated in 6, error in 7)
- `"moduleResolution": "node"` / `"node10"` → `"bundler"` or `"nodenext"` (deprecated in 6, error in 7)
- `import config from './config.json' assert { type: 'json' }` → `with { type: 'json' }` (error in 7)
- implicit global `@types` → explicit `"types": ["node"]` (TS 7 defaults to `[]`)
- `ignoreDeprecations` → fix the deprecated options (they are errors in 7)
- `.sort()` / `.reverse()` / `.splice()` on a shared array → `toSorted()` / `toReversed()` / `toSpliced()` (lib ES2023+)

### Naming

Descriptive `camelCase`; `is…` / `has…` booleans; plurals; `SCREAMING_SNAKE` constants. Verb-noun functions; `PascalCase` types (no `I`). See [naming.md](references/naming.md).

### Typing

No `any`. Prefer `unknown` + guards, `as const`, `satisfies`, discriminated unions, and `NoInfer` on fallback parameters. See [typing.md](references/typing.md).

### Immutability

Prefer immutable updates — spread and `toSorted()` / `toReversed()` / `toSpliced()` / `with()` over in-place mutation. See [immutability.md](references/immutability.md).

### Escape hatches

Narrow or parse at the boundary — no `as` / `!` / `@ts-ignore` to silence. Suppressions need the user's OK; then `@ts-expect-error` with a reason. See [escape-hatches.md](references/escape-hatches.md).

### Imports

Path alias + `import type`; import attributes use `with`, not `assert`. See [imports.md](references/imports.md).

### Functions

`export function` for exported multi-step; `const` arrows for locals/one-liners. See [functions.md](references/functions.md).

### Control flow

- Early `return` / `throw`; `if` or `return`, not `continue`; blank line before guards and before the happy-path `return`
- Pick the missing-value check from the type: `!value` for objects, arrays, and strings where `''` means missing; `value === undefined` for numbers, booleans, and strings where `''` is valid
- Trust the types inside the boundary — one guard per concern; no re-checks, `?.`, or fallbacks for what the type already rules out
- Prefer `undefined` inside — convert `null` at the boundary and never carry `null | undefined` for one value; keep `null` only where the receiving API gives it a meaning
- `??` over `||`; `?.` for optional chains

See [control-flow.md](references/control-flow.md).

### Async

Avoid request waterfalls. Parallelize independent work; defer `await` until the branch that needs it. See [async.md](references/async.md).

### Noise to skip

Omit obvious annotations, spelled-out `undefined`, boolean wrappers, and return-only locals. See [noise-to-skip.md](references/noise-to-skip.md).

### JSDoc

Short purpose-first docs: what it does, args, return with links to types. Don’t restate types TypeScript already shows, and skip comments on small internal helpers when the signature is clear enough. Inline comments explain a reason or rule the code can’t show — never narrate what the next line does. See [jsdoc.md](references/jsdoc.md).

### Compiler options

TS 6.0 is the baseline: write a tsconfig with no deprecated options and no `ignoreDeprecations`, with `strict`, `types`, and `rootDir` explicit, so it compiles identically on TS 7. Stricter flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) need a yes on an existing repo. Apply the TS 7 differences only when the repo already depends on TS 7. See [compiler-options.md](references/compiler-options.md).

### Common mistakes

| ❌ Incorrect | ✅ Correct |
| --- | --- |
| `any` / `as` / `!` to silence the checker | `unknown` + a guard, or parse at the boundary |
| `continue` in `for` | Matching `if`, or extract + early `return` |
| `export const` + chained `&&` for multi-step | `export function` + early returns |
| Annotate what TypeScript already infers | Omit the noise; document purpose on exports |
| `value === undefined` on an object, array, or token | `!value` — keep `=== undefined` for numbers, booleans, and strings where `''` is valid |
| `user?.name ?? ''` / `items ?? []` on non-optional types | Trust the declared type |
| `value === null \|\| value === undefined` / `null \| undefined` inside | Convert `null` at the boundary; inside, one missing value — `undefined` unless the receiving API gives `null` a meaning |
| `// Check if user exists` above `if (!user)` | No comment — or the reason the code can’t show |
| `.sort()` on a prop or shared array | `toSorted()` (lib ES2023+) |
| `ignoreDeprecations` to silence a deprecation | Replace the deprecated option |

## Practice areas

Read the reference for the task — don’t load every file.

| Area | Reference |
| --- | --- |
| Naming / booleans / constants | [naming.md](references/naming.md) |
| Typing / guards / unions / `satisfies` / `NoInfer` | [typing.md](references/typing.md) |
| Immutability / spread / `toSorted` / `toReversed` / `toSpliced` / `with` | [immutability.md](references/immutability.md) |
| Escape hatches (`as` / `!`) / `@ts-expect-error` | [escape-hatches.md](references/escape-hatches.md) |
| Imports / `import type` / import attributes `with` | [imports.md](references/imports.md) |
| Functions / export vs arrow | [functions.md](references/functions.md) |
| Control flow / early return / missing values / `null` vs `undefined` / `??` / `continue` | [control-flow.md](references/control-flow.md) |
| Async waterfalls / deferred await | [async.md](references/async.md) |
| Noise to skip / inference / spelled-out `undefined` / boolean wrappers / return the expression | [noise-to-skip.md](references/noise-to-skip.md) |
| JSDoc / TSDoc on exports / inline comments | [jsdoc.md](references/jsdoc.md) |
| tsconfig / compiler options / `strict` / deprecations / `erasableSyntaxOnly` / TypeScript 7 | [compiler-options.md](references/compiler-options.md) |
