# Throw vs Return

Prefer returning missing or empty when absence is a normal caller outcome. Throw a typed operational error only when the operation cannot succeed.

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
