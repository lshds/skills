# Logging

Prefer object fields on the repo logger over a glued-together string, so log lines are easy to search and you can follow a request.

## Structured fields

A sentence in the log is hard to search. Name the event and only put the ids that line needs.

```typescript
// ❌ Incorrect: one string plus the whole body — hard to search
export async function completeCheckout(
  logger: Logger,
  checkout: Checkout,
): Promise<Order> {
  const startedAt = Date.now()
  const order = await saveOrder(checkout)

  logger.info(
    `order ${order.id} created in ${Date.now() - startedAt}ms ${JSON.stringify(checkout)}`,
  )

  return order
}

// ✅ Correct: event name and a few fields
export async function completeCheckout(
  logger: Logger,
  checkout: Checkout,
): Promise<Order> {
  const startedAt = Date.now()
  const order = await saveOrder(checkout)

  logger.info({
    event: 'order_created',
    orderId: order.id,
    durationMs: Date.now() - startedAt,
  })

  return order
}
```

- Prefer names other handlers already use for the same thing, so you can search one field.

## Levels

`info` when the request did the normal thing — a cache hit, or a cache miss followed by a live fetch. `warn` when it still worked but on a fallback or degraded path: a stale copy served because the live fetch failed, or a save that was slow but worked. Don’t `warn` a normal path, or every cold cache key looks like an incident.

```typescript
// ❌ Incorrect: warn on a normal cache miss; the stale fallback hides at info
export async function loadCatalog(
  logger: Logger,
  catalogId: string,
): Promise<Catalog> {
  const cachedCatalog = await readCatalogCache(catalogId)

  if (cachedCatalog) {
    logger.info({ event: 'catalog_cache_hit', catalogId })
    return cachedCatalog
  }

  logger.warn({ event: 'catalog_cache_miss', catalogId })

  try {
    return await fetchCatalog(catalogId)
  } catch (error) {
    const staleCatalog = await readStaleCatalog(catalogId)

    if (!staleCatalog) {
      throw error
    }

    logger.info({ event: 'catalog_served_stale', catalogId })
    return staleCatalog
  }
}

// ✅ Correct: info on a normal miss; warn only when the fetch failed and a stale copy was served
export async function loadCatalog(
  logger: Logger,
  catalogId: string,
): Promise<Catalog> {
  const cachedCatalog = await readCatalogCache(catalogId)

  if (cachedCatalog) {
    logger.info({ event: 'catalog_cache_hit', catalogId })
    return cachedCatalog
  }

  logger.info({ event: 'catalog_cache_miss', catalogId })

  try {
    return await fetchCatalog(catalogId)
  } catch (error) {
    const staleCatalog = await readStaleCatalog(catalogId)

    if (!staleCatalog) {
      throw error
    }

    logger.warn({ event: 'catalog_served_stale', catalogId })
    return staleCatalog
  }
}
```

`debug` is extra detail. `error` is it failed.

```typescript
// ❌ Incorrect: error on a successful save; debug as the failure log
export async function createOrder(
  logger: Logger,
  orderInput: CreateOrderInput,
): Promise<Order | undefined> {
  const order = await saveOrder(orderInput)

  if (!order) {
    logger.debug({ event: 'order_create_failed' })
    return
  }

  logger.error({ event: 'order_created', orderId: order.id })

  return order
}

// ✅ Correct: debug for extra detail; error when it failed
export async function createOrder(
  logger: Logger,
  orderInput: CreateOrderInput,
): Promise<Order | undefined> {
  logger.debug({ event: 'order_create_start', skuCount: orderInput.items.length })

  const order = await saveOrder(orderInput)

  if (!order) {
    logger.error({ event: 'order_create_failed' })
    return
  }

  logger.info({ event: 'order_created', orderId: order.id })

  return order
}
```

## Correlation

If only some lines have the request id, you can’t follow the request. Put it on a child logger once so every line gets it.

```typescript
// ❌ Incorrect: request id only on some calls
export async function createOrder(
  logger: Logger,
  requestId: string,
  orderInput: CreateOrderInput,
): Promise<Order> {
  const order = await saveOrder(orderInput)

  logger.info({ event: 'order_created', orderId: order.id })

  return order
}

// ✅ Correct: child logger puts requestId on every line
export async function createOrder(
  logger: Logger,
  requestId: string,
  orderInput: CreateOrderInput,
): Promise<Order> {
  const requestLogger = logger.child({ requestId })
  const order = await saveOrder(orderInput)

  requestLogger.info({ event: 'order_created', orderId: order.id })

  return order
}
```

- Make the child in the handler and pass that logger down. Don’t add the id by hand on every call.

## One logger

One logger for the server. If the repo already has one, use it — `console.log` plus a debug package means logs live in two places and lose their fields. If there is no logger, `console.log` is fine; ask the user if they want a logger added, don’t add one on your own.

```typescript
// ❌ Incorrect: console.log and a second library on the request path
export async function createOrder(
  orderInput: CreateOrderInput,
): Promise<Order> {
  const order = await saveOrder(orderInput)

  console.log('order_created', order.id)
  debug('order %s saved', order.id)

  return order
}

// ✅ Correct: repo logger only
export async function createOrder(
  logger: Logger,
  orderInput: CreateOrderInput,
): Promise<Order> {
  const order = await saveOrder(orderInput)

  logger.info({ event: 'order_created', orderId: order.id })

  return order
}
```

- Use the logger already in the repo. Don’t add another one.
- No logger in the repo? `console.log` is fine. Ask the user if they want a logger before you add one.
