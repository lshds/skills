# ORM

Prefer the repo’s existing ORM (Prisma, Drizzle, or Knex) for ordinary CRUD
over hand-written SQL. Use raw SQL only when the ORM cannot express it, and
then only with bound parameters — never string concatenation. Each section
shows Drizzle in full; Prisma and Knex follow as short deltas of the same
rule. Prisma 7 client setup (generator, `prisma.config.ts`, driver adapter)
has its own section.

## Match the repo ORM

Use the ORM the project already depends on and extend its existing client and
query patterns. A second ORM beside it doubles the pools, types, and
migration paths for the same tables.

```typescript
import { eq } from 'drizzle-orm'
import knex from 'knex'
import { db } from './db'
import { user } from './schema'

// ❌ Incorrect: add Knex beside an existing Drizzle client for one query
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

Typed insert/select/update/delete covers ordinary paths. Hand-written SQL for
them loses the schema’s types and the column names the ORM already tracks.

```typescript
import { eq, sql } from 'drizzle-orm'
import { db } from './db'
import { user } from './schema'

type UserInsert = typeof user.$inferInsert
type UserRow = typeof user.$inferSelect

// ❌ Incorrect: raw SQL for an ordinary insert the ORM can express
export async function createUser(email: string, userName: string) {
  await db.execute(
    sql`INSERT INTO "user" (email, name) VALUES (${email}, ${userName})`,
  )
}

// ✅ Correct: Drizzle CRUD with field projection and inferred types
export async function createUser(newUser: UserInsert): Promise<UserRow> {
  const [createdUser] = await db.insert(user).values(newUser).returning()

  if (!createdUser) {
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

export async function renameUser(userId: number, userName: string) {
  await db.update(user).set({ name: userName }).where(eq(user.id, userId))
}
```

- Prisma: `prisma.user.create({ data: { email, name: userName }, select: { id: true, email: true } })`
  and `prisma.user.update({ where: { id: userId }, data: { name: userName } })`
  — not `$executeRaw` for the same insert or update.
- Knex: the query builder against the existing table name —
  `knex('user').insert({ email, name: userName }).returning(['id', 'email'])`
  and `knex('user').where({ id: userId }).update({ name: userName })` — not
  `knex.raw` with a hand-written `INSERT` or `UPDATE`.

## Type inference over duplicate models

Let the ORM own the row type. A parallel hand-written interface drifts from
the schema the first time a column changes.

```typescript
import { user } from './schema'

// ❌ Incorrect: parallel interface that drifts from the table definition
interface UserRow {
  id: number
  email: string
  name: string
}

// ✅ Correct: infer row and insert types from the table definition
export type UserRow = typeof user.$inferSelect
export type UserInsert = typeof user.$inferInsert
```

- Declare new identity keys with
  `integer('id').primaryKey().generatedAlwaysAsIdentity()` (drizzle-orm
  0.32+); `serial()` is the legacy PostgreSQL sequence column.
- Prisma: use the model types the generated client exports instead of
  redeclaring them.

## Parameterized raw SQL only

When you need SQL the ORM cannot generate, bind values — concatenating
untrusted input into the string is SQL injection. Narrow `unknown` at the
boundary; do not cast.

```typescript
import { sql } from 'drizzle-orm'
import { db } from './db'

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

- Prisma: the `prisma.$queryRaw<OrderIdRow[]>` tagged template binds each
  `${value}`; `$queryRawUnsafe` / `$executeRawUnsafe` with an interpolated
  string do not.
- Knex: `knex.raw('SELECT id FROM "order" WHERE status = ?', [orderStatus])`
  — `?` placeholders plus a bindings array, never a template literal.

## Joins and relation loads

Looping one query per row multiplies round trips, and selecting whole joined
rows drags large text/json columns onto list paths. Prefer one join or one
relation load, project only the columns the caller needs, and join on the
foreign keys already in the schema (`author_id` → `authorId` in the ORM).

```typescript
import { eq } from 'drizzle-orm'
import { db } from './db'
import { post, user } from './schema'

const LIST_PAGE_SIZE = 20

// ❌ Incorrect: select entire joined rows when the caller returns three fields
export async function fetchUserPostTitles() {
  return db
    .select()
    .from(user)
    .leftJoin(post, eq(user.id, post.authorId))
    .limit(LIST_PAGE_SIZE)
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
    columns: { id: true, title: true },
    with: {
      author: {
        columns: { id: true, name: true },
      },
    },
    limit: LIST_PAGE_SIZE,
  })
}
```

Relational queries (`db.query.post.findMany({ with })`) read relations
declared with the stable `relations()` helper, one call per table, exported
from the schema module that `drizzle(pool, { schema })` receives.

```typescript
import { relations } from 'drizzle-orm'
import { integer, pgTable, text } from 'drizzle-orm/pg-core'

export const user = pgTable('user', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
})

export const post = pgTable('post', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  authorId: integer('author_id')
    .notNull()
    .references(() => user.id),
  title: text('title').notNull(),
})

// ✅ Correct: relations() per table (drizzle-orm 0.x) — the default for relational queries
export const userRelations = relations(user, ({ many }) => ({
  posts: many(post),
}))

export const postRelations = relations(post, ({ one }) => ({
  author: one(user, { fields: [post.authorId], references: [user.id] }),
}))
```

- Prisma: nest `select` on the relation field and bound the list with
  `take` —
  `prisma.user.findMany({ take: LIST_PAGE_SIZE, select: { id: true, name: true, post: { select: { title: true } } } })`.
- Knex: one `leftJoin` with an explicit column list and `.limit()`, the same
  shape as the Drizzle join.

## Prepared statements for hot paths

Prepare frequent, identical-shape queries once and reuse them; rebuilding
the same SQL on every request re-parses it for a hot lookup. When the driver
exposes prepare (Drizzle + node-postgres), do that at module scope. Prisma
and Knex already send parameterized queries through the driver — do not add
a second prepare layer beside them.

```typescript
import { eq, sql } from 'drizzle-orm'
import { db } from './db'
import { user } from './schema'

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

A pool created per request exhausts the database’s connection limit under
load. Share one pool for the process, cap `max`, set idle and connect
timeouts, and hand the pool to the ORM. Never open a second `pg.Pool` beside
Prisma or Knex — each owns its pool.

```typescript
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const POOL_MAX_CONNECTIONS = 20
const IDLE_TIMEOUT_MS = 30_000
const CONNECTION_TIMEOUT_MS = 2_000

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required')
}

// ❌ Incorrect: new pool per request — exhausts connections
export async function fetchUserById(userId: number) {
  const requestPool = new Pool({ connectionString: databaseUrl })
  const requestDatabase = drizzle(requestPool)
  const [userRow] = await requestDatabase
    .select({ id: schema.user.id, email: schema.user.email })
    .from(schema.user)
    .where(eq(schema.user.id, userId))

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

- Size `max` for the process and the database’s connection limit (workers ×
  max must fit under the server cap). The same options go on the `pg` pool
  behind Drizzle or the Prisma 7 adapter; Prisma 6 sizes its pool with
  `connection_limit` / `pool_timeout` URL parameters.
- Knex: one module-scoped client —
  `createKnex({ client: 'pg', connection: databaseUrl, pool: { min: 0, max: POOL_MAX_CONNECTIONS, idleTimeoutMillis: IDLE_TIMEOUT_MS, acquireTimeoutMillis: CONNECTION_TIMEOUT_MS } })`;
  Knex names the connect timeout `acquireTimeoutMillis`.
- Always let the pool reclaim clients — do not hold a checked-out client
  across external HTTP.

## Prisma 7 client setup

Prisma 7 no longer reads the connection URL from `schema.prisma`, no longer
sizes the pool from `?connection_limit=`, and needs a driver adapter at
runtime.
Copying a Prisma 6 setup into a Prisma 7 project keeps the legacy generator
and leaves the pool on driver defaults.

```prisma
// ❌ Incorrect (Prisma 7): legacy generator; URL in the schema datasource
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ✅ Correct: prisma-client generator with an output path; no url in the datasource
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

```typescript
// ✅ Correct: prisma.config.ts at the project root owns the URL, migrations, and seed
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: { url: env('DATABASE_URL') },
})
```

```typescript
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

const POOL_MAX_CONNECTIONS = 10
const IDLE_TIMEOUT_MS = 30_000
const CONNECTION_TIMEOUT_MS = 2_000

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required')
}

// ✅ Correct: one module-scoped client; pool options go to the pg driver behind the adapter
const adapter = new PrismaPg({
  connectionString: databaseUrl,
  max: POOL_MAX_CONNECTIONS,
  idleTimeoutMillis: IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
})

export const prisma = new PrismaClient({ adapter })
```

- Never construct `PrismaClient` inside a request handler — each client opens
  its own pool and exhausts connections.
- Set both timeouts explicitly: Prisma 7 pool defaults come from `pg`
  (connection timeout 0, which waits forever; idle timeout 10s) and differ
  from Prisma 6.
- `migrations.seed` replaces the `package.json` `"prisma": { "seed" }` block,
  and `directUrl` is gone — the CLI uses `datasource.url`.
- Repos on Prisma 6 keep `prisma-client-js`, the datasource `url`, URL pool
  parameters, and the `package.json` seed block. Moving to 7 is a version
  upgrade, not part of an unrelated change.

## defineRelations only on drizzle-orm 1.x

`defineRelations()` (Relational Queries v2) ships only in the drizzle-orm 1.0
pre-release line. Proposing it on a 0.x repo means moving to a release
candidate, so `relations()` per table stays the default.

- When the repo already runs drizzle-orm 1.x, follow its single central
  `defineRelations()` definition — `r.one.user({ from: r.post.authorId, to: r.user.id })`,
  `r.many.post()` — passed as `drizzle({ client, relations })`.
- Never propose moving from `relations()` to `defineRelations()` while 1.0
  is not a stable release.
