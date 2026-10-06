# Concurrent

Prefer an owned failure path for every async task so errors cannot vanish or crash the process unmapped.

## Own every task

Await the work, join the group, or attach a failure path (typed error, dead-letter, or a defined degrade). Detached `void somePromise()` is a swallow.

```typescript
// ❌ Incorrect: detached work — failure is unmapped
export async function publishDocument(
  document: Document,
): Promise<PublishResult> {
  void indexDocument(document.id)

  return { id: document.id }
}

// ✅ Correct: await required work so failure maps
export async function publishDocument(
  document: Document,
): Promise<PublishResult> {
  await indexDocument(document.id)

  return { id: document.id }
}
```

- If indexing is optional, that is degradation: log, continue, don’t pretend index succeeded.
- If work continues after the caller already got success, that work still needs an owner.

## All-or-nothing batch

When the contract is all-or-nothing, one item failing means the batch failed. Returning the successful subset as `Item[]` hides the failure.

```typescript
// ❌ Incorrect: skip failures, return successes as full success
export async function saveItems(items: Item[]): Promise<Item[]> {
  const savedItems: Item[] = []

  for (const item of items) {
    try {
      savedItems.push(await saveItem(item))
    } catch {
      // ignore
    }
  }

  return savedItems
}

// ✅ Correct: one failure fails the batch
export async function saveItems(items: Item[]): Promise<Item[]> {
  return Promise.all(items.map((item) => saveItem(item)))
}
```

## Per-item batch

When the contract allows partial success, failed items must stay visible. Dropping them and returning only successes is still a swallow.

```typescript
// ❌ Incorrect: catch and omit failed items — callers see only successes
export async function saveItems(
  items: Item[],
): Promise<{ savedItems: Item[] }> {
  const savedItems: Item[] = []

  for (const item of items) {
    try {
      savedItems.push(await saveItem(item))
    } catch {
      // ignore
    }
  }

  return { savedItems }
}

// ✅ Correct: allSettled reports every outcome — failed items stay in the result
export async function saveItems(
  items: Item[],
): Promise<{ savedItems: Item[]; failedItems: Item[] }> {
  const saveResults = await Promise.allSettled(
    items.map((item) => saveItem(item)),
  )

  return {
    savedItems: saveResults.flatMap((saveResult) =>
      saveResult.status === 'fulfilled' ? [saveResult.value] : [],
    ),
    failedItems: items.filter(
      (item, itemIndex) => saveResults[itemIndex].status === 'rejected',
    ),
  }
}
```

- Prefer `Promise.allSettled` over a hand-rolled `try` / `catch` inside each `map` callback: it already reports each outcome as `fulfilled` (with `value`) or `rejected` (with `reason`), in input order, so result `itemIndex` belongs to `items[itemIndex]`.
- Partial success is a real outcome only when the contract says so. Silence is a swallow.
- If the parent is cancelled, stop work and propagate — don’t leave orphan tasks.
