# Project Structure

Prefer the observed Angular tree over flattening `src/app/` into `src/pages/`.
On greenfield, use flat role folders under `src/`. Apply the heading that
matches the folder you’re placing — not every section.

## Observed tree vs greenfield

Rewriting `src/app/` is a silent migration. New files go next to existing
siblings, using the names the repo already uses. If the tree or folder names
are unclear, ask the user before inventing a layout — don’t guess.

```text
# ❌ Incorrect: UI outside src / flatten an existing src/app/ tree
app/main.ts
lib/components/...
src/pages/film-calendar/     # when src/app/ already holds the UI

# ✅ Correct: keep the observed root
src/main.ts
src/app/                     # CLI / existing app — put new files here

# ✅ Correct: greenfield only — no existing UI tree
src/main.ts
src/pages/
src/components/
```

Paths in the sections below are the greenfield default (`src/pages/`,
`src/components/`, `src/layout/`, `src/configs/`, `src/services/`,
`src/utils/`). If the repo already uses `src/app/`, `screens/`, `shared/`, or
`core/`, substitute that root and those names — don’t invent a parallel tree.

## Flat layout

On greenfield, prefer role folders over feature trees. Keep top-level folders
under `src/` flat — easier to scan than nested domain paths. Don’t flatten an
existing `src/app/` or feature tree to match this picture.

```text
# ❌ Incorrect: deep nested feature trees on greenfield
src/movie-reel/show-times/film-calendar/
src/reserve-tickets/payment-info/

# ✅ Correct: greenfield — flat role folders under src/*
src/
├─ pages/
├─ components/
├─ layout/
├─ configs/
├─ services/
└─ utils/          # or lib/ / helpers/ — match the repo
```

## Colocation

A component’s `.ts`, template, styles, and `.spec.ts` live in the same folder.
Skip a big `tests/` pile — one folder has everything you need.

```text
# ❌ Incorrect: split assets / collected tests
src/templates/film-calendar.html
src/styles/film-calendar.css
src/tests/film-calendar.spec.ts

# ✅ Correct: same directory, shared base name
src/pages/film-calendar/film-calendar.ts
src/pages/film-calendar/film-calendar.html
src/pages/film-calendar/film-calendar.css
src/pages/film-calendar/film-calendar.spec.ts
```

## Pages

Routed screens go in the observed screen folder — `src/pages/` on greenfield,
or under `src/app/` / `screens/` when that’s the tree. One folder per page,
flat among siblings.

```text
# ❌ Incorrect: pages scattered / deeply nested
src/film-calendar/
src/show-times/film-calendar/film-calendar.ts

# ✅ Correct: flat under pages/
src/pages/film-calendar/
src/pages/payment-info/
src/pages/login/
```

## Components

Reusable UI (not a full route) goes in `src/components/`. Keep it flat — one
folder per component.

```text
# ❌ Incorrect: shared UI mixed into pages or deep nests
src/pages/film-calendar/ticket-badge.ts
src/components/booking/tickets/ticket-badge/

# ✅ Correct: flat under components/
src/components/ticket-badge/
src/components/date-picker/
```

## Layout

App chrome — main layout, nav, root outlet — lives in `src/layout/`.

```text
# ❌ Incorrect: chrome mixed into pages or components
src/pages/main-layout.ts
src/components/main-nav.ts

# ✅ Correct: layout folder
src/layout/
  main-layout.ts
  main-layout.html
  main-layout.css
  main-nav.ts
```

## Configs

App config / env wiring lives in `src/configs/`.

```text
# ❌ Incorrect: config dumped into utils or a page folder
src/utils/env.ts
src/pages/film-calendar/env.ts

# ✅ Correct: flat under configs/
src/configs/env.ts
src/configs/api.ts
```

## Services

Injectables go in `src/services/`. One service (or small related set) per file.
Where the file lives ≠ how you provide it (`root` vs route/component).

```text
# ❌ Incorrect: services buried under a page tree
src/pages/film-calendar/film-calendar-api.ts

# ✅ Correct: flat under services/
src/services/film-calendar-api.ts
src/services/auth.ts
```

## Utils / lib

Pure helpers in `src/utils/` (or `lib/` / `helpers/` if the repo uses those).
Name files after what they do — no `helpers.ts` / `common.ts` grab-bags. Keep
this folder small — only true cross-cutting code.

```text
# ❌ Incorrect: vague dump files / domain logic in utils
src/utils/helpers.ts
src/utils/common.ts
src/utils/film-calendar-api.ts

# ✅ Correct: named by concept; domain logic in services/
src/utils/format-show-time.ts
src/utils/money.ts
src/services/film-calendar-api.ts
```

## One concept per file

One component, directive, or service per file is the default. Small related
classes can share a file if they’re really one idea. Unsure? Prefer smaller
files — easier to open and review.

```text
# ❌ Incorrect: unrelated types crammed into one file
src/services/misc.ts   # AuthService, formatDate, and TicketBadge together

# ✅ Correct: one primary concept per file
src/services/auth.ts
src/utils/format-date.ts
src/components/ticket-badge/
```
