# Integration

Prefer real composition of collaborating units — handler + service + ports, or
a thin real store — exercised below the browser. Mock true externals; never
mock the subject under test.

## Scope

Use integration when the risk is wiring or boundary contracts:

- Service with faked repository / gateway ports
- HTTP handler (or in-process entry) through status + body
- API suite covering auth, validation, and not-found paths callers hit
- Repository / migration / seed behavior against a thin real store when the
  bug risk is SQL or schema interaction — not pure helper math

Do not use the browser for API-only contracts. Do not re-test pure functions
here — keep those in fast unit tests with every dependency stubbed.

```typescript
// ❌ Incorrect: browser e2e for an API contract that never needs a UI
test('should return 404 for missing order', async ({ page }) => {
  await page.goto('/api/orders/missing')
})

// ✅ Correct: hit the app through its HTTP (or in-process) boundary
test('should return 404 when the order is missing', async () => {
  const response = await request(app).get('/orders/missing-id')

  expect(response.status).toBe(404)
  expect(response.body).toMatchObject({ code: 'order_not_found' })
})
```

## Service with faked ports

Run the real service. Stub only ports that leave the module graph — repositories,
payment vendors, email, third-party HTTP, clocks. Preserve each port’s contract
so the fake fails the same way a slow/broken edge would.

```typescript
// ❌ Incorrect: mocks the service under test — asserts the mock, not behavior
const createOrder = vi.fn().mockResolvedValue({ id: 'ord_1' })
expect(await createOrder(orderInput)).toEqual({ id: 'ord_1' })

// ✅ Correct: real service; fake only the repository / gateway port
const orderInput = { amountCents: 1_000, customerId: 'cus_1' }

const orderRepository = {
  insert: vi.fn().mockResolvedValue({ id: 'ord_1', ...orderInput }),
  findById: vi.fn(),
}
const paymentGateway = {
  charge: vi.fn().mockResolvedValue({ status: 'succeeded' }),
}

const createdOrder = await createOrder(orderInput, {
  orderRepository,
  paymentGateway,
})

expect(createdOrder.id).toBe('ord_1')
expect(createdOrder.status).toBe('pending')
expect(paymentGateway.charge).toHaveBeenCalledWith({
  amountCents: orderInput.amountCents,
})
```

## Handler entry

Drive the real handler (or thin controller) with a request-like input. Fake
downstream services only when the handler’s job is mapping transport ↔ service —
or use the real service + faked ports when the suite owns that whole slice.

```typescript
// ❌ Incorrect: spies on private mapper helpers inside the handler module
expect(ordersHandler._mapBodyToCommand).toHaveBeenCalled()

// ✅ Correct: assert HTTP status, stable error code, and response fields
const response = await request(app)
  .post('/orders')
  .send({ amountCents: 1_000, customerId: 'cus_1' })

expect(response.status).toBe(201)
expect(response.body).toMatchObject({
  id: expect.any(String),
  status: 'pending',
})
```

Wire auth the way production does for protected routes (test user / test token
from env or fixtures). Never hardcode production secrets.

## API-level suites

Group tests by resource and behavior (`should reject empty body`, `should
return 401 when unauthenticated`). Prefer one focused case per behavior. Cover
the contract callers depend on: success shape, validation failures, not-found,
conflict, and authz denials — not every internal branch.

```typescript
// ❌ Incorrect: one mega-test that walks create → update → delete → list
it('should manage orders end to end', async () => { /* … */ })

// ✅ Correct: separate cases; unique data; assert the boundary contract
it('should return 422 when amountCents is missing', async () => {
  const response = await request(app)
    .post('/orders')
    .send({ customerId: 'cus_1' })

  expect(response.status).toBe(422)
  expect(response.body).toMatchObject({ code: 'validation_failed' })
})

it('should create an order when the body is valid', async () => {
  const customerId = `cus_${crypto.randomUUID()}`

  const response = await request(app)
    .post('/orders')
    .send({ amountCents: 1_000, customerId })

  expect(response.status).toBe(201)
  expect(response.body).toMatchObject({ status: 'pending' })
})
```

Match the repo’s HTTP test helper (`supertest`, framework `app.inject`, etc.).
Don’t introduce a second stack.

## Fakes vs testcontainers (store choice)

Choose the lightest store that still catches the bug class you care about.

| Prefer faked / in-memory ports when… | Prefer thin real DB / testcontainer when… |
| --- | --- |
| Logic and wiring matter; SQL is trivial or already trusted | Query SQL, constraints, migrations, or transactions are the risk |
| Suite must stay fast and parallel-cheap | Repo already runs a shared test DB or container in CI |
| Port boundary is clear and stable | You need real constraint/unique/cascade failures |

Default to fakes for service/handler suites. Reach for a real store when
fakes would lie about persistence behavior.

```typescript
// ❌ Incorrect: fake repository that cannot fail unique constraints — misses the bug
const orderRepository = {
  insert: vi.fn().mockResolvedValue({ id: 'ord_1' }),
}

// ✅ Correct (constraint risk): thin real DB; unique data; clean up after
const orderId = `ord_${crypto.randomUUID()}`

await db.insert(orders).values({
  id: orderId,
  customerId: 'cus_1',
  totalCents: 100,
})

try {
  const response = await request(app).get(`/orders/${orderId}`)

  expect(response.status).toBe(200)
} finally {
  await db.delete(orders).where(eq(orders.id, orderId))
}
```

Rules for a real store:

- Migrate once per suite (or use the repo’s existing test bootstrap).
- Seed and delete inside the test lifecycle — no dirty shared rows.
- Unique IDs/emails per test so workers stay parallel-safe.
- Assert through the public API or repository port, not raw table dumps,
  unless the table shape *is* the contract under test (migration/seed checks).

```typescript
// ❌ Incorrect: shared fixed id; next worker collides
await db.insert(orders).values({ id: 'fixed-id', totalCents: 100 })

// ✅ Correct: unique row; teardown in the same test
const orderId = `ord_${crypto.randomUUID()}`

await db.insert(orders).values({ id: orderId, totalCents: 100 })

try {
  const foundOrder = await orderRepository.findById(orderId)

  expect(foundOrder).toMatchObject({ totalCents: 100 })
} finally {
  await db.delete(orders).where(eq(orders.id, orderId))
}
```

## Migrations, seeds, and query modules

When the subject is a migration, seed, or query module: run it against the thin
real store the repo already uses, assert the observable schema or row outcome,
then clean up. Don’t spin a browser. Don’t mock away the SQL engine if SQL is
what you are proving.

```typescript
// ❌ Incorrect: asserts a mocked migrator was “called” — proves nothing about schema
const applyMigrations = vi.fn()
await applyMigrations()
expect(applyMigrations).toHaveBeenCalled()

// ✅ Correct: apply migration; assert a constraint or column the migration adds
await applyTestMigrations(testDatabase)

const orderColumns = await listColumns(testDatabase, 'orders')

expect(orderColumns).toEqual(
  expect.arrayContaining(['status', 'customer_id']),
)
```

## Assert the boundary contract

Assert status, stable error `code`, and fields callers depend on. Skip private
helper calls, log-spy spam, and internal payload shapes unless that shape is
the public contract.

```typescript
// ❌ Incorrect: couples to repository internals
expect(orderRepository._lastInsertPayload.lineItems[0]._tmp).toBeDefined()

// ✅ Correct: public HTTP / service outcome
expect(response.status).toBe(201)
expect(response.body).toMatchObject({
  id: expect.any(String),
  status: 'pending',
})
```

## Isolation

Each test owns its data and restores doubles afterward (`vi.restoreAllMocks`,
delete seeded rows). Assume parallel workers — no fixed emails, ids, or global
mutable singletons.

## Pyramid placement

- **Unit** — pure logic / single module; all deps stubbed; fastest.
- **Integration** — a few modules together across in-process or HTTP; fakes or
  thin real store as above.
- **E2E** — critical browser journeys only; not exhaustive API matrices.
