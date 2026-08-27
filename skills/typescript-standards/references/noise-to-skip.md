# Noise to Skip

Omit obvious annotations, extra wrappers, and `else` after `return`. Let
inference speak.

## Prefer inference

Redundant type annotations and `else` after `return` add noise without improving safety.

```typescript
// ❌ Incorrect: redundant annotation; else after return
const title: string = 'Dashboard'
if (!user) {
  return
} else {
  notifyUser(user)
}

// ✅ Correct: inference; bare return; no else after return
const title = 'Dashboard'

if (!user) {
  return
}

notifyUser(user)
```
