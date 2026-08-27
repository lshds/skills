---
name: database-patterns
description: >-
  Runtime data-access guidelines for migrations, queries, transactions, and
  ORM. This skill should be used when writing, reviewing, or refactoring
  data-access code to ensure safe production changes — including a quick
  column rename, a seed wipe, a backfill, or moving HTTP out of a transaction.
  Prefer forward-only migrations and parameterized queries over ad-hoc SQL.
  Triggers on tasks involving migrations, expand/contract, backfill, N+1,
  transactions, outbox, HTTP in a transaction, Prisma/Drizzle/Knex, connection
  pools, seeds, TRUNCATE, migrate reset, db push, or destructive SQL.
---

# Database Skills

Runtime data access: migrations, expand/contract, query hygiene, transactions,
ORM vs raw SQL, pools, and seeds. Prefer safe, reversible production changes.

**Domain:** runtime data access on a live database — how you migrate, query,
transact, and seed existing data under production constraints.
**Owns:** versioned forward-only migrations; expand/contract under rolling
deploys; query hygiene (projection, pagination, N+1, batched updates);
transactions, isolation, and lock order; ORM vs parameterized raw SQL;
connection pools; idempotent seeds; destructive-ops approval on shared data.
**Does not own:** which entities, keys, relations, or indexes to add (schema
shape); request-handler I/O, validation placement, or HTTP contracts; error
taxonomy and client-message mapping; authz/tenancy policy (only how a query is
bounded once a filter exists).

## When to activate

- Writing or reviewing migrations, backfills, or expand/contract
- Reviewing queries for field selection, pagination, or N+1
- Wrapping multi-step writes, moving HTTP out of a transaction, or choosing isolation
- Choosing ORM vs parameterized raw SQL (Prisma, Drizzle, Knex)
- Configuring connection pools or statement/idle timeouts
- Adding or reviewing seeds and fixtures
- Planning DROP, TRUNCATE, or mass DELETE against shared data

## Core Concepts

### Write vs review

- Pick one mode from the user ask — don’t mix output shapes
- **Write** (implement, fix, refactor): apply these defaults in migrations and data-access code; no review report unless asked
- **Review**: named scope only; report concrete misses in this skill’s domain
- Skip findings outside that domain

### Migrations

Every production schema change is a migration file — never alter prod by hand.
Migrations are forward-only in production; undo with a new forward migration.
Once applied, a migration is immutable. See
[migrations.md](references/migrations.md).

### Expand/contract

Never rename or drop in one shot on a live system. Expand (add new), dual-write
and backfill, cut the app over, then contract (drop old) in a later migration.
See [migrations.md](references/migrations.md).

### Query hygiene

Select only the columns you need; paginate or limit every unbounded list; fix
N+1 with a join, batch load, or ORM include. See
[query-hygiene.md](references/query-hygiene.md).

### Transactions / isolation

Use a transaction when multiple writes must succeed or fail together. Keep
transactions short; use a consistent lock order; prefer the engine default
isolation unless a measured bug needs a stronger level. See
[transactions.md](references/transactions.md).

### ORM vs raw SQL

Prefer the repo’s ORM for CRUD. Use parameterized raw SQL only when the ORM
cannot express the query — never concatenate user input into SQL. See
[orm.md](references/orm.md).

### Connection / pool timeouts

Size the pool for the process; set idle and connection timeouts so stuck
clients release. Pass a shared pool into the ORM — never open a new pool per
request. See [orm.md](references/orm.md).

### Seeds / fixtures

Seeds must be idempotent and safe to re-run. Never put production secrets,
real customer data, or live credentials in seed files. See
[seeds.md](references/seeds.md).

### Destructive ops

`DROP`, `TRUNCATE`, mass `DELETE`, and irreversible data transforms need
explicit user approval before you run or generate them against shared
environments. Follow the approve → backup → dry-run → execute checklist in
[migrations.md](references/migrations.md).

### Common mistakes

| ❌ Incorrect | ✅ Correct |
| --- | --- |
| Manual prod SQL, or editing an already-applied file | Migration files; a new forward migration to undo |
| Rename/drop in one live migration | Expand → dual-write/backfill → contract later |
| `SELECT *` / unbounded lists on hot paths | Explicit columns + `LIMIT` / pagination |
| String-concatenated SQL | ORM or parameterized bindings |
| Prod secrets in seeds, one-shot inserts, or `DROP`/`TRUNCATE` without ask | Idempotent synthetic seeds; explicit approval on shared data |

## Practice areas

Read the reference for the task — don't load every file.

| Area | Reference |
| --- | --- |
| Migrations / expand-contract / destructive ops | [migrations.md](references/migrations.md) |
| Transactions / isolation / lock order | [transactions.md](references/transactions.md) |
| Fields / pagination / N+1 | [query-hygiene.md](references/query-hygiene.md) |
| ORM / raw SQL / prepared statements / pools | [orm.md](references/orm.md) |
| Seeds / env boundaries | [seeds.md](references/seeds.md) |
