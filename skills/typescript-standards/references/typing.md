# Typing

No `any`. Prefer `unknown` + guards, `as const`, `satisfies`, `NoInfer`, and discriminated unions.

## Unknown + type guard (no `any`)

Narrow `unknown` at the boundary with a type predicate — never widen with `any`.

```typescript
// ❌ Incorrect: any silences the checker — no narrowing after JSON.parse
const parsedPayload: any = JSON.parse(rawPayload)
processUser(parsedPayload)

// ✅ Correct: unknown + type predicate
function isUser(value: unknown): value is User {
  if (typeof value !== 'object' || value === null || !('id' in value)) {
    return false
  }

  return typeof value.id === 'string'
}

const parsedPayload: unknown = JSON.parse(rawPayload)

if (!isUser(parsedPayload)) {
  return
}

processUser(parsedPayload)
```

## interface vs type

Use `interface` for object shapes; `type` for aliases, unions, and computed types.

```typescript
// ❌ Incorrect: type for object shapes that should be an interface
type UserShape = {
  id: string
  email: string
}

// ✅ Correct: interface for objects; type for aliases / unions
interface User {
  id: string
  email: string
}

type UserId = string
type FetchUserResult = User | undefined
```

## `as const` — derive types; no `enum`

Derive unions from `as const` objects — avoid `enum` for string unions. An
`enum` also emits runtime code, so `erasableSyntaxOnly` rejects it, while an
`as const` object is plain JavaScript that type stripping leaves intact.

```typescript
// ❌ Incorrect: enum — prefer `as const` object + derived union
enum StatusEnum {
  Idle = 'idle',
  Loading = 'loading',
  Ready = 'ready',
}

// ✅ Correct: derive union from values
const STATUSES = {
  idle: 'idle',
  loading: 'loading',
  ready: 'ready',
} as const
type Status = (typeof STATUSES)[keyof typeof STATUSES]
```

## `satisfies` for config

`satisfies` checks shape without widening literal keys and paths.

```typescript
// ❌ Incorrect: annotation widens keys/paths
const routes: Record<string, { path: string; isAuthRequired: boolean }> = {
  home: { path: '/', isAuthRequired: false },
  admin: { path: '/admin', isAuthRequired: true },
}

// ✅ Correct: keeps literals while checking shape
const routes = {
  home: { path: '/', isAuthRequired: false },
  admin: { path: '/admin', isAuthRequired: true },
} as const satisfies Record<string, { path: string; isAuthRequired: boolean }>
```

## `NoInfer<T>` on fallback parameters

When a fallback, default, or initial value shares a type parameter with the real input, TypeScript infers from both — a typo in the fallback widens the type instead of failing. `NoInfer<T>` checks the argument against `T` without letting it add candidates.

```typescript
// ❌ Incorrect: the fallback joins inference — 'primray' widens Variant and compiles
function pickVariant<Variant extends string>(
  variants: readonly Variant[],
  requestedVariant: string,
  fallback: Variant,
): Variant {
  return variants.find((variant) => variant === requestedVariant) ?? fallback
}

const buttonVariant = pickVariant(['primary', 'secondary'], requestedVariant, 'primray')

// ✅ Correct: NoInfer keeps the fallback out of inference — 'primray' is rejected
function pickVariant<Variant extends string>(
  variants: readonly Variant[],
  requestedVariant: string,
  fallback: NoInfer<Variant>,
): Variant {
  return variants.find((variant) => variant === requestedVariant) ?? fallback
}

const buttonVariant = pickVariant(['primary', 'secondary'], requestedVariant, 'primary')
```

## Discriminated unions

A `kind` discriminant plus exhaustive `switch` beats optional-field soup.

```typescript
// ❌ Incorrect: optional-field soup — invalid states compile
interface LabelResult {
  isOk?: boolean
  value?: string
  message?: string
}

// ✅ Correct: kind discriminant + exhaustive switch
type LabelResult =
  | { kind: 'ok'; value: string }
  | { kind: 'error'; message: string }

export function getLabel(labelResult: LabelResult): string {
  switch (labelResult.kind) {
    case 'ok':
      return labelResult.value
    case 'error':
      return labelResult.message
    default: {
      const exhaustiveCheck: never = labelResult
      return exhaustiveCheck
    }
  }
}
```
