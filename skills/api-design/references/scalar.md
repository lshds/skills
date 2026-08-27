# Scalar

Prefer passing the spec by `url` and `camelCase` config keys over a huge inline string and mixed names, so the page loads the same file the API serves and options actually apply.

## Pass the spec

A big `content` string copies the spec into the page and goes stale. `url` lets the browser fetch `/openapi.json` (JSON or YAML) and cache it.

```typescript
import { createApiReference } from '@scalar/api-reference'

// ❌ Incorrect: inline spec string that will not match the live file
createApiReference('#app', {
  content: `{
    "openapi": "3.0.3",
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
- `sources` is for multiple public specs. Do not add an admin or internal spec on the public docs page.

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
  hideModels: false,
  layout: 'modern',
})
```

- Known keys include `url`, `sources`, `layout`, `showOperationId`, `hideModels`.
- Leave `layout` as `'modern'` unless the repo already uses `'classic'`.
- `showOperationId` defaults to `false`. Set `true` only when you want the id on the page.

## Auth in the browser

`persistAuth: true` stores tokens in `localStorage` after reload. Hiding an operation in the UI does not remove it from the spec URL. Keep admin paths out of the file this page loads, and do not put secrets in environment defaults.

```yaml
# ❌ Incorrect: persistAuth true; spec has a token default and lists admin refund
# createApiReference('#app', { url: '/openapi.json', persistAuth: true })
openapi: "3.0.3"
info:
  title: Purchase orders
  version: "1.0.0"
x-scalar-environments:
  production:
    variables:
      accessToken:
        default: "sk_live_4f2a91c8e0b3"
paths:
  /api/v1/purchase-orders/{id}:
    get:
      operationId: getPurchaseOrder
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: The order
  /api/v1/admin/purchase-orders/{id}/refund:
    post:
      operationId: refundPurchaseOrder
      x-scalar-ignore: true
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "204":
          description: Refunded

# ✅ Correct: persistAuth false; public spec only; no token default
# createApiReference('#app', { url: '/openapi.json', persistAuth: false })
openapi: "3.0.3"
info:
  title: Purchase orders
  version: "1.0.0"
paths:
  /api/v1/purchase-orders/{id}:
    get:
      operationId: getPurchaseOrder
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: The order
```

- `persistAuth` defaults to `false`. Set `true` only when tokens should survive reload.
- `x-scalar-ignore` only hides an operation in the Scalar UI. Anyone can still fetch the spec URL.
- Do not put tokens, webhook secrets, or internal hostnames in `x-scalar-environments` defaults or examples.
