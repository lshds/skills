# Entities

Prefer uninflected singular `snake_case` tables that each map to one clear
real-world concept, so one name covers the table, keys, relations, and
application types.

## Table and column naming

Prefer the uninflected noun (singular in English): the table is an abstract
container, so its name should not inflect for row count or usage. That form
is regular, language-independent, and keeps one stem for table, keys, and
types (`order` / `order_detail`).

```sql
-- ❌ Incorrect: plural/inflected table, mixed casing, abbreviated column
CREATE TABLE Order_Details (
  ID INT PRIMARY KEY,
  OrderID INT,
  qty INT
);

-- ✅ Correct: uninflected singular table, snake_case, spelled-out column
CREATE TABLE order_detail (
  id BIGINT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  quantity INT NOT NULL
);
```

- Tables and columns use uninflected singular `snake_case` (`customer`,
  `created_at`, `customer_id`).
- Foreign key columns are named `<singular_entity>_id` (`customer_id`, not
  `uid` or `fk_customer`).
- Use the same stem for the table, primary key context, FK prefixes, and
  entity class — one vocabulary, not singular class + plural table.
- The integer primary key is database-generated: `GENERATED ALWAYS AS
  IDENTITY` on PostgreSQL, `BIGINT UNSIGNED AUTO_INCREMENT` on MySQL.
  Examples in this file show naming and column shape; put the matching
  generator on every entity `id`.

## One entity per table

A table that models two concepts at once forces every query to filter out
irrelevant rows and every insert to leave half the columns null.

```sql
-- ❌ Incorrect: one table modeling two unrelated concepts
CREATE TABLE contact (
  id BIGINT PRIMARY KEY,
  contact_type TEXT,
  customer_credit_limit NUMERIC,
  supplier_payment_terms TEXT
);

-- ✅ Correct: one table per concept, no columns left null by construction
CREATE TABLE customer (
  id BIGINT PRIMARY KEY,
  credit_limit NUMERIC NOT NULL DEFAULT 0
);

CREATE TABLE supplier (
  id BIGINT PRIMARY KEY,
  payment_terms TEXT NOT NULL
);
```

- Split a table the moment a column only applies to a subset of rows because
  it represents a different concept, not just an optional attribute.

## Ownership and tenancy columns

Rows without an explicit owner or tenant column force every access-control
check to infer ownership through a join, which is easy to get wrong.

```sql
-- ❌ Incorrect: ownership only inferable through a join, two hops away
CREATE TABLE document (
  id BIGINT PRIMARY KEY,
  folder_id BIGINT NOT NULL
);

-- ✅ Correct: explicit, directly queryable ownership
CREATE TABLE document (
  id BIGINT PRIMARY KEY,
  owner_id BIGINT NOT NULL,
  tenant_id BIGINT NOT NULL,
  folder_id BIGINT NOT NULL
);
```

- Every row that belongs to a user or tenant carries its own `owner_id` /
  `tenant_id`, even when that value is also derivable through a parent row.

## Temporal columns

Tables without `created_at` / `updated_at` make it impossible to tell when a
row appeared or last changed, which blocks debugging and analytics after the
fact.

```sql
-- ❌ Incorrect: no record of when a row was created or last changed
CREATE TABLE invoice (
  id BIGINT PRIMARY KEY,
  total NUMERIC NOT NULL
);

-- ✅ Correct (PostgreSQL): identity PK; TIMESTAMPTZ for lifecycle columns
CREATE TABLE invoice (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  total NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ✅ Correct (MySQL): DATETIME — not TIMESTAMP (2038 limit / TZ coercion)
CREATE TABLE invoice (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  total DECIMAL(12, 2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP
);
```

- Add `created_at` and `updated_at` to every table by default. Skip both on
  pure link/junction tables. On append-only facts that are never updated in
  place (`event`), keep `created_at` and skip `updated_at`.
- Pick the engine's timestamp type above — don't paste PostgreSQL types into
  MySQL (or the reverse).
