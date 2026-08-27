# Escape Hatches

Don’t use `as` / `!` / `@ts-ignore` to silence the checker. Narrow or parse
at the boundary.

## Narrow or parse

Prefer `@ts-expect-error` with a reason if an ignore is unavoidable. Never `as` across untrusted/`unknown` data — including `JSON.parse` results, network payloads, and web storage.

```typescript
// ❌ Incorrect: silence the checker — cast, non-null assertion, @ts-ignore
const user = rawValue as User
const userName = user!.name
processItem(items[0]!)
// @ts-ignore — never; prefer @ts-expect-error + reason if unavoidable

// ❌ Incorrect: cast after JSON.parse — parsed value is unknown at runtime
const config = JSON.parse(rawJson) as Config

// ✅ Correct: narrow with a type guard — no cast
function isUser(value: unknown): value is User {
  if (typeof value !== 'object' || value === null || !('id' in value)) {
    return false
  }

  return typeof value.id === 'string'
}

function isConfig(value: unknown): value is Config {
  if (typeof value !== 'object' || value === null || !('theme' in value)) {
    return false
  }

  return typeof value.theme === 'string'
}

function parseUser(value: unknown): User | undefined {
  if (!isUser(value)) {
    return
  }

  return value
}

function parseConfig(rawJson: string): Config | undefined {
  const parsedPayload: unknown = JSON.parse(rawJson)
  return isConfig(parsedPayload) ? parsedPayload : undefined
}

// ✅ Correct: handle indexed T | undefined — guard before use
const firstItem = items[0]

if (firstItem === undefined) {
  return
}

processItem(firstItem)
```

## When `as` is OK

`as` is for *preserving* a type the checker already almost has — not for asserting shape on untrusted data. Safe uses:

- `as const` to lock literal types
- `satisfies` (optionally with `as const`) to check a shape without widening
- A cast that only restates what a runtime check already proved, when the checker cannot see the narrowing (rare; prefer a type predicate so you don’t need `as`)

```typescript
// ❌ Incorrect: cast untrusted / unknown data
const user = rawValue as User
const config = JSON.parse(rawJson) as Config

// ✅ Correct: runtime check narrows — no cast needed
const parsedPort = Number.parseInt(rawPort, 10)

if (Number.isNaN(parsedPort)) {
  return
}

const port = parsedPort

// ✅ Correct: as const / satisfies — not a trust boundary cast
const routes = {
  home: { path: '/', auth: false },
} as const satisfies Record<string, { path: string; auth: boolean }>
```
