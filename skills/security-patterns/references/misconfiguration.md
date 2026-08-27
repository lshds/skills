# Misconfiguration

Allowlist CORS origins, set security headers, and return generic errors in
production. Permissive defaults and debug output leak data.

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
const ALLOWED_ORIGINS = ['https://app.example.com'] as const
const allowedOrigins = new Set<string>(ALLOWED_ORIGINS)

export function isAllowedOrigin(
  origin: string | undefined,
): origin is string {
  return typeof origin === 'string' && allowedOrigins.has(origin)
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

app.use((error: unknown, request, response, _next) => {
  console.error(error)

  response.status(500).json({ error: 'internal_error' })
})
```

- No debug flags or stack traces in production client responses.
- Change default admin passwords before deploy; use strong generated credentials.
