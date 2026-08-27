# Soft Delete

Prefer a hard delete unless the product needs to recover or audit removed
rows. A nullable `deleted_at` is the exception, not the default.

## When to soft-delete vs. hard-delete

Soft delete adds a filter that every future query must remember to apply;
only pay that cost when there's a real recovery or audit requirement.

```sql
-- ❌ Incorrect: soft-deleting ephemeral rows that never need recovery
ALTER TABLE session ADD COLUMN deleted_at TIMESTAMPTZ; -- DATETIME on MySQL
UPDATE session SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?;

-- ✅ Correct: hard delete when nothing needs the row afterward
DELETE FROM session WHERE id = ?;
```

- Default to hard delete. Add `deleted_at` only for tables with an explicit
  undo, retention, or audit requirement.

## Scope every query to exclude deleted rows

A soft-deleted row that isn't filtered out reappears in lists, reports, and
joins as if it still exists.

```sql
-- ❌ Incorrect: forgets to exclude soft-deleted rows
SELECT id, customer_id, total FROM invoice WHERE customer_id = ?;

-- ✅ Correct: every read path filters on deleted_at
SELECT id, customer_id, total FROM invoice
WHERE customer_id = ? AND deleted_at IS NULL;
```

- Centralize this filter in one place (a view, scope, or repository method)
  so it can't be forgotten in a new query.

## Unique constraints must exclude deleted rows

A plain `UNIQUE` constraint on a soft-deletable table blocks re-creating a
row with the same value after the original was "deleted." Scope uniqueness
to active rows — the idiom differs by engine (PostgreSQL has partial unique
indexes; MySQL does not).

```sql
-- ❌ Incorrect: blocks re-registering an email after a soft-deleted account
CREATE TABLE account (
  id BIGINT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  deleted_at TIMESTAMPTZ  -- or DATETIME on MySQL
);

-- ✅ Correct (PostgreSQL): partial unique index on non-deleted rows only
CREATE TABLE account (
  id BIGINT PRIMARY KEY,
  email TEXT NOT NULL,
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX account_email_active_idx ON account (email)
  WHERE deleted_at IS NULL;

-- ✅ Correct (MySQL): generated column is NULL when soft-deleted; UNIQUE
-- allows multiple NULLs, so only active emails collide
CREATE TABLE account (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  deleted_at DATETIME NULL,
  email_active VARCHAR(255) AS (IF(deleted_at IS NULL, email, NULL)) STORED,
  UNIQUE KEY account_email_active_idx (email_active)
);
```

- Never leave a plain table-level `UNIQUE` on a soft-deletable natural key —
  use a partial unique index (PostgreSQL) or a NULL-when-deleted generated
  column with `UNIQUE` (MySQL).

## Cascading soft delete

A foreign-key `ON DELETE CASCADE` never fires for a soft delete — cascading
has to be handled explicitly in application or transaction logic.

```sql
-- ❌ Incorrect: assumes ON DELETE CASCADE will clean up child rows
UPDATE folder SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?;

-- ✅ Correct: explicitly soft-delete dependent rows in the same transaction
UPDATE folder SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?;
UPDATE document SET deleted_at = CURRENT_TIMESTAMP
  WHERE folder_id = ? AND deleted_at IS NULL;
```

- Decide per relationship whether a soft delete on the parent should
  soft-delete, block, or ignore its children, and implement it explicitly.
