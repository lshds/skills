---
name: expo-react-native-patterns
description: >-
  Expo / React Native UI guidelines for cross-platform web and mobile apps.
  This skill should be used when writing, reviewing, or refactoring Expo or
  React Native code to ensure solid navigation, layout, and native UI
  patterns. Prefer Expo Router and RN primitives over web DOM patterns.
  Triggers on tasks involving routes, Expo Router, screens, lists, platform
  splits, storage, device networking, @expo/ui, or web→native false friends.
---

# React Native Skills

Expo / React Native UI for cross-platform web and mobile: project structure,
Expo Router, native UI, lists, platform splits, storage, device networking,
and web→native false friends. Prefer Expo Router and RN primitives over web
DOM patterns.

**Domain:** Expo / React Native app structure, navigation, and native UI for
cross-platform web and mobile.
**Owns:** routes-only `app/`, Expo Router, RN primitives, lists, platform
splits, prefs/SecureStore, device fetch, web→native false friends.
**Does not own:** React hooks, memoization, or RSC; stack-agnostic form UX;
CSS-first web styling; web keyboard/ARIA depth.

## When to activate

- Placing routes, screens, or server `+api` files in an Expo app
- Writing or reviewing Expo Router navigation, tabs, modals, or sheets
- Building cross-platform UI (RN primitives, safe area, colors, icons, media)
- Implementing lists, ios/android/web splits, prefs/SecureStore, or client fetch
- Porting web idioms or reviewing web→native false friends

## Core Concepts

### Write vs review

- Pick one mode from the user ask — don’t mix output shapes
- **Write** (implement, fix, refactor): apply these defaults in the Expo / RN code; no review report unless asked
- **Review**: named scope only; report concrete misses in this skill’s domain
- Skip findings outside that domain

### Match the repo

Detect the project’s stack and stay consistent with it. These patterns are
defaults for greenfield or when the task explicitly adopts them — not a
migration checklist. Prefer consistency over “more native / newer Expo.”
Don’t migrate existing code for a newer pattern. For **new** work, you may
suggest a modern option (e.g. `@expo/ui`, NativeTabs, Reanimated, system blur)
— state it as a choice and let the user decide; don’t apply it silently.

Priority when choosing an approach:

1. **Repo conventions** — existing folders, helpers, icon set, theme, tabs,
   storage wrapper, query lib, styling system. Extend them; don’t replace.
2. **Hard correctness** — routes-only `app/`, no DOM on native, absolute
   `EXPO_PUBLIC_*` fetch bases, secrets in SecureStore, serializable route
   params, virtualized long lists, SDK 56+ no `@react-navigation/*` in app
   code. Fix these even in brownfield.
3. **Task scope** — change only what the request needs. No drive-by upgrades
   (NativeTabs, `@expo/ui` drop-ins, sqlite-localStorage, SF Symbols, Color
   API, liquid glass, `experimental_backgroundImage`).
4. **Greenfield / new UI** — when creating a new app or new surface, suggest
   defaults from this skill; user picks before you adopt them.
5. **Ask before migrating** — if unsure whether a swap is in scope, ask; don’t
   invent a second parallel stack.

### Project structure

`app/` or `src/app/` is **routes only** — every file is a route (no phantom
routes from co-located UI/helpers). Thin routes → `screens/` for new or
touched routes only — no mass extraction in brownfield. Flat role folders
beside routes: `components/`, `configs/`, `services/`, `lib/` / `utils/`,
plus `server/` for `app/api/` `+api` helpers. Greenfield may use `src/` +
`@/*` / `~/*` aliases — don’t reshuffle an existing app to match. See
[structure.md](references/structure.md).

### Navigation

File-based Expo Router. `_layout.tsx` owns stacks/tabs/providers. Nest a Stack
**inside** each tab when adding tabs. Use `NativeTabs` only if the SDK/repo
already does (or greenfield + SDK supports them) — don’t swap JS tabs mid-app.
Prefer Stack `modal` / `formSheet` over custom modals. Navigate with `<Link>` /
`router.*` — no second navigator. Pass ids, not large objects. See
[navigation.md](references/navigation.md).

### Native UI

RN primitives (`View`, `Text`, `Pressable`) — not DOM. Safe area via headers /
`contentInsetAdjustmentBehavior="automatic"`. Prefer `expo-image`,
`expo-audio`/`expo-video`, and the repo’s theme / icon set. `@expo/ui`,
motion, blur, glass, and gradients: load only when the task needs them. See
[ui.md](references/ui.md), [expo-ui.md](references/expo-ui.md),
[effects.md](references/effects.md).

### Lists

Long or dynamic data → FlatList / FlashList with stable `keyExtractor`. Short
fixed content → `ScrollView` / `View` + `map`. See [lists.md](references/lists.md).

### Platform

Small diffs → `Platform.select` (or `process.env.EXPO_OS` when the repo uses
it). Large divergences → `.ios` / `.android` / `.web` file splits. See
[platform.md](references/platform.md).

### Storage

Prefs / flags → the repo’s existing helper first; on greenfield, sqlite
localStorage (or the stack you choose once). Secrets → SecureStore. Large /
relational data → SQLite. Never put lifecycle state in persistence. See
[storage.md](references/storage.md).

### Data

Native clients need absolute `EXPO_PUBLIC_*` bases — no browser origin. Prefer
`fetch` / `expo/fetch` and the repo’s query lib; check `response.ok`; put auth
on headers. See [data.md](references/data.md).

### False friends

Web DOM tags, `onClick` / `e.target.value`, CSS layout, and hover-first UX
fail on native — map to RN primitives and thumb-first patterns. See
[false-friends.md](references/false-friends.md).

### Common mistakes

| ❌ Incorrect | ✅ Correct |
| --- | --- |
| DOM tags, `onClick`, `e.target.value` on native | RN primitives (`View`, `Text`, `Pressable`) |
| Co-located helpers inside `app/` (phantom routes) | Routes-only `app/`; UI/helpers in role folders |
| Relative fetch URLs on a native client | Absolute `EXPO_PUBLIC_*` base |
| Secrets in AsyncStorage or prefs | SecureStore for secrets; prefs helper for flags |

## Practice areas

Read the reference for the task — don’t load every file.

| Area | Reference |
| --- | --- |
| Routes-only `app/` / screens / server | [structure.md](references/structure.md) |
| Expo Router / Link / tabs / modals / sheets | [navigation.md](references/navigation.md) |
| RN UI / safe area / colors / icons / media | [ui.md](references/ui.md) |
| `@expo/ui` Host / universal / drop-ins | [expo-ui.md](references/expo-ui.md) |
| Motion / blur / glass / gradients | [effects.md](references/effects.md) |
| Lists / FlatList / keyExtractor | [lists.md](references/lists.md) |
| Platform splits / ios / android / web | [platform.md](references/platform.md) |
| Prefs / SecureStore / SQLite | [storage.md](references/storage.md) |
| Fetch / env / auth headers | [data.md](references/data.md) |
| Web idioms that break on native | [false-friends.md](references/false-friends.md) |
