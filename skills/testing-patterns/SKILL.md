---
name: testing-patterns
description: >-
  Testing guidelines for unit, integration, component, and e2e. This skill
  should be used when writing, reviewing, or refactoring tests for stable,
  behavior-focused coverage — including flaky CI, brittle waits, Page Object /
  Playwright setup, and service/handler/API integration with faked ports or a
  thin test DB. Prefer the pyramid and public behavior over brittle internals.
  Triggers on unit test, integration test, handler test, service test, API
  test, testcontainers, Jest, Vitest, RTL, Testing Library, mock, e2e,
  Playwright, end-to-end, flaky test, flaky CI, waitForTimeout, Page Object,
  or storageState.
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
| Unit / pure logic / mocks | [unit.md](references/unit.md) |
| Integration / handlers / faked ports / test DB | [integration.md](references/integration.md) |
| Component / Testing Library | [components.md](references/components.md) |
| Async waits / `findBy*` / flake | [async.md](references/async.md) |
| E2E / critical journeys | [e2e.md](references/e2e.md) |
| Selectors / role / label / `data-testid` | [selectors.md](references/selectors.md) |
| Playwright / Page Object / storageState | [playwright.md](references/playwright.md) |
