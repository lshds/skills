# Control Flow

Prefer early `return` / `throw`. Pick the missing-value check from the type.
Trust the types inside the boundary. Prefer `undefined` for internal missing
values — convert `null` at the boundary unless the receiving API needs it.
Use `??` over `||`, and `?.` for optional chains.

## Early return

Guard clauses flatten nested happy paths and make failure cases obvious at the top.

```typescript
// ❌ Incorrect: nested happy path — harder to follow exit points
export function parseInput(rawInput?: string | null): string | undefined {
  if (rawInput) {
    if (rawInput.startsWith('prefix:')) {
      const parsedValue = rawInput.slice('prefix:'.length).trim()
      if (parsedValue.length > 0) {
        return parsedValue
      }
    }
  }
  return
}

// ✅ Correct: guard first; `?.` covers both null and undefined
export function parseInput(rawInput?: string | null): string | undefined {
  if (!rawInput?.startsWith('prefix:')) {
    return
  }

  const parsedValue = rawInput.slice('prefix:'.length).trim()
  return parsedValue.length > 0 ? parsedValue : undefined
}
```

Keep the final exit when other paths return a value — falling off the end
fails `noImplicitReturns` (TS7030).

```typescript
// ❌ Incorrect: final return dropped — TS7030 under noImplicitReturns
export function labelForStatus(status: Status): string | undefined {
  if (status === 'ready') {
    return 'Ready'
  }
}

// ✅ Correct: final exit stays as a bare return
export function labelForStatus(status: Status): string | undefined {
  if (status === 'ready') {
    return 'Ready'
  }

  return
}
```

## Checking for a missing value

Pick the check from the type — `!value` also treats `''`, `0`, `false`, and
`NaN` as missing (same reason `??` beats `||`).

| Value type | Check |
| --- | --- |
| Object, array, function, `Date`, `Map`, row | `!value` |
| String where `''` means missing | `!value` |
| `number`, `boolean`, or string where `''` is valid | `value === undefined` |

```typescript
// ❌ Incorrect: spelled-out checks on an object and a token; `!` on a count where 0 is valid
if (user === undefined) {
  return
}

if (sessionToken === undefined || sessionToken === '') {
  return
}

if (!retryCount) {
  return
}

// ✅ Correct: truthiness for objects and empty-means-missing strings; explicit for numbers
if (!user) {
  return
}

if (!sessionToken) {
  return
}

if (retryCount === undefined) {
  return
}
```

## Trust the types inside the boundary

Parse once at the boundary (API, `JSON.parse`, form, env). Inside, trust the
types — no re-checks, `?.`, or fallbacks for ruled-out states. One guard per
concern so exits stay clear and computed values are reused.

```typescript
// ❌ Incorrect: spelled-out undefined checks, validation mixed in
if (
  hourlyHours === undefined ||
  current === undefined ||
  Number.isNaN(Date.parse(current.currentTime))
) {
  return undefined
}

// ✅ Correct: truthiness for objects/arrays, one guard per concern
if (!hourlyHours || !current) {
  return
}

const currentTime = Date.parse(current.currentTime)

if (Number.isNaN(currentTime)) {
  return
}
```

The same goes for optional chaining, fallbacks, and conversions on values the
signature already guarantees.

```typescript
// ❌ Incorrect: user is User and items is Item[] — none of these fallbacks can run
export function summarizeCart(user: User, items: Item[]) {
  const userName = user?.name ?? ''
  const visibleItems = (items ?? []).filter((item) => item.isVisible)

  return `${String(userName)}: ${visibleItems.length} items`
}

// ✅ Correct: trust the declared types
export function summarizeCart(user: User, items: Item[]) {
  const visibleItems = items.filter((item) => item.isVisible)

  return `${user.name}: ${visibleItems.length} items`
}
```

## `null` and `undefined` together

Two missing values for one field means two checks everywhere it is read.
Convert `null` at the boundary (database row, DOM, JSON) and use `undefined`
inside — never carry `null | undefined` for the same value.

```typescript
// ❌ Incorrect: null leaks past the boundary; two checks for one missing state
function applyDiscount(
  price: number,
  discountPercent: number | null | undefined,
) {
  if (discountPercent === null || discountPercent === undefined) {
    return price
  }

  return price * (1 - discountPercent / 100)
}

// ✅ Correct: normalize at the boundary; inside, only undefined
interface DiscountRow {
  discountPercent: number | null
}

function mapDiscount(row: DiscountRow): number | undefined {
  return row.discountPercent ?? undefined
}

function applyDiscount(price: number, discountPercent: number | undefined) {
  if (discountPercent === undefined) {
    return price
  }

  return price * (1 - discountPercent / 100)
}
```

- Keep `null` when the value is serialized or passed to an API that reads it —
  `JSON.stringify` keeps `null` but drops `undefined` keys, so converting it
  silently removes the field from the output.
- When the repo already models a value as `null`, keep it — don’t mix in
  `undefined` for the same field.

## Blank lines between statements

Put a blank line between logically separate steps: after locals before a guard `if`, and after a closed `if` / `else` block before the next `return` or statement. Don’t clump declaration, guard, and happy-path return.

```typescript
// ❌ Incorrect: clumped control flow — hard to scan exits
const user = getUserById(userId)
if (!user) {
  return { title: 'Not found' }
}
return {
  title: user.name,
}

// ✅ Correct: blank line before the guard and before the happy-path return
const user = getUserById(userId)

if (!user) {
  return { title: 'Not found' }
}

return {
  title: user.name,
}
```

## `if` or `return`, not `continue`

`continue` hides the work behind a jump. Skip an iteration with a matching `if`, or extract the body and use early `return`. Prefer early `return` when the body has a guard plus more than one step.

```typescript
// ❌ Incorrect: continue skips the rest of the iteration — the work sits after an implicit jump
for (const hour of hours) {
  const level = levelForHour(hour)

  if (!level) {
    continue
  }

  peak = strongerLevel(peak, level)
}

// ✅ Correct: one-step body sits in the matching `if`
for (const hour of hours) {
  const level = levelForHour(hour)

  if (level) {
    peak = strongerLevel(peak, level)
  }
}

// ✅ Correct: multi-step body uses early `return`
function nextPeak(peak: Level | undefined, hour: Hour): Level | undefined {
  const level = levelForHour(hour)

  if (!level) {
    return peak
  }

  return strongerLevel(peak, level)
}

for (const hour of hours) {
  peak = nextPeak(peak, hour)
}
```

## `??` over `||`

Nullish coalescing preserves valid falsy values like `0`, `''`, and `false`.

```typescript
// ❌ Incorrect: || treats 0 and '' as missing
const pageSize = itemCount || 20
const label = displayName || 'unknown'

// ✅ Correct: keeps valid 0 / '' / false
const pageSize = itemCount ?? 20
const label = displayName ?? 'unknown'
```
