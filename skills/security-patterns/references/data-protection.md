# Data Protection

Keep secrets server-side, treat public env prefixes as client-visible, and
never log credentials or full PII. Leaked config and logs are how data gets
out.

## Secrets and client bundles

Hardcoded keys and `NEXT_PUBLIC_*` / `VITE_*` / `EXPO_PUBLIC_*` variables ship to every client bundle.

```typescript
// ❌ Incorrect: hardcoded secret / client-bundled env var
const STRIPE_SECRET = 'sk_live_...'
// EXPO_PUBLIC_API_SECRET=... / NEXT_PUBLIC_DB_PASSWORD=...

// ❌ Incorrect: log authorization header and full request body
console.log('auth', {
  authorization: request.headers.authorization,
  body: request.body,
})

// ✅ Correct: server-only env; public URL prefix only; structured log without secrets
const stripeSecret = process.env.STRIPE_SECRET_KEY
const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL

logger.info('login_attempt', { userId, ipAddress })
```

- No hardcoded secrets in source; keep `.env*` out of git.
- `NEXT_PUBLIC_*`, `VITE_*`, and `EXPO_PUBLIC_*` are visible to end users — secrets stay server-only.
- Vite: only `VITE_*` (or the configured `envPrefix`) is exposed to the browser bundle; server-only secrets use names without that prefix and stay off `import.meta.env` in client code.
- Next: `NEXT_PUBLIC_*` ships to the client; server Components/Route Handlers read non-public `process.env` — never rename a secret into the public prefix to “share” it.

## What may be stored (tokens & secrets)

Owns *what* is allowed in client storage — not storage-API hygiene.

**Web:** httpOnly Secure cookies when practical. `localStorage` / `sessionStorage` are allowed when cookies aren’t practical — short lifecycle only (not long-lived persistence); accept the XSS/exfiltration risk.

**Native:** AsyncStorage is not encrypted; tokens stored there are readable on a compromised device — use SecureStore.

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'

// ❌ Incorrect: AsyncStorage for auth tokens — not encrypted at rest
await AsyncStorage.setItem('accessToken', accessToken)

// ✅ Correct: SecureStore for app tokens on device
await SecureStore.setItemAsync('accessToken', accessToken)
```

- Never log tokens, passwords, or full PII in application or access logs.
