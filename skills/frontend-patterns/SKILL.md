---
name: frontend-patterns
description: >-
  Stack-agnostic client behavior guidelines for web frontends. This skill
  should be used when writing, reviewing, or refactoring client environment
  config, browser storage helpers, client logs, async screen states, or form
  submit behavior to ensure checked config, safe prefs, and explicit outcomes.
  Prefer a checked config object, the app logger, and native controls over raw
  env reads, console.log, and clickable divs. Triggers on public env prefixes,
  localStorage, sessionStorage, console.log, loading / empty / error states,
  double-submit, or validation timing.
---

# Frontend Skills

Client-side behavior that holds across web stacks: public environment config,
browser prefs helpers, client logs, async screen states, form submit behavior,
and native controls. Prefer checked config, explicit outcomes, and the app’s
logger.

**Domain:** client-side behavior that holds across web stacks.
**Owns:** public environment names and the checked config object read before
the first request; `localStorage` / `sessionStorage` prefs helpers; client
`info` / `warn` logs (the app’s logger, named events); loading, empty,
success, and error for async screens; validation timing, double-submit
guards, and keeping input on a recoverable failure; native controls (`button`,
`a`, `label`) rather than clickable `div` or `span`; minimal component
boundaries and keeping server data apart from UI state.
**Does not own:** language rules such as typing and naming; how a particular
framework wires components, composition, hooks, signals, state, or forms
(controlled inputs, form libraries, schema validators); cache on the server
request path; keyboard, ARIA, and focus-trap depth; or how auth tokens are
sent and where secrets are stored.

## When to activate

- Adding or reviewing client environment variables (public prefixes, a checked config object before the first request)
- Writing prefs helpers that use `localStorage` / `sessionStorage`
- Adding or reviewing client logs (`console.log` vs the app logger)
- Implementing loading, empty, error, and success states for an async view
- Guarding a form against double-submit or choosing when it validates
- Replacing a clickable `div` / `span` with a native control

## Core Concepts

### Write vs review

- Pick one mode from the user ask — don’t mix output shapes
- **Write** (implement, fix, refactor): apply these defaults in the UI; no review report unless asked
- **Review**: named scope only; report concrete misses in this skill’s domain (environment, prefs helpers, client logs, async states, submit behavior, native controls)
- Skip findings outside that domain

### Component boundaries

- Keep components single-purpose and name them by domain (`InvoiceTable`), not by type (`TableComponent`)
- Split presentational markup from data loading only when the repo already does

### State

Keep server data separate from ephemeral UI state, and derive values instead of mirroring them in state.

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

- Read public values through one config object whose required fields are checked when the module loads, so a missing value fails at startup instead of landing in a URL as `"undefined"`.
- Use the names, public prefix, and access path the rest of the client already uses; a server-only secret never gets a public prefix.
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
| Inline errors on every keystroke | Validate at submit (on blur only if the repo already does) |
| `JSON.parse(localStorage.getItem('prefs'))` unchecked | Guard storage + validate shape before use |
| `console.log` when the app already has a logger | App logger `info` / `warn` |
| `process.env.API_URL` in a request URL | Checked `publicEnvironment.apiBaseUrl` before the first request |
| `<div onClick={handleOpenMenu}>` | `<button type="button" onClick={handleOpenMenu}>` |

## Practice areas

Read the reference for the task — don’t load every file.

| Area | Reference |
| --- | --- |
| Client logs / app logger / named events / `info` vs `warn` / `console.log` only if none | [logging.md](references/logging.md) |
| Environment / public env prefix / checked config object / one source / server-only secrets | [environment.md](references/environment.md) |
