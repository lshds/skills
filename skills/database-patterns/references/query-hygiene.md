# Query Hygiene

Prefer narrow, bounded queries over fetching every column and every row so
hot paths stay fast and predictable under load.

## Select only needed columns

Prefer an explicit column list over `SELECT *` or a full-row ORM select.
Wide rows waste I/O and memory — project only the fields the caller returns.

```typescript
// ❌ Incorrect: pull every column when the caller needs two
export async function fetchTenantUserEmails(tenantId: number) {
  return db.select().from(user).where(eq(user.tenantId, tenantId))
}

// ✅ Correct: select only the fields you return
export async function fetchTenantUserEmails(tenantId: number) {
  return db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.tenantId, tenantId))
}
```

```sql
-- ❌ Incorrect: SELECT * on a hot path
SELECT * FROM "order" WHERE tenant_id = 42;

-- ✅ Correct: explicit column list; quote reserved table names in raw SQL
SELECT id, status, total_cents FROM "order" WHERE tenant_id = 42;
```

## Paginate or limit unbounded lists

Unbounded result sets grow with data and will eventually time out or OOM.
Always `LIMIT`, offset-page, or cursor-page list endpoints.

```typescript
const PAGE_SIZE = 20

// ❌ Incorrect: load every matching row
export async function fetchTenantOrders(tenantId: number) {
  return db.select().from(order).where(eq(order.tenantId, tenantId))
}

// ✅ Correct: bounded offset page for small lists + the columns you return
export async function fetchTenantOrderPage(
  tenantId: number,
  pageNumber: number,
) {
  return db
    .select({
      id: order.id,
      status: order.status,
      totalCents: order.totalCents,
    })
    .from(order)
    .where(eq(order.tenantId, tenantId))
    .orderBy(asc(order.id))
    .limit(PAGE_SIZE)
    .offset((pageNumber - 1) * PAGE_SIZE)
}

// ✅ Correct: cursor pagination for large tables
export async function fetchTenantOrdersAfterCursor(
  tenantId: number,
  lastOrderId: number,
) {
  return db
    .select({
      id: order.id,
      status: order.status,
      totalCents: order.totalCents,
    })
    .from(order)
    .where(and(eq(order.tenantId, tenantId), gt(order.id, lastOrderId)))
    .orderBy(asc(order.id))
    .limit(PAGE_SIZE)
}
```

- Prefer cursor pagination when offsets get deep or the table is large.
- Order by a stable unique key so pages do not skip or duplicate rows.

## Eliminate N+1

One query per parent row multiplies latency. Load children in one join or
one batched query, still projected and bounded.

```text
N+1      One child query per parent row — latency grows with page size.
BATCH    One parent page, one child query for those ids, then group in memory.
RELATION ORM include / `with` in one round trip — still `select` + `take`.
```

```typescript
const PAGE_SIZE = 20
const ORDERS_PER_USER = 20

// ❌ Incorrect: N+1 — one query per user; mutates rows in place
export async function fetchTenantUsersWithOrders(tenantId: number) {
  const userRows = await db
    .select()
    .from(user)
    .where(eq(user.tenantId, tenantId))

  for (const userRow of userRows) {
    userRow.orderRows = await db
      .select()
      .from(order)
      .where(eq(order.userId, userRow.id))
  }

  return userRows
}

// ✅ Correct: bounded parent page, projected columns, one batched child query
export async function fetchTenantUsersWithOrders(tenantId: number) {
  const userRows = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.tenantId, tenantId))
    .orderBy(asc(user.id))
    .limit(PAGE_SIZE)

  const userIds = userRows.map((userRow) => userRow.id)

  if (userIds.length === 0) {
    return []
  }

  const orderRows = await db
    .select({
      id: order.id,
      userId: order.userId,
      status: order.status,
    })
    .from(order)
    .where(inArray(order.userId, userIds))
    .orderBy(asc(order.id))

  const orderRowsByUserId = new Map<number, typeof orderRows>()

  for (const orderRow of orderRows) {
    const existingOrderRows = orderRowsByUserId.get(orderRow.userId) ?? []

    if (existingOrderRows.length >= ORDERS_PER_USER) {
      continue
    }

    orderRowsByUserId.set(orderRow.userId, [...existingOrderRows, orderRow])
  }

  return userRows.map((userRow) => ({
    ...userRow,
    orderRows: orderRowsByUserId.get(userRow.id) ?? [],
  }))
}

// ✅ Correct: ORM relation load with projection and bounds
export async function fetchTenantUsersWithOrderRelations(tenantId: number) {
  return prisma.user.findMany({
    where: { tenantId },
    take: PAGE_SIZE,
    orderBy: { id: 'asc' },
    select: {
      id: true,
      email: true,
      order: {
        select: { id: true, status: true, totalCents: true },
        take: ORDERS_PER_USER,
      },
    },
  })
}
```

- A batched `IN` still needs a per-parent cap; Prisma `take` on the relation
  does this in the query. Cap in memory only after a stable `orderBy`.

## Chunk large updates

Mass updates in one statement lock wide ranges. Process in batches with a
progress condition until none remain.

```typescript
const BATCH_SIZE = 1000

// ❌ Incorrect: update every row at once
export async function normalizeUserEmails(): Promise<void> {
  await db.update(user).set({ normalizedEmail: sql`lower(${user.email})` })
}

// ✅ Correct: process a fixed batch size until none remain
export async function normalizeUserEmails(): Promise<void> {
  let updatedCount = BATCH_SIZE

  while (updatedCount === BATCH_SIZE) {
    const batchRows = await db
      .select({ id: user.id })
      .from(user)
      .where(isNull(user.normalizedEmail))
      .limit(BATCH_SIZE)

    if (batchRows.length === 0) {
      return
    }

    const userIds = batchRows.map((batchRow) => batchRow.id)

    await db
      .update(user)
      .set({ normalizedEmail: sql`lower(${user.email})` })
      .where(inArray(user.id, userIds))

    updatedCount = batchRows.length
  }
}
```
