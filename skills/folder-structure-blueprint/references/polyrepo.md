# Polyrepo

Prefer a single-package tree of flat role folders under `src/*` over
workspace-style roots, so placement stays inside one package and matches the
observed tree.

## Document the observed tree

Document the roots that exist. Don’t invent workspace folders this package
doesn’t have.

One root package/module manifest and its lockfile when the stack uses one.
ASCII tree to depth 3. Exclude generated or vendor trees
(`node_modules/`, `target/`, `dist/`, `coverage/`, `.git/`, and generated
`android/` / `ios/` unless custom native is committed). Mirror real role
folders — document the repo’s names as-is (`hooks/`, `screens/`,
`components/`, `services/`). Include `app/`, `controllers/`, or `routers/` when
present.

```text
// ❌ Incorrect: workspace-style roots without workspace config
repo/
├── apps/
├── packages/
└── package.json

// ✅ Correct: document the role folders that exist (Node example)
repo/
├── src/
│   ├── components/
│   ├── screens/
│   ├── hooks/
│   ├── services/
│   ├── lib/
│   └── app/
├── package.json
└── tsconfig.json

// ✅ Correct: same role layout with a Go module manifest
repo/
├── src/
│   ├── components/
│   ├── screens/
│   ├── services/
│   └── lib/
└── go.mod

// ✅ Correct: same role layout with a Cargo package manifest
repo/
├── src/
│   ├── components/
│   ├── screens/
│   ├── services/
│   └── lib/
└── Cargo.toml
```

- Role folders live under `src/*` (not nested under `src/app/`).
- A routes directory named `app/` stays when the framework requires it.
- Match the repo’s names (`utils/` vs `lib/`, `pages/` vs `screens/`,
  `routes/` vs `routers/`).
- Document `controllers/` / `routers/` when that package owns HTTP.

## Greenfield defaults

Use defaults only when there is **no** usable `src/*` role layout yet (a
messy-but-real tree still counts as observed). Default to a few flat role
folders under `src/` for what the app needs. Add router or HTTP folders when
the stack needs them.

```text
// ❌ Incorrect: invent workspace roots inside a single package
repo/
├── apps/
├── packages/
├── package.json
└── tsconfig.json

// ✅ Correct: flat role folders under src/ (manifest matches the stack)
repo/
├── src/
│   ├── components/
│   ├── configs/
│   ├── screens/
│   ├── services/
│   └── lib/
├── package.json
└── tsconfig.json
```

## Key directories

Put code in the role folder that matches its job. Keep `lib/` / `utils/` /
`helpers/` small — only true cross-cutting code.

```text
// ❌ Incorrect: domain UI and hooks dumped into lib/; unused HTTP folders
src/lib/OrderCard.tsx
src/lib/useOrders.ts
src/controllers/
src/routers/

// ✅ Correct: flat role folders; lib stays cross-cutting
src/components/OrderCard.tsx
src/hooks/useOrders.ts
src/services/orders.ts
src/configs/env.ts
src/lib/errors.ts
```

- `src/*` — application source; flat role folders.
- `app/` — file-based framework routes when the framework requires that name.
- `pages/` / `screens/` — screen bodies when used.
- `layout/` — app chrome when present.
- `components/` — reusable UI; `hooks/` — shared hooks when present.
- `configs/` — app config / env wiring.
- `controllers/` / `routers/` / `routes/` — when HTTP lives in this package.
- `services/` — business logic when the repo uses that name.
- `lib/` / `utils/` / `helpers/` — cross-cutting utilities.
- Root — one package/module manifest, language config, lint/format, env as
  present.

## File placement and naming

Match this repo’s routing and alias conventions. Use whatever module paths or
aliases the stack already defines (for example `tsconfig` paths, Go module
path).

```text
// ❌ Incorrect: workspace package alias; unused layer folders; invented HTTP
import { x } from '@repo/utils'
src/domain/orders/OrderCard.tsx
src/application/orders/useOrders.ts
src/controllers/OrderCard.tsx

// ✅ Correct: local alias; observed role folders
import { x } from '@/lib/errors'
import { y } from '~/utils/format'
src/components/OrderCard.tsx
src/hooks/useOrders.ts
src/services/orders.ts
```

- File-based routes → `app/`; screen bodies → `pages/` / `screens/` as the
  repo uses.
- UI → `components/`; chrome → `layout/`; config → `configs/`; logic →
  `services/` (or the repo’s equivalent).
- HTTP handlers / route wiring → `controllers/` + `routers/` when present.
- Cross-cutting helpers → `lib/` / `utils/` / `helpers/` when reused.
- CLI helpers → package `bin` field or existing scripts.
- Tests: colocated / `__tests__` / `*.test.ts(x)` / `*.spec.ts(x)`.

## Where to add new code

Add inside this package’s tree, in the matching observed role folder.

```text
// ❌ Incorrect: fake workspace roots; dump UI into lib/
apps/
packages/utils/
src/lib/InvoiceList.tsx

// ✅ Correct: new files in the matching observed role folder
src/components/InvoiceList.tsx
src/hooks/useInvoices.ts
src/services/invoices.ts
src/configs/invoices.ts
src/lib/formatMoney.ts
```

- New screen / route → `app/` and/or `pages/` / `screens/` as the repo uses.
- New UI → `components/`; chrome → `layout/`; config → `configs/`.
- New endpoint → `controllers/` + `routers/` when this package owns HTTP;
  otherwise keep API in its own service/repo.
- Shared helper → `lib/` / `utils/` / `helpers/` (or publish for other repos).
- Tests and config → next to the code / at the single root.

## Common mistakes

Stay in one package with observed role folders and local aliases. Add HTTP
folders only when this package owns HTTP.

```text
// ❌ Incorrect: workspace folders without config; invented HTTP; wrong aliases
packages/utils/
src/controllers/OrderCard.tsx
src/domain/orders/model.ts
import { x } from '@repo/utils'

// ✅ Correct: observed role folders; thin lib; local @/ or ~/
src/components/OrderCard.tsx
src/services/orders.ts
src/lib/errors.ts
import { x } from '@/lib/errors'
import { y } from '~/utils/format'
```
