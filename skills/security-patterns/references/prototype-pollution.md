# Prototype Pollution

Skip `__proto__` and related keys when merging untrusted JSON. Those keys can
change `Object.prototype` for every object.

## Skip dangerous keys

A polluted `isAdmin` on `Object.prototype` makes every object look authorized.

```typescript
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// ❌ Incorrect: merge without dangerous-key checks — payload: {"__proto__":{"isAdmin":true}}
export function mergeDeep(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
) {
  for (const key of Object.keys(source)) {
    const sourceValue = source[key]
    const targetValue = target[key]

    if (isPlainObject(sourceValue)) {
      target[key] = mergeDeep(
        isPlainObject(targetValue) ? targetValue : {},
        sourceValue,
      )
    } else {
      target[key] = sourceValue
    }
  }

  return target
}

const parsedPayload: unknown = JSON.parse(userInput)

if (!isPlainObject(parsedPayload)) {
  throw new Error('expected plain object')
}

const mergedConfig = mergeDeep({}, parsedPayload)

// ✅ Correct: skip dangerous keys; immutable merge; null-prototype object or Map for dynamic keys
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

export function mergeDeep(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  return Object.keys(source).reduce<Record<string, unknown>>(
    (mergedTarget, key) => {
      if (DANGEROUS_KEYS.has(key)) {
        return mergedTarget
      }

      const sourceValue = source[key]
      const targetValue = mergedTarget[key]

      if (isPlainObject(sourceValue)) {
        const nestedTarget = isPlainObject(targetValue) ? targetValue : {}

        return {
          ...mergedTarget,
          [key]: mergeDeep(nestedTarget, sourceValue),
        }
      }

      return {
        ...mergedTarget,
        [key]: sourceValue,
      }
    },
    { ...target },
  )
}

const parsedPayload: unknown = JSON.parse(userInput)

if (!isPlainObject(parsedPayload)) {
  throw new Error('expected plain object')
}

const mergedConfig = mergeDeep({}, parsedPayload)
const safeObject: Record<string, unknown> = Object.create(null)
const safeStore = new Map<string, unknown>()
```

- Do not deep-merge untrusted JSON into app objects without key allowlisting.

## Dynamic keys

- Prefer `Object.create(null)` or `Map` when keys come from external input.
