# Playwright

Prefer one structural style — Page Object or fixtures. Wait on UI state with
auto-waiting locators and `expect`; mock the network when isolation requires it.

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
specs start logged in. Keep credentials in env vars — not in the repo.

```typescript
// ❌ Incorrect: full UI login inside every authenticated test
test('should open settings', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('user@example.com')
  await page.getByLabel('Password').fill('SecurePass123!')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.goto('/settings')
})

// ✅ Correct: setup writes storageState; dependent projects reuse it
const AUTH_STORAGE_STATE_PATH = 'playwright/.auth/user.json'
const e2eUserEmail = process.env.E2E_USER_EMAIL
const e2eUserPassword = process.env.E2E_USER_PASSWORD

if (e2eUserEmail === undefined || e2eUserPassword === undefined) {
  throw new Error('Missing E2E user credentials')
}

await page.goto('/login')
await page.getByLabel('Email').fill(e2eUserEmail)
await page.getByLabel('Password').fill(e2eUserPassword)
await page.getByRole('button', { name: 'Sign in' }).click()
await page.context().storageState({ path: AUTH_STORAGE_STATE_PATH })

// projects: setup (testMatch auth.setup) → chromium with
// use: { storageState: AUTH_STORAGE_STATE_PATH }
```

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
const isCiEnvironment = process.env.CI !== undefined

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
