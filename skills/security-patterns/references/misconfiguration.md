# Misconfiguration

Allowlist CORS origins, set security headers, and return generic errors in
production. Prefer a nonce-based CSP with `'strict-dynamic'` over host
allow-lists or `'unsafe-inline'`, and roll out Trusted Types report-only
first. Permissive defaults and debug output leak data or let injected script
run.

## CORS

Wildcard origin with credentials is invalid in browsers and signals an overly permissive policy; unlisted origins should receive no CORS headers.

```typescript
// ❌ Incorrect: wildcard origin with credentials enabled
app.use((request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Credentials', 'true')
  next()
})

// ✅ Correct: explicit origin allowlist; Vary: Origin when credentials are used
const ALLOWED_ORIGINS = new Set(['https://app.example.com'])

export function isAllowedOrigin(
  origin: string | undefined,
): origin is string {
  if (!origin) {
    return false
  }

  return ALLOWED_ORIGINS.has(origin)
}

app.use((request, response, next) => {
  const origin = request.headers.origin

  if (isAllowedOrigin(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Access-Control-Allow-Credentials', 'true')
    response.setHeader('Vary', 'Origin')
  }

  next()
})
```

## Security headers and error handling

Missing `nosniff` and verbose error bodies expose MIME-sniffing vectors and internal stack traces to clients.

```typescript
// ❌ Incorrect: leak stack trace and environment to client
app.use((error: unknown, request, response, next) => {
  const errorStack = error instanceof Error ? error.stack : undefined
  response.status(500).json({ stack: errorStack, env: process.env })
})

// ✅ Correct: security headers on responses; generic error body in production
app.use((request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  next()
})

app.use((error: unknown, request, response, next) => {
  console.error(error)

  response.status(500).json({ error: 'internal_error' })
})
```

- No debug flags or stack traces in production client responses.
- Change default admin passwords before deploy; use strong generated credentials.

## Content Security Policy

A host allow-list trusts every script on those hosts (including JSONP and
old library versions), and `'unsafe-inline'` lets any injected `<script>`
run. A per-request nonce marks only the scripts your server emitted.

```typescript
import { randomBytes } from 'node:crypto'

// ❌ Incorrect: host allow-list + 'unsafe-inline' — injected inline script runs
app.use((request, response, next) => {
  response.setHeader(
    'Content-Security-Policy',
    "script-src 'self' 'unsafe-inline' https://cdn.example.com",
  )
  next()
})

// ✅ Correct: fresh nonce per response + 'strict-dynamic'; no plugins; no <base> hijack
app.use((request, response, next) => {
  const cspNonce = randomBytes(16).toString('base64')

  response.locals.cspNonce = cspNonce
  response.setHeader(
    'Content-Security-Policy',
    `script-src 'nonce-${cspNonce}' 'strict-dynamic'; object-src 'none'; base-uri 'none'`,
  )
  next()
})
```

- Put the nonce on every `<script nonce>` the server renders. Scripts those
  load inherit trust through `'strict-dynamic'`, so no CDN host list is
  needed.
- Generate the nonce per response from a CSPRNG (at least 128 bits); a
  static or reused nonce is as weak as `'unsafe-inline'`.
- `object-src 'none'` blocks plugin content; `base-uri 'none'` stops an
  injected `<base>` from redirecting relative script URLs.
- When tightening an existing policy, ship it as
  `Content-Security-Policy-Report-Only` first and fix the reported
  violations.

## Trusted Types

DOM XSS sinks (`innerHTML`, `outerHTML`, `insertAdjacentHTML`, script `src`)
accept plain strings from anywhere in the bundle. Trusted Types makes the
browser reject strings at those sinks unless they come from a named policy,
so one reviewed sanitizer becomes the only way in.

```typescript
// ❌ Incorrect: enforce on day one — every unconverted sink throws in production
app.use((request, response, next) => {
  response.setHeader(
    'Content-Security-Policy',
    "require-trusted-types-for 'script'; trusted-types app-html",
  )
  next()
})

// ✅ Correct: report-only first, collect violations, enforce once reports are clean
app.use((request, response, next) => {
  response.setHeader(
    'Reporting-Endpoints',
    'csp-endpoint="https://app.example.com/csp-reports"',
  )
  response.setHeader(
    'Content-Security-Policy-Report-Only',
    "require-trusted-types-for 'script'; trusted-types app-html; report-to csp-endpoint",
  )
  next()
})
```

- Create one named policy (`trustedTypes.createPolicy('app-html', { createHTML })`)
  whose `createHTML` runs the HTML sanitizer already in the repo, and route
  every HTML sink through it.
- List only the policy names the app creates in `trusted-types`; an unlisted
  policy name fails, which stops a second, unreviewed policy.
- Trusted Types is Baseline 2026 (Chrome/Edge 83+, Firefox 148+, Safari 26+).
