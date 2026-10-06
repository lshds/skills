# OpenAPI

Prefer keeping the OpenAPI spec next to the routes so it matches the live API —
a drifted spec is what callers implement. Greenfield specs use `openapi: "3.1.0"`.
The first section defines the shared `components` once; later sections show only
the paths and schemas they change.

## Match the real API

Path, auth, body, examples, and status codes in the spec must match the live API — callers will use what the spec says.

```yaml
# ❌ Incorrect: verb path, no auth, and a flat snake_case example the live API never returns
paths:
  /api/v1/getPurchaseOrder:
    get:
      operationId: getPurchaseOrder
      security: []
      responses:
        "200":
          description: The order
          content:
            application/json:
              examples:
                order:
                  value: { order_id: "1", status: OK }

# ✅ Correct: path, Bearer auth, envelope, example, and error statuses match the live API
openapi: "3.1.0"
info:
  title: Purchase orders
  version: "1.0.0"
tags:
  - name: PurchaseOrders
    description: Purchase orders
security:
  - bearerAuth: []
paths:
  /api/v1/purchase-orders/{id}:
    get:
      operationId: getPurchaseOrder
      tags: [PurchaseOrders]
      parameters:
        - { name: id, in: path, required: true, schema: { type: string } }
      responses:
        "200":
          description: The order
          content:
            application/json:
              schema: { $ref: "#/components/schemas/PurchaseOrderResponse" }
              examples:
                order:
                  value:
                    data:
                      type: purchase-orders
                      id: "1"
                      attributes: { status: paid, paidAt: "2026-03-01T12:00:00Z" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "404":
          description: Purchase order not found
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ErrorResponse" }
```

Shared parameters, responses, and schemas live once under `components`; every fragment below references them.

```yaml
components:
  securitySchemes:
    bearerAuth: { type: http, scheme: bearer, bearerFormat: JWT }
  parameters:
    IdempotencyKey:
      name: Idempotency-Key
      in: header
      required: false
      description: A replay with the same key returns the first response instead of creating a second purchase order.
      schema: { type: string }
  responses:
    Unauthorized:
      description: Missing or invalid access token
      content:
        application/json:
          schema: { $ref: "#/components/schemas/ErrorResponse" }
  schemas:
    PurchaseOrderAttributes:
      type: object
      required: [status]
      properties:
        status: { type: string }
        paidAt: { type: [string, "null"], format: date-time }
    PurchaseOrder:
      type: object
      required: [type, id, attributes]
      properties:
        type: { type: string, enum: [purchase-orders] }
        id: { type: string }
        attributes: { $ref: "#/components/schemas/PurchaseOrderAttributes" }
        links: { type: object, properties: { self: { type: string } } }
    PurchaseOrderResponse:
      type: object
      required: [data]
      properties:
        data: { $ref: "#/components/schemas/PurchaseOrder" }
    PurchaseOrderCollectionResponse:
      type: object
      required: [data, links]
      properties:
        data:
          type: array
          items: { $ref: "#/components/schemas/PurchaseOrder" }
        links:
          type: object
          required: [self]
          properties:
            self: { type: string }
            next: { type: [string, "null"] }
            last: { type: string }
        meta: { type: object, properties: { total: { type: integer } } }
    PurchaseOrderWrite:
      type: object
      required: [data]
      properties:
        data:
          type: object
          required: [type, attributes]
          properties:
            type: { type: string, enum: [purchase-orders] }
            attributes: { type: object, required: [status], properties: { status: { type: string } } }
    ErrorResponse:
      type: object
      required: [errors]
      properties:
        errors:
          type: array
          minItems: 1
          items:
            type: object
            required: [status, code, title, detail]
            properties:
              status: { type: string }
              code: { type: string }
              title: { type: string }
              detail: { type: string }
              source: { type: object, properties: { pointer: { type: string } } }
```

- List every status the handler returns for that operation, with the same `errors[]` body the API returns.
- The example uses the same field names and types as the schema.
- Root `security` applies Bearer auth to every operation. An operation that is really public overrides it with `security: []`.

## OpenAPI 3.1 keywords

Under `openapi: "3.1.0"` schemas are JSON Schema 2020-12. `nullable` is not a keyword there, so a `null` value fails validation; a boolean `exclusiveMinimum` is invalid; schema-level `example` is deprecated.

```yaml
# ❌ Incorrect: 3.0 keywords under openapi "3.1.0" — null paidAt fails validation, exclusiveMinimum: true is invalid
totalAmount: { type: number, minimum: 0, exclusiveMinimum: true, example: 120.5 }
paidAt: { type: string, format: date-time, nullable: true }

# ✅ Correct: numeric exclusiveMinimum, examples array, and "null" in the type list
totalAmount: { type: number, exclusiveMinimum: 0, examples: [120.5] }
paidAt: { type: [string, "null"], format: date-time }
```

- Media-type `examples` (a named map with `value`, as in the responses above) is unchanged in 3.1. Only the schema-level `example` becomes the `examples` array.
- When the repo or its docs tooling is on 3.0.x, keep `openapi: "3.0.3"` with `nullable` and `example`, and don't mix 3.0 and 3.1 keywords in one file. 3.2 is fine when every tool that reads the spec supports it.

## Writes, errors, and pagination

A GET-only `200` spec is not the contract. Document create as `201` + `Location`, the `Idempotency-Key` header on POSTs clients retry, validation as `422` with `errors[]`, and collection query params `page[offset]` / `page[limit]`.

```yaml
# ❌ Incorrect: POST returns 200 + success flag and takes no Idempotency-Key; the collection GET has no page params
paths:
  /api/v1/purchase-orders:
    post:
      operationId: createPurchaseOrder
      responses:
        "200":
          description: Created or invalid
          content:
            application/json:
              schema: { type: object, properties: { success: { type: boolean } } }
    get:
      operationId: listPurchaseOrders
      responses:
        "200": { description: All orders }

# ✅ Correct: POST 201 + Location + Idempotency-Key, 422 errors[], page[offset]/page[limit]
paths:
  /api/v1/purchase-orders:
    post:
      operationId: createPurchaseOrder
      tags: [PurchaseOrders]
      parameters:
        - $ref: "#/components/parameters/IdempotencyKey"
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/PurchaseOrderWrite" }
      responses:
        "201":
          description: Created. A replay with the same Idempotency-Key returns this same response.
          headers:
            Location:
              required: true
              schema: { type: string, examples: ["/api/v1/purchase-orders/1"] }
          content:
            application/json:
              schema: { $ref: "#/components/schemas/PurchaseOrderResponse" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "422":
          description: Semantically invalid
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ErrorResponse" }
              examples:
                invalidStatus:
                  value:
                    errors:
                      - status: "422"
                        code: invalid_format
                        title: Invalid Attribute
                        detail: Status cannot be blank
                        source: { pointer: /data/attributes/status }
    get:
      operationId: listPurchaseOrders
      tags: [PurchaseOrders]
      parameters:
        - { name: "page[offset]", in: query, schema: { type: integer, minimum: 0, default: 0 } }
        - { name: "page[limit]", in: query, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
      responses:
        "200":
          description: Purchase order list
          content:
            application/json:
              schema: { $ref: "#/components/schemas/PurchaseOrderCollectionResponse" }
        "401": { $ref: "#/components/responses/Unauthorized" }
```

- POST omits `id` (server assigns). Never return `200` with `{ success: false }`.
- Reference `IdempotencyKey` on every unsafe POST a client may retry. A replay with the same key returns the first response — same `201`, body, and `id` — never a second row. The header is an IETF draft, not yet an RFC.
- Collection GETs require `page[offset]` / `page[limit]` (0-based offset, default limit, max cap). Put totals in `meta` when cheap.
- The parameter name `page[offset]` matches the query string. Do not rename it to `pageOffset`.

## Structure and names

Docs tools build the menu and generated method names from `tags`, `operationId`, and schema names. Bad names give a bad menu and bad client code.

```yaml
# ❌ Incorrect: spaces in operationId, snake_case path and parameter, tag missing from root tags, unnamed inline body
paths:
  /api/v1/purchase_orders/{order_id}:
    get:
      operationId: Get Purchase Order
      tags: [order-endpoints]
      parameters:
        - { name: order_id, in: path, required: true, schema: { type: string } }
      responses:
        "200":
          description: The order
          content:
            application/json:
              schema: { type: object, properties: { order_id: { type: string }, paid_at: { type: string } } }

# ✅ Correct: kebab-case path, id parameter, camelCase operationId, root-listed tag, named schema
tags:
  - name: PurchaseOrders
paths:
  /api/v1/purchase-orders/{id}:
    get:
      operationId: getPurchaseOrder
      tags: [PurchaseOrders]
      parameters:
        - { name: id, in: path, required: true, schema: { type: string } }
      responses:
        "200":
          description: The order
          content:
            application/json:
              schema: { $ref: "#/components/schemas/PurchaseOrderResponse" }
```

- `operationId` is unique, `camelCase`, verb plus thing: `getPurchaseOrder`, `listPurchaseOrders`. No spaces. Same style on every operation.
- List tags under root `tags`. Every operation has at least one tag. Tag order in the file is the menu order. Name the tag after the resource: `PurchaseOrders`.
- Schema names under `components.schemas` are `PascalCase` (`PurchaseOrderResponse`). Do not leave the body as an unnamed inline object.
- Query and JSON fields are `camelCase` (`paidAt`). The path parameter uses the same name as the URL (`id` in `/api/v1/purchase-orders/{id}`). Paths are kebab-case (`/api/v1/purchase-orders`, not `/api/v1/purchase_orders`).

## Deprecation and version bump

Deleting a field from the spec overnight breaks every client that still sends or reads it. Keep it on v1 with `deprecated: true` and an end date. Drop it on v2.

```yaml
# ❌ Incorrect: legacyStatus deleted from the v1 PurchaseOrderAttributes properties — shipped clients still read it
properties:
  status: { type: string }
  paidAt: { type: [string, "null"], format: date-time }

# ✅ Correct: v1 PurchaseOrderAttributes keeps legacyStatus, marked deprecated with an end date
properties:
  status: { type: string }
  paidAt: { type: [string, "null"], format: date-time }
  legacyStatus:
    type: string
    deprecated: true
    description: Removed in v2 after 2026-12-01. Use status.
```

- v2 ships its own path and response schema without the field (`/api/v2/purchase-orders/{id}`, `operationId: getPurchaseOrderV2`, `PurchaseOrderResponseV2`). The v1 operation keeps the deprecated field until the end date.
- Stay on `/api/v1` when you only add optional fields or new paths. Bump to `/api/v2` when a documented field is removed, renamed, or changes type.

## Public vs internal

A public spec is what customers will call. Admin paths, internal scores, and secrets do not belong there.

```yaml
# ❌ Incorrect: the public spec lists an admin refund and internal attributes
paths:
  /api/v1/admin/purchase-orders/{id}/refund:
    post:
      operationId: refundPurchaseOrder
      parameters:
        - { name: id, in: path, required: true, schema: { type: string } }
      responses:
        "204": { description: Refunded }
components:
  schemas:
    PurchaseOrderAttributes:
      type: object
      required: [status]
      properties:
        status: { type: string }
        paidAt: { type: [string, "null"], format: date-time }
        stripeCustomerId: { type: string }
        internalRiskScore: { type: number }

# ✅ Correct: the admin refund lives only in the internal spec; public attributes are customer fields
components:
  schemas:
    PurchaseOrderAttributes:
      type: object
      required: [status]
      properties:
        status: { type: string }
        paidAt: { type: [string, "null"], format: date-time }
```

- An internal spec may list admin paths. Do not publish it on the same docs page as the public spec.
- Hiding an operation or the download button in the docs UI does not make it private — anyone can fetch the spec URL. Keep admin paths and internal fields out of the file the public docs page loads.
- Do not put tokens, webhook secrets, or internal hostnames in examples or in docs-tool environment defaults.
