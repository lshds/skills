# Prototype Pollution

Skip `__proto__` and related keys when merging untrusted JSON. Those keys can
change `Object.prototype` for every object.

## Skip dangerous keys

A polluted `isAdmin` on `Object.prototype` makes every object look authorized.

```typescript
// ❌ Incorrect: merge without dangerous-key checks — payload: {"__proto__":{"isAdmin":true}}
function mergeDeep(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
) {
  for (const key of Object.keys(source)) {
    const sourceValue = source[key]

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue)
    ) {
      target[key] = mergeDeep(
        (target[key] as Record<string, unknown>) ?? {},
        sourceValue as Record<string, unknown>,
      )
    } else {
      target[key] = sourceValue
    }
  }

  return target
}

const unsafePayload: unknown = JSON.parse(userInput)
mergeDeep({}, unsafePayload as Record<string, unknown>)

// ✅ Correct: skip dangerous keys; immutable merge; null-prototype object or Map for dynamic keys
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function safeMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  return Object.keys(source).reduce<Record<string, unknown>>(
    (mergedTarget, key) => {
      if (DANGEROUS_KEYS.has(key)) {
        return mergedTarget
      }

      const sourceValue = source[key]

      if (isPlainObject(sourceValue)) {
        const nestedTarget = isPlainObject(mergedTarget[key])
          ? mergedTarget[key]
          : {}

        return {
          ...mergedTarget,
          [key]: safeMerge(nestedTarget, sourceValue),
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

const mergedConfig = safeMerge({}, parsedPayload)
const safeObject: Record<string, unknown> = Object.create(null)
const safeStore = new Map<string, unknown>()
```

- Do not deep-merge untrusted JSON into app objects without key allowlisting.

## Dynamic keys

- Prefer `Object.create(null)` or `Map` when keys come from external input.
