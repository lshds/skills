---
name: react-patterns
description: >-
  React UI guidelines for .tsx apps. This skill should be used when writing,
  reviewing, or refactoring React components, hooks, effects, forms, client
  data, or RSC — including janky .tsx forms, page waterfalls, re-render bugs,
  and Server Actions — to ensure valid hooks, cheap renders, and serializable
  Server Action payloads. Prefer function components and the repo’s data/form
  libs. Triggers on
  hooks, effects, Suspense, memoization, error boundaries, or Server Actions.
---

# React Skills

React UI in .tsx: components, hooks, effects, state, data fetching, forms,
composition, rendering, memoization, error boundaries, and RSC / Server
Actions. Prefer function components and the repo’s data/form libs.

**Domain:** React component and rendering patterns in `.tsx` (client and RSC).
**Owns:** function components and props/keys, Rules of Hooks and custom `use*`,
effect sync vs derive-in-render, local UI state / Context+reducer, client data
libraries and shared listeners, controlled form wiring, composition, memo only
when needed, error boundaries, RSC / Server Action cache and serialization,
component control-flow spacing in JSX modules.
**Does not own:** stack-agnostic async/form UX copy, TypeScript language rules
outside component modules, keyboard / ARIA depth, auth-token transport, or
generic Node / non-`.tsx` server handlers.

## When to activate

- Writing new React components, hooks, or screens
- Fixing a janky `.tsx` form, page waterfall, or re-render / effect bug
- Implementing client data fetching (query libs, Suspense, listeners)
- Writing or reviewing RSC / Server Actions (cache, serialization, composition)
- Reviewing React for re-renders, effects, or memoization issues
- Refactoring existing React UI (state, forms, composition, error boundaries)

## Core Concepts

### Write vs review

- Pick one mode from the user ask — don’t mix output shapes
- **Write** (implement, fix, refactor): apply these defaults in the `.tsx`; no review report unless asked
- **Review**: named scope only; report concrete misses in this skill’s domain
- Skip findings outside that domain

### Components

Function components only (`export function`) — no class components except error boundaries when the repo has no shared alternative. Props via `interface`; avoid `React.FC`; type `children` explicitly when used. List `key`s from stable identity (id), not array index, unless the list is static and never reorders. Blank line before guards and before the happy-path `return` / JSX so exits scan cleanly. See [components.md](references/components.md).

### Hooks

Call hooks unconditionally at the top level — never in conditions, loops, or after an early return. Custom hooks start with `use` and encapsulate reusable logic. See [hooks.md](references/hooks.md).

### Effects

`useEffect` syncs external systems — not derived state. Prefer cleanup and real deps; derive in render; put logic in handlers. See [hooks.md](references/hooks.md).

### State

Local UI first; don’t mirror server data unless drafting. Derive / lazy-init / functional updates; Context or store for shared UI. See [state.md](references/state.md).

### Data fetching

Use the repo’s server-state library for remote/cacheable data — don’t hand-roll fetch-in-`useEffect`. Dedupe client reads; Suspense only when the app already uses it. See [client-data.md](references/client-data.md).

### Re-render

No nested component types; derive in render (not props→state effects); side effects in handlers; `startTransition` / `useDeferredValue` for heavy list work; refs for high-frequency pointer/scroll values. See [rerender.md](references/rerender.md).

### Advanced subscriptions

Stable external subscriptions with `useEffectEvent` (or a ref fallback); don’t re-bind on every handler identity. See [advanced.md](references/advanced.md).

### Memoization

Don’t pre-optimize. Add `useMemo` / `useCallback` / `memo` only for proven cost or required referential stability. If the repo uses React Compiler, skip manual memo unless you still need an explicit boundary. See [memoization.md](references/memoization.md).

### Rendering

Ternary / explicit boolean over `&&` with numbers so `0` never leaks into the tree. See [rendering.md](references/rendering.md).

### Forms

React implementation: controlled inputs or the repo’s form lib; `isPending` / error state on submit. See [forms.md](references/forms.md).

### Composition

`children` / compound components over boolean prop matrices. See [composition.md](references/composition.md).

### Error boundaries

Route/feature islands with safe fallback; not for event/async errors. See [error-boundaries.md](references/error-boundaries.md).

### Server (RSC / Actions)

No request data in module scope; parallel fetch via composition; lean RSC props; `React.cache()`; runtime `after()` (e.g. Next) for non-blocking side effects. See [server.md](references/server.md).

### Common mistakes

| ❌ Incorrect | ✅ Correct |
| --- | --- |
| Fetch remote data in `useEffect` + local state | Repo data library (`useQuery` / SWR / loaders) |
| Sync derived values with state + effect | Derive during render; remount with `key` to reset ([rerender.md](references/rerender.md)) |
| Nested component type / props→state reset effect | Module-scope child + `key` remount ([rerender.md](references/rerender.md)) |
| Double-submit or wipe field on failed save | `isPending` guard; keep values on recoverable failure |
| Await sibling data in one RSC parent | Sibling async components so fetches start together |

## Practice areas

Read the reference for the task — don’t load every file.

| Area | Reference |
| --- | --- |
| Components / props / keys / files | [components.md](references/components.md) |
| Hooks / custom `use*` / effect cleanup & deps | [hooks.md](references/hooks.md) |
| Remounts / laggy input / derive-vs-effect / transitions | [rerender.md](references/rerender.md) |
| Stable subscriptions / `useEffectEvent` / init-once | [advanced.md](references/advanced.md) |
| Local UI / Context+reducer / shared state | [state.md](references/state.md) |
| Client data / Suspense / shared listeners | [client-data.md](references/client-data.md) |
| Memo / `useMemo` / `useCallback` / stable defaults | [memoization.md](references/memoization.md) |
| Conditional render (`&&` vs ternary) | [rendering.md](references/rendering.md) |
| Forms / controlled submit / `isPending` | [forms.md](references/forms.md) |
| Composition / children / compound components | [composition.md](references/composition.md) |
| Error boundaries / feature islands / fallback | [error-boundaries.md](references/error-boundaries.md) |
| RSC / Server Actions / cache / serialization | [server.md](references/server.md) |
