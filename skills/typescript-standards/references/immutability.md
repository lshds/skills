# Immutability

Prefer immutable updates. Spread objects/arrays instead of mutating in place.

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

## When mutation is OK

Mutate only when an API or a clear perf constraint requires it.
