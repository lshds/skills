# Normalization

Prefer third normal form by default. Denormalize only when a measured read
path needs it — doing it early is hard to undo.

## Eliminate repeating groups and derived data

Storing the same fact in multiple columns, or deriving one column from
another, invites the two values to drift apart.

```sql
-- ❌ Incorrect: repeating group plus a derived column kept in sync by hand
CREATE TABLE order (
  id BIGINT PRIMARY KEY,
  item_1_name TEXT,
  item_2_name TEXT,
  item_3_name TEXT,
  item_count INT
);

-- ✅ Correct: one row per item; count computed on read
CREATE TABLE order_item (
  id BIGINT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  item_name TEXT NOT NULL
);
```

- Never store a value that a query can compute correctly from existing rows;
  the one exception is a proven hot read path.

## Eliminate partial and transitive dependencies

A column that depends on only part of the key, or on another non-key column,
belongs in a different table.

```sql
-- ❌ Incorrect: supplier_country depends on supplier_id, not on the order line
CREATE TABLE order_line (
  order_id BIGINT NOT NULL,
  supplier_id BIGINT NOT NULL,
  supplier_country TEXT NOT NULL,
  quantity INT NOT NULL,
  PRIMARY KEY (order_id, supplier_id)
);

-- ✅ Correct: supplier attributes live with the supplier
CREATE TABLE supplier (
  id BIGINT PRIMARY KEY,
  country TEXT NOT NULL
);

CREATE TABLE order_line (
  order_id BIGINT NOT NULL,
  supplier_id BIGINT NOT NULL REFERENCES supplier (id),
  quantity INT NOT NULL,
  PRIMARY KEY (order_id, supplier_id)
);
```

- If two non-key columns in the same table always change together, one of
  them likely belongs in its own table.

## Denormalize only for a measured hot path

Denormalization trades write complexity and consistency risk for read speed
— only accept that trade after normalized queries have measurably failed a
latency target.

```sql
-- ❌ Incorrect: denormalized total as the only copy of the line amounts
CREATE TABLE order (
  id BIGINT PRIMARY KEY,
  total NUMERIC(12, 2) NOT NULL
);

-- ✅ Correct: line items are the source of truth; no stored total
CREATE TABLE order_item (
  id BIGINT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  price NUMERIC(12, 2) NOT NULL,
  quantity INT NOT NULL
);

CREATE TABLE order (
  id BIGINT PRIMARY KEY
);
```

- Default shipped shape has no `total` column — sum `price * quantity` on
  read.
- If a measured hot path later needs a cache, add `total NUMERIC(12, 2)
  NOT NULL DEFAULT 0` on `order` beside the line items, not instead of
  them, and write it in the same transaction as any change to those rows.

## Structured columns vs. flexible attributes

A column per known, queried attribute keeps constraints and indexes
meaningful; a flexible attribute bag is for data that is genuinely optional
or not known in advance.

```sql
-- ❌ Incorrect: known, always-present, frequently filtered fields buried in a blob
CREATE TABLE product (
  id BIGINT PRIMARY KEY,
  attributes_blob TEXT NOT NULL
);

-- ✅ Correct: known attributes are real columns; only true extras stay flexible
CREATE TABLE product (
  id BIGINT PRIMARY KEY,
  price NUMERIC NOT NULL,
  in_stock BOOLEAN NOT NULL,
  extra_attributes TEXT
);
```

- Promote an attribute out of the flexible column into a real, typed column
  as soon as the product regularly filters, sorts, or joins on it.
