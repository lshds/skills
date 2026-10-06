---
name: react-patterns
description: >-
  React UI guidelines for .tsx apps. This skill should be used when writing,
  reviewing, or refactoring React components, hooks, effects, forms, client
  data, or RSC — page waterfalls, re-render bugs, client form wiring — to
  ensure valid hooks, cheap renders, and serializable RSC props. Prefer
  function components, React Compiler, and the repo’s data/form libs over
  hand-written memo and fetch-in-effect. Triggers on hooks, effects, Suspense,
  Activity, useEffectEvent, useActionState, or error boundaries.
---

# React Skills

React UI in .tsx: components, hooks, effects, state, data fetching, forms,
composition, rendering, memoization, error boundaries, and RSC. Prefer
function components, React Compiler for memoization, and the repo’s data/form
libs.

**Domain:** React component and rendering patterns in `.tsx` (client and RSC).
**Owns:** function components and props/keys/refs, Rules of Hooks and custom
`use*`, effect sync vs derive-in-render and Effect Events, local UI state /
Context+reducer, `Activity`, client data libraries / `use()` / shared
listeners, client form wiring (`useActionState`, `<form action>`,
`useFormStatus`, `useOptimistic`), composition, React Compiler vs manual memo,
error boundaries, RSC composition and serialization, `React.cache()`,
component control-flow spacing in JSX modules.
**Does not own:** stack-agnostic async/form UX copy, TypeScript language rules
outside component modules, keyboard / ARIA depth, auth-token transport,
generic Node / non-`.tsx` server handlers, framework routing files,
authorization and session checks inside server actions, or framework cache
directives and revalidation.

## When to activate

- Writing new React components, hooks, or screens
- Fixing a `.tsx` form, page waterfall, or re-render / effect bug
- Implementing client data fetching (query libs, Suspense, `use()`, listeners)
- Wiring a form to an Action (`useActionState`, `useFormStatus`, `useOptimistic`)
- Writing or reviewing RSC composition, serialization, or `React.cache()`
- Reviewing React for re-renders, effects, memoization, or React Compiler fit
- Refactoring existing React UI (state, forms, composition, error boundaries)

## Core Concepts

### Write vs review

- Pick one mode from the user ask — don’t mix output shapes
- **Write** (implement, fix, refactor): apply these defaults in the `.tsx`; no review report unless asked
- **Review**: named scope only; report concrete misses in this skill’s domain
- Skip findings outside that domain

### Match the repo

Read installed versions from `package.json` and the lockfile (plus the bundler or framework config where React Compiler is enabled). Follow the patterns already in the tree; greenfield defaults apply only where nothing contradicts them. When code lags behind what the installed version supports, finish the task in the existing style, then propose the migration once — old → new, why, file count, risk — and wait for a yes. Never fold it into the current change. In review, report the gap as a finding instead.

On React 18, keep `forwardRef` and `.Provider` — there `<ThemeContext>` renders a consumer, not a provider. Enabling React Compiler in a repo that lacks it adds a dependency and config — follow the repo; never propose it as a migration.

Version signals:

- `forwardRef<HTMLInputElement, InputProps>` → `ref` as a regular prop (19)
- `<ThemeContext.Provider value={theme}>` → `<ThemeContext value={theme}>` (19)
- `useFormState` from `react-dom` → `useActionState` from `react` (19)
- `propTypes` / `defaultProps` on function components → TypeScript props + default parameters (19 removed both for function components)
- latest-value ref read inside an Effect (`onTickRef.current()`) → `useEffectEvent` (19.2)
- hand-written `useMemo` / `useCallback` / `memo` when React Compiler is already configured → remove where the compiler covers it (Compiler 1.0)

### Components

`export function` and a props `interface` — type `children` explicitly when used; no `React.FC`; no classes except error boundaries when the repo has no shared alternative. No `defaultProps` / `propTypes` on function components, string refs, or `ReactDOM.render` (`createRoot`). `key` from a stable id, not the index, unless the list is static and never reorders; `{ tone = 'info' }` in the signature and `onDismiss?.()` instead of an `=== undefined` check in the body; `return null`, not a bare `return`; `onClick={handleSave}` unless the handler needs more than the event; ref callbacks return a cleanup instead of handling `null`. `<title>` / `<meta>` only when the framework doesn’t own metadata. Blank line before guards and the happy-path `return` / JSX so exits scan cleanly. See [components.md](references/components.md).

### Hooks

Call hooks unconditionally at the top level — never in conditions, loops, or after an early return. Custom hooks start with `use` and encapsulate reusable logic. See [hooks.md](references/hooks.md).

### Effects

`useEffect` syncs external systems — not derived state. Prefer cleanup and real deps; derive in render; put logic in handlers. See [hooks.md](references/hooks.md).

### State

Local UI first; don’t mirror server data unless drafting. Derive / lazy-init / functional updates; Context or store for shared UI. See [state.md](references/state.md).

### Data fetching

Use the repo’s server-state library for remote/cacheable data — don’t hand-roll fetch-in-`useEffect`. Dedupe client reads. When the app already uses Suspense, `use()` reads a promise created outside render (passed from a Server Component or a cache) inside `<Suspense>` — never a promise created in the same render. See [client-data.md](references/client-data.md).

### Re-render

No nested component types; derive in render (not props→state effects); side effects in handlers; `startTransition` / `useDeferredValue` for heavy list work; refs for high-frequency pointer/scroll values. Hide tab panels and drawers with `<Activity mode>` when their state should survive hiding, instead of unmounting them. See [rerender.md](references/rerender.md).

### Advanced subscriptions

Stable external subscriptions with `useEffectEvent`; a latest-value ref on older React. Don’t re-bind on every handler identity. Effect Events live in the same component/hook as their Effect, are called only from inside Effects, and never go in deps. See [advanced.md](references/advanced.md).

### Memoization

With React Compiler on (eslint-plugin-react-hooks `recommended`), don’t hand-write `memo` / `useMemo` / `useCallback`. Manual memo is an escape hatch: a measured hot spot the compiler doesn’t cover, or an explicit referential-stability contract with a non-React consumer. `'use no memo'` opts one component out while debugging. Without React Compiler: don’t pre-optimize; memoize only for measured cost or required referential stability. See [memoization.md](references/memoization.md).

### Rendering

Ternary / explicit boolean over `&&` with numbers so `0` never leaks into the tree. Optional lists: `items?.length ? <ItemList items={items} /> : null`, not an undefined check plus a length comparison. See [rendering.md](references/rendering.md).

### Forms

React implementation: controlled inputs or the repo’s form lib; `isPending` / error state on submit. Forms that post to a Server Action use `useActionState` + `<form action>` — not hand-rolled pending state or the deprecated `useFormState`. `useFormStatus` runs in a child rendered inside the `<form>`; `useOptimistic` shows the expected result while the Action runs. See [forms.md](references/forms.md).

### Composition

`children` / compound components over boolean prop matrices. See [composition.md](references/composition.md).

### Error boundaries

Route/feature islands with safe fallback; not for event/async errors. See [error-boundaries.md](references/error-boundaries.md).

### Server (RSC)

No request data in module scope; sibling async components so fetches start together, with `<Suspense>` around the slow part so the shell streams; lean RSC props; `React.cache()` for per-request dedupe. Defer non-blocking side effects with the host framework’s post-response API — never await them on the render path. See [server.md](references/server.md).

### Common mistakes

| ❌ Incorrect | ✅ Correct |
| --- | --- |
| Fetch remote data in `useEffect` + local state | Repo data library (`useQuery` / SWR / loaders) |
| Sync derived values with state + effect | Derive during render; remount with `key` to reset ([rerender.md](references/rerender.md)) |
| Nested component type / props→state reset effect | Module-scope child + `key` remount ([rerender.md](references/rerender.md)) |
| `{activeTab === 'notes' && <NotesPanel />}` loses the draft on tab switch | `<Activity mode={activeTab === 'notes' ? 'visible' : 'hidden'}>` keeps its state |
| Hand-written `useMemo` / `useCallback` / `memo` with React Compiler on | Plain code; manual memo only for a measured gap or a stability contract |
| Double-submit or wipe field on failed save | `isPending` guard; keep values on recoverable failure |
| Await sibling data in one RSC parent | Sibling async components so fetches start together |
| `tone === undefined ? 'info' : tone` / `if (onDismiss !== undefined)` in the body | Default in the signature; `onDismiss?.()` |
| Bare `return` for an empty render | `return null` |
| `forwardRef` / `<Context.Provider>` on React 19 | `ref` as a prop / `<Context value>` |
| Hand-rolled `isPending` around a Server Action form | `useActionState` + `<form action>` |

## Practice areas

Read the reference for the task — don’t load every file.

| Area | Reference |
| --- | --- |
| Components / props / `ref` prop / ref callback cleanup / `<title>` metadata / removed APIs (`defaultProps`, `ReactDOM.render`) / `return null` / keys / files | [components.md](references/components.md) |
| Hooks / custom `use*` / effect cleanup & deps | [hooks.md](references/hooks.md) |
| Remounts / `Activity` / laggy input / derive-vs-effect / transitions / `useDeferredValue` | [rerender.md](references/rerender.md) |
| Stable subscriptions / `useEffectEvent` / ref fallback / init-once | [advanced.md](references/advanced.md) |
| Local UI / Context+reducer / shared state | [state.md](references/state.md) |
| Client data / `use()` / Suspense / shared listeners | [client-data.md](references/client-data.md) |
| React Compiler / `'use no memo'` / memo / `useMemo` / `useCallback` / stable defaults | [memoization.md](references/memoization.md) |
| Conditional render (`&&` vs ternary) / optional lists `?.length` | [rendering.md](references/rendering.md) |
| Forms / controlled submit / `isPending` / `useActionState` / `useFormStatus` / `useOptimistic` | [forms.md](references/forms.md) |
| Composition / children / compound components | [composition.md](references/composition.md) |
| Error boundaries / feature islands / fallback | [error-boundaries.md](references/error-boundaries.md) |
| RSC / Suspense shell / parallel fetch / `React.cache()` / serialization | [server.md](references/server.md) |
