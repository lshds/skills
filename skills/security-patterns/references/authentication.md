# Authentication

Hash credentials with a strong algorithm, pin JWT verification to expected
algorithms and claims, and keep tokens out of query strings — weak storage and
token handling are direct account-compromise paths.

## Password storage

Use argon2 or bcrypt with appropriate cost factors. Never store plaintext passwords or reversible encryption.

- Hash at registration and password-reset flows before persisting.
- Compare with a constant-time verify function from the same library.

## JWT verification

Decoding without verification or trusting the token's `alg` header enables `alg: none` and algorithm-confusion attacks.

```typescript
import { SignJWT, jwtVerify, decodeJwt } from 'jose'

// ❌ Incorrect: decode without verify — trusts alg from token (including alg: none)
const payload = decodeJwt(accessToken)

// ❌ Incorrect: verify without pinning algorithm or claims
app.get('/api/me', async (request, response) => {
  const { payload } = await jwtVerify(String(request.query.token), jwtSecret)
  response.json(payload)
})

// ✅ Correct: pin alg; verify issuer/audience/expiry; use jose verify
const jwtSecretKey = process.env.JWT_SECRET

if (!jwtSecretKey) {
  throw new Error('JWT_SECRET missing')
}

const jwtSecret = new TextEncoder().encode(jwtSecretKey)

export async function signAccessToken(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .setIssuer('urn:example:api')
    .setAudience('urn:example:app')
    .sign(jwtSecret)
}

export async function verifyAccessToken(accessToken: string) {
  const { payload } = await jwtVerify(accessToken, jwtSecret, {
    algorithms: ['HS256'],
    issuer: 'urn:example:api',
    audience: 'urn:example:app',
  })

  return payload
}
```

## Token transport

Query-string tokens end up in server logs, browser history, and Referer headers.

```typescript
// ❌ Incorrect: token in query — logs / Referer leak
app.get('/api/me', async (request, response) => {
  const { payload } = await jwtVerify(String(request.query.token), jwtSecret)
  response.json(payload)
})

// ✅ Correct: Bearer from Authorization header (middleware → verifyAccessToken)
app.get('/api/me', requireAuth, async (request, response) => {
  response.json({ id: request.user.id, email: request.user.email })
})
```

Middleware alone is not enough for Server Actions or exported mutation handlers — verify authn **inside** each entry point before trusting the caller.

## Expo deep links

Deep-link URLs are attacker-controllable entry points. Tokens or privileged actions in the query fragment leak via logs, history, and other apps that observe the link.

```typescript
import * as Linking from 'expo-linking'

// ❌ Incorrect: access token in deep-link query — any app/log that sees the URL gets it
Linking.openURL(`myapp://auth/callback?accessToken=${accessToken}`)

// ❌ Incorrect: treat deep-link path/query as trusted without allowlist / casts
Linking.addEventListener('url', ({ url }) => {
  const { path, queryParams } = Linking.parse(url)
  navigate(path as string, queryParams as Record<string, string>)
})

// ✅ Correct: one-time code or server exchange; allowlisted paths only; no long-lived secrets in the URL
const ALLOWED_DEEP_LINK_PATHS = new Set(['auth/callback', 'invite/accept'])

Linking.addEventListener('url', ({ url }) => {
  const { path, queryParams } = Linking.parse(url)

  if (!path || !ALLOWED_DEEP_LINK_PATHS.has(path)) {
    return
  }

  const oneTimeCode = queryParams?.code

  if (typeof oneTimeCode !== 'string') {
    return
  }

  exchangeCodeForSession(oneTimeCode)
})
```

- Prefer authorization codes (or app-bound claims) over access tokens in `myapp://` links.
- Allowlist paths; never navigate to an arbitrary parsed path from the link.
- Validate and expire one-time codes on the server the same way as other auth callbacks.

## Session cookies

Session cookies without hardening flags are readable by scripts or sent over plain HTTP.

```typescript
// ❌ Incorrect: session cookie without hardening flags
response.setHeader('Set-Cookie', `session=${sessionId}; Path=/`)

// ✅ Correct: HttpOnly, Secure, SameSite on session cookie
response.setHeader(
  'Set-Cookie',
  `session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/`,
)
```

- `HttpOnly` — not readable by page scripts.
- `Secure` — HTTPS only.
- `SameSite=Lax` or `Strict` — limits cross-site cookie submission.
