# Storage

Prefer the repo’s prefs helper for non-sensitive client data and SecureStore for
secrets — wrong store leaks tokens or invents a second persistence API.

## Choose the right store

Match the use case to one store; never put lifecycle state in persistence.

```tsx
// ❌ Incorrect: auth token in AsyncStorage — not encrypted at rest
import AsyncStorage from '@react-native-async-storage/async-storage'
await AsyncStorage.setItem('auth_token', token)

// ✅ Correct: SecureStore for secrets; prefs helper for UI flags
import * as SecureStore from 'expo-secure-store'
await SecureStore.setItemAsync('auth_token', token)
// theme / flags → repo prefs helper (sqlite localStorage or existing wrapper)
```

| Use case | Prefer |
| --- | --- |
| Settings, flags, small prefs | Repo helper — `expo-sqlite` `localStorage` polyfill, or existing AsyncStorage wrapper |
| Tokens, passwords, session secrets | `expo-secure-store` |
| Large / relational / queryable data | `expo-sqlite` |

## Prefs (non-sensitive)

Prefer the storage the repo already uses. On greenfield Expo, prefer the sqlite
localStorage polyfill over adding a second AsyncStorage dependency.

```tsx
// ❌ Incorrect: persist full server models / untyped grab-bag keys
await AsyncStorage.setItem('user', JSON.stringify(fullUserFromApi))

// ✅ Correct: small typed keys; ids / drafts / UI prefs only
import 'expo-sqlite/localStorage/install'
localStorage.setItem('theme', 'dark')
const theme = localStorage.getItem('theme')
```

- Wrap read/write in `try/catch`.
- JSON-serialize objects; validate on read.

## Secrets

Store tokens only in SecureStore — never prefs, AsyncStorage, or plain localStorage.

```tsx
// ❌ Incorrect: token in plain localStorage polyfill
localStorage.setItem('auth_token', token)

// ✅ Correct: SecureStore
import * as SecureStore from 'expo-secure-store'
await SecureStore.setItemAsync('auth_token', token)
const token = await SecureStore.getItemAsync('auth_token')
```

## Reactive prefs

If UI must subscribe to pref changes, wrap get/set with `useSyncExternalStore`
(or the repo’s existing hook) — don’t invent a second global store for the same
keys.

```tsx
// ❌ Incorrect: useState copy that drifts from storage
const [theme, setTheme] = useState(localStorage.getItem('theme') ?? 'light')

// ✅ Correct: subscribe via useSyncExternalStore / repo hook
const [theme, setTheme] = useStorage('theme', 'light')
```
