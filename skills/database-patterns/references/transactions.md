# Transactions

Prefer a short transaction for multi-step writes that must succeed or fail
together. Keep it tiny — no external HTTP or long work inside — so locks stay
brief and the database never ends up half-updated.

## When to open a transaction

Prefer an explicit transaction when several writes form one business unit of
work over committing each write alone. Skip the transaction for a single
independent write — it adds lock time without buying atomicity. Adjust
balances in SQL so a concurrent transaction cannot clobber a stale in-memory
value. Lock rows in a stable order (lower id first) so concurrent transfers
cannot deadlock.

```typescript
// ❌ Incorrect: two related writes without a transaction
export async function transferFunds(
  fromAccountId: number,
  toAccountId: number,
  transferAmount: number,
): Promise<void> {
  await db
    .update(account)
    .set({ balance: sql`${account.balance} - ${transferAmount}` })
    .where(eq(account.id, fromAccountId))
  await db
    .update(account)
    .set({ balance: sql`${account.balance} + ${transferAmount}` })
    .where(eq(account.id, toAccountId))
}

// ✅ Correct: both writes commit or neither does; lock lower id first
export async function transferFunds(
  fromAccountId: number,
  toAccountId: number,
  transferAmount: number,
): Promise<void> {
  const [firstAccountId, secondAccountId] =
    fromAccountId < toAccountId
      ? [fromAccountId, toAccountId]
      : [toAccountId, fromAccountId]
  const isDebitingFirst = firstAccountId === fromAccountId

  await db.transaction(async (transaction) => {
    await transaction
      .update(account)
      .set({
        balance: isDebitingFirst
          ? sql`${account.balance} - ${transferAmount}`
          : sql`${account.balance} + ${transferAmount}`,
      })
      .where(eq(account.id, firstAccountId))
    await transaction
      .update(account)
      .set({
        balance: isDebitingFirst
          ? sql`${account.balance} + ${transferAmount}`
          : sql`${account.balance} - ${transferAmount}`,
      })
      .where(eq(account.id, secondAccountId))
  })
}
```

## Keep transactions short

Long transactions hold locks, grow WAL, and raise deadlock risk. Do only
database work inside the transaction. Moving `fetch` to the line after commit
still loses the charge if the process crashes before the paid update.

```text
TX 1     Insert the business row and an outbox row that describes the work.
         Commit. No HTTP.
WORKER   Claim pending outbox rows. Perform the HTTP call outside any
         database transaction.
TX 2     Mark the order paid or failed and the outbox done. Retry-safe.
```

```typescript
// ❌ Incorrect: hold a transaction open across an HTTP call
export async function chargeOrder(
  userId: number,
  chargeAmount: number,
): Promise<{ id: number }> {
  return db.transaction(async (transaction) => {
    const [createdOrder] = await transaction
      .insert(order)
      .values({ userId, status: 'pending', amount: chargeAmount })
      .returning({ id: order.id })

    if (createdOrder === undefined) {
      throw new Error('failed to create order')
    }

    await fetch('https://payments.example/charge', {
      method: 'POST',
      body: JSON.stringify({
        orderId: createdOrder.id,
        amount: chargeAmount,
      }),
    })

    await transaction
      .update(order)
      .set({ status: 'paid' })
      .where(eq(order.id, createdOrder.id))

    return createdOrder
  })
}

// ❌ Incorrect: charge then mark paid in a later commit — crash loses the intent
export async function chargeOrder(
  userId: number,
  chargeAmount: number,
): Promise<{ id: number }> {
  const [createdOrder] = await db
    .insert(order)
    .values({ userId, status: 'pending', amount: chargeAmount })
    .returning({ id: order.id })

  if (createdOrder === undefined) {
    throw new Error('failed to create order')
  }

  await fetch('https://payments.example/charge', {
    method: 'POST',
    body: JSON.stringify({
      orderId: createdOrder.id,
      amount: chargeAmount,
    }),
  })

  await db
    .update(order)
    .set({ status: 'paid' })
    .where(eq(order.id, createdOrder.id))

  return createdOrder
}

// ✅ Correct: short tx records intent; a worker performs the HTTP side effect
export async function chargeOrder(
  userId: number,
  chargeAmount: number,
): Promise<{ id: number }> {
  return db.transaction(async (transaction) => {
    const [createdOrder] = await transaction
      .insert(order)
      .values({ userId, status: 'pending', amount: chargeAmount })
      .returning({ id: order.id })

    if (createdOrder === undefined) {
      throw new Error('failed to create order')
    }

    await transaction.insert(outbox).values({
      type: 'charge_order',
      payload: { orderId: createdOrder.id, amount: chargeAmount },
    })

    return createdOrder
  })
}
// Worker (separate process): claim pending outbox → HTTP charge → short tx:
// mark order paid (or failed), insert payment, mark outbox done. Retry-safe;
// still no HTTP inside a database transaction.
```

- Use an outbox whenever an external side effect must not be lost: in one
  short transaction, write the business row and an outbox row that describes
  the work. A worker reads pending outbox rows, performs the HTTP call, and
  marks each row done. Intent and state change commit together.

## Isolation defaults

Prefer the engine default (`READ COMMITTED` on PostgreSQL and MySQL) unless
you have a measured anomaly that needs a stronger level.

```typescript
// ❌ Incorrect: serializable on every request “just in case”
export async function insertClickEvent(): Promise<void> {
  await db.transaction(
    async (transaction) => {
      await transaction.insert(event).values({ type: 'click' })
    },
    { isolationLevel: 'serializable' },
  )
}

// ✅ Correct: default isolation for ordinary writes
export async function insertClickEvent(): Promise<void> {
  await db.transaction(async (transaction) => {
    await transaction.insert(event).values({ type: 'click' })
  })
}
```

- Raise isolation only for a proven race (lost update, write skew) and keep
  that transaction tiny.
- Document why a non-default level is required at the call site.

## Lock order and deadlocks

Concurrent transactions that touch the same rows in different orders
deadlock. Always lock and update rows in a stable order (for example by
primary key).

```text
DEADLOCK  Tx A updates id 2 then 1; Tx B updates id 1 then 2.
SAFE      Both lock the lower id first, then the higher — ignore debit/credit
          argument order.
```

```typescript
// ❌ Incorrect: lock order depends on argument order
export async function transferFunds(
  fromAccountId: number,
  toAccountId: number,
  transferAmount: number,
): Promise<void> {
  await db.transaction(async (transaction) => {
    await transaction
      .update(account)
      .set({ balance: sql`${account.balance} - ${transferAmount}` })
      .where(eq(account.id, fromAccountId))
    await transaction
      .update(account)
      .set({ balance: sql`${account.balance} + ${transferAmount}` })
      .where(eq(account.id, toAccountId))
  })
}

// ✅ Correct: always lock the lower id first
export async function transferFunds(
  fromAccountId: number,
  toAccountId: number,
  transferAmount: number,
): Promise<void> {
  const [firstAccountId, secondAccountId] =
    fromAccountId < toAccountId
      ? [fromAccountId, toAccountId]
      : [toAccountId, fromAccountId]
  const isDebitingFirst = firstAccountId === fromAccountId

  await db.transaction(async (transaction) => {
    await transaction
      .update(account)
      .set({
        balance: isDebitingFirst
          ? sql`${account.balance} - ${transferAmount}`
          : sql`${account.balance} + ${transferAmount}`,
      })
      .where(eq(account.id, firstAccountId))
    await transaction
      .update(account)
      .set({
        balance: isDebitingFirst
          ? sql`${account.balance} + ${transferAmount}`
          : sql`${account.balance} - ${transferAmount}`,
      })
      .where(eq(account.id, secondAccountId))
  })
}
```

## ORM transaction APIs

Use the repo’s transaction helper. Abort on business failure so the whole
unit rolls back.

```typescript
// ❌ Incorrect: return on failure — Drizzle still commits the unit
export async function debitAccount(
  fromAccountId: number,
  transferAmount: number,
): Promise<void> {
  await db.transaction(async (transaction) => {
    const [sourceAccount] = await transaction
      .select({ id: account.id, balance: account.balance })
      .from(account)
      .where(eq(account.id, fromAccountId))

    if (sourceAccount === undefined) {
      return
    }

    if (sourceAccount.balance < transferAmount) {
      return
    }

    await transaction
      .update(account)
      .set({ balance: sql`${account.balance} - ${transferAmount}` })
      .where(eq(account.id, fromAccountId))
  })
}

// ✅ Correct: Drizzle — throw to abort the unit
export async function debitAccount(
  fromAccountId: number,
  transferAmount: number,
): Promise<void> {
  await db.transaction(async (transaction) => {
    const [sourceAccount] = await transaction
      .select({ id: account.id, balance: account.balance })
      .from(account)
      .where(eq(account.id, fromAccountId))

    if (sourceAccount === undefined) {
      throw new Error(`account ${fromAccountId} not found`)
    }

    if (sourceAccount.balance < transferAmount) {
      throw new Error('insufficient funds')
    }

    await transaction
      .update(account)
      .set({ balance: sql`${account.balance} - ${transferAmount}` })
      .where(eq(account.id, fromAccountId))
  })
}
```

```typescript
// ❌ Incorrect: return on failure — Prisma still commits the unit
export async function debitAccount(
  fromAccountId: number,
  transferAmount: number,
): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    const sourceAccount = await transaction.account.findUniqueOrThrow({
      where: { id: fromAccountId },
    })

    if (sourceAccount.balance < transferAmount) {
      return
    }

    await transaction.account.update({
      where: { id: fromAccountId },
      data: { balance: { decrement: transferAmount } },
    })
  })
}

// ✅ Correct: Prisma — interactive transaction
export async function debitAccount(
  fromAccountId: number,
  transferAmount: number,
): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    const sourceAccount = await transaction.account.findUniqueOrThrow({
      where: { id: fromAccountId },
    })

    if (sourceAccount.balance < transferAmount) {
      throw new Error('insufficient funds')
    }

    await transaction.account.update({
      where: { id: fromAccountId },
      data: { balance: { decrement: transferAmount } },
    })
  })
}
```

```typescript
// ❌ Incorrect: return on failure — Knex still commits the unit
export async function debitAccount(
  fromAccountId: number,
  transferAmount: number,
): Promise<void> {
  await knex.transaction(async (transaction) => {
    const sourceAccount = await transaction('account')
      .where({ id: fromAccountId })
      .forUpdate()
      .first()

    if (sourceAccount === undefined) {
      return
    }

    if (sourceAccount.balance < transferAmount) {
      return
    }

    await transaction('account')
      .where({ id: fromAccountId })
      .decrement('balance', transferAmount)
  })
}

// ✅ Correct: Knex — explicit transaction callback
export async function debitAccount(
  fromAccountId: number,
  transferAmount: number,
): Promise<void> {
  await knex.transaction(async (transaction) => {
    const sourceAccount = await transaction('account')
      .where({ id: fromAccountId })
      .forUpdate()
      .first()

    if (sourceAccount === undefined) {
      throw new Error(`account ${fromAccountId} not found`)
    }

    if (sourceAccount.balance < transferAmount) {
      throw new Error('insufficient funds')
    }

    await transaction('account')
      .where({ id: fromAccountId })
      .decrement('balance', transferAmount)
  })
}
```
