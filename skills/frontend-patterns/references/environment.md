# Environment

Prefer one public config object, checked when the module loads, over raw
environment reads at call sites so a missing value fails at startup instead of
landing in a request URL as `"undefined"`. Read every variable through that
object, under the name the client already uses, from one source.

## Required public values

An unchecked public variable has type `string | undefined`, so embedding it in a URL puts the string `"undefined"` into the path. Check the values when the module is first evaluated and throw if a required value is absent.

```typescript
// ❌ Incorrect: unchecked public variable embedded in the request URL
export async function loadCatalog(): Promise<Catalog> {
  const response = await fetch(`${process.env.API_URL}/catalog`)

  return parseCatalog(await response.json())
}

// ✅ Correct: checked when the module is first evaluated
interface PublicEnvironment {
  apiBaseUrl: string
}

function parsePublicEnvironment(): PublicEnvironment {
  const apiBaseUrl = process.env.API_URL

  if (!apiBaseUrl) {
    throw new Error('API_URL is required')
  }

  return { apiBaseUrl }
}

export const publicEnvironment = parsePublicEnvironment()

export async function loadCatalog(): Promise<Catalog> {
  const response = await fetch(`${publicEnvironment.apiBaseUrl}/catalog`)

  return parseCatalog(await response.json())
}
```

## Names the client already uses

Client bundles see only the variables the bundler exposes — typically those with its public prefix (`VITE_` through `import.meta.env`, `EXPO_PUBLIC_` through `process.env`) — and anything else reads as `undefined`. Use the name, prefix, and access path the repository already reads; a new spelling for the same setting is a second variable nobody sets.

```typescript
// ❌ Incorrect: a name the rest of the client does not use
function parsePublicEnvironment(): PublicEnvironment {
  const apiBaseUrl = process.env.CATALOG_HOST

  if (!apiBaseUrl) {
    throw new Error('CATALOG_HOST is required')
  }

  return { apiBaseUrl }
}

// ✅ Correct: the name the repository already uses, read inside the checked config
function parsePublicEnvironment(): PublicEnvironment {
  const apiBaseUrl = process.env.API_URL

  if (!apiBaseUrl) {
    throw new Error('API_URL is required')
  }

  return { apiBaseUrl }
}
```

- Never give a server-only secret a public prefix — every value the client bundle reads ships to every user.

## One source

Reading both `app.config` `extra` and an environment variable gives two sources for the same setting. Use the source the repository already uses.

```typescript
// ❌ Incorrect: app.config extra and an environment variable as two sources
import Constants from 'expo-constants'

export function readApiBaseUrl(): string {
  const extraApiUrl: unknown = Constants.expoConfig?.extra?.apiUrl

  if (typeof extraApiUrl === 'string' && extraApiUrl) {
    return extraApiUrl
  }

  return process.env.API_URL ?? ''
}

// ✅ Correct: the source the repository already uses
import { publicEnvironment } from './environment'

export function readApiBaseUrl(): string {
  return publicEnvironment.apiBaseUrl
}
```
