---
name: testing-patterns
description: >-
  Testing guidelines for unit, integration, component, and e2e. This skill
  should be used when writing, reviewing, or refactoring tests to ensure
  stable, behavior-focused coverage — flaky CI, brittle waits, Playwright
  setup, and service, handler, or API integration with faked ports or a thin
  test DB. Prefer the pyramid and public behavior over brittle internals.
  Triggers on unit, integration, handler, or API test, Jest, Vitest, RTL,
  Testing Library, userEvent, MSW, mock, testcontainers, e2e, Playwright,
  flaky test, waitForTimeout, Page Object, or storageState.
---

# Testing Skills

Unit, integration, component, and e2e patterns for stable, maintainable
suites — plus async waits, selectors, and Playwright setup. Prefer the
pyramid: many fast unit tests, focused integration at service/HTTP
boundaries, fewer component tests, few critical e2e paths.

**Domain:** how tests are layered, named, and kept stable — unit through e2e.
**Owns:** pyramid triage, AAA and behavior names, public-behavior assertions,
test layout, async waits, selectors, Playwright setup.
**Does not own:** production error mapping, UI accessibility, API resource
design, or application implementation.

## When to activate

- Writing or reviewing unit tests for pure logic or services
- Writing or reviewing integration tests: handlers, services + faked ports,
  API suites, or thin real DB / testcontainers for query/migration/seed risk
- Adding component tests with Testing Library
- Choosing unit vs integration vs component vs e2e for a change
- Stabilizing flaky async or e2e waits (including flaky CI)
- Setting up Playwright flows, Page Objects / fixtures, e2e auth, or CI runner config
- Naming tests, mocks, or assertions after behavior

## Core Concepts

### Write vs review

- Pick one mode from the user ask — don’t mix output shapes
- **Write** (add or fix tests): apply these defaults; no review report unless asked
- **Review**: named scope only; report concrete misses in this skill’s domain (layer, flake, assertion coupling)
- Skip findings outside that domain

### Match the repo

Read installed versions from `package.json` and the lockfile (plus
`vitest.config.*`, `playwright.config.*`, and `jest.config.*`). Follow the
patterns already in the tree; greenfield defaults apply only where nothing
contradicts them. When code lags behind what the installed version supports,
finish the task in the existing style, then propose the migration once — old →
new, why, file count, risk — and wait for a yes. Never fold it into the current
change. In review, report the gap as a finding instead.

Keep the repo’s runner, test environment (jsdom, happy-dom, or Browser Mode),
`render` wrapper, HTTP test client, and fixtures.

Version signals:

- `userEvent.click(button)` → `const user = userEvent.setup(); await user.click(button)`
  (user-event 14)
- `act` from `react-dom/test-utils` → `act` from `react` (React 19)
- `browser.provider: 'playwright'` + `@vitest/browser/context` → `provider: playwright()`
  from `@vitest/browser-playwright` + `vitest/browser` (Vitest 4)
- MSW `rest.get` + `res(ctx.json())` → `http.get` + `HttpResponse.json()` (MSW 2)
- `page.waitForTimeout(5_000)` / `page.$(selector)` → web-first `expect(locator)`
  assertions + `getByRole` (Playwright)

Switching test frameworks (Jest ↔ Vitest) is never proposed as modernization.

### Pyramid / triage

Put logic in unit tests; wiring across modules in integration; UI behavior in
component tests; critical user journeys in e2e. Keep e2e few and focused —
edge cases and exhaustive branches belong lower in the pyramid, not in the
browser.

### AAA + naming

Structure every test as Arrange → Act → Assert. Name tests after the behavior
under change (`should … when …`), not after implementation steps or file names.

### Public behavior

Assert what callers or users observe — return values, HTTP status/`code`,
rendered output, visible state. Avoid coupling to private helpers, internal
state shape, or snapshot spam that breaks on unrelated markup churn.

### Layout

Colocate tests with the code they cover using the repo’s convention
(`*.{test,spec}.ts(x)`, or `__tests__/`). Match existing placement
before inventing a new suite layout.

### Common mistakes

| ❌ Incorrect | ✅ Correct |
| --- | --- |
| Edge cases and exhaustive branches in e2e | Unit/component for edges; e2e for critical journeys |
| Browser e2e for API-only contracts | Integration at HTTP / in-process boundary |
| Mock the handler/service under test | Real subject; fake ports or thin real store |
| Fake DB when SQL/constraints are the risk | Thin real DB / testcontainer + cleanup |
| `waitForTimeout` / fixed sleeps | Await visible outcome (`findBy*`, Playwright auto-wait) |
| Broad DOM / snapshot spam as the assertion | Assert the observed behavior that matters |
| CSS/XPath or internal state coupling | Role/label/`data-testid`; public return values |

## Workflow

1. Triage the layer (unit / integration / component / e2e) from Pyramid above.
2. Open only the matching Practice areas ref(s) — don’t load every file.
3. Write or review against Core Concepts and Common mistakes.

## Practice areas

Read the reference for the task — don’t load every file.

| Area | Reference |
| --- | --- |
| Unit / pure logic / mocks / AAA / naming / teardown | [unit.md](references/unit.md) |
| Integration / handlers / faked ports / MSW / third-party HTTP / test DB / testcontainers | [integration.md](references/integration.md) |
| Component / Testing Library / `userEvent.setup()` / `act` / snapshots / Vitest Browser Mode | [components.md](references/components.md) |
| Async waits / `findBy*` / `waitFor` / fake timers / flake | [async.md](references/async.md) |
| E2E / critical journeys / isolation / parallel-safe / login once | [e2e.md](references/e2e.md) |
| Selectors / role / label / `data-testid` / query priority | [selectors.md](references/selectors.md) |
| Playwright / Page Object / fixtures / storageState / `toPass` / `page.clock` / aria snapshot / CI config | [playwright.md](references/playwright.md) |
