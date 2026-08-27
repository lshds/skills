# Relations

Prefer explicit 1:1, 1:N, and N:M foreign keys over leaving the relationship
only in application code.

## One-to-many

The most common relationship: many child rows reference one parent. The
foreign key lives on the "many" side.

```sql
-- ❌ Incorrect: relationship only implied by a shared value, no FK
CREATE TABLE author (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE book (
  id BIGINT PRIMARY KEY,
  author_id BIGINT,
  title TEXT NOT NULL
);

-- ✅ Correct: explicit FK with a stated delete policy
CREATE TABLE author (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE book (
  id BIGINT PRIMARY KEY,
  author_id BIGINT NOT NULL REFERENCES author (id) ON DELETE RESTRICT,
  title TEXT NOT NULL
);
```

- Integer primary keys are database-generated (`GENERATED ALWAYS AS IDENTITY`
  on PostgreSQL, `BIGINT UNSIGNED AUTO_INCREMENT` on MySQL). Examples below
  show relationship shape, not generator syntax.
- Choose `ON DELETE RESTRICT` when the parent must not disappear while
  children exist, `CASCADE` when children are owned exclusively by the
  parent, and `SET NULL` when the relationship is optional.

## One-to-one

A true 1:1 relationship needs a uniqueness guarantee on the foreign key,
otherwise it silently becomes 1:N.

```sql
-- ❌ Incorrect: FK without uniqueness allows multiple profiles per user
CREATE TABLE user_profile (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES user (id)
);

-- ✅ Correct: child's PK is the parent's PK — one profile, no extra key
CREATE TABLE user_profile (
  user_id BIGINT PRIMARY KEY REFERENCES user (id) ON DELETE CASCADE,
  bio TEXT
);
```

- Prefer the shared primary key when the child row cannot exist without the
  parent and is always fetched together with it.
- A separate `id` plus `UNIQUE` on the foreign key is also 1:1; use it when
  the child needs its own identity independent of the parent.

## Many-to-many

N:M relationships need a junction table, not a comma-separated or
multi-value column on either side.

```sql
-- ❌ Incorrect: multi-value column instead of a junction table
CREATE TABLE article (
  id BIGINT PRIMARY KEY,
  tag_ids TEXT
);

-- ✅ Correct: junction table with its own composite key
CREATE TABLE article_tag (
  article_id BIGINT NOT NULL REFERENCES article (id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES tag (id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);
```

- Order the composite primary key columns to match the most common lookup
  direction; add extra columns (for example `added_at`) directly on the
  junction table when the relationship itself carries data.

## Delete policy

Every foreign key needs an explicit `ON DELETE` decision — relying on the
engine's default behavior for a required relationship is easy to get wrong
without noticing.

```sql
-- ❌ Incorrect: no explicit policy stated for a required relationship
CREATE TABLE comment (
  id BIGINT PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES post (id)
);

-- ✅ Correct: explicit policy matches the ownership semantics
CREATE TABLE comment (
  id BIGINT PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES post (id) ON DELETE CASCADE
);

-- ✅ Correct: optional relationship — nullable FK, never NOT NULL with SET NULL
CREATE TABLE book (
  id BIGINT PRIMARY KEY,
  publisher_id BIGINT REFERENCES publisher (id) ON DELETE SET NULL,
  title TEXT NOT NULL
);
```

- Never leave the delete policy unstated for a required relationship — pick
  `RESTRICT`, `CASCADE`, or `SET NULL` based on ownership, not convenience.
- `SET NULL` is only valid on a nullable column.
