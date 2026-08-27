# Control Flow

Prefer early `return` / `throw`. Use `??` over `||`, and `?.` for optional chains.

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

// ✅ Correct: guard first; null → undefined at boundary
export function parseInput(rawInput?: string | null): string | undefined {
  const input = rawInput ?? undefined

  if (!input?.startsWith('prefix:')) {
    return
  }

  const parsedValue = input.slice('prefix:'.length).trim()
  return parsedValue.length > 0 ? parsedValue : undefined
}
```

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
