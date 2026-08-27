# DOM Clobbering

Prefer `window.location` / `window.document` over bare `document` lookups.
Named elements in untrusted HTML can replace `document.location` with a form.

## Window APIs

A `<form id="location">` makes `document.location` a form, so an origin check on
`.href` is attacker-controlled.

```typescript
// ❌ Incorrect: document.location may be a form element, not Location — clobber bypass
if (document.location.href.includes('trusted.com')) {
  // bypassed when <form id="location"> clobbers document.location
}

// ✅ Correct: explicit window APIs; strip id/name from untrusted HTML
const pageUrl = window.location.href

export function sanitizeClobberableHtml(unsafeHtml: string) {
  const parsedDocument = new DOMParser().parseFromString(
    unsafeHtml,
    'text/html',
  )

  parsedDocument.querySelectorAll('[id], [name]').forEach((node) => {
    node.removeAttribute('id')
    node.removeAttribute('name')
  })

  return parsedDocument.body.innerHTML
}
```

## Strip id and name

Leftover `id`/`name` on inserted HTML still clobbers `document` even when
lookups use `window`.

- Strip `id` and `name` from HTML that was not authored by the app.
