---
name: frontend-patterns
description: >-
  Stack-agnostic UI guidelines for frontend applications. This skill should
  be used when writing, reviewing, or refactoring UI code to ensure sound
  component and state patterns. Prefer colocation and clear async/form UX
  over ad-hoc alternatives. Triggers on tasks involving component boundaries,
  state colocation, separation of concerns, async UI, forms UX, web
  storage helpers (prefs, localStorage, sessionStorage), client logging
  (console.log, loggers), or environment.
---

# Frontend Skills

Client UI across web stacks: component boundaries, colocated state, async
screen states, form submit behavior, and browser prefs helpers. Prefer local
state and explicit loading and submit outcomes.

**Domain:** how client UI is structured and behaves, across web stacks.
**Owns:** splitting markup that renders from code that fetches and shapes;
where local UI state sits versus data from the server; loading, empty,
success, and error for async screens; when a form validates and how a second
submit is prevented; helpers that persist preferences in `localStorage` /
`sessionStorage`; native controls (`button`, `a`, `label`) rather than
clickable `div` or `span`; client `info` / `warn` logs (the app’s logger,
named events); environment.
**Does not own:** language rules such as typing and naming; cache on the
server request path; keyboard, ARIA, and focus-trap depth; how a particular
framework wires components, hooks, signals, or forms; or how auth tokens are
sent and where secrets are stored.

## When to activate

- Writing new UI components or screens
- Reviewing component boundaries or prop/state ownership
- Refactoring presentational vs logic separation
- Implementing loading, empty, success, or error UI for async views
- Building or reviewing form submit, validation timing, and double-submit UX
- Writing prefs helpers that use `localStorage` / `sessionStorage`
- Adding or reviewing client logs
- Adding or reviewing environment

## Core Concepts

### Write vs review

- Pick one mode from the user ask — don’t mix output shapes
- **Write** (implement, fix, refactor): apply these defaults in the UI; no review report unless asked
- **Review**: named scope only; report concrete misses in this skill’s domain (boundaries, state, async states, submit guards, prefs helpers, client logs, environment)
- Skip findings outside that domain

### Component boundaries

- Keep components small and single-purpose; name by domain, not by type
- Split presentational markup from container/logic only when the repo already does
- Prefer composition over boolean prop matrices that encode multiple modes

### State

- Colocate state with the component that uses it; lift only when shared
- Keep server/remote data separate from ephemeral UI state
- Derive values instead of mirroring them in state

### Separation of concerns

- Presentational views render and emit events
- Push business logic, API calls, and data shaping into services, state modules, or stores

### Async UI

- Handle loading, empty, success, and error — don’t leave a spinner or blank panel as the only outcome
- Errors are safe and actionable; retry only when idempotent and the product already does
- Empty states explain what is missing and the next useful step when there is one
- Fetch at a clear boundary (route / container / loader); never treat undefined as valid data
- Cancel or ignore stale responses when the key changes mid-flight

### Forms UX

Stack-agnostic submit *behavior* — not controlled wiring, schema libs, or ARIA for errors:

- Validate at submit (on blur only if the repo already does); don’t punish typing with noisy inline errors
- Disable or guard double-submit on mutating actions
- Preserve user input across recoverable failures unless the flow explicitly resets

### Web storage

Prefs and similar non-secret client data in `localStorage` / `sessionStorage` — not auth tokens, session secrets, or native secure stores:

- Persist only the fields the helper needs — not full server objects
- Guard `getItem` / `setItem` (quota, private mode, and disabled storage throw)
- Validate shape after deserialize — don’t cast untrusted JSON to a typed object

### Logging

- Log `info` / `warn` with the app’s logger — not `console.log` when a logger exists.
- If there is no logger, `console.log` is fine — ask the user if they want a logger added.
- Don’t add a second logger.
- See [logging.md](references/logging.md).

### Environment

- Prefer the environment names the rest of the client already uses, and check required values before the first request so a missing value does not land in a URL as `"undefined"`.
- Prefer one source for the same setting. If you would add another, ask first.
- See [environment.md](references/environment.md).

### UI hygiene

- Prefer native controls (`button`, `a`, `label`, headings) over clickable `div`/`span`
- Deep keyboard / ARIA work is out of scope here

### Common mistakes

| ❌ Incorrect | ✅ Correct |
| --- | --- |
| Spinner forever; no empty or error branch | Explicit loading / empty / success / error |
| Second click fires another mutating submit | Disable or guard until the first attempt settles |
| `JSON.parse(localStorage.getItem(...))` unchecked | Guard storage + validate shape before use |
| Business fetch + shaping inside a pure view | View renders/emits; container or service owns I/O |
| Duplicate state that can be derived | Compute from source of truth |
| `console.log` when the app already has a logger | App logger `info` / `warn` |
| `process.env.API_URL` in a request URL | Checked `publicEnvironment.apiBaseUrl` before the first request |

## Practice areas

Read the reference for the task — don’t load every file.

| Area | Reference |
| --- | --- |
| Client logs / logger / `console.log` only if none | [logging.md](references/logging.md) |
| Environment | [environment.md](references/environment.md) |
