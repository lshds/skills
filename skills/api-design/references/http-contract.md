# HTTP Contract

Prefer noun resource URLs and a `data` / `errors` envelope with real HTTP status codes over verb paths and `200` + `{ success: false }`, so clients can branch on status and share one wire shape. Greenfield uses the shapes below; a mature flat or alternate envelope stays that shape. Spec and HTML docs tools live in sibling files — this file is the wire contract.

## Resource URLs

A verb in the path or a deep `/a/:id/b/:id/c/:id` tree forces every client to relearn the same operations and breaks when a child needs its own identity.

```text
# ❌ Incorrect: verb in the path, singular collection, three-level nest
GET /api/v1/getPurchaseOrder
GET /api/v1/purchase-order
GET /api/v1/customers/:customerId/sites/:siteId/orders/:orderId

# ✅ Correct: plural kebab-case nouns; shallow child; verb only for a non-CRUD action
GET|POST            /api/v1/purchase-orders
GET|PUT|PATCH|DELETE /api/v1/purchase-orders/:id
GET|POST            /api/v1/purchase-orders/:id/line-items
POST                /api/v1/purchase-orders/:id/cancel
POST                /api/v1/auth/login
```

- Action endpoints may use a plain JSON body (or no body). They do not need the `data.type` / `attributes` write envelope unless the rest of the API already uses it for actions.

## Naming

Snake_case paths and camelCase-in-the-URL collide with the JSON field convention and with every other route in the same API.

```text
# ❌ Incorrect: snake_case path, verb segment, singular collection
/api/v1/purchase_orders
/api/v1/getPurchaseOrders
/api/v1/purchase-order

# ✅ Correct: kebab-case path; camelCase JSON / query fields
/api/v1/purchase-orders
/api/v1/purchase-orders?filter[status]=active&sort=-createdAt
/api/v1/purchase-orders/:id/line-items
```

- When the repo already uses another JSON or query casing, keep that casing. Do not mix camelCase and snake_case fields on the same API.

## Methods

DELETE with a body, or PUT used as a partial update, makes caches and clients disagree about whether the row still exists and which fields survived.

```text
# ❌ Incorrect: DELETE returns 200 with a body; PUT used for a partial name change
DELETE /api/v1/purchase-orders/1
# 200 { "deleted": true }
PUT /api/v1/purchase-orders/1
# attributes: { "name": "Q4 supplies revised" }  — other fields cleared

# ✅ Correct: DELETE is 204 with no body; PATCH for a partial update; PUT for a full replace
DELETE /api/v1/purchase-orders/1
PATCH  /api/v1/purchase-orders/1
PUT    /api/v1/purchase-orders/1
```

- POST on a collection creates. POST on `:id/cancel` (or similar) is a non-CRUD action.
- DELETE also returns `204` if the row is already gone, unless the product must distinguish “was present” (`404`).

## Status codes

Clients branch on the status code. `200` with `{ success: false }` hides the failure from that branch and from HTTP caches.

```jsonc
// ❌ Incorrect: 200 with success: false — clients that switch on status treat this as OK
{
  "success": false,
  "message": "Name cannot be blank"
}

// ✅ Correct: 422 with errors[] and a source pointer
{
  "errors": [
    {
      "status": "422",
      "code": "invalid_format",
      "title": "Invalid Attribute",
      "detail": "Name cannot be blank",
      "source": { "pointer": "/data/attributes/name" }
    }
  ]
}
```

- `200` OK with a body, including empty collections (`data: []`). `201` created plus `Location`. `204` success with no body. `400` malformed. `422` well-formed but semantically invalid. `401` unauthenticated. `403` forbidden. `404` missing resource (not an empty list). `409` conflict. `429` rate limited (`Retry-After`). `5xx` unexpected or upstream.
- Auth on the wire is `Authorization` (Bearer or session) at the edge. Do not invent custom identity headers clients can spoof.

## Write envelopes

A missing `id` on PATCH, or an `id` on POST, makes create vs update ambiguous and lets clients invent identifiers the server does not own.

```jsonc
// ❌ Incorrect: POST includes a client-invented id
{
  "data": {
    "type": "purchase-orders",
    "id": "po-client-1",
    "attributes": { "name": "Q4 supplies" }
  }
}

// ✅ Correct: POST omits id — the server assigns it
{
  "data": {
    "type": "purchase-orders",
    "attributes": { "name": "Q4 supplies" }
  }
}
```

```jsonc
// ✅ Correct: PATCH includes id and only the attributes to change
{
  "data": {
    "type": "purchase-orders",
    "id": "1",
    "attributes": { "name": "Q4 supplies revised" }
  }
}
```

```jsonc
// ✅ Correct: PUT includes id and the full attribute set to replace
{
  "data": {
    "type": "purchase-orders",
    "id": "1",
    "attributes": {
      "name": "Q4 supplies",
      "status": "draft",
      "notes": "Warehouse dock 4"
    }
  }
}
```

- JSON:API-inspired subset: `data` / `type` / `id` / `attributes` / `errors` / `links` / `meta` only. Out of scope: `relationships`, `included`, full JSON:API content types. One contract (`Content-Type: application/json`).
- Omitted PUT attributes are cleared or defaulted per contract — do not treat PUT as a partial PATCH.
- When a mature API already uses a flat or alternate envelope, keep that shape — adapt status, `code`, and pointer ideas, not the nesting.

## Success envelopes

Without `type` + `id` and a `self` link, clients cannot cache or reload the same record from the response they just received.

```jsonc
// ❌ Incorrect: flat body with no type, id wrapper, or self — client cannot reload this record
{
  "id": "1",
  "name": "Q4 supplies"
}

// ✅ Correct: single resource with type, id, attributes, and self
{
  "data": {
    "type": "purchase-orders",
    "id": "1",
    "attributes": { "name": "Q4 supplies" },
    "links": { "self": "/api/v1/purchase-orders/1" }
  }
}
```

```jsonc
// ✅ Correct: collection with pagination links and a cheap total
{
  "links": {
    "self": "/api/v1/purchase-orders?page[offset]=0&page[limit]=20",
    "next": "/api/v1/purchase-orders?page[offset]=20&page[limit]=20",
    "last": "/api/v1/purchase-orders?page[offset]=140&page[limit]=20"
  },
  "data": [
    {
      "type": "purchase-orders",
      "id": "1",
      "attributes": { "name": "Q4 supplies" }
    }
  ],
  "meta": { "total": 142 }
}
```

- A single-resource response never includes both `data` and `errors`.
- When a mature API already uses a flat body, keep that shape.

## Pagination and query

An unbounded collection GET will time out or OOM as the table grows; an unstable sort duplicates or skips rows across pages.

```text
# ❌ Incorrect: unbounded collection GET; sort only by a colliding timestamp
GET /api/v1/purchase-orders
GET /api/v1/purchase-orders?sort=-createdAt

# ✅ Correct: offset/limit, a stable id tie-break, filter, and sparse fields
GET /api/v1/purchase-orders?page[offset]=0&page[limit]=20&sort=-createdAt,id
GET /api/v1/purchase-orders?filter[status]=active&fields[purchase-orders]=name,status
```

- Offset is 0-based in items. Document a default `page[limit]` and a max cap.
- Cursor: opaque `page[cursor]` (+ `page[limit]`) for large or frequently changing feeds; put `next` (and `prev` if needed) in `links`.
- Always return `links.self`; include `links.next` / `links.last` when applicable; put totals in `meta` when cheap and useful.
- When the product already pages by number, `page[number]` / `page[size]` stays — do not introduce a second pagination style beside it.

## Idempotency

A retried POST without `Idempotency-Key` inserts a second purchase order; the client cannot tell which id to keep.

```text
# ❌ Incorrect: client retries; server inserts twice
POST /api/v1/purchase-orders
POST /api/v1/purchase-orders
# 201 id=1 then 201 id=2

# ✅ Correct: same Idempotency-Key returns the first result
POST /api/v1/purchase-orders
Idempotency-Key: 8f3c-q4-supplies
# replay → same body and id=1
```

- GET/PUT/DELETE are idempotent by HTTP. Design PATCH to be idempotent when practical.

## Bulk

An unbounded batch times out or commits a partial write with no pointer the client can retry.

```jsonc
// ❌ Incorrect: one envelope error for two rows; caller cannot retry the failed item
{
  "errors": [
    {
      "status": "500",
      "code": "batch_failed",
      "title": "Batch Failed",
      "detail": "One or more rows failed"
    }
  ]
}

// ✅ Correct: POST /api/v1/purchase-orders/batch — documented max size; per-item pointer
{
  "data": [
    {
      "type": "purchase-orders",
      "id": "1",
      "attributes": { "name": "Q4 supplies" }
    }
  ],
  "errors": [
    {
      "status": "422",
      "code": "invalid_format",
      "title": "Invalid Attribute",
      "detail": "Name cannot be blank",
      "source": { "pointer": "/data/1/attributes/name" }
    }
  ]
}
```

- Prefer `POST /api/v1/purchase-orders/batch` with a documented max size (cap it; do not accept unbounded arrays).
- When a batch is OK, the response may include successful `data` rows next to per-item `errors` so the client can retry only the failed index. A single-resource response still never includes both.

## Versioning

Removing a field on v1 breaks every shipped client that still reads it; adding an optional field does not.

```jsonc
// ❌ Incorrect: v1 drops legacyStatus overnight — shipped clients still read it
{
  "data": {
    "type": "purchase-orders",
    "id": "1",
    "attributes": { "name": "Q4 supplies" }
  }
}

// ✅ Correct: v1 keeps the old field; bump to /api/v2 before dropping it
{
  "data": {
    "type": "purchase-orders",
    "id": "1",
    "attributes": {
      "name": "Q4 supplies",
      "legacyStatus": "open"
    }
  }
}
```

- Prefer URL version `/api/v1/purchase-orders`. Bump to v2 only for breaking changes; keep v1 through a documented deprecation window.
- Non-breaking (stay on v1): add optional fields, query params, or new endpoints.
- Breaking: remove or rename fields, change types or defaults, tighten required validation, or change URL structure.
