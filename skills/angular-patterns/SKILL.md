---
name: angular-patterns
description: >-
  Angular UI guidelines for `.ts` / `.html` apps. This skill should be used
  when writing, reviewing, or refactoring components, templates, DI, Signal
  Forms, httpResource, or routes to ensure standalone, signal, and zoneless
  defaults. Prefer Signal Forms and omit redundant OnPush; match the repo —
  ask before migrating. Triggers on tasks involving input(), output(),
  inject(), @if, loadComponent, CanActivateFn, interceptors, zoneless, SSR,
  or selectors.
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
Signal Forms and Reactive Forms control wiring; `httpResource` and functional
interceptors; lazy routes, functional guards, and route inputs; SSR /
hydration and browser-API gating.
**Does not own:** stack-agnostic loading / empty / error or submit-guard copy;
TypeScript language rules; native semantics, ARIA, or keyboard widgets;
auth-token transport; or repo / package placement beyond this app’s Angular
`src/*` conventions.

## When to activate

- Writing or reviewing Angular components, templates, or host directives
- Choosing zoneless vs Zone.js, or whether to set OnPush on a new component
- Naming files, selectors, or events, or placing files in the observed Angular `src` tree
- Injecting services or tokens, or choosing signal state vs RxJS at a boundary
- Building or reviewing Signal Forms or Reactive Forms, including validation and submit
- Loading page data with `httpResource` or adding a functional interceptor
- Adding lazy routes, `CanActivateFn` guards, or route-bound inputs
- Gating SSR / hydration or browser-only DOM access

## Core Concepts

### Write vs review

- Pick one mode from the user ask — don’t mix output shapes
- **Write** (implement, fix, refactor): apply these defaults in the `.ts` /
  `.html`; no review report unless asked
- **Review**: named scope only; report concrete misses in this skill’s domain
- Old way to implement the same design: always suggest the current default;
  ask before changing unless the user already allowed it
- Skip findings outside that domain

### Generation

**Angular 22+.** OnPush is the compiler default; new apps are zoneless; Signal
Forms and `httpResource` are the greenfield defaults. Match the repo — don’t
migrate silently. When you find an old way to implement the same design,
always suggest the current default and ask before changing; apply it only if
the user already allowed the change.

### Standalone

Standalone by default — don’t set `standalone: true`; skip NgModules unless the
repo requires them.

### Change detection

Omit `changeDetection: ChangeDetectionStrategy.OnPush` — it’s the default.
Don’t stamp `Eager` on new components. Greenfield is zoneless: don’t add
`provideZonelessChangeDetection()` or `provideZoneChangeDetection()`. If the
repo still uses Zone.js or `Eager`, keep it. Ask before migrating. See
[components.md](references/components.md).

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

Native control flow and `[class.]` / `[style.]`. Derive in the class with
`computed` — don’t leave a pass-through method that only calls a helper. See
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

Greenfield: Signal Forms (`form()`, `[formField]`, schema validators). If the
repo uses Reactive Forms, stay there — one stack per app. Ask before converting
`FormGroup` to Signal Forms. See [forms.md](references/forms.md).

### HTTP

`httpResource` for page reads bound to signals or `input()`. `ResolveFn` only
when the route must not activate without the data. Functional interceptors.
See [http.md](references/http.md).

### Routing

Lazy `loadComponent` / `loadChildren`; `CanActivateFn`; route inputs. Don’t
fetch in `ngOnInit`. See [routing.md](references/routing.md).

### SSR

Gate browser APIs; avoid hydration mismatches. See
[ssr.md](references/ssr.md).

### Common mistakes

| ❌ Incorrect | ✅ Correct |
| --- | --- |
| `@Input()` / `@Output()` on new code | `readonly` `input()` / `output()` / `model()` |
| `*ngIf` / `*ngFor` / `ngClass` | `@if` / `@for` / `[class.]` |
| `changeDetection: OnPush` on every component | Omit it — OnPush is the default |
| New `FormGroup` on greenfield | Signal Forms; ask before migrating existing Reactive Forms |
| Eager `component:` for heavy screens | `loadComponent` / `loadChildren` |

## Practice areas

Read the reference for the task — don’t load every file.

| Area | Reference |
| --- | --- |
| File / selector naming | [naming.md](references/naming.md) |
| Angular `src` tree / placement | [project-structure.md](references/project-structure.md) |
| Components / change detection / host / lifecycle | [components.md](references/components.md) |
| Events / key modifiers / outputs | [events.md](references/events.md) |
| Control flow / class-style / defer | [templates.md](references/templates.md) |
| Attribute / host directives | [directives.md](references/directives.md) |
| DI / tokens / cleanup | [di.md](references/di.md) |
| Forms / Signal Forms / Reactive Forms | [forms.md](references/forms.md) |
| Signals / RxJS interop | [state.md](references/state.md) |
| `httpResource` / interceptors | [http.md](references/http.md) |
| Lazy routes / `CanActivateFn` / inputs | [routing.md](references/routing.md) |
| SSR / hydration | [ssr.md](references/ssr.md) |
