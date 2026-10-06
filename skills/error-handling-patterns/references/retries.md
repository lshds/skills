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

## Cancellation and timeouts

A retry loop that ignores the caller's signal keeps calling the dependency after the request is gone, and an attempt without its own timeout can hang until the whole budget is spent. Pass the caller's `AbortSignal` through, bound each attempt with `AbortSignal.timeout(ms)`, combine both with `AbortSignal.any([signal, timeoutSignal])`, and stop once the caller aborted.

```typescript
const MAX_ATTEMPTS = 3
const ATTEMPT_TIMEOUT_MS = 2_000

// ❌ Incorrect: no caller signal, no per-attempt timeout — one hung attempt stalls the loop, and retries keep running after the caller left
export async function fetchExchangeRates(): Promise<ExchangeRates> {
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 1) {
      await waitForBackoff(attempt)
    }

    try {
      return await requestExchangeRates()
    } catch (error) {
      lastError = error
    }
  }

  throw new ApplicationError({
    code: 'exchange_rates_unavailable',
    kind: 'unavailable',
    message: 'Exchange rates are unavailable',
    cause: lastError,
  })
}

// ✅ Correct: each attempt aborts on the caller's signal or its own timeout; a caller abort ends the loop
export async function fetchExchangeRates(
  signal: AbortSignal,
): Promise<ExchangeRates> {
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 1) {
      await waitForBackoff(attempt, signal)
    }

    try {
      return await requestExchangeRates(
        AbortSignal.any([signal, AbortSignal.timeout(ATTEMPT_TIMEOUT_MS)]),
      )
    } catch (error) {
      if (signal.aborted) {
        throw error
      }

      lastError = error
    }
  }

  throw new ApplicationError({
    code: 'exchange_rates_unavailable',
    kind: 'unavailable',
    message: 'Exchange rates are unavailable',
    cause: lastError,
  })
}
```

- Create the timeout signal inside the loop. A timeout signal starts counting when it is created, so one shared across attempts is already aborted by the later ones.
- A per-attempt timeout is a transient failure worth retrying; a caller abort is not — rethrow it instead of mapping it to `unavailable` or logging it as an upstream failure.
- The backoff wait listens to the same signal, so a cancelled caller doesn't sleep through the delay.

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
  } catch (error) {
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
