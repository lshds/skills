# E2E

Prefer a thin e2e suite: critical user journeys only. Keep tests independent,
parallel-safe, and free of lower-pyramid edge-case coverage.

## What belongs in e2e

Cover critical browser journeys (login, checkout, signup). Leave edge cases and API contracts lower in the pyramid.

```typescript
// ❌ Incorrect: e2e enumerates validation edge cases better suited to unit tests
test('rejects every invalid email shape', async ({ page }) => {
  for (const invalidEmail of invalidEmails) {
    await page.goto('/signup')
    await page.getByLabel('Email').fill(invalidEmail)
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
  }
})

// ✅ Correct: one critical journey — user can complete signup
test('should complete signup and land on the dashboard', async ({ page }) => {
  await page.goto('/signup')
  await page.getByLabel('Email').fill('user@example.com')
  await page.getByLabel('Password').fill('SecurePass123!')
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})
```

## Isolation and cleanup

Each test creates what it needs and cleans up afterward. Never depend on another
test’s side effects or shared mutable seed left dirty.

```typescript
// ❌ Incorrect: relies on data left by a previous test
test('should open the created project', async ({ page }) => {
  await page.goto('/projects')
  await page.getByText('Shared Project').click()
})

// ✅ Correct: creates and cleans its own data inside the test lifecycle
test('should open the created project', async ({ page }) => {
  const projectName = `Project ${Date.now()}`
  const project = await createTestProject({ name: projectName })

  try {
    await page.goto('/projects')
    await page.getByRole('link', { name: project.name }).click()
    await expect(page.getByRole('heading', { name: project.name })).toBeVisible()
  } finally {
    await deleteTestProject(project.id)
  }
})
```

## Parallel-safe

Assume tests run concurrently. Use unique data (timestamps, UUIDs) and avoid
global singletons or fixed IDs that collide across workers.

```typescript
// ❌ Incorrect: fixed email — collisions when workers run in parallel
const testUserEmail = 'e2e-user@example.com'

// ✅ Correct: unique identity per run
const testUserEmail = `e2e-user-${crypto.randomUUID()}@example.com`
```

## Auth and credentials

Reuse authenticated session state instead of logging in through the UI in every
test. Seed disposable fixture users; never commit real passwords, tokens, or
production accounts.

```typescript
// ❌ Incorrect: production credentials hardcoded; full login in every test
const adminPassword = 'ProdAdmin!2024'

test('should open settings', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('user@example.com')
  await page.getByLabel('Password').fill(adminPassword)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.goto('/settings')
})

// ✅ Correct: seeded e2e user from env; session reused across authenticated specs
const e2eUserEmail = process.env.E2E_USER_EMAIL
const e2eUserPassword = process.env.E2E_USER_PASSWORD

if (e2eUserEmail === undefined || e2eUserPassword === undefined) {
  throw new Error('Missing E2E user credentials')
}

const e2eUser = {
  email: e2eUserEmail,
  password: e2eUserPassword,
}
```

## What does not belong

Skip unit-level logic, exhaustive API contracts, and implementation details.
Match the project’s existing e2e runner — don’t introduce a second stack.
