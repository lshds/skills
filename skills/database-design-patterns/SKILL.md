---
name: database-design-patterns
description: >-
  Relational schema guidelines for PostgreSQL and MySQL. This skill should
  be used when designing, reviewing, or choosing table shape — entities,
  keys, relations, or indexes — to ensure a 3NF target schema. Prefer 3NF
  with auto-incrementing BIGINT keys over premature denormalization. Triggers on
  tables, PKs/FKs, identity, relations, normalization, indexing, soft delete,
  multi-tenant columns, TIMESTAMPTZ, DATETIME, JSON, UUID-versus-integer,
  junction tables, ON DELETE, CHECK versus enum, utf8mb4, or partitioning.
---

# Database Design Skills

Table and schema design for PostgreSQL and MySQL: naming, keys, relations,
indexes, soft delete, and engine-specific types. Identify the engine before
choosing types or key syntax.

**Domain:** the shape of the relational schema — which entities, keys,
relations, constraints, and indexes belong in the database.
**Owns:** uninflected naming; BIGINT primary keys versus natural or external
ids; 1:1 / 1:N / N:M and ON DELETE policy; 3NF versus measured denormalization;
NOT NULL / CHECK / UNIQUE; soft versus hard delete; index access paths;
engine-specific types, JSON, and partitioning.
**Does not own:** how a live schema is rolled out or reversed; how application
queries are projected, paginated, or batched at runtime; how the application
maps rows to objects; who is allowed to read a row (only that owner/tenant
columns exist on the row itself).

## When to activate

- Designing new tables, entities, or a data model for a feature
- Choosing a BIGINT identity primary key vs a UUID, or an explicit `ON DELETE` policy
- Modeling 1:1, 1:N, or N:M (junction table) cardinality
- Normalizing a schema or deciding whether to denormalize a hot read path
- Adding or reviewing indexes for a query's access path
- Deciding soft vs hard delete, tenant/owner columns, or `created_at` / `updated_at`
- Choosing PostgreSQL- or MySQL-specific types, charset, JSON columns, or partitioning

## Core Concepts

### Design vs review

- Pick one mode from the user ask — don’t mix output shapes
- **Design** (new tables, keys, relations): apply these defaults; no review report unless asked
- **Review**: named scope only; report concrete misses in this skill’s domain
- Skip findings outside that domain

### Match the repo

Follow the engine, key style, and naming already in the tree. Greenfield uses 3NF
with auto-incrementing BIGINT primary keys. Don’t replace a mature UUID or
natural-key primary key with BIGINT unless the user asked. If you find an older
way to do the same work, say so and ask before replacing it.

### Entity design & naming

Uninflected singular `snake_case` tables and columns (the noun is not
inflected for row count); one entity per table. Add `created_at` /
`updated_at` to every table by default. Skip both on pure link/junction
tables. On append-only facts that are never updated in place, keep
`created_at` and skip `updated_at`. See
[entities.md](references/entities.md).

### Keys

Prefer a database-generated `BIGINT` primary key that grows over time
(1, 2, 3…) for every entity table — `BIGINT UNSIGNED` on MySQL. Keep
natural or external IDs (email, UUID, slug) in a separate unique column —
not as the primary key. Reserve composite primary keys for junction
tables. See [postgres.md](references/postgres.md) or
[mysql.md](references/mysql.md).

### Relations

Model 1:1, 1:N, and N:M explicitly: 1:1 via a shared primary key (or a
unique foreign key), 1:N via a foreign key on the "many" side, N:M via a
junction table. Choose an explicit `ON DELETE` policy per relationship —
never leave it unstated for a required FK. See
[relations.md](references/relations.md).

### Normalization

Normalize to third normal form by default; denormalize only for a measured,
high-traffic read path. Keep core relationships and queried attributes in
real columns — use a flexible/JSON column only for genuinely optional,
schema-less attributes. See [normalization.md](references/normalization.md).

### Constraints

`NOT NULL` wherever a value is semantically required; `CHECK` and `UNIQUE`
enforce invariants in the database itself, not just the application. Prefer a
`CHECK` constraint or lookup table over an enum type for values that evolve.
See [postgres.md](references/postgres.md) or [mysql.md](references/mysql.md).

### Soft delete

Default to hard delete. Use nullable `deleted_at` only for recover/audit.
Scope uniqueness to active rows (partial unique on PostgreSQL;
NULL-when-deleted generated column on MySQL). Soft delete does not fire
`ON DELETE CASCADE` — cascade children explicitly. See
[soft-delete.md](references/soft-delete.md).

### Indexing

Index every foreign key column and every column that drives a hot filter,
join, or sort. PostgreSQL does not index FKs for you; MySQL InnoDB does —
declare the index in the same `CREATE TABLE` so you control the name. Order
composite indexes with equality columns first, then range/sort columns,
matching the leftmost-prefix rule. Don't add indexes that no query uses. See
[indexing.md](references/indexing.md).

### Multi-tenant & ownership

Put `tenant_id` / `owner_id` on the row itself — don't rely on joining a
parent to learn who owns it. When queries always filter by tenant, put that
column first in composite indexes. See [entities.md](references/entities.md)
and [indexing.md](references/indexing.md).

### Engine defaults

Load the matching engine reference — PostgreSQL and MySQL disagree on keys,
types, indexes, soft-delete uniqueness, and partitioning. Don't mix their
defaults. See [postgres.md](references/postgres.md) or
[mysql.md](references/mysql.md).

### Common mistakes

| ❌ Incorrect | ✅ Correct |
| --- | --- |
| Random UUID as the primary key | Auto-incrementing BIGINT PK; UUID as a secondary unique column |
| Foreign key column with no supporting index | Index every foreign key — explicit on PostgreSQL; named in the same `CREATE TABLE` on MySQL |
| Enum type for a value that changes often | `CHECK` constraint or lookup table |
| Plain `UNIQUE` on a soft-deletable table | Partial unique (PostgreSQL) or NULL-when-deleted generated column (MySQL) |
| Mixing PostgreSQL and MySQL type/key defaults in one schema | Load the matching engine reference before choosing types or keys |

## Practice areas

Read the reference for the task — don't load every file.

| Area | Reference |
| --- | --- |
| Entities / naming / temporal / ownership columns | [entities.md](references/entities.md) |
| Relationship cardinality / FK delete policy | [relations.md](references/relations.md) |
| Normalization / denormalization / structured vs. flexible attributes | [normalization.md](references/normalization.md) |
| Indexing access paths / composite order / covering / partial | [indexing.md](references/indexing.md) |
| Soft delete vs. hard delete / scoped uniqueness | [soft-delete.md](references/soft-delete.md) |
| Keys / constraints / types / indexes / JSON / partitioning (PostgreSQL) | [postgres.md](references/postgres.md) |
| Keys / constraints / types / charset / indexes / JSON / partitioning (MySQL) | [mysql.md](references/mysql.md) |
