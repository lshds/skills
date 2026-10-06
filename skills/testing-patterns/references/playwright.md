# Playwright

Prefer one structural style — Page Object or fixtures. Wait on UI state with
auto-waiting locators and `expect`, control time with `page.clock` instead of
sleeping, and mock the network when isolation requires it, so specs stay fast
and stop flaking on timing.

## One style: Page Object or fixtures

Use one style consistently. Prefer the repo’s choice when it is already clear.
If the suite mixes heavy Page Objects with scattered ad-hoc locators, or
duplicates the same navigation everywhere, consolidate toward one style — don’t
copy a bad mix.

```typescript
// ❌ Incorrect: locators and navigation duplicated inline across tests
test('should search items', async ({ page }) => {
  await page.goto('/items')
  await page.getByLabel('Search').fill('notebook')
  await page.getByRole('button', { name: 'Search' }).click()
})

test('should open first item', async ({ page }) => {
  await page.goto('/items')
  await page.getByLabel('Search').fill('notebook')
  await page.getByRole('button', { name: 'Search' }).click()
  await page.getByRole('link').first().click()
})

// ✅ Correct: Page Object encapsulates shared page actions
class ItemsPage {
  constructor(private readonly page: Page) {}

  async goToItems(): Promise<void> {
    await this.page.goto('/items')
  }

  async searchItems(searchQuery: string): Promise<void> {
    await this.page.getByLabel('Search').fill(searchQuery)
    await this.page.getByRole('button', { name: 'Search' }).click()
  }
}

test('should search items', async ({ page }) => {
  const itemsPage = new ItemsPage(page)
  const searchQuery = 'notebook'

  await itemsPage.goToItems()
  await itemsPage.searchItems(searchQuery)

  await expect(page.getByRole('listitem').first()).toBeVisible()
})
```

```typescript
// ✅ Correct alternative: fixtures when that is the suite’s style
import { test as base } from '@playwright/test'

interface ItemsFixtures {
  itemsPage: ItemsPage
}

export const test = base.extend<ItemsFixtures>({
  itemsPage: async ({ page }, useItemsPage) => {
    const itemsPage = new ItemsPage(page)

    await itemsPage.goToItems()
    await useItemsPage(itemsPage)
  },
})
```

## Authenticated storageState

Authenticate once in a setup project, persist `storageState`, and reuse it so
specs start logged in. Log in as a seeded, disposable e2e user whose
credentials come from env vars — never real passwords or production accounts
in the repo.

```typescript
// ❌ Incorrect: full UI login with hardcoded credentials inside every authenticated test
test('should open settings', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('user@example.com')
  await page.getByLabel('Password').fill('SecurePass123!')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.goto('/settings')
})

// ✅ Correct: auth.setup.ts logs in once and writes storageState
import { test as setup } from '@playwright/test'

const AUTH_STORAGE_STATE_PATH = 'playwright/.auth/user.json'

setup('authenticate', async ({ page }) => {
  const e2eUserEmail = process.env.E2E_USER_EMAIL
  const e2eUserPassword = process.env.E2E_USER_PASSWORD

  if (!e2eUserEmail || !e2eUserPassword) {
    throw new Error('Missing E2E user credentials')
  }

  await page.goto('/login')
  await page.getByLabel('Email').fill(e2eUserEmail)
  await page.getByLabel('Password').fill(e2eUserPassword)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.context().storageState({ path: AUTH_STORAGE_STATE_PATH })
})
```

```typescript
// ✅ Correct: playwright.config.ts — setup runs first; dependent projects start logged in
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
})
```

- Git-ignore `playwright/.auth/` — the file holds live session cookies.

## Waits on UI state

Rely on locator auto-wait and web-first assertions. Do not use fixed timeouts
as synchronization.

```typescript
// ❌ Incorrect: fixed timeout before clicking
await page.waitForTimeout(5_000)
await page.getByRole('button', { name: 'Confirm' }).click()

// ✅ Correct: assert readiness, then act
await expect(page.getByRole('button', { name: 'Confirm' })).toBeEnabled()
await page.getByRole('button', { name: 'Confirm' }).click()

await expect(page.getByText('Order confirmed')).toBeVisible()
```

## Poll non-locator conditions with toPass

Locator assertions already retry. For anything else — an API status, a
downloaded file, a value read through `page.evaluate` — pass the check to
`expect()` as an async callback and call `.toPass()`, so it retries until it
holds or the timeout ends, instead of sleeping and reading once.

```typescript
import { expect, test } from '@playwright/test'

// ❌ Incorrect: sleep, then read once — flaky when the export takes longer
test('should publish the CSV export', async ({ page, request }) => {
  await page.goto('/reports')
  await page.getByRole('button', { name: 'Export CSV' }).click()
  await page.waitForTimeout(3_000)

  const exportResponse = await request.get('/api/exports/latest')

  expect(exportResponse.status()).toBe(200)
})

// ✅ Correct: retry the whole block until it passes or times out
test('should publish the CSV export', async ({ page, request }) => {
  await page.goto('/reports')
  await page.getByRole('button', { name: 'Export CSV' }).click()

  await expect(async () => {
    const exportResponse = await request.get('/api/exports/latest')

    expect(exportResponse.status()).toBe(200)
  }).toPass({ timeout: 10_000 })
})
```

## Control time with page.clock

Countdowns, session timeouts, and “today” labels depend on the clock. Waiting
real time makes specs slow and nondeterministic; install a fake clock before the
page loads, then move it forward.

```typescript
import { expect, test } from '@playwright/test'

// ❌ Incorrect: waits a real minute for the session warning
test('should warn before the session expires', async ({ page }) => {
  await page.goto('/dashboard')
  await page.waitForTimeout(60_000)

  await expect(page.getByRole('alert')).toHaveText('Your session expires in 5 minutes')
})

// ✅ Correct: fake clock installed before load, then fast-forwarded
test('should warn before the session expires', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T09:00:00Z') })
  await page.goto('/dashboard')

  await page.clock.fastForward('01:00')

  await expect(page.getByRole('alert')).toHaveText('Your session expires in 5 minutes')
})
```

- For date-dependent rendering with no timers involved, pin the time with
  `await page.clock.setFixedTime(new Date('2026-01-01T09:00:00Z'))`.

## Structure checks with aria snapshots

When the assertion is the shape of a region — headings, landmarks, the controls
in a toolbar — compare its accessibility tree with `toMatchAriaSnapshot`. An
HTML snapshot breaks on every class or wrapper change and still misses a lost
role or name.

```typescript
import { expect, test } from '@playwright/test'

// ❌ Incorrect: full HTML snapshot — breaks on markup churn, blind to roles and names
test('should render the orders page structure', async ({ page }) => {
  await page.goto('/orders')

  expect(await page.content()).toMatchSnapshot()
})

// ✅ Correct: aria snapshot of the main region — roles, names, and levels only
test('should render the orders page structure', async ({ page }) => {
  await page.goto('/orders')

  await expect(page.getByRole('main')).toMatchAriaSnapshot(`
    - heading "Orders" [level=1]
    - button "New order"
  `)
})
```

## Network mock and route

Intercept third-party or unstable APIs when the journey under test should not
depend on them. Prefer fulfilling controlled responses over hitting live
vendors.

```typescript
// ❌ Incorrect: depends on a live third-party that flakes
test('should show payment success', async ({ page }) => {
  await page.goto('/checkout')
  await page.getByRole('button', { name: 'Pay' }).click()

  await expect(page.getByText('Payment successful')).toBeVisible()
})

// ✅ Correct: route stubs the payment API
test('should show payment success', async ({ page }) => {
  await page.route('**/api/payments/**', async (paymentRoute) => {
    await paymentRoute.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'succeeded' }),
    })
  })

  await page.goto('/checkout')
  await page.getByRole('button', { name: 'Pay' }).click()

  await expect(page.getByText('Payment successful')).toBeVisible()
})
```

## Steps for reporting

Group long journeys with `test.step` so failures pinpoint the stage without
changing the assertion style.

```typescript
test('should complete checkout', async ({ page }) => {
  await test.step('Add item to cart', async () => {
    await page.goto('/products')
    await page.getByRole('button', { name: 'Add to cart' }).click()
  })

  await test.step('Confirm payment', async () => {
    await page.goto('/checkout')
    await page.getByRole('button', { name: 'Pay' }).click()

    await expect(page.getByText('Payment successful')).toBeVisible()
  })
})
```

- Label key locators in product words with `locator.describe('Checkout button')`
  so traces and reports read without decoding selectors.

## CI config

Retries and artifacts belong in CI — not as a way to hide flakes locally. Fail
the build on `.only`, and keep workers constrained on shared runners.

```typescript
// ❌ Incorrect: retries always on; no failure artifacts; .only allowed in CI
export default defineConfig({
  retries: 2,
  forbidOnly: false,
  use: {
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
})

// ✅ Correct: CI-only retries; evidence on failure; forbid .only; fewer workers
const isCiEnvironment = Boolean(process.env.CI)

export default defineConfig({
  retries: isCiEnvironment ? 2 : 0,
  forbidOnly: isCiEnvironment,
  workers: isCiEnvironment ? 1 : undefined,
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
})
```

- Locally, `npx playwright test --only-changed` runs just the specs affected by
  uncommitted changes — a fast loop, not a replacement for the full CI run.
- `instant()` from `@next/playwright` (the journey steps go in its callback)
  belongs only in Next.js repos that enable Instant Navigations
  (`cacheComponents: true` + `partialPrefetching: true`); don’t add it
  elsewhere.
