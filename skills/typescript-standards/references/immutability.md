# Immutability

Prefer immutable updates. Spread objects/arrays and use copying array methods
instead of mutating in place.

## Spread / map

Immutable updates via spread and `map` keep data flow predictable and avoid accidental shared mutation.

```typescript
// ❌ Incorrect: in-place mutation — shared references change unexpectedly
user.name = userName
items.push(newItem)
item.name = userName

// ✅ Correct: immutable update via spread / map
const nextUser = { ...user, name: userName }
const nextItems = [...items, newItem]
const renamedItems = items.map((item) =>
  item.id === itemId ? { ...item, name: userName } : item,
)
```

## Copy methods over in-place sort

`.sort()`, `.reverse()`, and `.splice()` reorder the array they are called on. On a prop, a function argument, or shared state, every other reader sees the new order — and frameworks that compare by reference miss the change.

```typescript
interface Order {
  id: string
  createdAt: number
}

// ❌ Incorrect: .sort() reorders the caller's array in place — the prop and every other reader change too
export function listNewestOrders(orders: Order[]) {
  return orders.sort((left, right) => right.createdAt - left.createdAt)
}

// ✅ Correct: toSorted returns a sorted copy — the input stays untouched
export function listNewestOrders(orders: readonly Order[]) {
  return orders.toSorted((left, right) => right.createdAt - left.createdAt)
}
```

- `toReversed()` instead of `.reverse()`, `toSpliced(start, deleteCount, insertedItem)` instead of `.splice()`, `with(index, value)` instead of `array[index] = value` — each returns a new array.
- They need `lib` ES2023 or later (a `target` of ES2023+ includes it). On an older `lib`, copy first: `[...orders].sort(compareOrders)`.
- Type inputs as `readonly Order[]` so the checker rejects `.sort()` / `.reverse()` / `.splice()` on them.

## When mutation is OK

Mutate only when an API requires it or a measured hot path does — and keep it on a value the function created, so nobody else holds a reference until it is returned.

```typescript
interface Order {
  customerId: string
  amount: number
}

// ❌ Incorrect: spread inside reduce copies the accumulator for every order — quadratic on large lists
export function sumTotalsByCustomer(orders: readonly Order[]) {
  return orders.reduce<Record<string, number>>(
    (totals, order) => ({
      ...totals,
      [order.customerId]: (totals[order.customerId] ?? 0) + order.amount,
    }),
    {},
  )
}

// ✅ Correct: a local Map that never escapes before the return — the mutation is invisible to callers
export function sumTotalsByCustomer(orders: readonly Order[]) {
  const totalsByCustomer = new Map<string, number>()

  for (const order of orders) {
    totalsByCustomer.set(
      order.customerId,
      (totalsByCustomer.get(order.customerId) ?? 0) + order.amount,
    )
  }

  return totalsByCustomer
}
```
