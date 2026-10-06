# Authentication

Prefer passkeys, Argon2id password hashes, pinned JWT verification, and
`__Host-` session cookies over shared secrets, fast hashes, and loose token
handling — weak credential storage and token transport are direct
account-compromise paths. When passwords stay, follow NIST SP 800-63B-4
instead of composition and rotation rules.

## Prefer passkeys

Passwords and one-time codes can be phished: the user types them into a
look-alike site. A passkey (WebAuthn) signs a server challenge with a key
bound to the real origin, so a phishing page has nothing to replay and the
server stores no shared secret worth stealing.

- Offer passkeys as the primary sign-in when the product allows; keep
  passwords as a fallback, not the default.
- Verify the challenge, origin, and relying-party ID on the server with the
  WebAuthn library the repo already uses — never hand-parse authenticator
  responses.
- Account recovery must not be weaker than the passkey it replaces (no
  security questions, no unauthenticated email change).
- Passkeys also satisfy accessible-authentication requirements: no memory or
  transcription test.

## Password storage

A fast or unsalted digest lets an attacker who steals the table test billions
of guesses per second offline. Argon2id makes every guess cost memory and
time.

```typescript
import { createHash } from 'node:crypto'

// ❌ Incorrect: fast unsalted digest — offline cracking at GPU speed
export function hashPasswordInsecurely(password: string) {
  return createHash('sha256').update(password).digest('hex')
}

// ✅ Correct (Bun): Argon2id at the OWASP baseline; legacy bcrypt hashes upgrade on login
const ARGON2ID_OPTIONS = {
  algorithm: 'argon2id',
  memoryCost: 19_456,
  timeCost: 2,
} as const

export async function hashPassword(password: string) {
  return Bun.password.hash(password, ARGON2ID_OPTIONS)
}

export async function verifyPassword(
  userId: string,
  password: string,
  storedHash: string,
) {
  const isValid = await Bun.password.verify(password, storedHash)

  if (isValid && !storedHash.startsWith('$argon2id$')) {
    await updatePasswordHash(userId, await hashPassword(password))
  }

  return isValid
}
```

- Argon2id is the default for new hashes: OWASP baseline 19 MiB memory
  (`19_456` KiB), 2 iterations, parallelism 1. Tune upward, never below.
- bcrypt (cost ≥ 10) is only for verifying existing hashes. After a
  successful login, rehash the submitted password with Argon2id and replace
  the stored value — the only moment the plaintext is available.
- On Node, use the Argon2id implementation already installed with the same
  parameters. If none is available, keep bcrypt and ask before adding a
  dependency.
- Hash at registration and password reset before persisting; compare with
  the library’s verify function (constant time), never `===` on hashes.
- Never store plaintext passwords or reversible encryption.

## Password policy

NIST SP 800-63B-4 drops composition and rotation rules because they push
users toward predictable passwords; length and a breached-password check
stop real attacks.

```html
<!-- ❌ Incorrect: composition pattern, 16-character cap, paste blocked -->
<input
  type="password"
  pattern="(?=.*\d)(?=.*[A-Z]).{8,16}"
  onpaste="return false"
/>

<!-- ✅ Correct: length-based and password-manager friendly -->
<input
  type="password"
  autocomplete="new-password"
  minlength="15"
  maxlength="128"
  required
/>
```

- Minimum 15 characters when the password is the only factor, 8 when it is
  one factor of MFA; accept at least 64.
- No composition rules (required digits, symbols, or mixed case).
- No periodic forced rotation — require a change only on evidence of
  compromise.
- Reject passwords found in breached or common-password lists.
- Allow paste and password managers (`autocomplete="current-password"` /
  `"new-password"`).
- No security questions for login or recovery.
- Enforce length and the breached-password check on the server; input
  attributes only guide the user.

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

Session cookies without hardening flags are readable by scripts, sent over
plain HTTP, or overwritten by a sibling subdomain.

```typescript
// ❌ Incorrect: session cookie without hardening flags
response.setHeader('Set-Cookie', `session=${sessionId}; Path=/`)

// ✅ Correct: __Host- prefix + HttpOnly + Secure + SameSite=Lax
response.setHeader(
  'Set-Cookie',
  `__Host-session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/`,
)
```

- `__Host-` — the browser accepts the cookie only with `Secure`, `Path=/`,
  and no `Domain`, so a subdomain or plain-HTTP response cannot set or
  shadow it. Supported by all current browsers.
- `HttpOnly` — not readable by page scripts.
- `Secure` — HTTPS only.
- `SameSite=Lax` — the default; `Strict` when cross-site navigation never
  needs the session.
