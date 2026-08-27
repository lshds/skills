# Logging

Prefer the app’s logger over `console.log`, so client logs go to one place and are easy to search.

## App logger

If the app already has a logger, use it — not `console.log` in a click handler. If it doesn’t, `console.log` is fine. Ask the user if they want a logger added; don’t add one on your own.

```tsx
// ❌ Incorrect: leftover console.log in the handler
function CheckoutButton({ cartId }: { cartId: string }) {
  function handleClick() {
    console.log(`checkout started ${cartId}`)
    startCheckout(cartId)
  }

  return (
    <button type="button" onClick={handleClick}>
      Checkout
    </button>
  )
}

// ✅ Correct: the app’s logger
function CheckoutButton({ cartId }: { cartId: string }) {
  function handleClick() {
    logger.info('checkout_started', { cartId })
    startCheckout(cartId)
  }

  return (
    <button type="button" onClick={handleClick}>
      Checkout
    </button>
  )
}
```

## Named events

A sentence in the log is hard to search. Name the event and only put the ids that line needs.

```typescript
// ❌ Incorrect: one string plus the whole cart
export function logCheckoutStarted(cart: Cart): void {
  logger.info(`checkout started ${JSON.stringify(cart)}`)
}

// ✅ Correct: event name and the id that line needs
export function logCheckoutStarted(cart: Cart): void {
  logger.info('checkout_started', { cartId: cart.id })
}
```

- Prefer names other screens already use for the same thing, so you can search one event.

## Levels

`info` when nothing was off. `warn` when the UI still worked but something was off. For example: you showed a stale cache. Don’t `warn` when the load was normal.

```typescript
// ❌ Incorrect: warn for a normal live load
export function logCatalogLoad(result: CatalogLoadResult): void {
  if (result.source === 'network') {
    logger.warn('catalog_loaded', { catalogId: result.catalogId })
    return
  }

  logger.info('catalog_stale_cache', { catalogId: result.catalogId })
}

// ✅ Correct: info on a live load; warn when you showed a stale cache
export function logCatalogLoad(result: CatalogLoadResult): void {
  if (result.source === 'cache') {
    logger.warn('catalog_stale_cache', { catalogId: result.catalogId })
    return
  }

  logger.info('catalog_loaded', { catalogId: result.catalogId })
}
```

## One logger

One logger for the app. A second one next to it means logs live in two places.

```typescript
// ❌ Incorrect: a second logger next to the app’s logger
const debugLog = createDebugLogger()

export function logCheckoutStarted(cartId: string): void {
  debugLog('checkout_started', cartId)
  logger.info('checkout_started', { cartId })
}

// ✅ Correct: the app’s logger only
export function logCheckoutStarted(cartId: string): void {
  logger.info('checkout_started', { cartId })
}
```

- Use the logger already in the app. Don’t add another one.
- No logger in the app? `console.log` is fine. Ask the user if they want a logger before you add one.
