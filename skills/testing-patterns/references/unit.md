# Unit

Prefer isolated, fast tests of public behavior. Mock at boundaries; keep each
test short, deterministic, and independent.

## Isolation and mocks

Stub things your code talks to outside itself — network, DB, filesystem, clocks —
so the test never hits the real world.
Run the real function/class you are testing; never replace it with a mock.

```typescript
// ❌ Incorrect: mocks the function under test — asserts nothing useful
const fetchOrderTotal = vi.fn().mockReturnValue(42)
expect(fetchOrderTotal()).toBe(42)

// ✅ Correct: real unit; stub only the boundary dependency
const paymentGateway = {
  charge: vi.fn().mockResolvedValue({ status: 'succeeded' }),
}

const paymentResult = await submitPayment(
  { amountCents: 1_000 },
  paymentGateway,
)

expect(paymentResult.status).toBe('succeeded')
expect(paymentGateway.charge).toHaveBeenCalledWith({ amountCents: 1_000 })
```

## Arrange–Act–Assert

Keep setup, action, and expectations visually separated. One act per test when
practical.

```typescript
// ❌ Incorrect: setup, action, and asserts interleaved without structure
expect(formatCurrency(100)).toBe('$1.00')
const parsedAmountCents = parseCurrency('$2.00')
expect(parsedAmountCents).toBe(200)

// ✅ Correct: arrange → act → assert for one behavior
const amountCents = 100

const formattedAmount = formatCurrency(amountCents)

expect(formattedAmount).toBe('$1.00')
```

## Naming

Describe the behavior and condition — not `test1` or `it works`.

```typescript
// ❌ Incorrect: opaque names hide intent in the report
it('test1', () => {
  expect(isValidEmail('a@b.co')).toBe(true)
})

// ✅ Correct: name states behavior and condition
it('should accept a standard email when the domain is present', () => {
  expect(isValidEmail('user@example.com')).toBe(true)
})
```

## Public interface

Test exported APIs and observable outcomes. Skip private helpers unless they
are the public surface.

```typescript
// ❌ Incorrect: reaches into private helpers via module internals
expect(orderModule._computeLineTotal(lineItem)).toBe(50)

// ✅ Correct: asserts through the public API
expect(buildOrderSummary([lineItem]).totalCents).toBe(50)
```

## Short, simple, fast

One behavior per test. Prefer small fixtures over multi-step setup chains.

```typescript
// ❌ Incorrect: one test covers create, update, and delete paths
it('should manage users', async () => {
  const createdUser = await createUser(validUser)
  const updatedUser = await updateUser(createdUser.id, { name: 'Ada' })
  await deleteUser(createdUser.id)
  expect(updatedUser.name).toBe('Ada')
})

// ✅ Correct: focused test for a single behavior
it('should update the display name when the user exists', async () => {
  const existingUser = await createUser(validUser)

  const updatedUser = await updateUser(existingUser.id, { name: 'Ada' })

  expect(updatedUser.name).toBe('Ada')
})
```

## Happy, unhappy, and edge

Cover valid input, invalid input, and boundary cases that the unit owns.

```typescript
// ❌ Incorrect: only the happy path — invalid and empty inputs untested
expect(clamp(5, 0, 10)).toBe(5)

// ✅ Correct: happy, unhappy, and edge in separate focused tests
expect(clamp(5, 0, 10)).toBe(5)
expect(clamp(-1, 0, 10)).toBe(0)
expect(clamp(11, 0, 10)).toBe(10)
expect(clamp(0, 0, 10)).toBe(0)
```

## Teardown and clean environment

Clean up during and after the run so leaked state never affects later tests.

```typescript
// ❌ Incorrect: leaked mock affects later tests
vi.spyOn(apiClient, 'get').mockResolvedValue({ items: [] })
// no restore — next file still sees the stub

// ✅ Correct: restore after each test; tear down shared suite resources once
afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(async () => {
  await deleteTempDirectory(tempDirectoryPath)
  await closeTestDatabase(testDatabase)
})
```

## Meaningful coverage

Cover the behavior you changed. Do not chase percentage targets or add asserts
that only exercise lines without checking outcomes.
