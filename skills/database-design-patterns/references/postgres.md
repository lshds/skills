# PostgreSQL

Prefer PostgreSQL's native types and identity columns over legacy or
cross-engine substitutes, so the schema uses the engine's actual guarantees
instead of working around them.

## Primary keys

`GENERATED ALWAYS AS IDENTITY` replaces the legacy `serial` type with a real,
standard-compliant identity column; a random UUID as the primary key
fragments the index because rows no longer insert in a predictable order.

```sql
-- ❌ Incorrect: legacy serial type, random UUID as the primary key
CREATE TABLE user (
  id SERIAL PRIMARY KEY,
  external_id UUID DEFAULT gen_random_uuid()
);

-- ✅ Correct: identity column; UUID only as a secondary, opaque identifier
CREATE TABLE user (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  external_id UUID NOT NULL,
  UNIQUE (external_id)
);
```

- On PostgreSQL 18+, `DEFAULT uuidv7()` on `external_id` is fine. On earlier
  majors, generate a time-ordered UUID in the application and insert it —
  never `gen_random_uuid()` / `uuid_generate_v4()` as the primary key itself.
- Identity / sequence gaps from rollbacks and concurrency are normal — do not
  try to keep IDs consecutive.
- Prefer `BIGINT` for IDs and foreign keys unless storage is proven critical.

## Types

Postgres has one flexible text type and one timezone-aware timestamp type;
reaching for length-bounded or timezone-naive variants adds constraints
Postgres doesn't need and bugs it doesn't have to have.

```sql
-- ❌ Incorrect: varchar, money type, timezone-naive / precision-limited time, float
CREATE TABLE invoice (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  status invoice_status_enum NOT NULL,
  memo VARCHAR(255),
  amount MONEY NOT NULL,
  due_at TIMESTAMP(0) NOT NULL,
  paid BOOLEAN
);

-- ✅ Correct: TEXT + CHECK, NUMERIC, TIMESTAMPTZ, BOOLEAN NOT NULL
CREATE TABLE invoice (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'paid')),
  memo TEXT,
  amount NUMERIC(12, 2) NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT false
);
```

- Prefer `TEXT`; if a max length is required, use
  `CHECK (LENGTH(col) <= n)` instead of `VARCHAR(n)` / `CHAR(n)`.
- Prefer `TIMESTAMPTZ` — never bare `TIMESTAMP`, `TIMETZ`, or
  `TIMESTAMPTZ(n)` precision specs.
- Prefer `NUMERIC` for money and exact decimals — never `MONEY`, `FLOAT`, or
  `DOUBLE PRECISION` for currency.
- Prefer `BOOLEAN NOT NULL` unless a true tri-state (`NULL`) is intentional.
- Prefer `CHECK` or a lookup table over a custom `ENUM` for values that may
  grow.
- Postgres does not silently truncate overflows — oversized inserts error;
  size the type for the real domain.

## Constraints

`UNIQUE` allows multiple `NULL`s unless `NULLS NOT DISTINCT` is set;
`CHECK` also lets `NULL` pass unless the column is `NOT NULL`.

```sql
-- ❌ Incorrect: UNIQUE allows unlimited NULL phone numbers
CREATE TABLE contact (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phone_number TEXT UNIQUE
);

-- ✅ Correct: NULLS NOT DISTINCT allows at most one NULL
CREATE TABLE contact (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phone_number TEXT,
  UNIQUE NULLS NOT DISTINCT (phone_number)
);
```

```sql
-- ❌ Incorrect: CHECK alone — NULL prices pass the check
CREATE TABLE product (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  price NUMERIC CHECK (price > 0)
);

-- ✅ Correct: NOT NULL + CHECK so NULL cannot bypass the rule
CREATE TABLE product (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  price NUMERIC NOT NULL CHECK (price > 0)
);
```

```sql
-- ❌ Incorrect: application-only double-booking guard, no DB exclusion
CREATE TABLE booking (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id BIGINT NOT NULL,
  period TSTZRANGE NOT NULL
);

-- ✅ Correct: EXCLUDE prevents overlapping bookings for the same room
CREATE TABLE booking (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id BIGINT NOT NULL,
  period TSTZRANGE NOT NULL,
  EXCLUDE USING gist (room_id WITH =, period WITH &&)
);
```

- Reach for `NULLS NOT DISTINCT` whenever a nullable column should still
  enforce "at most one," including the `NULL` case.
- Prefer `[)` bounds for range types and keep that convention consistent.

## Index types

Postgres ships multiple index access methods; picking the wrong one either
fails to accelerate the query or wastes space maintaining an index the
planner can't use.

```sql
-- ❌ Incorrect: B-tree on a JSONB column for containment queries
CREATE INDEX product_attributes_btree_idx ON product (attributes);

-- ✅ Correct: GIN for JSONB containment and key existence
CREATE INDEX product_attributes_gin_idx ON product USING GIN (attributes);
```

```sql
-- ❌ Incorrect: B-tree on a huge append-only time column
CREATE INDEX event_created_at_btree_idx ON event (created_at);

-- ✅ Correct: BRIN when physical row order correlates with the column
CREATE INDEX event_created_at_brin_idx ON event USING BRIN (created_at);
```

```sql
-- ❌ Incorrect: widen the key just to cover selected columns
CREATE INDEX order_customer_wide_idx ON order (customer_id, status, total);

-- ✅ Correct: INCLUDE adds covered columns without widening the key
CREATE INDEX order_customer_idx ON order (customer_id) INCLUDE (status, total);
```

```sql
-- ❌ Incorrect: case-sensitive unique index when lookups lower the input
CREATE UNIQUE INDEX user_email_idx ON user (email);

-- ✅ Correct: expression index matching the query expression
CREATE UNIQUE INDEX user_email_lower_idx ON user (LOWER(email));
```

- **GIN** for `JSONB` containment (`@>`), key existence (`?`), and array
  operators (`@>`, `&&`).
- **GiST** for range types and `EXCLUDE` constraints.
- **BRIN** for very large, append-mostly tables where physical row order
  correlates with the indexed column.
- **`INCLUDE`** adds columns to a covering index without making them part of
  the key, keeping the key itself narrow.
- An expression index (for example `LOWER(email)`) only matches queries that
  use the exact same expression in the `WHERE` clause.

## JSONB

`JSONB` is for genuinely optional or schema-less data; a frequently filtered
JSONB path should be promoted to a real, indexed column instead.

```sql
-- ❌ Incorrect: untyped JSON blob with no shape guard or index path
CREATE TABLE profile (
  user_id BIGINT PRIMARY KEY,
  attrs JSON
);

-- ✅ Correct: JSONB object + GIN; hot scalars as generated indexed columns
CREATE TABLE profile (
  user_id BIGINT PRIMARY KEY,
  attrs JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(attrs) = 'object'),
  theme TEXT GENERATED ALWAYS AS (attrs->>'theme') STORED
);
CREATE INDEX profile_attrs_gin_idx ON profile USING GIN (attrs);
CREATE INDEX profile_theme_idx ON profile (theme);
```

- Use `JSONB`, never `JSON`, unless original key order must be preserved.
- Promote a JSONB path to a generated column the moment a query filters,
  sorts, or joins on it regularly.

## Partitioning

Partitioning a table after it's already large requires migrating the data;
deciding upfront on tables expected to grow past tens of millions of rows
avoids that rebuild.

```sql
-- ❌ Incorrect: primary key omits the partition key
CREATE TABLE event (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

-- ✅ Correct: partition key included in the primary key
CREATE TABLE event (
  id BIGINT GENERATED ALWAYS AS IDENTITY,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE event_2026_01 PARTITION OF event
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE event_2026_02 PARTITION OF event
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
```

- Consider range partitioning once a table is expected to pass roughly 20
  million rows (general tables) or 10 million rows (append-heavy,
  time-ordered tables like logs and events).
- Append-only event tables take `created_at` only — no `updated_at`.
- The partition key must be included in the primary key and in every
  `UNIQUE` constraint — Postgres does not support a global unique constraint
  across partitions on a non-partition-key column.
- Create future partitions ahead of time; an insert with no matching
  partition fails outright.
