# DOM Clobbering

Prefer module-scoped config and type-checked DOM lookups over undeclared
globals and named `document` properties. In untrusted HTML, an element’s `id`
fills any `window` global the page never defined, and `name` on `form`, `img`,
`embed`, `object`, or `iframe` overrides `document` properties such as
`document.cookie`.

## Globals and named properties

A global the page never defined resolves to the element with that `id`. Two
`<a id="appConfig">` tags, the second with `name="cdnUrl"` and an attacker
`href`, make `window.appConfig.cdnUrl` stringify to the attacker URL.

```typescript
import { appConfig } from './app-config'

declare global {
  interface Window {
    appConfig?: { cdnUrl: string }
  }
}

// ❌ Incorrect: optional global — injected <a id="appConfig"> elements supply cdnUrl
const widgetScript = document.createElement('script')
widgetScript.src = `${window.appConfig?.cdnUrl ?? '/static'}/widget.js`
document.body.append(widgetScript)

// ✅ Correct: config from a module; instanceof check on the DOM lookup; strip id/name from untrusted HTML
const widgetScript = document.createElement('script')
widgetScript.src = `${appConfig.cdnUrl}/widget.js`
document.body.append(widgetScript)

const configElement = document.getElementById('server-config')

if (!(configElement instanceof HTMLScriptElement)) {
  throw new Error('server config missing')
}

const serverConfig: unknown = JSON.parse(configElement.textContent ?? '{}')

export function sanitizeClobberableHtml(unsafeHtml: string) {
  const parsedDocument = new DOMParser().parseFromString(
    unsafeHtml,
    'text/html',
  )

  parsedDocument.querySelectorAll('[id], [name]').forEach((element) => {
    element.removeAttribute('id')
    element.removeAttribute('name')
  })

  return parsedDocument.body.innerHTML
}
```

## Strip id and name

Removing `id` and `name` from untrusted HTML takes away the attributes that
create named properties, so it also covers reads you have not found yet.

- Strip `id` and `name` from HTML that was not authored by the app.
