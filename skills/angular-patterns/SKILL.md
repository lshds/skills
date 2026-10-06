---
name: angular-patterns
description: >-
  Angular UI guidelines for `.ts` / `.html` apps. This skill should be used
  when writing, reviewing, or refactoring components, templates, DI, Signal
  Forms, httpResource, or routes to ensure standalone, signal, and zoneless
  defaults. Prefer Signal Forms and omit redundant OnPush; match the repo —
  ask before migrating. Triggers on tasks involving input(), output(),
  inject(), @if, loadComponent, CanActivateFn, interceptors, zoneless, SSR,
  or component selectors.
---

# Angular Skills

Angular UI in `.ts` / `.html`: standalone components, templates, DI, signals,
forms, HTTP, routing, and SSR / hydration. Prefer standalone + signals over
NgModules and unnecessary RxJS; greenfield is zoneless with Signal Forms and
no extra OnPush — match the repo, ask before migrating.

**Domain:** Angular component, template, DI, forms, HTTP, routing, and SSR
patterns in `.ts` / `.html`.
**Owns:** standalone vs NgModules; change detection (OnPush default / zoneless);
signal I/O, `host`, queries, and lifecycle; file / selector naming; Angular
`src/*` role folders; `@if` / `@for` and class/style bindings; attribute /
host directives; signals and RxJS boundaries; `inject()` / tokens / scopes;
Signal Forms, custom form controls, and Reactive Forms control wiring;
`httpResource` / `rxResource` and functional interceptors; lazy routes,
functional guards, and route inputs; SSR / hydration and browser-API gating.
**Does not own:** stack-agnostic loading / empty / error or submit-guard copy;
TypeScript language rules; native semantics, ARIA, or keyboard widgets;
auth-token transport; or repo / package placement beyond this app’s Angular
`src/*` conventions.

## When to activate

- Writing or reviewing Angular components, templates, or host directives
- Choosing zoneless vs Zone.js, or whether to set OnPush on a new component
- Naming files, selectors, or events, or placing files in the observed Angular `src` tree
- Injecting services or tokens, or choosing signal state vs RxJS at a boundary
- Building or reviewing Signal Forms or Reactive Forms, including validation, submit, and custom controls
- Loading page data with `httpResource` / `rxResource` or adding a functional interceptor
- Adding lazy routes, `CanActivateFn` guards, or route-bound inputs
- Configuring SSR / incremental hydration or gating browser-only DOM access

## Core Concepts

### Write vs review

- Pick one mode from the user ask — don’t mix output shapes
- **Write** (implement, fix, refactor): apply these defaults in the `.ts` /
  `.html`; no review report unless asked
- **Review**: named scope only; report concrete misses in this skill’s domain
- Old way to implement the same design: always suggest the current default;
  ask before changing unless the user already allowed it
- Skip findings outside that domain

### Match the repo

Read installed versions from `package.json` and the lockfile (plus
`angular.json`). Follow the patterns already in the tree; greenfield defaults
apply only where nothing contradicts them. When code lags behind what the
installed version supports, finish the task in the existing style, then
propose the migration once — old → new, why, file count, risk — and wait for a
yes. Never fold it into the current change. In review, report the gap as a
finding instead.

Greenfield: standalone components without `standalone: true` and no
NgModules; Signal Forms and `httpResource` for new forms and page reads; no
`provideZonelessChangeDetection()` or `provideZoneChangeDetection()` — zoneless
is already the default.

Version signals:

- `*ngIf` / `*ngFor` / `*ngSwitch` → `@if` / `@for` / `@switch` (deprecated in v20)
- `@Input()` / `@Output()` → `input()` / `output()` / `model()` (stable since v19)
- constructor parameter injection → `inject()`
- `@HostBinding` / `@HostListener` → `host: {}` in component metadata
- `provideClientHydration(withIncrementalHydration(), withEventReplay())` →
  `provideClientHydration()`
- Reactive Forms for a new form → Signal Forms `form()` + `[formField]`;
  existing reactive forms stay until approved

### Change detection

OnPush is the default — omit `changeDetection`; keep `Eager` and Zone.js where
the repo has them. See [components.md](references/components.md).

### Naming

Hyphenated files matching the class; app-prefixed selectors. See
[naming.md](references/naming.md).

### Project structure

Match the observed Angular tree. Flat `src/*` role folders only on greenfield —
don’t flatten `src/app/`. See
[project-structure.md](references/project-structure.md).

### Components

Signal I/O, `host` object, thin lifecycle. Skip `ngOnInit` when fields,
`httpResource`, or `afterNextRender` already cover the work. See
[components.md](references/components.md).

### Events

Name handlers for the action, not the DOM event. See
[events.md](references/events.md).

### Templates

Native control flow and `[class.]` / `[style.]`; `@let` names a value the
template reads repeatedly. Derive in the class with `computed` — don’t leave a
pass-through method that only calls a helper. See
[templates.md](references/templates.md).

### Directives

Attribute + `hostDirectives`; no custom `*if` / `*for`. See
[directives.md](references/directives.md).

### State

Signals locally; private writables in services; RxJS at boundaries. See
[state.md](references/state.md).

### DI

`inject()`, explicit scopes, `takeUntilDestroyed`. See
[di.md](references/di.md).

### Forms

Greenfield: Signal Forms (`form()`, `[formField]`, schema validators); custom
controls implement `FormValueControl` / `FormCheckboxControl`, not
`ControlValueAccessor`. If the repo uses Reactive Forms, stay there — one stack
per app; `compatForm` / `SignalFormControl` only bridge an approved migration.
See [forms.md](references/forms.md).

### HTTP

`httpResource` for page reads bound to signals or `input()`; `rxResource` when
the loader is already an Observable. `ResolveFn` only when the route must not
activate without the data. Functional interceptors. See
[http.md](references/http.md).

### Routing

Lazy `loadComponent` / `loadChildren`; `CanActivateFn`; route inputs. Don’t
fetch in `ngOnInit`. See [routing.md](references/routing.md).

### SSR

Gate browser APIs; avoid hydration mismatches. Pick when each block hydrates
with `@defer (hydrate on viewport | interaction | idle)`. See
[ssr.md](references/ssr.md).

### Common mistakes

| ❌ Incorrect | ✅ Correct |
| --- | --- |
| `ngClass` / `ngStyle` | `[class.]` / `[style.]` |
| `changeDetection: OnPush` on every component | Omit it — OnPush is the default |
| New `ControlValueAccessor` for a Signal Forms control | `FormValueControl` with `readonly value = model('')` |
| Same signal chain repeated across a template | `@let` once; `computed` when it needs logic |
| Eager `component:` for heavy screens | `loadComponent` / `loadChildren` |

## Practice areas

Read the reference for the task — don’t load every file.

| Area | Reference |
| --- | --- |
| File / selector naming | [naming.md](references/naming.md) |
| Angular `src` tree / placement | [project-structure.md](references/project-structure.md) |
| Components / change detection / zoneless / host / lifecycle | [components.md](references/components.md) |
| Events / key modifiers / outputs | [events.md](references/events.md) |
| Control flow / class-style / `@let` / defer | [templates.md](references/templates.md) |
| Attribute / host directives | [directives.md](references/directives.md) |
| DI / tokens / cleanup | [di.md](references/di.md) |
| Signal Forms / Reactive Forms / `FormValueControl` / `compatForm` migration | [forms.md](references/forms.md) |
| Signals / RxJS interop | [state.md](references/state.md) |
| `httpResource` / `resource` / `rxResource` / interceptors | [http.md](references/http.md) |
| Lazy routes / `CanActivateFn` / inputs | [routing.md](references/routing.md) |
| SSR / hydration / `hydrate on` triggers / transfer cache | [ssr.md](references/ssr.md) |
