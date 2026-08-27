# Functions

Use `export function` for exported multi-step logic. Use `const` arrows for
nested/local helpers and one-liners.

## Exported multi-step

Exported multi-step logic reads better as a named function with early returns than a chained arrow expression.

```typescript
// ❌ Incorrect: export const + chained && — hard to debug and extend
export const isExpectedFailure = (value: unknown): value is ApplicationError =>
  value instanceof ApplicationError &&
  typeof value.code === 'string' &&
  !value.code.startsWith('ERR_INFRA_')

// ✅ Correct: export function + early returns
export function isExpectedFailure(value: unknown): value is ApplicationError {
  if (!(value instanceof ApplicationError)) {
    return false
  }

  if (typeof value.code !== 'string') {
    return false
  }

  return !value.code.startsWith('ERR_INFRA_')
}
```

## Nested / local helpers

Use `const` arrows for helpers scoped inside a function — avoid nested `function` declarations.

```typescript
// ❌ Incorrect: nested function declaration
function notifyUser(user: User) {
  function formatSubject() {
    return `Welcome ${user.email}`
  }
  sendEmail({ to: user.email, subject: formatSubject() })
}

// ✅ Correct: const arrow for nested helpers
function notifyUser(user: User) {
  const formatSubject = () => `Welcome ${user.email}`
  sendEmail({ to: user.email, subject: formatSubject() })
}
```

## When `const` arrow is OK

One-liners, callbacks, and short local utilities are fine as `const` arrows.

```typescript
// ✅ Correct: one-liners, callbacks, short locals
const doubleAmount = (amount: number) => amount * 2
items.filter((item) => item.isEnabled)
```
