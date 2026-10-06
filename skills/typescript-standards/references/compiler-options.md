# Compiler Options

Prefer a TypeScript 6.0 tsconfig with no deprecated options and no
`ignoreDeprecations` over one that silences warnings, so the same config
compiles identically on TypeScript 7. TS 6.0 is the house baseline. Follow the
repo's existing tsconfig; these defaults apply to new configs and to options
you are asked to change. The last section applies only when the repo already
depends on TypeScript 7.

## Config that compiles identically on TS 7

TS 7 has the same type system as 6.0, so a config that builds cleanly on 6.0 with `stableTypeOrdering` and without `ignoreDeprecations` builds the same on 7. Deprecated options and implicit defaults are what break on the move.

```json
// ❌ Incorrect: baseUrl, node resolution, and esModuleInterop off are deprecated in 6 and hard errors in 7 — ignoreDeprecations only hides them
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": false,
    "baseUrl": "./src",
    "paths": {
      "~/*": ["*"]
    },
    "ignoreDeprecations": "6.0"
  },
  "include": ["src"]
}

// ✅ Correct: no deprecated options; defaults that differ in 7 are stated explicitly
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2023",
    "module": "esnext",
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,
    "noUncheckedSideEffectImports": true,
    "stableTypeOrdering": true,
    "types": ["node"],
    "rootDir": "./src",
    "outDir": "./dist",
    "paths": {
      "~/*": ["./src/*"]
    },
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- `moduleResolution: "bundler"` with `module: "esnext"` for code a bundler builds; `"nodenext"` for both in Node libraries and code Node runs directly.
- `paths` entries start with `./` and resolve from the tsconfig's folder — no `baseUrl`.
- `verbatimModuleSyntax` keeps imports as written, so a type imported without `import type` is a compile error instead of a runtime import.
- `noUncheckedSideEffectImports` reports side-effect imports (`import './polyfills'`) that don't resolve.
- `stableTypeOrdering` orders types the way 7 does (7 can't turn it off).

## Fix deprecations instead of silencing them

TS 6.0 reports each deprecated option as an error that `"ignoreDeprecations": "6.0"` can silence; TS 7 rejects the option outright. Silencing doesn't fix anything — it postpones the break to the day the compiler changes.

```json
// ❌ Incorrect: the deprecation is silenced, not fixed — the same config fails on TS 7
{
  "compilerOptions": {
    "moduleResolution": "node",
    "ignoreDeprecations": "6.0"
  }
}

// ✅ Correct: the deprecated option is replaced — nothing left to silence
{
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler"
  }
}
```

- `baseUrl` → remove it and write `paths` relative to the tsconfig (`"./src/*"`); bare imports that relied on `baseUrl` need a `paths` entry.
- `moduleResolution: "node"` / `"node10"` / `"classic"` → `"bundler"` or `"nodenext"`.
- `module: "amd"` / `"umd"` / `"systemjs"` / `"none"` → `"esnext"` or `"nodenext"`.
- `target: "es5"` and `downlevelIteration` → a modern `target` (ES2023 or later).
- `esModuleInterop: false` / `allowSyntheticDefaultImports: false` / `alwaysStrict: false` → remove the option.
- `module Billing { }` namespace keyword → `namespace Billing { }`; import `assert { type: 'json' }` → `with { type: 'json' }`.
- File paths passed to `tsc` while a tsconfig.json exists → run `tsc` against the config, or add `--ignoreConfig` when the paths are intended.
- When a fix touches many files (every bare import that relied on `baseUrl`), finish the current task first and propose the fix as its own change.

## Explicit `types` and `rootDir`

TS 7 defaults `types` to `[]` and `rootDir` to `./`. A config that leans on the old defaults silently changes meaning: globals from `@types` packages (`process`, `Buffer`) disappear, and emitted files move from `dist/index.js` to `dist/src/index.js`.

```json
// ❌ Incorrect: implicit @types globals and an inferred rootDir — on TS 7 `process` is unknown and output lands in dist/src/
{
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src"]
}

// ✅ Correct: globals and output root are stated — same result on 6 and 7
{
  "compilerOptions": {
    "types": ["node"],
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

- List every `@types` package whose globals the code uses. A separate test tsconfig adds the test runner's global types there, not in the app config.
- `"types": ["*"]` restores the old include-everything behavior — prefer the explicit list so a transitive `@types` package can't leak globals.

## `erasableSyntaxOnly` for type-stripped code

Node type stripping and other erase-only tools delete type syntax without transforming code. `enum`, parameter properties, namespaces with runtime code, and `import x = require()` need generated JavaScript, so they fail there. Turn on `erasableSyntaxOnly` when code runs through type stripping or should stay erasable, so `tsc` reports them first.

```typescript
import type { OrderRepository } from '~/repositories/order-repository'

// ❌ Incorrect: enum and a parameter property emit runtime code — type stripping can't erase them
enum OrderStatus {
  Pending = 'pending',
  Shipped = 'shipped',
}

class OrderService {
  constructor(private readonly orderRepository: OrderRepository) {}

  async markShipped(orderId: string) {
    await this.orderRepository.updateStatus(orderId, OrderStatus.Shipped)
  }
}

// ✅ Correct: as const object + derived union; the field is declared and assigned explicitly
const ORDER_STATUSES = {
  pending: 'pending',
  shipped: 'shipped',
} as const

type OrderStatus = (typeof ORDER_STATUSES)[keyof typeof ORDER_STATUSES]

class OrderService {
  private readonly orderRepository: OrderRepository

  constructor(orderRepository: OrderRepository) {
    this.orderRepository = orderRepository
  }

  async markShipped(orderId: string) {
    await this.orderRepository.updateStatus(orderId, ORDER_STATUSES.shipped)
  }
}
```

- Pair it with `verbatimModuleSyntax` so type-only imports are marked `import type` and stripping removes them cleanly.

## Stricter flags are opt-in

`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` catch real bugs, but turning either on in an existing tree surfaces many errors at once, in files unrelated to the task.

```json
// ✅ Correct: greenfield — stricter flags on from the first commit
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

- `noUncheckedIndexedAccess` types index reads (`scores[0]`, `pricesBySku[sku]`) as `T | undefined`, so a missing element is handled before use.
- `exactOptionalPropertyTypes` stops `nickname?: string` from accepting an explicit `undefined`; write `nickname?: string | undefined` where callers pass `undefined` on purpose.
- Turn them on for greenfield configs or when asked. On an existing repo, ask first and land the flag as its own change with the error count.

## TypeScript 7 differences

Apply this section only when `package.json` already has `typescript@^7` or an alias to it (such as `"@typescript/native": "npm:typescript@^7.0.2"`). On a 6.0 repo, keep the baseline above. Moving a repo from 6 to 7 is a version change: never do it unasked and don't attach it to unrelated work — propose it when the user raises TypeScript 7 or upgrading.

- **New defaults:** `strict: true`, `module: esnext`, `target` = latest stable ES, `noUncheckedSideEffectImports: true`, `libReplacement: false`, `stableTypeOrdering: true` (can't be disabled), `rootDir: ./`, `types: []`. Set them explicitly when the repo relied on the old values.
- **Hard errors (deprecated in 6):** `target: es5`, `downlevelIteration`, `moduleResolution: node` / `node10` / `classic`, `module: amd` / `umd` / `systemjs` / `none`, `baseUrl`, `esModuleInterop: false`, `allowSyntheticDefaultImports: false`, `alwaysStrict: false`, the `module` keyword for namespaces, import `assert { }`, and file paths passed to `tsc` while a tsconfig.json exists (needs `--ignoreConfig`). `ignoreDeprecations` can't silence them.
- **JSDoc in `checkJs` repos:** no `@enum` special-casing, no Closure function syntax (`function(string): number`), no postfix `!` in JSDoc types, `@typedef` must name the type inside the tag, and values can't be used as types — write `typeof`.
- **CLI:** `--checkers <n>` sets parallel type-check workers (default 4), `--builders <n>` sets parallel project builds with `--build`, `--singleThreaded` runs on one thread.
- **Binary:** the 7.0 compiler is `tsc`; `tsgo` was only the preview name, so scripts and CI keep calling `tsc`.
- **Template literal inference** splits strings by Unicode code point, so types that peel characters off emoji or other astral-plane text infer differently than on 6.

```typescript
type HeadTail<Text extends string> = Text extends `${infer Head}${infer Tail}`
  ? [Head, Tail]
  : never

// TS 7: ['😀', 'abc'] — the emoji stays one character
type EmojiHeadTail = HeadTail<'😀abc'>
```

TS 7.0 has no programmatic API (it arrives in 7.1). Tools that import `typescript` — typescript-eslint (8.x doesn't support 7), ts-morph, TypeDoc, ts-patch, Angular template type-checking, Vue/Volar, Svelte, Astro, MDX — need 6.0 installed side by side. `typescript` then resolves to 6.0 (the `tsc6` binary and the 6.0 API) and `@typescript/native` provides the 7.0 `tsc`:

```json
{
  "devDependencies": {
    "typescript": "npm:@typescript/typescript6@^6.0.2",
    "@typescript/native": "npm:typescript@^7.0.2"
  }
}
```
