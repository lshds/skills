# Retries

Prefer fail-fast typed errors unless the work is transient and idempotent, so retries cannot double-charge, double-create, or double-send.

## When to retry

Retry when the failure is likely temporary and repeating the work will not double-apply: timeouts, connection resets, unavailable/upstream — on safe reads, or on writes protected by an idempotency key.

```typescript
// ❌ Incorrect: retry a non-idempotent create — can double-charge
export async function chargeOrder(orderId: string): Promise<Payment> {
  return retryOperation(() => createPayment(orderId))
}

// ✅ Correct: retry only with an idempotency key
export async function chargeOrder(orderId: string): Promise<Payment> {
  return createPayment(orderId, { idempotencyKey: orderId })
}
```

- Fail fast (no retry): `malformed`, `validation`, `unauthenticated`, `forbidden`, `not_found`, `conflict`.
- Upstream failures become your `unavailable` error, not the vendor body. Don’t retry after the caller hung up.

## Backoff

If you retry: bounded attempts, exponential backoff, jitter. Unbounded tight retries turn one slow dependency into a self-DoS.

## Degradation

When the product can continue without the dependency, prefer a defined fallback over a hard internal failure. Always log the degradation — returning fallback data as fresh success hides the failure.

```typescript
// ❌ Incorrect: fallback returned as fresh success — failure is hidden
export async function listRecommendations(
  userId: string,
): Promise<Recommendation[]> {
  try {
    return await fetchRecommendations(userId)
  } catch {
    return staleRecommendations
  }
}

// ✅ Correct: fallback is a logged degradation
export async function listRecommendations(
  userId: string,
): Promise<Recommendation[]> {
  try {
    return await fetchRecommendations(userId)
  } catch (error: unknown) {
    logger.warn({
      code: 'recommendations_unavailable',
      kind: 'unavailable',
      cause: error,
    })

    return staleRecommendations
  }
}
```

## Circuit breaker

Retries against an already-failing dependency multiply traffic and spend callers’ timeout budget until neighboring work fails too.

- **Open** the circuit when error/timeout rate on that dependency is already high: fail fast as `unavailable`, log degradation, skip the retry loop.
- **Close** when the dependency recovers (probe / cooldown).
- A single blip is retry-with-backoff, not a circuit. `validation` / `unauthenticated` / `not_found` never trip a circuit.
- Don’t add breaker infrastructure unless the task needs it. Default when a dependency is down: fail fast, typed `unavailable`, log.
