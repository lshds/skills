# Naming

Prefer descriptive names over abbreviations. `camelCase` values, `PascalCase`
types, verb-noun functions.

## Variable naming

Names should reveal intent at the call site — booleans with `is`/`has`, collections plural, constants in `SCREAMING_SNAKE`.

```typescript
// ❌ Incorrect: abbreviations, snake_case, opaque names
const q = 'election'
const flag = true
const arr = users.filter((u) => u.flag)
const user_id = 'user_123'

// ✅ Correct: descriptive camelCase / booleans / plurals
const marketSearchQuery = 'election'
const isUserAuthenticated = true
const activeUsers = users.filter((user) => user.isActive)
const userId = 'user_123'
const QUERY_STALE_TIME_MS = 60_000
```

## Function naming

Functions are verb-noun; callbacks use `on…` in the parameter, `handle…` for the local handler.

```typescript
// ❌ Incorrect: noun-only, opaque params, on… as the local handler
async function user(id: string) { }
function email(e) { }
function onUserCreated() {
  cb(data)
}

// ✅ Correct: verb-noun; handle… local, on… callback param
async function fetchUserById(userId: string) { }
function isValidEmail(email: string): boolean { }
function handleUserCreated(onUserCreated: (userId: string) => void) {
  onUserCreated(userId)
}
```

## Types / interfaces

Use `PascalCase` for types and interfaces — no `I` prefix or opaque aliases.

```typescript
// ❌ Incorrect: I-prefix, unclear aliases
interface IUser {
  id: string
}
type TUser = User

// ✅ Correct: PascalCase; no I-prefix
interface User {
  id: string
}
type UserId = string
type FetchUserResult = User | undefined
```
