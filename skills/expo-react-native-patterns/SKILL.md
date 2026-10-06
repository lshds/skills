---
name: expo-react-native-patterns
description: >-
  Expo / React Native UI guidelines for cross-platform web and mobile apps.
  This skill should be used when writing, reviewing, or refactoring Expo or
  React Native code to ensure solid navigation, layout, and native UI
  patterns. Prefer Expo Router and RN primitives over web DOM patterns.
  Triggers on tasks involving Expo Router routes and screens, React Native
  lists, platform splits, on-device storage, device networking, @expo/ui, or
  web→native false friends.
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
- Gating signed-in routes with `Stack.Protected` / `Tabs.Protected` in a layout
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

Read installed versions from `package.json` and the lockfile (plus `app.json` /
`app.config.ts`). Follow the patterns already in the tree; greenfield defaults
apply only where nothing contradicts them. When code lags behind what the
installed version supports, finish the task in the existing style, then
propose the migration once — old → new, why, file count, risk — and wait for a
yes. Never fold it into the current change. In review, report the gap as a
finding instead.

Hard correctness is fixed even in brownfield: routes-only `app/`, no DOM on
native, absolute `EXPO_PUBLIC_*` fetch bases, secrets in SecureStore,
serializable route params, virtualized long lists, no `@react-navigation/*`
imports on SDK 56+. Optional newer APIs (NativeTabs, `@expo/ui` drop-ins,
sqlite localStorage, SF Symbols, Color API, liquid glass,
`experimental_backgroundImage`) are a choice to offer for new surfaces — never
a drive-by.

Version signals:

- `@react-navigation/*` imports in app code → `expo-router` entry points (SDK 56)
- `expo-av` → `expo-video` / `expo-audio`
- `SafeAreaView` from `react-native` → `react-native-safe-area-context`
- per-screen `<Redirect>` auth checks → `Stack.Protected` / `Tabs.Protected` in
  the layout (SDK 53)
- FlashList v1 `estimatedItemSize` → FlashList v2 without size estimates (when
  flash-list 2.x is installed)

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
`router.*` — no second navigator. Pass ids, not large objects. Gate signed-in
routes once with `Stack.Protected` / `Tabs.Protected` in the layout — not a
`<Redirect>` in every screen. See [navigation.md](references/navigation.md).

### Native UI

RN primitives (`View`, `Text`, `Pressable`) — not DOM. Safe area via headers /
`contentInsetAdjustmentBehavior="automatic"`. Prefer `expo-image`,
`expo-audio`/`expo-video`, and the repo’s theme / icon set. `@expo/ui`,
motion, blur, glass, and gradients: load only when the task needs them. See
[ui.md](references/ui.md), [expo-ui.md](references/expo-ui.md),
[effects.md](references/effects.md).

### Lists

Long or dynamic data → `FlashList` from `@shopify/flash-list` (v2, no
`estimatedItemSize`) with a stable `keyExtractor`. `FlatList` when flash-list
isn’t installed (adding it is a new dependency — ask first) or the list is
small and simple. Short fixed content → `ScrollView` / `View` + `map`. See
[lists.md](references/lists.md).

### Platform

Small diffs → `Platform.select` (or `process.env.EXPO_OS` when the repo uses
it). Large divergences → `.ios` / `.android` / `.web` file splits. Android
draws edge to edge — pad headerless screens with safe-area insets. See
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

Web DOM tags, `onClick` / `event.target.value`, CSS layout, and hover-first UX
fail on native — map to RN primitives and thumb-first patterns. See
[false-friends.md](references/false-friends.md).

### Common mistakes

| ❌ Incorrect | ✅ Correct |
| --- | --- |
| DOM tags, `onClick`, `event.target.value` on native | RN primitives (`View`, `Text`, `Pressable`) |
| Co-located helpers inside `app/` (phantom routes) | Routes-only `app/`; UI/helpers in role folders |
| Relative fetch URLs on a native client | Absolute `EXPO_PUBLIC_*` base |
| Secrets in AsyncStorage or prefs | SecureStore for secrets; prefs helper for flags |
| `<Redirect>` auth check in every protected screen | `Stack.Protected guard` in the root layout |

## Practice areas

Read the reference for the task — don’t load every file.

| Area | Reference |
| --- | --- |
| Routes-only `app/` / screens / server | [structure.md](references/structure.md) |
| Expo Router / Link / tabs / modals / sheets / auth gating / `Stack.Protected` | [navigation.md](references/navigation.md) |
| RN UI / safe area / colors / icons / media | [ui.md](references/ui.md) |
| `@expo/ui` Host / universal / drop-ins | [expo-ui.md](references/expo-ui.md) |
| Motion / Reanimated / blur / glass / gradients | [effects.md](references/effects.md) |
| Lists / FlashList v2 / FlatList / keyExtractor | [lists.md](references/lists.md) |
| Platform splits / ios / android / web / edge-to-edge insets | [platform.md](references/platform.md) |
| Prefs / SecureStore / SQLite | [storage.md](references/storage.md) |
| Fetch / env / auth headers | [data.md](references/data.md) |
| Web idioms that break on native | [false-friends.md](references/false-friends.md) |
