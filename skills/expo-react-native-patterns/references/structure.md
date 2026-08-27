# Structure

Prefer routes-only `app/` — every file under `app/` becomes a route, so
co-located helpers/UI create phantom routes. That rule is hard correctness.
Thin routes → `screens/` is convention for **new or touched** routes only —
no mass extraction in brownfield. Keep role folders **flat** under the source
root (`src/` when used). Greenfield may use the skeleton below; never reshuffle
an existing app just to match it.

## Greenfield skeleton

For **new** Expo apps only: keep app code under `src/`, config outside it, and
routes under `src/app/`. Expo also supports top-level `app/` — follow the repo.

```text
├── assets/
├── scripts/
├── src/
│   ├── app/                 # routes ONLY (file-based)
│   │   ├── api/             # +api server routes
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   └── settings.tsx
│   ├── screens/             # routed screen bodies
│   ├── components/          # reusable UI
│   ├── configs/             # app config / env wiring
│   ├── services/            # business logic
│   ├── server/              # server-only helpers for app/api
│   ├── hooks/
│   ├── utils/
│   ├── context/
│   └── types/
├── app.json
├── eas.json
└── package.json
```

- Default template aliases `@/*` and `~/*` → `./src/*`.
- `app.json`, `eas.json`, `package.json`, `assets/`, `scripts/` stay outside `src/`.
- Ask before moving files when unsure whether the project is greenfield.

## Routes-only `app/`

Keep only route and `_layout` files under `app/` / `src/app/` — including
Expo Router specials like `+not-found.tsx`, `index.tsx`, and similar — helpers
and UI belong in sibling role folders.

```tsx
// ❌ Incorrect: component co-located in app/ — becomes an unintended route
// app/profile-card.tsx
export function ProfileCard() {
  return <View />
}

// ✅ Correct: routes only under app/; UI lives in components/ or screens/
// components/ProfileCard.tsx
export function ProfileCard() {
  return <View />
}
```

- Ensure a route matches `/` (may live inside a group).
- Route filenames: Expo conventions (`settings.tsx`, `[id].tsx`); no special
  characters. Component files: PascalCase matching the export (`ProfileCard.tsx`).
- Remove old route files when restructuring navigation.

## Thin routes and screens

For **new or edited** routes: keep the route file thin (params + render a
screen body). Don’t mass-extract untouched fat routes in brownfield. Shared UI
→ `components/`; private pieces under the screen folder. Default-export the
route (Expo Router requires it); named-export the screen body.

```tsx
// ❌ Incorrect: fat route — layout and private UI live in app/
export default function HomeScreen() {
  return (
    <View>
      <HomeHeader />
      <HomeFeed />
    </View>
  )
}

// ✅ Correct: thin route — screen body imported from screens/
import { Home } from '@/screens/Home'

export default function HomeScreen() {
  return <Home />
}
```

- `screens/` — screen bodies that aren’t shared; colocate private pieces
  (`screens/Home/HomeCard.tsx`). Follow the repo’s folder name if it differs
  (`pages/` is fine when that’s what exists).
- `components/` — generic reused UI; one named `export function`; grow into
  folder + `index.tsx`.
- `configs/` — app config / env wiring; `services/` — business logic;
  `lib/` / `utils/` / `helpers/` — cross-cutting only, keep small.
- Large platform divergences → `.ios` / `.android` / `.web` file splits (keep
  shared logic in a base module).

## Server API routes

`+api` files are server-only (secrets via non-`EXPO_PUBLIC_` env). Group under
`app/api/` so paths don’t collide with screens. HTTP helpers for those routes
live in `server/` (or `controllers/` if the repo already uses that name).

```tsx
// ❌ Incorrect: +api beside a screen path — /user screen vs /user API collide
// app/user+api.ts  and  app/user.tsx

// ✅ Correct: API under app/api/; helpers in server/
// app/api/user+api.ts  →  /api/user
// server/auth.ts
```
