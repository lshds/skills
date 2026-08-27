# Data

On native, API calls need an absolute base URL (`EXPO_PUBLIC_*`) — there is no
browser origin, so relative `/api/...` fails. Prefer `fetch` / `expo/fetch` and
the repo’s query lib over hand-rolled request code.

## Fetch basics

Build every request from an absolute API base (`EXPO_PUBLIC_API_URL` or the
repo’s client). Check `response.ok` before `json()` — a 4xx/5xx body is not
success data.

```tsx
// ❌ Incorrect: relative URL + ignore HTTP errors
const data = await fetch('/api/me').then((response) => response.json())

// ✅ Correct: absolute base + status check
const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/me`)

if (!response.ok) {
  throw new Error(`HTTP ${response.status}`)
}

const data = await response.json()
```

- Prefer `fetch` (or `expo/fetch` for streaming) unless the repo already
  standardizes on another client.
- Only `EXPO_PUBLIC_*` vars ship to the client — never put write-capable secrets
  there. Restart the bundler after `.env` changes.
- For cacheable remote data, use the repo’s query lib — don’t hand-roll
  fetch-in-`useEffect` when that stack exists.

## Auth on device

Read bearer tokens from SecureStore and attach `Authorization` headers — never
AsyncStorage / plain localStorage.

```tsx
// ❌ Incorrect: token from AsyncStorage
const token = await AsyncStorage.getItem('auth_token')
await fetch(url, { headers: { Authorization: `Bearer ${token}` } })

// ✅ Correct: SecureStore + Authorization header
import * as SecureStore from 'expo-secure-store'
const token = await SecureStore.getItemAsync('auth_token')
await fetch(url, {
  headers: token ? { Authorization: `Bearer ${token}` } : {},
})
```

- Dedupe refresh with a single in-flight refresh promise when implementing
  refresh.

## Offline and cancellation

Wire network status into the query client when offline matters; abort stray
fetches on unmount when not using a query lib.

```tsx
// ❌ Incorrect: ignore offline; no abort on unmount
useEffect(() => {
  fetch(url).then(…).then(setData)
}, [url])

// ✅ Correct: AbortController cleanup (query libs often cancel for you)
useEffect(() => {
  const abortController = new AbortController()

  fetch(url, { signal: abortController.signal })
    .then((response) => response.json())
    .then(setData)
    .catch((error) => {
      if (error.name !== 'AbortError') {
        setError(error)
      }
    })

  return () => abortController.abort()
}, [url])
```

- React Query: sync NetInfo → `onlineManager` for pause/resume when offline.
- Expo Router `useLoaderData` loaders are primarily a **web** (SDK 55+) path —
  on native prefer hooks / React Query unless the repo already uses loaders.
