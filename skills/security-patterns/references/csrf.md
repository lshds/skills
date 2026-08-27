# CSRF

Protect cookie-authenticated state changes with SameSite cookies and CSRF
tokens. Browsers attach cookies to cross-site requests automatically.

## State-changing methods

GET endpoints that mutate data can be triggered by `<img src="…">` or prefetch without user intent.

```typescript
// ❌ Incorrect: state change via GET — <img src="…"> fires it
app.get('/api/transfer', async (request, response) => {
  await transferFunds(
    request.session.userId,
    request.query.to,
    request.query.amount,
  )
  response.sendStatus(200)
})

// ✅ Correct: mutate via POST only — not reachable via <img> / prefetch
app.post('/api/transfer', async (request, response) => {
  await transferFunds(
    request.session.userId,
    request.body.to,
    request.body.amount,
  )

  response.sendStatus(200)
})
```

- State changes via POST, PUT, PATCH, or DELETE only — never GET.
- Bearer-token APIs from non-cookie clients are usually outside classic CSRF scope.

## CSRF tokens and SameSite

Cookie sessions without a CSRF check let forged cross-site POSTs run as the victim.

```typescript
import { randomBytes, timingSafeEqual } from 'node:crypto'

// ❌ Incorrect: cookie session with no CSRF check on mutate
app.post('/api/settings', async (request, response) => {
  await updateSettings(request.session.userId, request.body)
  response.sendStatus(200)
})

// ✅ Correct: issue token into session; verify on mutate; SameSite=Lax cookie
interface CsrfSession {
  userId?: string
  csrfToken?: string
}

class CsrfError extends Error {
  statusCode = 403
  constructor(message = 'CSRF token mismatch', options?: ErrorOptions) {
    super(message, options)
    this.name = 'CsrfError'
  }
}

function isCsrfSession(value: unknown): value is CsrfSession {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  if (
    'csrfToken' in value &&
    value.csrfToken !== undefined &&
    typeof value.csrfToken !== 'string'
  ) {
    return false
  }

  if (
    'userId' in value &&
    value.userId !== undefined &&
    typeof value.userId !== 'string'
  ) {
    return false
  }

  return true
}

function requireCsrfSession(sessionValue: unknown): CsrfSession {
  if (!isCsrfSession(sessionValue)) {
    throw new CsrfError('invalid session')
  }

  return sessionValue
}

export function createCsrfToken() {
  return randomBytes(32).toString('base64url')
}

export function assertCsrfToken(
  headerToken: string | undefined,
  sessionToken: string | undefined,
) {
  if (
    !headerToken ||
    !sessionToken ||
    headerToken.length !== sessionToken.length
  ) {
    throw new CsrfError()
  }

  if (
    !timingSafeEqual(Buffer.from(headerToken), Buffer.from(sessionToken))
  ) {
    throw new CsrfError()
  }
}

app.post('/api/login', async (request, response) => {
  const session = requireCsrfSession(request.session)
  const csrfToken = createCsrfToken()
  request.session = { ...session, userId: user.id, csrfToken }

  response.setHeader(
    'Set-Cookie',
    `session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/`,
  )
  response.json({ csrfToken }) // client stores and sends as X-CSRF-Token
})

app.get('/api/csrf', async (request, response) => {
  const session = requireCsrfSession(request.session)
  const csrfToken = session.csrfToken ?? createCsrfToken()
  request.session = { ...session, csrfToken }

  response.json({ csrfToken })
})

app.post('/api/settings', async (request, response) => {
  const session = requireCsrfSession(request.session)
  assertCsrfToken(request.headers['x-csrf-token'], session.csrfToken)
  await updateSettings(session.userId, request.body)

  response.sendStatus(200)
})

await fetch('/api/settings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
  },
  credentials: 'include',
  body: JSON.stringify(settingsUpdate),
})
```

- Do not put CSRF tokens in URLs — they leak via logs, Referer, and caches.
- Send the token in a header (e.g. `X-CSRF-Token`), not the query string.
