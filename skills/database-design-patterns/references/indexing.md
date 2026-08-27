# Indexing

Prefer indexes on columns a query actually filters, joins, or sorts on. An
unused index only slows writes.

## Always index foreign keys

An unindexed foreign key turns every join or cascading delete on that
relationship into a full table scan. PostgreSQL never creates that index for
you. MySQL InnoDB creates one if none exists — a later `CREATE INDEX` on the
same column duplicates it.

```sql
-- ❌ Incorrect: FK column with no supporting index
CREATE TABLE order (
  id BIGINT PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customer (id)
);

-- ✅ Correct (PostgreSQL): FKs are not indexed automatically — add the index
CREATE TABLE order (
  id BIGINT PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customer (id)
);
CREATE INDEX order_customer_id_idx ON order (customer_id);

-- ✅ Correct (MySQL): name the index in the same CREATE TABLE as the FK
CREATE TABLE order (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT UNSIGNED NOT NULL,
  CONSTRAINT order_customer_fk
    FOREIGN KEY (customer_id) REFERENCES customer (id),
  INDEX order_customer_id_idx (customer_id)
);
```

- Add this index at the same time you add the foreign key — don't wait for a
  slow query to reveal it's missing.
- On MySQL, declare `INDEX` (or `KEY`) in the same `CREATE TABLE` as the
  foreign key so InnoDB uses that index instead of creating an anonymous one.

## Composite index column order

A composite index only serves queries that filter on a leftmost prefix of
its columns, so column order must match the query shape, not alphabetical or
arbitrary order.

```sql
-- ❌ Incorrect: range column placed before the equality columns
CREATE INDEX order_bad_idx ON order (created_at, tenant_id, status);

-- ✅ Correct: equality columns first, range/sort column last
CREATE INDEX order_tenant_status_created_idx
  ON order (tenant_id, status, created_at);
```

- An index on `(a, b, c)` serves `WHERE a`, `WHERE a AND b`, and
  `WHERE a AND b AND c` — it does not serve `WHERE b` or `WHERE b AND c`
  alone.
- A range or `LIKE 'prefix%'` predicate stops the leftmost-prefix match for
  every column after it; put range/sort columns last.

## Covering indexes

A covering index lets the engine answer a query from the index alone when
every selected column is present in the index.

```sql
-- ❌ Incorrect: index only covers the filter, not the selected columns
CREATE INDEX order_customer_idx ON order (customer_id);
SELECT customer_id, status FROM order WHERE customer_id = ?;

-- ✅ Correct: covering index includes every selected column
CREATE INDEX order_customer_covering_idx ON order (customer_id, status);
SELECT customer_id, status FROM order WHERE customer_id = ?;
```

- Reach for a covering index on a high-frequency read path that selects few
  columns.

## Partial indexes (PostgreSQL)

A partial index shrinks an index down to only the rows a hot query actually
touches. PostgreSQL supports `WHERE` on indexes; MySQL/InnoDB does not —
put the dominant equality first in a composite index instead.

```sql
-- ❌ Incorrect: full-table index when almost every lookup is for active rows
CREATE INDEX order_customer_idx ON order (customer_id);

-- ✅ Correct (PostgreSQL): partial index scoped to the hot subset
CREATE INDEX order_active_customer_idx ON order (customer_id)
  WHERE status = 'active';

-- ✅ Correct (MySQL): no partial indexes — lead with the hot equality
CREATE INDEX order_status_customer_idx ON order (status, customer_id);
```

- On PostgreSQL, reach for a partial index when one predicate value dominates
  the table and matches the query filter.
- On MySQL, encode the same filter as the leftmost column of a composite
  index (or accept a full-table index when the predicate is not selective
  enough to lead).

## Don't over-index

Every additional index adds write-path cost and storage — an index that no
query uses is pure overhead.

```sql
-- ❌ Incorrect: separate single-column index duplicating a composite index's job
CREATE INDEX order_tenant_idx ON order (tenant_id);
CREATE INDEX order_tenant_status_idx ON order (tenant_id, status);

-- ✅ Correct: one composite index serves both access patterns
CREATE INDEX order_tenant_status_idx ON order (tenant_id, status);
```

- Before adding an index, check whether an existing composite index already
  covers the same leftmost columns.
