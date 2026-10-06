# Scalar

Prefer passing the spec by `url` and `camelCase` config keys over a huge inline string and mixed names, so the page loads the same file the API serves and options actually apply.

## Pass the spec

A big `content` string copies the spec into the page and goes stale. `url` lets the browser fetch `/openapi.json` (JSON or YAML) and cache it.

```typescript
import { createApiReference } from '@scalar/api-reference'

// ❌ Incorrect: inline spec string that will not match the live file
createApiReference('#app', {
  content: `{
    "openapi": "3.1.0",
    "info": { "title": "Purchase orders", "version": "1.0.0" },
    "paths": {
      "/api/v1/purchase-orders/{id}": {
        "get": {
          "operationId": "getPurchaseOrder",
          "responses": { "200": { "description": "The order" } }
        }
      }
    }
  }`,
})

// ✅ Correct: fetch the spec the API already serves
createApiReference('#app', {
  url: '/openapi.json',
})

// ✅ Correct: several specs use sources with title and kebab-case slug
createApiReference('#app', {
  sources: [
    {
      title: 'Purchase orders',
      slug: 'purchase-orders',
      url: '/openapi.json',
      default: true,
    },
    { title: 'Invoices', slug: 'invoices', url: '/openapi-invoices.json' },
  ],
})
```

- Do not add Scalar if the repo has no docs page yet, or if Redoc is already that page.
- The spec at `url` uses kebab-case paths (`/api/v1/purchase-orders`) and camelCase `operationId` / JSON fields (`getPurchaseOrder`, `paidAt`). The path parameter matches the URL (`id`).
- `sources[].slug` is kebab-case (`purchase-orders`), same as the path.
- `sources` lists several specs on one page. Mark the one that opens first with `default: true`.

## Option names

The config object uses `camelCase`. Snake_case or kebab-case keys are ignored, so you get the defaults.

```typescript
import { createApiReference } from '@scalar/api-reference'

// ❌ Incorrect: snake_case / kebab-case keys the config object does not read
createApiReference('#app', {
  url: '/openapi.json',
  show_operation_id: true,
  'hide-models': true,
  layout: 'modern',
})

// ✅ Correct: camelCase keys
createApiReference('#app', {
  url: '/openapi.json',
  showOperationId: true,
  hideModels: true,
  layout: 'modern',
})
```

- Known keys include `url`, `sources`, `layout`, `showOperationId`, `hideModels`, `documentDownloadType`, `persistAuth`.
- Leave `layout` as `'modern'` unless the repo already uses `'classic'`.
- `showOperationId` defaults to `false`. Set `true` only when you want the id on the page.
- Scalar hides the download button with `documentDownloadType: 'none'` (older releases: `hideDownloadButton: true`). Don't copy Redoc's plural `hideDownloadButtons` — Scalar ignores it.
- Hiding the download button, or an operation with `x-scalar-ignore: true` in the spec, changes only what the page shows. It is not access control — anyone can still fetch the spec URL.

## Auth in the browser

`persistAuth: true` keeps the credentials a reader enters in `localStorage`, so they survive reloads and stay in that browser for whoever uses it next.

```typescript
import { createApiReference } from '@scalar/api-reference'

// ❌ Incorrect: persistAuth on a shared docs page — the access token outlives the session in localStorage
createApiReference('#app', {
  url: '/openapi.json',
  persistAuth: true,
})

// ✅ Correct: persistAuth left at its default (false) — the token is gone after a reload
createApiReference('#app', {
  url: '/openapi.json',
})
```

- `persistAuth` defaults to `false`. Set `true` only when tokens should survive reload.
