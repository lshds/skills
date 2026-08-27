# Seeds

Prefer idempotent seed scripts that are safe to re-run over one-shot inserts,
so local and CI databases stay predictable without wiping shared data.

## Principles

Prefer re-runnable fixture data over ad-hoc inserts so every developer and CI
job starts from the same known baseline.

- Seeds must be idempotent — running twice must not duplicate or fail.
- Never put production secrets, real customer data, or live credentials in
  seed files.
- Keep seeds out of production deploy paths unless the user explicitly asks
  for a controlled reference-data seed.
- Prefer deterministic keys (`slug`, `code`, fixed email) so upserts target the
  same rows every run.
- Seed reference/lookup data and a small demo graph — not a dump of prod.
- Separate “always-needed reference data” from “dev/demo fixtures” when the
  repo already splits them.

## Idempotent upserts

Prefer insert-on-conflict / upsert over bare `INSERT` so a second run is a
no-op update, not a unique-violation. Running twice must not duplicate or
fail.

```typescript
// ❌ Incorrect: one-shot insert — second run fails or duplicates
export async function seedRoles(): Promise<void> {
  await db.insert(role).values([
    { code: 'admin', name: 'Admin' },
    { code: 'member', name: 'Member' },
  ])
}

// ✅ Correct: upsert on a stable unique key (Drizzle)
export async function seedRoles(): Promise<void> {
  await db
    .insert(role)
    .values([
      { code: 'admin', name: 'Admin' },
      { code: 'member', name: 'Member' },
    ])
    .onConflictDoUpdate({
      target: role.code,
      set: { name: sql`excluded.name` },
    })
}
```

```typescript
// ❌ Incorrect: one-shot create — second run fails
export async function seedAdminRole(): Promise<void> {
  await prisma.role.create({
    data: { code: 'admin', name: 'Admin' },
  })
}

// ✅ Correct: Prisma upsert on a unique field
export async function seedAdminRole(): Promise<void> {
  await prisma.role.upsert({
    where: { code: 'admin' },
    create: { code: 'admin', name: 'Admin' },
    update: { name: 'Admin' },
  })
}
```

```typescript
// ❌ Incorrect: one-shot insert — second run fails or duplicates
export async function seedRoles(): Promise<void> {
  await knex('role').insert([
    { code: 'admin', name: 'Admin' },
    { code: 'member', name: 'Member' },
  ])
}

// ✅ Correct: Knex onConflict merge
export async function seedRoles(): Promise<void> {
  await knex('role')
    .insert([
      { code: 'admin', name: 'Admin' },
      { code: 'member', name: 'Member' },
    ])
    .onConflict('code')
    .merge(['name'])
}
```

```sql
-- ❌ Incorrect: one-shot INSERT — second run fails or duplicates
INSERT INTO "role" (code, name)
VALUES ('admin', 'Admin'), ('member', 'Member');

-- ✅ Correct: SQL upsert; quote reserved names (`role` is reserved on PostgreSQL)
INSERT INTO "role" (code, name)
VALUES ('admin', 'Admin'), ('member', 'Member')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name;
```

## No secrets or real data

Seed files are committed and shared. Use fake values and env-injected secrets
only when a local tool truly needs them — never paste prod credentials.

```typescript
const DEMO_USER_EMAIL = 'demo@example.com'

// ❌ Incorrect: real customer email and live API key in the repo
export async function seedDemoUser(): Promise<void> {
  await db.insert(user).values({
    email: 'ceo@acme-customer.com',
    apiKey: 'sk_live_••••',
  })
}

// ✅ Correct: synthetic fixture; secrets from env when required locally
export async function seedDemoUser(): Promise<void> {
  const demoPasswordHash = process.env.SEED_DEMO_PASSWORD_HASH

  if (demoPasswordHash === undefined) {
    throw new Error('SEED_DEMO_PASSWORD_HASH is required for local seeds')
  }

  await db
    .insert(user)
    .values({
      email: DEMO_USER_EMAIL,
      passwordHash: demoPasswordHash,
    })
    .onConflictDoUpdate({
      target: user.email,
      set: { passwordHash: demoPasswordHash },
    })
}
```

- Prefer obviously fake domains (`example.com`, `test.local`).
- Never commit dumps, PII, or copied production rows into seed files.

## Environment boundaries

Run seeds in local and CI by default. Treat shared staging/production as
opt-in and ask before generating or running seed SQL there.

```text
LOCAL / CI   Safe default — idempotent seeds after migrate.
STAGING      Only with explicit approval; prefer reference data, not demo users.
PRODUCTION   Never auto-seed. Reference data belongs in a reviewed migration
             or an explicitly approved one-off — not a casual seed script.
```

```bash
# ❌ Incorrect: seed production as part of deploy
# npm run db:seed  # in a prod pipeline

# ✅ Correct: migrate forward in every env
npx prisma migrate deploy

# ✅ Correct: seed only in local / CI — not in a prod or shared-staging deploy
npx prisma db seed
```

## Stable graphs and ordering

When fixtures reference each other, upsert parents first and children by
stable foreign keys — not by auto-increment values that differ per database.

```typescript
const DEMO_USER_EMAIL = 'demo@example.com'
const DEMO_ORDER_REF = 'seed-order-demo-1'

// ❌ Incorrect: assume serial ids from a previous run
export async function seedDemoOrder(): Promise<void> {
  await db.insert(order).values({ userId: 1, status: 'pending' })
}

// ✅ Correct: resolve parent by natural key, then upsert child
export async function seedDemoOrder(): Promise<void> {
  const [demoUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, DEMO_USER_EMAIL))

  if (demoUser === undefined) {
    throw new Error('demo user missing — seed users first')
  }

  await db
    .insert(order)
    .values({
      userId: demoUser.id,
      externalRef: DEMO_ORDER_REF,
      status: 'pending',
    })
    .onConflictDoUpdate({
      target: order.externalRef,
      set: { status: 'pending' },
    })
}
```

## Tooling

Use the repo’s seed entrypoint — Prisma `db seed`, a Knex seed file, or the
project’s `db:seed` script. Do not invent a parallel seeder beside it.

```bash
# ❌ Incorrect: invent a parallel seeder beside the repo entrypoint
# python scripts/custom_seed.py

# ✅ Correct: Prisma — package.json "prisma": { "seed": "tsx prisma/seed.ts" }
npx prisma db seed

# ✅ Correct: Drizzle / custom — project script after migrate
npm run db:seed

# ✅ Correct: Knex
npx knex seed:run
```

- Keep seed modules small and composable (`seedRoles`, `seedDemoUser`).
- After schema changes, update seeds in the same change so CI still boots.
- If a seed would `TRUNCATE` or mass-delete shared data, stop and ask —
  that is a destructive op, not a normal seed.
