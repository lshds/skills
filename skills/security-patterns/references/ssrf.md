# SSRF

Allowlist scheme and host before fetching user-supplied URLs. The server can
reach internal networks and metadata endpoints that browsers cannot.

## URL fetch

Passing a user-controlled URL directly to `fetch` lets attackers probe internal services and cloud metadata.

```typescript
// ❌ Incorrect: user-controlled URL passed to fetch
const response = await fetch(String(request.query.url))

// ❌ Incorrect: prefix check alone — https://trusted.com.evil.com bypasses startsWith
if (String(request.query.url).startsWith('https://trusted.com')) {
  await fetch(String(request.query.url))
}

// ✅ Correct: allowlist scheme and host; block link-local/metadata ranges
const ALLOWED_HOSTS = new Set(['api.partner.com', 'cdn.example.com'])

class UnsafeUrlError extends Error {
  statusCode = 400
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'UnsafeUrlError'
  }
}

export function assertSafeUrl(rawUrl: string) {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(rawUrl)
  } catch (cause) {
    throw new UnsafeUrlError('invalid url', { cause })
  }

  if (
    parsedUrl.protocol !== 'https:' ||
    !ALLOWED_HOSTS.has(parsedUrl.hostname)
  ) {
    throw new UnsafeUrlError('url not allowed')
  }

  return parsedUrl
}

const webhookUrl = request.body.webhookUrl

if (typeof webhookUrl !== 'string') {
  throw new UnsafeUrlError('invalid url')
}

await fetch(assertSafeUrl(webhookUrl))
await fetch(`${process.env.INTERNAL_API_URL}/v1/health`) // server-controlled base — fine
```

- Server-configured base URLs alone are not SSRF — the risk is user-influenced destinations.

## Open redirects

Redirecting to an arbitrary external URL enables phishing and token theft via the Referer header.

```typescript
// ❌ Incorrect: open redirect to attacker-controlled URL
response.redirect(String(request.query.next))

// ✅ Correct: relative path only; reject protocol-relative //evil.com
export function toSafeRedirect(nextPath: unknown) {
  if (
    typeof nextPath !== 'string' ||
    !nextPath.startsWith('/') ||
    nextPath.startsWith('//')
  ) {
    return '/home'
  }

  return nextPath
}

const nextPath = request.query.next

response.redirect(toSafeRedirect(nextPath))
```
