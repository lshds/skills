# Redoc

Prefer the casing Redoc uses on that surface — kebab-case on the HTML element, camelCase in `Redoc.init` and `redocly.yaml` — and one place to set the options, so the docs page matches what you set.

## Option names

The HTML `<redoc>` tag reads kebab-case attributes. `Redoc.init` and `redocly.yaml` read camelCase keys. The other casing on that surface is ignored, so you debug a default you did not pick.

```html
<!-- ❌ Incorrect: camelCase attributes on the HTML element are ignored -->
<redoc
  spec-url="/openapi.json"
  scrollYOffset="64"
  hideDownloadButtons="true"
></redoc>

<!-- ✅ Correct: kebab-case attributes on the HTML element -->
<redoc
  spec-url="/openapi.json"
  scroll-y-offset="64"
  hide-download-buttons="true"
></redoc>
```

```typescript
const container = document.getElementById('redoc')
if (container === null) {
  throw new Error('Missing #redoc')
}

// ❌ Incorrect: kebab-case keys in the init object
Redoc.init(
  '/openapi.json',
  {
    'scroll-y-offset': 64,
    'hide-download-buttons': true,
  },
  container,
)

// ✅ Correct: camelCase keys in the init object
Redoc.init(
  '/openapi.json',
  {
    scrollYOffset: 64,
    hideDownloadButtons: true,
  },
  container,
)
```

```yaml
# ❌ Incorrect: kebab-case keys in redocly.yaml are ignored
openapi:
  scroll-y-offset: 64
  hide-download-buttons: true

# ✅ Correct: camelCase keys in redocly.yaml
openapi:
  scrollYOffset: 64
  hideDownloadButtons: true
```

- HTML element: kebab-case (`spec-url`, `scroll-y-offset`, `hide-download-buttons`).
- `Redoc.init` and `redocly.yaml`: camelCase (`scrollYOffset`, `hideDownloadButtons`).
- Set options in `redocly.yaml` or in `Redoc.init`, not both with different values.
- Set only the options you need. Do not paste a full theme. Keep the file the repo already has.
- Do not add Redoc if the repo has no docs page yet, or if Scalar is already that page.

## Tags and groups

The sidebar is built from `tags`. If you add `x-tagGroups` and leave a tag out of every group, that tag and its operations disappear from the menu.

```yaml
# ❌ Incorrect: Payments is used but missing from x-tagGroups, so it is hidden
openapi: "3.0.3"
info:
  title: Shop
  version: "1.0.0"
tags:
  - name: Orders
  - name: Payments
x-tagGroups:
  - name: Shop
    tags:
      - Orders
paths:
  /api/v1/orders:
    get:
      operationId: listOrders
      tags:
        - Orders
      responses:
        "200":
          description: Order list
  /api/v1/payments:
    get:
      operationId: listPayments
      tags:
        - Payments
      responses:
        "200":
          description: Payment list

# ✅ Correct: every tag is in a group
openapi: "3.0.3"
info:
  title: Shop
  version: "1.0.0"
tags:
  - name: Orders
  - name: Payments
x-tagGroups:
  - name: Shop
    tags:
      - Orders
      - Payments
paths:
  /api/v1/orders:
    get:
      operationId: listOrders
      tags:
        - Orders
      responses:
        "200":
          description: Order list
  /api/v1/payments:
    get:
      operationId: listPayments
      tags:
        - Payments
      responses:
        "200":
          description: Payment list
```

- List tags under root `tags`. Put at least one tag on every operation.
- Tag order in the file is the menu order. Do not set `sortTagsAlphabetically: true` if that order is the menu you want.
- Skip `x-tagGroups` unless the menu needs groups. If you use it, put every tag in a group.

## Hide download is not private

`hideDownloadButtons: true` only hides the button. Anyone can still fetch the spec URL. Admin paths and internal fields in that file are still public.

```yaml
# ❌ Incorrect: download is hidden, but the spec Redoc loads still has admin refund
# Redoc.init('/openapi.json', { hideDownloadButtons: true }, document.getElementById('redoc'))
openapi: "3.0.3"
info:
  title: Orders
  version: "1.0.0"
paths:
  /api/v1/orders/{id}:
    get:
      operationId: getOrder
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: The order
  /api/v1/admin/orders/{id}/refund:
    post:
      operationId: refundOrder
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "204":
          description: Refunded

# ✅ Correct: the spec Redoc loads has only customer paths
openapi: "3.0.3"
info:
  title: Orders
  version: "1.0.0"
paths:
  /api/v1/orders/{id}:
    get:
      operationId: getOrder
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

- `hideDownloadButtons` is optional. It does not make the spec private.
- Keep admin paths and internal fields out of the file Redoc points at.
