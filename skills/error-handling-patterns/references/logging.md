# Logging

Prefer a client-safe `code` + `message` in the response and a `cause` chain in server logs, so stacks and SQL never leak.

## Log vs return

Mixing client and server surfaces is how internals leak. Clients get `code` + safe `message`; servers get `kind`, correlation id, identifiers, and `cause`.

```typescript
// ❌ Incorrect: driver text and id leak into the client message
export function createUserNotFoundError(userId: string, error: unknown): never {
  throw new ApplicationError({
    code: 'user_not_found',
    kind: 'not_found',
    message: `pg: ${String(error)} (${userId})`,
  })
}

// ✅ Correct: stable code; safe message; id stays in logs
export function createUserNotFoundError(userId: string, error: unknown): never {
  throw new ApplicationError({
    code: 'user_not_found',
    kind: 'not_found',
    message: 'User not found',
    cause: error,
  })
}
```

- A correlation id belongs in logs. Return it to the client only when the contract already does.
- `kind` and `cause` stay on the server. HTTP `statusCode` is the response status, not a JSON field — unless this API already returns that field.

## Cause chains

Wrapping without `cause` drops the root error. Keep `cause` so the edge can log the original failure; keep `message` client-safe.

```typescript
// ❌ Incorrect: stringify and drop the chain
export function wrapUpstreamError(error: unknown): never {
  throw new ApplicationError({
    code: 'order_failed',
    kind: 'unexpected',
    message: String(error),
  })
}

// ✅ Correct: preserve cause; message stays client-safe
export function wrapUpstreamError(error: unknown): never {
  throw new ApplicationError({
    code: 'order_failed',
    kind: 'unavailable',
    message: 'Order could not be completed',
    cause: error,
  })
}
```

- Wrap when you add context the caller doesn’t have. Don’t wrap only to rethrow the same failure unchanged — propagate as-is.

## Log once

Log at the boundary that owns the decision — usually the edge that maps to transport. Logging the same failure at every layer duplicates alerts. Don’t log and then succeed.

```typescript
// ❌ Incorrect: log then succeed — swallow dressed as success
export async function createOrder(orderInput: CreateOrderInput): Promise<Order> {
  try {
    return await saveOrder(orderInput)
  } catch (error: unknown) {
    logger.error(error)
    return emptyOrder
  }
}

// ✅ Correct: propagate so the edge maps and logs once
export async function createOrder(orderInput: CreateOrderInput): Promise<Order> {
  return saveOrder(orderInput)
}
```

- **Operational:** info/warn; `code` + `kind`; no stack spam for routine misses and validation.
- **Unexpected:** error; stack + `cause` + correlation id.
- **Degradation:** always log that you degraded, with `code` / `kind`.
