# Throw vs Return

Prefer returning missing or empty when absence is a normal caller outcome. Throw a typed operational error only when the operation cannot succeed. Either way, release resources on every failure path.

## Optional lookup

Callers should not try/catch a routine miss. Put missing in the return type so the happy path can branch on it.

```typescript
// ❌ Incorrect: throw for normal absence — callers must try/catch a routine miss
export function findUserById(userId: string): User {
  const user = loadUserById(userId)

  if (!user) {
    throw new Error('User not found')
  }

  return user
}

// ✅ Correct: missing is in the return type
export function findUserById(userId: string): User | undefined {
  return loadUserById(userId) ?? undefined
}
```

## Required lookup

When the resource must exist, throw the repo’s operational error type — not `new Error`. Keep `message` free of identifiers and driver text.

```typescript
// ❌ Incorrect: generic Error; identifier interpolated into message
export function getUserById(userId: string): User {
  const user = loadUserById(userId)

  if (!user) {
    throw new Error(`User ${userId} not found`)
  }

  return user
}

// ✅ Correct: typed operational error; client-safe message
export function getUserById(userId: string): User {
  const user = loadUserById(userId)

  if (!user) {
    throw new ApplicationError({
      code: 'user_not_found',
      kind: 'not_found',
      message: 'User not found',
    })
  }

  return user
}
```

- Log `userId` server-side; don’t put it in `message`. Don’t set `statusCode` at the call site — the edge derives it from `kind`.

## Clean up on every failure path

A resource released only after the last success step leaks whenever an earlier step throws — connections pile up until the pool is exhausted, locks and file handles stay held. Release it in `try` / `finally` by default (other languages: `defer`, `with`, try-with-resources).

```typescript
const ARCHIVE_ORDER_SQL = 'UPDATE orders SET archived_at = now() WHERE id = $1'

// ❌ Incorrect: release runs only on success — a throwing write leaks the connection
export async function archiveOrder(orderId: string): Promise<void> {
  const connection = await connectionPool.acquire()
  await connection.execute(ARCHIVE_ORDER_SQL, [orderId])
  connectionPool.release(connection)
}

// ✅ Correct: finally releases the connection on success and on throw
export async function archiveOrder(orderId: string): Promise<void> {
  const connection = await connectionPool.acquire()

  try {
    await connection.execute(ARCHIVE_ORDER_SQL, [orderId])
  } finally {
    connectionPool.release(connection)
  }
}

// ✅ Correct: the connection implements Symbol.asyncDispose — await using releases it when the scope exits, including on throw
export async function archiveOrder(orderId: string): Promise<void> {
  await using connection = await connectionPool.acquire()
  await connection.execute(ARCHIVE_ORDER_SQL, [orderId])
}
```

- `try` / `finally` is the default — it works in every runtime and TypeScript version.
- Use `using` (resource implements `Symbol.dispose`) or `await using` (`Symbol.asyncDispose`) only when the resource already implements it and the repo's TypeScript and runtime support it (TypeScript 5.2+ with `lib` `esnext.disposable` or an ES2025+ target). Don't wrap a resource just to use the syntax.
- Don't catch only to clean up and rethrow — `finally` releases without touching the error.
- Keep cleanup from throwing: an exception inside `finally` replaces the original error.

## When a Result type is OK

Return a `Result` (`{ ok: true; value: User } | { ok: false; error: ApplicationError }`) only when the repo already uses one for this layer. Adding it next to thrown errors gives callers two error channels to check, and failures slip through whichever one they forget.

- Use the repo's existing `Result` type and helpers — don't write a second one.
- In a throwing codebase, keep routine absence as `T | undefined` and failures as thrown typed errors.
- When a dependency returns results but the repo throws (or the reverse), convert once at that boundary, not in every caller.
