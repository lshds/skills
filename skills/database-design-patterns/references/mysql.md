# MySQL

Prefer InnoDB's clustered primary key and `utf8mb4` defaults, so inserts stay
sequential and every string column can store the full Unicode range.

## Primary keys

InnoDB stores rows in primary key order (the clustered index), so a random
primary key causes page splits on every insert; a monotonic key keeps
inserts sequential.

```sql
-- ❌ Incorrect: random UUID as the clustered primary key
CREATE TABLE user (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  email VARCHAR(255) NOT NULL
);

-- ✅ Correct: monotonic BIGINT primary key; UUID as a secondary identifier
CREATE TABLE user (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  public_id BINARY(16) NOT NULL,
  email VARCHAR(255) NOT NULL,
  UNIQUE KEY user_public_id_idx (public_id)
);
```

- Default to `BIGINT UNSIGNED AUTO_INCREMENT` for the primary key — `INT`
  exhausts at roughly 4.3 billion rows.
- If an external, opaque identifier is required, store it as `BINARY(16)` in
  a secondary unique column, generated as a time-ordered UUID (UUIDv7)
  rather than random UUIDv4, to keep secondary-index locality reasonable.
- Every secondary index entry carries the primary key value — a wide or
  random primary key makes every secondary index larger and more fragmented
  too.

## Types and charset

MySQL's `utf8` alias is actually 3-byte `utf8mb3` and cannot store emoji or
the full CJK range; `TIMESTAMP` also has a 2038 range limit that `DATETIME`
does not.

```sql
-- ❌ Incorrect: legacy utf8 alias, 2038-limited TIMESTAMP, FLOAT money
CREATE TABLE order (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  note VARCHAR(500) CHARACTER SET utf8,
  total FLOAT NOT NULL,
  placed_at TIMESTAMP NOT NULL
) DEFAULT CHARSET=utf8;

-- ✅ Correct: utf8mb4, DECIMAL for money, DATETIME for the full date range
CREATE TABLE order (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  note VARCHAR(500),
  total DECIMAL(12, 2) NOT NULL,
  placed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

- Always `utf8mb4` with `utf8mb4_0900_ai_ci` (case- and accent-insensitive)
  as the database/table default; use `utf8mb4_0900_as_cs` only where
  exact-case matching is required.
- `DECIMAL(p, s)` for money and any exact quantity — never `FLOAT` /
  `DOUBLE`.
- `DATETIME` over `TIMESTAMP` for any date that might need to represent a
  value past 2038, and to avoid MySQL's automatic timezone conversion on
  `TIMESTAMP`.
- Bounded `VARCHAR(n)` (not `TEXT`) for strings that are filtered, sorted, or
  indexed directly — `TEXT` columns need a prefix index instead of a
  full-column index.
- Prefer a lookup table over `ENUM` / `SET` for values that change; altering
  an `ENUM` definition can rewrite the entire table.

## Composite and covering indexes

A composite index only helps a query that starts filtering from its
leftmost column, and InnoDB secondary indexes already carry the primary key,
which can make a narrower index "cover" more queries than it looks like it
should.

```sql
-- ❌ Incorrect: range/sort column placed before the equality columns
CREATE INDEX order_bad_idx ON order (created_at, user_id, status);

-- ✅ Correct: equality columns first, sort column last, matching direction
CREATE INDEX order_user_status_created_idx
  ON order (user_id, status, created_at DESC);
```

- `EXPLAIN` shows `Using index` in `Extra` when a query is fully covered by
  the index — no row lookup against the table is needed.
- Because a secondary index implicitly stores the primary key,
  `INDEX(status)` alone already covers `SELECT id FROM order WHERE status = ?`.
- For long `VARCHAR` / `TEXT` columns that must be indexed, use a prefix
  index: `INDEX (description(191))`.

## JSON columns

A native `JSON` column cannot be indexed directly — index a generated column
extracted from the JSON path instead.

```sql
-- ❌ Incorrect: filtering a JSON path directly, no supporting index
SELECT id, payload FROM event WHERE JSON_EXTRACT(payload, '$.type') = 'signup';

-- ✅ Correct: generated column extracted from the JSON path, then indexed
ALTER TABLE event
  ADD COLUMN event_type VARCHAR(50)
    GENERATED ALWAYS AS (payload->>'$.type') STORED,
  ADD INDEX event_event_type_idx (event_type);
```

- Use `->>` (unquoted extraction) in comparisons — the plain
  `->` / `JSON_EXTRACT` form returns a quoted JSON value and won't match a
  bare string.
- Reserve `JSON` for genuinely schema-less or rarely queried data; promote
  any path that's filtered or joined on regularly to a real generated
  column.

## Partitioning

Every column in the partitioning expression must also be part of every
`UNIQUE` / `PRIMARY KEY` on the table, and partitioned InnoDB tables cannot
use foreign keys at all.

```sql
-- ❌ Incorrect: primary key omits the partition key; no MAXVALUE catch-all
CREATE TABLE event (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL
) PARTITION BY RANGE COLUMNS (created_at) (
  PARTITION p2026_01 VALUES LESS THAN ('2026-02-01')
);

-- ✅ Correct: partition key in PK; MAXVALUE catch-all partition
CREATE TABLE event (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_type VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE COLUMNS (created_at) (
  PARTITION p2026_01 VALUES LESS THAN ('2026-02-01'),
  PARTITION p_future VALUES LESS THAN (MAXVALUE)
);
```

- Always add a `MAXVALUE` catch-all partition so inserts past the last
  defined range don't fail.
- A partitioned InnoDB table cannot define foreign keys to other tables, and
  no other table can reference it with a foreign key — plan around this
  before partitioning a table with real relationships.
- Consider partitioning once a table passes roughly 10 million rows for
  time-ordered/append-heavy data, or 20 million rows for general large
  tables.
- Append-only event tables take `created_at` only — no `updated_at`.
