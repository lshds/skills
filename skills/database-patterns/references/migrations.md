# Migrations

Prefer versioned, reviewed migration files over manual production SQL, and
forward-only changes in production over editing or rolling back an
already-applied file, so every environment applies the same history safely.

## Forward-only files

Ship every production schema change as a migration file through the repo
migrator. Generate locally, apply forward everywhere — never push, reset, or
edit an already-applied file.

```bash
# ❌ Incorrect: wipe or skip history instead of a forward phase
# npx prisma migrate reset
# npx drizzle-kit push
# npx knex migrate:rollback

# ✅ Correct: Prisma — create locally, deploy forward in production
npx prisma migrate dev --name add_user_avatar
npx prisma migrate deploy
npx prisma migrate dev --create-only --name add_user_email_index

# ✅ Correct: Drizzle Kit — generate files, then migrate forward
npx drizzle-kit generate
npx drizzle-kit migrate

# ✅ Correct: Knex — create and apply forward
npx knex migrate:make add_user_avatar
npx knex migrate:latest
```

- Give each migration an UP and a DOWN, or mark it irreversible on purpose.
- Keep schema changes and data backfills in separate migrations.
- Never edit a migration that has already run in a shared environment — add a
  new one.
- Review generated SQL before commit.

## Expand and contract

When the new shape cannot coexist with the old one in a single deploy
(rename, type change, drop, split, or tighten nullability), expand first.
Never `RENAME COLUMN` or `ALTER COLUMN ... TYPE` in place under rolling
deploys.

```text
EXPAND   Add the new column/table (nullable or with default).
         Deploy dual-write; backfill (convert on type change; handle bad casts).
MIGRATE  Deploy: read from new, still write both. Verify consistency.
CONTRACT Deploy: app uses only new. Drop the old column/table later.
```

```sql
-- ❌ Incorrect: rename or retype in place (PostgreSQL USING shown)
ALTER TABLE "user" RENAME COLUMN username TO display_name;
ALTER TABLE "user" ALTER COLUMN age TYPE INTEGER USING age::integer;

-- ✅ Correct: add the new columns; dual-write and backfill; drop old later
ALTER TABLE "user" ADD COLUMN display_name TEXT;
ALTER TABLE "user" ADD COLUMN age_years INTEGER;
-- dual-write + backfill, then read from the new columns
-- later migration, after the app uses only the new columns:
-- ALTER TABLE "user" DROP COLUMN username;
-- ALTER TABLE "user" DROP COLUMN age;
```

- Drop only after the app no longer reads or writes the old column.
- Keep the table, column, and index names already in the schema; do not rename
  for style.
- Quote reserved table names in raw SQL (`"user"`, `"order"` on PostgreSQL;
  `` `user` ``, `` `order` `` on MySQL). ORM identifiers stay unquoted.

## Columns and indexes

Column and index work is the same flow: EXPAND with a safe add, MIGRATE the
app onto it, CONTRACT anything superseded. Never bare `NOT NULL` or a blocking
index build on a live table.

```text
EXPAND   Add column nullable or with a default; build the index online.
MIGRATE  App writes/reads the new column; backfill before tightening constraints.
CONTRACT Drop superseded columns/indexes only after the app has moved on.
```

```sql
-- ❌ Incorrect: rewrite or lock the live table while expanding
ALTER TABLE "user" ADD COLUMN role TEXT NOT NULL;
CREATE INDEX user_email_idx ON "user" (email);

-- ✅ Correct: PostgreSQL — nullable or defaulted add; online index
ALTER TABLE "user" ADD COLUMN avatar_url TEXT;
ALTER TABLE "user" ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX CONCURRENTLY user_email_idx ON "user" (email);

-- ✅ Correct: MySQL 8+ — online DDL when the server supports it
ALTER TABLE `user` ADD COLUMN avatar_url TEXT;
ALTER TABLE `user`
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE `user`
  ADD INDEX user_email_idx (email), ALGORITHM=INPLACE, LOCK=NONE;
```

- PostgreSQL: `CREATE INDEX CONCURRENTLY` cannot run inside a transaction —
  use an empty/custom migration and the tool’s non-transactional path.
- MySQL: prefer `ALGORITHM=INPLACE, LOCK=NONE` when the server supports it;
  some alters still copy the table.

## Batched backfill

Large updates in one transaction hold locks and bloat WAL. Backfill in
batches, then cut the app over to the filled column.

```text
EXPAND   Add the target column (nullable or with a default).
MIGRATE  Backfill in batches; verify; app reads from the filled column.
CONTRACT Drop or ignore the source only after cutover.
```

```sql
-- ❌ Incorrect: backfill every row in one transaction
UPDATE "user" SET normalized_email = LOWER(email);

-- ✅ Correct: PostgreSQL — one batch per statement; repeat until 0 rows
-- Drive the loop from the app/migrator; COMMIT cannot run inside DO $$ … END $$.
WITH batch AS (
  SELECT id
  FROM "user"
  WHERE normalized_email IS NULL
  ORDER BY id
  LIMIT 10000
  FOR UPDATE SKIP LOCKED
)
UPDATE "user" AS u
SET normalized_email = LOWER(email)
FROM batch
WHERE u.id = batch.id;

-- ✅ Correct: MySQL — repeat from the migrator until ROW_COUNT() = 0
UPDATE `user`
SET normalized_email = LOWER(email)
WHERE normalized_email IS NULL
ORDER BY id
LIMIT 10000;
```

- Prefer an app-level batch loop (select ids → update → commit) when the
  migrator cannot commit between batches.

## Destructive ops

`DROP`, `TRUNCATE`, mass `DELETE`, and irreversible data transforms need an
explicit approve-gate before you generate or run them against shared
environments. Prefer a late contract drop over a wipe as the first step.

```text
APPROVE   Get explicit user approval for the shared environment and scope.
BACKUP    Confirm a recent restore point / snapshot exists (or take one).
DRY-RUN   Count affected rows; run the filter as SELECT; rehearse on a copy.
EXECUTE   Ship as a reviewed forward migration; monitor locks and row counts.
VERIFY    Confirm app health and that the intended rows/objects are gone.
```

```sql
-- ❌ Incorrect: destructive SQL with no count, backup, or approval
TRUNCATE "order";
DELETE FROM "user" WHERE last_login_at < NOW() - INTERVAL '1 year';
DROP TABLE session;

-- ✅ Correct: dry-run the filter first, then a scoped forward migration
-- PostgreSQL interval literal; MySQL: INTERVAL 1 YEAR
SELECT COUNT(*) FROM "user"
WHERE last_login_at < NOW() - INTERVAL '1 year';

-- After approval + backup, batch-delete (or DROP only in a later contract)
DELETE FROM "user"
WHERE id IN (
  SELECT id FROM "user"
  WHERE last_login_at < NOW() - INTERVAL '1 year'
  LIMIT 1000
);
```

| Gate | Required |
| --- | --- |
| Approve | User explicitly okays the op, environment, and blast radius |
| Backup | Known restore path (snapshot, PITR, or export) before execute |
| Dry-run | `SELECT` / `COUNT` of the same predicate; rehearsal on a non-prod copy |
| Scope | Narrow `WHERE`; batch large deletes; avoid unqualified `DELETE`/`TRUNCATE` |
| Rollback | How to restore if the migration succeeds but the product breaks |
| Timing | Prefer a low-traffic window; estimate lock time on large tables |

- Treat `migrate reset`, `DROP SCHEMA`, and seed `TRUNCATE` the same way —
  ask first on anything shared.
- Irreversible transforms (hashing, scrubbing, type loss) count as destructive
  even when they are `UPDATE`s.
- Local-only throwaway databases may skip backup, but still prefer idempotent
  seeds over wipe-and-reload when the repo already has a seed path.
