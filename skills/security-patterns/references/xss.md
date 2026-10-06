# XSS

Escape or sanitize untrusted data before it reaches HTML sinks and URL
attributes — reflected, stored, and DOM-based XSS all execute attacker script
in the victim's browser.

Types: **reflected** (request → response), **stored** (saved then rendered),
**DOM-based** (client source → sink).

## HTML sinks

`dangerouslySetInnerHTML` and `innerHTML` render raw markup; JSX text interpolation is escaped by default.

```tsx
import DOMPurify from 'dompurify'

// ❌ Incorrect: React HTML sink — unescaped user markup
<div dangerouslySetInnerHTML={{ __html: comment.body }} />

// ❌ Incorrect: DOM XSS — hash fragment written as HTML
element.innerHTML = location.hash.slice(1)

// ✅ Correct: JSX text — escaped by default
<p>{comment.body}</p>

// ✅ Correct: sanitize with a tight allowlist only when HTML is required
const ALLOWED_COMMENT_TAGS = ['p', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li']
const ALLOWED_COMMENT_ATTRIBUTES = ['href']

export function sanitizeHtml(unsafeHtml: string) {
  return DOMPurify.sanitize(unsafeHtml, {
    ALLOWED_TAGS: ALLOWED_COMMENT_TAGS,
    ALLOWED_ATTR: ALLOWED_COMMENT_ATTRIBUTES,
  })
}

<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(comment.body) }} />

// ✅ Correct: text API instead of HTML sink for untrusted strings
element.textContent = location.hash.slice(1)
```

- Prefer `textContent` and text APIs over `innerHTML`.
- JSX `{userInput}` is escaped — do not flag by default.
- Trusted Types, a CSP directive, enforces this sink discipline in the
  browser: once enabled, `innerHTML` and similar sinks reject raw strings
  that did not pass through an approved sanitizing policy.

## URL attributes

User-controlled `href`, `src`, `action`, and `formaction` values can use dangerous schemes beyond `javascript:`.

```tsx
// ❌ Incorrect: user URL attrs — javascript:/data:/blob:/vbscript: schemes
<a href={userProvidedUrl}>Open</a>
<img src={userProvidedUrl} />
<form action={userProvidedUrl} />

// ✅ Correct: allowlist http(s) + relative path; block protocol-relative //
const SAFE_PROTOCOLS = new Set(['http:', 'https:'])

export function toSafeHref(rawHref: unknown) {
  if (typeof rawHref !== 'string') {
    return
  }

  const trimmedHref = rawHref.trim()

  if (trimmedHref.startsWith('/') && !trimmedHref.startsWith('//')) {
    return trimmedHref
  }

  try {
    const parsedUrl = new URL(trimmedHref)

    if (!SAFE_PROTOCOLS.has(parsedUrl.protocol)) {
      return
    }

    return parsedUrl.href
  } catch {
    return
  }
}

<a href={toSafeHref(userProvidedUrl)}>Open</a>
```

- Reject `javascript:`, `data:`, `vbscript:`, `blob:`, `file:`, and protocol-relative `//evil.com`.
- Allowlist `http:`, `https:`, and relative `/…` paths (not `//…`).
