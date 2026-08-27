# Monorepo

Prefer workspace layout by client deployable vs library vs backend
(`apps/` / `packages/` / `api/`) over mixing HTTP into `apps/` or inventing
roots the repo does not use, so placement and blueprints match the real tree.

## Document the observed tree

Document by **workspace package**. Mirror the roots that exist — include
`api/`, `bin/`, `services/`, or `tools/` when they are present — and keep
folder names as the repo uses them (`hooks/`, `screens/`, `components/`,
`services/`). Don’t rewrite the tree to a template.

```text
// ❌ Incorrect: rewrite the tree to a template and drop real workspace roots
repo/
├── apps/
│   └── webapp/
└── packages/
    └── ui/

// ✅ Correct: document the roots that exist (Node workspace example)
repo/
├── apps/
│   ├── webapp/
│   └── mobileapp/
├── api/
├── packages/
│   ├── ui/
│   └── config/
├── bin/
├── package.json
├── turbo.json
└── pnpm-workspace.yaml

// ✅ Correct: same roots with a Go workspace marker
repo/
├── apps/
│   └── webapp/
├── api/
├── packages/
│   └── shared/
├── go.work
└── go.mod

// ✅ Correct: same roots with a Cargo workspace marker
repo/
├── apps/
│   └── webapp/
├── api/
├── packages/
│   └── shared/
└── Cargo.toml
```

## Greenfield defaults

Use defaults only when there are **no** usable workspace roots yet (a
messy-but-real tree still counts as observed). Default to `apps/` +
`packages/`, plus top-level `api/` when the product has an HTTP backend.
Inside each package use flat role folders under `src/*` for the folders the
app needs.

```text
// ❌ Incorrect: put the HTTP API under apps/ on a new layout
repo/
├── apps/
│   ├── webapp/
│   └── api/
├── packages/
│   └── ui/
├── package.json
└── pnpm-workspace.yaml

// ✅ Correct: clients in apps/; HTTP/backend in top-level api/
repo/
├── apps/
│   └── webapp/
├── api/
├── packages/
│   └── ui/
├── package.json
└── pnpm-workspace.yaml
```

## Key directories

Deployable units go under a deployable root; shared libraries go under
`packages/*`. One purpose per package. HTTP/backend belongs in `api/`.

```text
// ❌ Incorrect: shared utils left under an app; mega-shared package; API under apps/
apps/webapp/shared/utils.ts
apps/api/
packages/shared/

// ✅ Correct: clients in apps/; HTTP in api/; focused packages
apps/webapp/
apps/mobileapp/
api/
packages/ui/
packages/types/
packages/typescript-config/
```

- `apps/*` — client deployables (web, mobile, CLI).
- `packages/*` — shared libraries and config packages.
- `api/` — HTTP/backend. If the repo already uses another backend root, place
  against that observed root; for new layout or greenfield, use top-level `api/`.
- `bin/` — committed CLI/scripts entrypoints when present.
- Shared code across apps → `packages/*`.
- Each workspace package has one package/module manifest at its root. Folder
  groups are fine (`packages/config/eslint/`, `packages/config/typescript/`)
  when each leaf owns its own manifest and is listed as a workspace.
- Deps where used; root manifest = task runner / hooks / repo tooling.

## File placement and naming

Match this repo’s names and aliases. Namespace internal packages
(`@repo/*` / `@org/*`); local `@/` or `~/` inside an app is fine. Apps import
shared code from `packages/*`, not from other apps.

```text
// ❌ Incorrect: app imports another app; unnamespaced internal package
apps/webapp → import from apps/mobileapp
packages/ui/package.json  { "name": "ui" }

// ✅ Correct: extract shared surface; namespace internals
packages/ui/package.json  { "name": "@repo/ui" }
apps/webapp → import from @repo/ui
apps/mobileapp → import from @repo/ui
```

- `apps/*` hold separate client deployables — e.g. `webapp/`, `mobileapp/`.
- Inside each app: flat role folders under `src/*` (match repo names).
- API handlers → `api/` (or the observed backend root).
- CLI helpers → `bin/` or the package’s `bin` field when the repo uses that.
- Tests: colocated / `__tests__` / `*.test.ts(x)` / `*.spec.ts(x)`.
- Config: per-package manifest + language config; root task runner, lint/format,
  env as present.

## Where to add new code

Put new work in the package that owns the concern. Extract to `packages/*`
when a second app needs the same code. Prefer flat role folders under `src/*`.

```text
// ❌ Incorrect: deep nests under an app; duplicate helpers across apps
apps/webapp/src/settings/pages/detail/SettingsPage.tsx
apps/webapp/lib/formatDate.ts
apps/mobileapp/lib/formatDate.ts

// ✅ Correct: flat role folders; shared helper in packages/*
apps/webapp/src/pages/settings/SettingsPage.tsx
apps/webapp/src/components/settings-panel/SettingsPanel.tsx
apps/webapp/src/services/settings.ts
apps/mobileapp/src/screens/SettingsScreen.tsx
apps/mobileapp/src/components/SettingsForm.tsx
api/src/controllers/settingsController.ts
packages/utils/src/formatDate.ts
```

- New code → flat role folder under `src/*` in the owning app (match that
  app’s names — `hooks/`, `screens/`, `components/`, `services/` as present).
- Shared library → existing or new `packages/*` (one purpose).
- API / backend → `api/`; CLI → `bin/` when that root exists.
- Tests and config changes → same package as the code they cover.

## Common mistakes

Keep clients, libraries, and HTTP separate. Place against the observed tree;
use top-level `api/` for backend on new layout.

```text
// ❌ Incorrect: API under apps/; shared under an app; app→app import; nested packages
apps/api/
apps/webapp/shared/utils.ts
apps/webapp → import from apps/mobileapp
packages/ui/internal/helpers/package.json
# all dependencies only in root package.json

// ✅ Correct: api/ for backend; extract to packages/*; deps where used
api/
packages/utils/src/formatDate.ts
apps/webapp → import from @repo/utils
packages/config/eslint/
packages/config/typescript/
# install in the package that imports the dependency
```
