# Environment

Prefer a public environment object whose required fields are checked when the
module loads. Don’t put unchecked env vars in request URLs.

## Names the client already uses

The name of a client-visible variable is whatever the repository already reads. Whether it begins with `API_`, `EXPO_PUBLIC_`, `VITE_`, or another prefix is not the rule.

```typescript
// ❌ Incorrect: a name the rest of the client does not use
export async function loadCatalog(): Promise<Catalog> {
  const response = await fetch(`${process.env.CATALOG_HOST}/catalog`)
  const catalog: Catalog = await response.json()
  return catalog
}

// ✅ Correct: the name the repository already uses
export async function loadCatalog(): Promise<Catalog> {
  const response = await fetch(`${process.env.API_URL}/catalog`)
  const catalog: Catalog = await response.json()
  return catalog
}
```

- A secret that must stay on the server must not be among the values copied into client code.

## Required public values

An unchecked public variable has type `string | undefined`, so embedding it in a URL puts the string `"undefined"` into the path. Check the values when the module is first evaluated and throw if a required value is absent.

```typescript
// ❌ Incorrect: unchecked public variable embedded in the request URL
export async function loadCatalog(): Promise<Catalog> {
  const response = await fetch(`${process.env.API_URL}/catalog`)
  const catalog: Catalog = await response.json()
  return catalog
}

// ✅ Correct: checked when the module is first evaluated
type PublicEnvironment = {
  apiBaseUrl: string
}

function parsePublicEnvironment(): PublicEnvironment {
  const apiBaseUrl = process.env.API_URL

  if (apiBaseUrl === undefined || apiBaseUrl === '') {
    throw new Error('API_URL is required')
  }

  return { apiBaseUrl }
}

const publicEnvironment = parsePublicEnvironment()

export async function loadCatalog(): Promise<Catalog> {
  const response = await fetch(`${publicEnvironment.apiBaseUrl}/catalog`)
  const catalog: Catalog = await response.json()
  return catalog
}
```

## One source

Reading both `app.config` `extra` and an environment variable gives two sources for the same setting. Use the source the repository already uses.

```typescript
// ❌ Incorrect: app.config extra and an environment variable as two sources
import Constants from 'expo-constants'

export function readApiBaseUrl(): string {
  const extraApiUrl = Constants.expoConfig?.extra?.apiUrl
  if (typeof extraApiUrl === 'string' && extraApiUrl.length > 0) {
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
