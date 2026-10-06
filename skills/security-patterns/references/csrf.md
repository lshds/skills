# CSRF

Prefer SameSite=Lax session cookies plus a Fetch Metadata (`Sec-Fetch-Site`)
and `Origin` check on every cookie-authenticated state change over CSRF
tokens alone, so forged cross-site requests are rejected before any handler
logic runs. Browsers attach cookies to cross-site requests automatically.
Keep CSRF tokens for legacy browsers and non-browser cookie clients.

## State-changing methods

GET endpoints that mutate data can be triggered by an `<img>` tag on another site or by prefetch, without user intent.

```typescript
// ❌ Incorrect: state change via GET — <img src="/api/transfer?to=attacker"> fires it
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

## Fetch Metadata and Origin first

Evergreen browsers label every request with `Sec-Fetch-Site` (`same-origin`,
`same-site`, `cross-site`, or `none`) and send `Origin` on cross-origin and
POST requests. A forged request from another site cannot fake either header,
so checking them stops CSRF without token plumbing.

```typescript
const APP_ORIGIN = 'https://app.example.com'

// ❌ Incorrect: cookie-authenticated mutation accepts requests from any site
export async function POST(request: Request) {
  await updateSettings(await requireSessionUserId(), await request.json())

  return new Response(null, { status: 204 })
}

// ✅ Correct: reject cross-site state changes before touching the session
export function isSameOriginRequest(request: Request) {
  const fetchSite = request.headers.get('sec-fetch-site')

  if (fetchSite) {
    return fetchSite === 'same-origin'
  }

  return request.headers.get('origin') === APP_ORIGIN
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return new Response(null, { status: 403 })
  }

  await updateSettings(await requireSessionUserId(), await request.json())

  return new Response(null, { status: 204 })
}
```

- Run the check on every cookie-authenticated POST, PUT, PATCH, and DELETE.
- Accept `same-site` only when sibling subdomains are meant to call the
  endpoint; always reject `cross-site`.
- Express: the same logic in a middleware before mutating routes, reading
  `request.get('sec-fetch-site')` and `request.get('origin')`.
- A request with neither header (very old browsers, non-browser cookie
  clients) gets no pass — require a CSRF token instead.

## Next.js Server Actions and Route Handlers

Server Actions and Route Handlers look alike but get different built-in
protection, so a check that exists for one is easy to assume for the other.

- Server Actions compare `Origin` with `Host` / `X-Forwarded-Host`
  automatically and reject mismatches. Behind a proxy or on a separate
  public domain, list that origin in `serverActions.allowedOrigins` in
  `next.config` instead of disabling the check.
- Custom Route Handlers (`app/**/route.ts`) get no automatic check — add the
  Fetch Metadata / Origin check to every cookie-authenticated mutating
  handler.
- The Origin check stops cross-site forgery only; every Server Action still
  needs authn and authz inside its body.

## CSRF tokens for legacy and non-browser clients

When a client sends neither `Sec-Fetch-Site` nor `Origin`, a per-session
token is the remaining proof that the request came from your page.

```typescript
import { randomBytes, timingSafeEqual } from 'node:crypto'

export function createCsrfToken() {
  return randomBytes(32).toString('base64url')
}

export function isValidCsrfToken(
  headerToken: string | undefined,
  sessionToken: string | undefined,
) {
  if (
    !headerToken ||
    !sessionToken ||
    headerToken.length !== sessionToken.length
  ) {
    return false
  }

  return timingSafeEqual(Buffer.from(headerToken), Buffer.from(sessionToken))
}

// ❌ Incorrect: token read from the query string and compared with ===
app.post('/api/settings', async (request, response) => {
  if (request.query.csrfToken !== request.session.csrfToken) {
    return response.sendStatus(403)
  }

  await updateSettings(request.session.userId, request.body)

  response.sendStatus(204)
})

// ✅ Correct: token from a header, compared in constant time
app.post('/api/settings', async (request, response) => {
  if (
    !isValidCsrfToken(request.get('x-csrf-token'), request.session.csrfToken)
  ) {
    return response.sendStatus(403)
  }

  await updateSettings(request.session.userId, request.body)

  response.sendStatus(204)
})
```

- Issue the token into the session at login (and from a `GET /api/csrf`
  endpoint), return it in the JSON body, and have the client send it as
  `X-CSRF-Token` with `credentials: 'include'`.
- Never put CSRF tokens in URLs — they leak via logs, Referer, and caches.
- Rotate the token when the session is created or elevated.
