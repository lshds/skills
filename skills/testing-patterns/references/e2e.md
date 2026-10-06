# E2E

Prefer a thin e2e suite: critical user journeys only. Keep tests independent,
parallel-safe, and free of lower-pyramid edge-case coverage.

## What belongs in e2e

Cover critical browser journeys (login, checkout, signup). Leave edge cases and API contracts lower in the pyramid.

```typescript
// ❌ Incorrect: e2e enumerates validation edge cases better suited to unit tests
test('should reject every invalid email shape', async ({ page }) => {
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

## Log in once, not in every test

Logging in through the UI in every test multiplies runtime and makes every spec
flake on the login page instead of the journey under test. Authenticate once and
reuse the saved session (Playwright `storageState`, or the runner’s equivalent);
drive the login form only in the test that covers login itself. Credentials
belong to seeded, disposable e2e users and come from env vars — never real
passwords, tokens, or production accounts.

## What does not belong

Skip unit-level logic, exhaustive API contracts, and implementation details.
Match the project’s existing e2e runner — don’t introduce a second stack.
