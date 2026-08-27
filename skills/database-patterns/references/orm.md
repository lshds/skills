# ORM

Prefer the repo’s existing ORM (Prisma, Drizzle, or Knex) for ordinary CRUD
over hand-written SQL. Use raw SQL only when the ORM cannot express it, and
then only with bound parameters — never string concatenation.

## Match the repo ORM

Use the ORM the project already depends on — Prisma, Drizzle, or Knex — and
extend its existing client and query patterns. Do not add another ORM beside
it.

```typescript
// ❌ Incorrect: add Knex beside an existing Drizzle client for one query
import knex from 'knex'

export async function fetchUserById(userId: number) {
  const knexClient = knex({
    client: 'pg',
    connection: process.env.DATABASE_URL,
  })

  return knexClient('user').where({ id: userId }).first()
}

// ✅ Correct: use the repo’s Drizzle client
export async function fetchUserById(userId: number) {
  const [userRow] = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.id, userId))

  return userRow
}
```

## ORM first for CRUD

Typed insert/select/update/delete covers ordinary paths. Infer insert and
select types from the schema instead of hand-rolling parallel interfaces.
Use the table and column identifiers already in the schema.

```typescript
import { eq, sql } from 'drizzle-orm'

type UserInsert = typeof user.$inferInsert
type UserRow = typeof user.$inferSelect

// ❌ Incorrect: raw SQL for an ordinary insert the ORM can express
export async function createUser(email: string, userName: string) {
  await db.execute(
    sql`INSERT INTO "user" (email, name) VALUES (${email}, ${userName})`,
  )
}

// ✅ Correct: Drizzle CRUD with field projection and inferred types
export async function createUser(userData: UserInsert): Promise<UserRow> {
  const [createdUser] = await db.insert(user).values(userData).returning()

  if (createdUser === undefined) {
    throw new Error('failed to create user')
  }

  return createdUser
}

export async function fetchUserEmail(
  userId: number,
): Promise<string | undefined> {
  const [userRow] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))

  return userRow?.email
}

export async function renameUser(
  userId: number,
  userName: string,
): Promise<void> {
  await db.update(user).set({ name: userName }).where(eq(user.id, userId))
}

export async function deleteUser(userId: number): Promise<void> {
  await db.delete(user).where(eq(user.id, userId))
}
```

```typescript
// ❌ Incorrect: $executeRaw for an ordinary create the client can express
export async function createUser(email: string, userName: string) {
  await prisma.$executeRaw`
    INSERT INTO "user" (email, name) VALUES (${email}, ${userName})
  `
}

// ✅ Correct: Prisma CRUD
export async function createUser(email: string, userName: string) {
  return prisma.user.create({
    data: { email, name: userName },
    select: { id: true, email: true },
  })
}

export async function renameUser(
  userId: number,
  userName: string,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { name: userName },
  })
}
```

```typescript
// ❌ Incorrect: knex.raw for an ordinary insert the query builder can express
export async function createUser(email: string, userName: string) {
  await knex.raw('INSERT INTO "user" (email, name) VALUES (?, ?)', [
    email,
    userName,
  ])
}

// ✅ Correct: Knex query builder against the existing table name
export async function createUser(email: string, userName: string) {
  const [createdUser] = await knex('user')
    .insert({ email, name: userName })
    .returning(['id', 'email'])

  if (createdUser === undefined) {
    throw new Error('failed to create user')
  }

  return createdUser
}

export async function renameUser(
  userId: number,
  userName: string,
): Promise<void> {
  await knex('user').where({ id: userId }).update({ name: userName })
}
```

## Parameterized raw SQL only

When you need SQL the ORM cannot generate, bind values — never concatenate
untrusted input into the string. Narrow `unknown` at the boundary; do not
cast.

```typescript
import { sql } from 'drizzle-orm'

interface OrderIdRow {
  id: number
}

// ❌ Incorrect: string concatenation + cast — injection risk
export async function fetchOrderIdsByStatus(rawOrderStatus: unknown) {
  const orderStatus = rawOrderStatus as string

  return db.execute(
    sql.raw(`SELECT id FROM "order" WHERE status = '${orderStatus}'`),
  )
}

// ✅ Correct: narrow at the boundary, then bind the value
export async function fetchOrderIdsByStatus(
  rawOrderStatus: unknown,
): Promise<OrderIdRow[]> {
  if (typeof rawOrderStatus !== 'string') {
    throw new Error('status is required')
  }

  const orderStatus = rawOrderStatus

  return db.execute(sql`
    SELECT id FROM "order" WHERE status = ${orderStatus}
  `)
}
```

```typescript
interface OrderIdRow {
  id: number
}

// ❌ Incorrect: $queryRawUnsafe + concatenation — injection risk
export async function fetchOrderIdsByStatus(rawOrderStatus: unknown) {
  const orderStatus = rawOrderStatus as string

  return prisma.$queryRawUnsafe(
    `SELECT id FROM "order" WHERE status = '${orderStatus}'`,
  )
}

// ✅ Correct: Prisma parameterized raw
export async function fetchOrderIdsByStatus(
  rawOrderStatus: unknown,
): Promise<OrderIdRow[]> {
  if (typeof rawOrderStatus !== 'string') {
    throw new Error('status is required')
  }

  const orderStatus = rawOrderStatus

  return prisma.$queryRaw<OrderIdRow[]>`
    SELECT id FROM "order" WHERE status = ${orderStatus}
  `
}
```

```typescript
// ❌ Incorrect: interpolate the value into the SQL string
export async function fetchOrderIdsByStatus(rawOrderStatus: unknown) {
  const orderStatus = rawOrderStatus as string

  return knex.raw(`SELECT id FROM "order" WHERE status = '${orderStatus}'`)
}

// ✅ Correct: Knex bindings
export async function fetchOrderIdsByStatus(rawOrderStatus: unknown) {
  if (typeof rawOrderStatus !== 'string') {
    throw new Error('status is required')
  }

  const orderStatus = rawOrderStatus

  return knex.raw('SELECT id FROM "order" WHERE status = ?', [orderStatus])
}
```

## Joins and relation loads

Prefer one join or one relation load over looping queries. Project only the
columns the caller needs — skip large text/json fields on list paths.
Join on the foreign keys already in the schema (`author_id` → `authorId` in
the ORM).

```typescript
import { eq } from 'drizzle-orm'

const LIST_PAGE_SIZE = 20

// ❌ Incorrect: select entire joined rows when the caller returns three fields
export async function fetchUserPostTitles() {
  return db.select().from(user).leftJoin(post, eq(user.id, post.authorId))
}

// ✅ Correct: explicit projection across the join
export async function fetchUserPostTitles() {
  return db
    .select({
      userId: user.id,
      userName: user.name,
      postTitle: post.title,
    })
    .from(user)
    .leftJoin(post, eq(user.id, post.authorId))
    .limit(LIST_PAGE_SIZE)
}

// ✅ Correct: Drizzle relational query — columns + with + limit
export async function fetchPostsWithAuthors() {
  return db.query.post.findMany({
    columns: {
      id: true,
      title: true,
    },
    with: {
      author: {
        columns: { id: true, name: true },
      },
    },
    limit: LIST_PAGE_SIZE,
  })
}

// ✅ Correct: Prisma relation load with select
export async function fetchUsersWithPostTitles() {
  return prisma.user.findMany({
    take: LIST_PAGE_SIZE,
    select: {
      id: true,
      name: true,
      post: { select: { title: true } },
    },
  })
}
```

## Prepared statements for hot paths

Prepare frequent, identical-shape queries once and reuse them. Do not
re-parse the same SQL on every request for a hot lookup. When the driver
exposes prepare (Drizzle + node-postgres), do that at module scope. Prisma
and Knex already send parameterized queries through the driver — do not add
a second prepare layer beside them.

```typescript
import { eq, sql } from 'drizzle-orm'

// ❌ Incorrect: rebuild the same select on every call
export async function fetchUserByEmail(email: string) {
  const [userRow] = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.email, email))

  return userRow
}

// ✅ Correct: prepare once, execute with bound placeholders
const preparedFetchUserByEmail = db
  .select({ id: user.id, email: user.email })
  .from(user)
  .where(eq(user.email, sql.placeholder('email')))
  .prepare('fetchUserByEmail')

export async function fetchUserByEmail(email: string) {
  const [userRow] = await preparedFetchUserByEmail.execute({ email })

  return userRow
}
```

## Connection pool

Share one pool for the process. Cap `max`, set idle and connect timeouts, and
hand the pool to the ORM. Never create a pool inside a request handler, and
never open a second `pg.Pool` beside Prisma or Knex — each has its own pool.

```typescript
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'

const POOL_MAX_CONNECTIONS = 20
const IDLE_TIMEOUT_MS = 30_000
const CONNECTION_TIMEOUT_MS = 2_000

const databaseUrl = process.env.DATABASE_URL

if (databaseUrl === undefined) {
  throw new Error('DATABASE_URL is required')
}

// ❌ Incorrect: new pool per request — exhausts connections
export async function fetchUserById(userId: number) {
  const requestPool = new Pool({ connectionString: databaseUrl })
  const requestDb = drizzle(requestPool)
  const [userRow] = await requestDb
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.id, userId))

  await requestPool.end()

  return userRow
}

// ✅ Correct: module-scoped pool with timeouts
const connectionPool = new Pool({
  connectionString: databaseUrl,
  max: POOL_MAX_CONNECTIONS,
  idleTimeoutMillis: IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
})

export const db = drizzle(connectionPool, { schema })
```

```typescript
// ❌ Incorrect: new PrismaClient per request — exhausts connections
export async function fetchUserById(userId: number) {
  const requestPrisma = new PrismaClient()

  return requestPrisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  })
}

// ✅ Correct: Prisma — one client per process; pool via the datasource URL
// postgresql://USER:PASS@HOST:5432/DB?connection_limit=10&pool_timeout=2
export const prisma = new PrismaClient()
```

```typescript
import createKnex from 'knex'

const POOL_MAX_CONNECTIONS = 20
const IDLE_TIMEOUT_MS = 30_000
const CONNECTION_TIMEOUT_MS = 2_000

const databaseUrl = process.env.DATABASE_URL

if (databaseUrl === undefined) {
  throw new Error('DATABASE_URL is required')
}

// ❌ Incorrect: new Knex client per request — exhausts connections
export async function fetchUserById(userId: number) {
  const requestKnex = createKnex({
    client: 'pg',
    connection: databaseUrl,
  })

  return requestKnex('user').where({ id: userId }).first()
}

// ✅ Correct: Knex — one client per process with pool timeouts
export const knex = createKnex({
  client: 'pg',
  connection: databaseUrl,
  pool: {
    min: 0,
    max: POOL_MAX_CONNECTIONS,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    acquireTimeoutMillis: CONNECTION_TIMEOUT_MS,
  },
})
```

- Size `max` (or Prisma `connection_limit`) for the process and the
  database’s connection limit (workers × max must fit under the server cap).
- Always let the pool reclaim clients — do not hold a checked-out client
  across external HTTP.

## Type inference over duplicate models

Let the ORM own the row type. Do not maintain a parallel hand-written
interface that drifts from the schema.

```typescript
// ❌ Incorrect: parallel interface that will drift
interface UserRow {
  id: number
  email: string
  name: string
}

// ✅ Correct: infer from the schema definition
type UserRow = typeof user.$inferSelect
type UserInsert = typeof user.$inferInsert
```
