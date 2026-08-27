# OpenAPI

Prefer keeping the OpenAPI next to the routes so the spec matches the live API —
a drifted spec is what callers implement.

## Match the real API

Path, auth, body, examples, and status codes in the spec must match the live API — callers will use what the spec says.

```yaml
# ❌ Incorrect: path, auth, body, and example do not match the live API
openapi: "3.0.3"
info:
  title: Purchase orders
  version: "1.0.0"
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
                  value:
                    order_id: "1"
                    status: OK

# ✅ Correct: path, Bearer, envelope, example, and error statuses match the live API
openapi: "3.0.3"
info:
  title: Purchase orders
  version: "1.0.0"
paths:
  /api/v1/purchase-orders/{id}:
    get:
      operationId: getPurchaseOrder
      security:
        - bearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: The order
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PurchaseOrderResponse"
              examples:
                order:
                  value:
                    data:
                      type: purchase-orders
                      id: "1"
                      attributes:
                        status: paid
                        paidAt: "2026-03-01T12:00:00Z"
        "401":
          description: Missing or invalid access token
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "404":
          description: Purchase order not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    PurchaseOrderResponse:
      type: object
      required: [data]
      properties:
        data:
          type: object
          required: [type, id, attributes]
          properties:
            type:
              type: string
              enum: [purchase-orders]
            id:
              type: string
            attributes:
              type: object
              required: [status]
              properties:
                status:
                  type: string
                paidAt:
                  type: string
                  format: date-time
                  nullable: true
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
              status:
                type: string
              code:
                type: string
              title:
                type: string
              detail:
                type: string
              source:
                type: object
                properties:
                  pointer:
                    type: string
```

- List every status the handler returns for that operation, with the same `errors[]` body the API returns.
- The example uses the same field names and types as the schema.

## Writes, errors, and pagination

A GET-only `200` spec is not the contract. Document create as `201` + `Location`, validation as `422` with `errors[]`, and collection query params `page[offset]` / `page[limit]`.

```yaml
# ❌ Incorrect: POST returns 200, collection GET has no page params, validation is 200 + success false
openapi: "3.0.3"
info:
  title: Purchase orders
  version: "1.0.0"
paths:
  /api/v1/purchase-orders:
    post:
      operationId: createPurchaseOrder
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                status:
                  type: string
      responses:
        "200":
          description: Created or invalid
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
    get:
      operationId: listPurchaseOrders
      responses:
        "200":
          description: All orders

# ✅ Correct: POST 201 + Location, page[offset]/page[limit], 422 errors[]
openapi: "3.0.3"
info:
  title: Purchase orders
  version: "1.0.0"
tags:
  - name: PurchaseOrders
    description: Purchase orders
paths:
  /api/v1/purchase-orders:
    post:
      operationId: createPurchaseOrder
      tags:
        - PurchaseOrders
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/PurchaseOrderWrite"
            examples:
              create:
                value:
                  data:
                    type: purchase-orders
                    attributes:
                      status: paid
      responses:
        "201":
          description: Created
          headers:
            Location:
              required: true
              schema:
                type: string
                example: /api/v1/purchase-orders/1
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PurchaseOrderResponse"
        "401":
          description: Missing or invalid access token
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "422":
          description: Semantically invalid
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
              examples:
                invalidStatus:
                  value:
                    errors:
                      - status: "422"
                        code: invalid_format
                        title: Invalid Attribute
                        detail: Status cannot be blank
                        source:
                          pointer: /data/attributes/status
    get:
      operationId: listPurchaseOrders
      tags:
        - PurchaseOrders
      security:
        - bearerAuth: []
      parameters:
        - name: page[offset]
          in: query
          schema:
            type: integer
            minimum: 0
            default: 0
        - name: page[limit]
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
      responses:
        "200":
          description: Purchase order list
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PurchaseOrderCollectionResponse"
              examples:
                page:
                  value:
                    links:
                      self: /api/v1/purchase-orders?page[offset]=0&page[limit]=20
                      next: /api/v1/purchase-orders?page[offset]=20&page[limit]=20
                      last: /api/v1/purchase-orders?page[offset]=140&page[limit]=20
                    data:
                      - type: purchase-orders
                        id: "1"
                        attributes:
                          status: paid
                    meta:
                      total: 142
        "401":
          description: Missing or invalid access token
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    PurchaseOrderWrite:
      type: object
      required: [data]
      properties:
        data:
          type: object
          required: [type, attributes]
          properties:
            type:
              type: string
              enum: [purchase-orders]
            attributes:
              type: object
              required: [status]
              properties:
                status:
                  type: string
    PurchaseOrderResponse:
      type: object
      required: [data]
      properties:
        data:
          type: object
          required: [type, id, attributes]
          properties:
            type:
              type: string
              enum: [purchase-orders]
            id:
              type: string
            attributes:
              type: object
              required: [status]
              properties:
                status:
                  type: string
            links:
              type: object
              properties:
                self:
                  type: string
    PurchaseOrderCollectionResponse:
      type: object
      required: [data, links]
      properties:
        data:
          type: array
          items:
            type: object
            required: [type, id, attributes]
            properties:
              type:
                type: string
                enum: [purchase-orders]
              id:
                type: string
              attributes:
                type: object
                required: [status]
                properties:
                  status:
                    type: string
        links:
          type: object
          required: [self]
          properties:
            self:
              type: string
            next:
              type: string
              nullable: true
            last:
              type: string
        meta:
          type: object
          properties:
            total:
              type: integer
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
              status:
                type: string
              code:
                type: string
              title:
                type: string
              detail:
                type: string
              source:
                type: object
                properties:
                  pointer:
                    type: string
```

- POST omits `id` (server assigns). Never return `200` with `{ success: false }`.
- Collection GETs require `page[offset]` / `page[limit]` (0-based offset, default limit, max cap). Put totals in `meta` when cheap.
- `name: page[offset]` matches the query string. Do not rename it to `pageOffset`.

## Structure and names

Docs tools build the menu and generated method names from `tags`, `operationId`, and schema names. Bad names give a bad menu and bad client code.

```yaml
# ❌ Incorrect: spaces in operationId, snake_case path and schema, no root tags
openapi: "3.0.3"
info:
  title: Purchase orders
  version: "1.0.0"
paths:
  /api/v1/purchase_orders/{order_id}:
    get:
      operationId: Get Purchase Order
      tags:
        - order-endpoints
      parameters:
        - name: order_id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: The order
          content:
            application/json:
              schema:
                type: object
                properties:
                  order_id:
                    type: string
                  paid_at:
                    type: string

# ✅ Correct: camelCase operationId, root tags, named schema, kebab-case path
openapi: "3.0.3"
info:
  title: Purchase orders
  version: "1.0.0"
tags:
  - name: PurchaseOrders
    description: Purchase orders
paths:
  /api/v1/purchase-orders/{id}:
    get:
      operationId: getPurchaseOrder
      tags:
        - PurchaseOrders
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: The order
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PurchaseOrderResponse"
components:
  schemas:
    PurchaseOrderResponse:
      type: object
      required: [data]
      properties:
        data:
          type: object
          required: [type, id, attributes]
          properties:
            type:
              type: string
              enum: [purchase-orders]
            id:
              type: string
            attributes:
              type: object
              required: [status]
              properties:
                status:
                  type: string
                paidAt:
                  type: string
                  format: date-time
                  nullable: true
```

- `operationId` is unique, `camelCase`, verb plus thing: `getPurchaseOrder`, `listPurchaseOrders`. No spaces. Same style on every operation.
- List tags under root `tags`. Every operation has at least one tag. Tag order in the file is the menu order. Name the tag after the resource: `PurchaseOrders`.
- Schema names under `components.schemas` are `PascalCase` (`PurchaseOrderResponse`). Do not leave the body as an unnamed inline object.
- Query and JSON fields are `camelCase` (`paidAt`). The path parameter uses the same name as the URL (`id` in `/api/v1/purchase-orders/{id}`). Paths are kebab-case (`/api/v1/purchase-orders`, not `/api/v1/purchase_orders`).

## Deprecation and version bump

Deleting a field from the spec overnight breaks every client that still sends or reads it. Keep it on v1 with `deprecated: true` and an end date. Drop it on v2.

```yaml
# ❌ Incorrect: legacyStatus is gone from v1 with no warning
openapi: "3.0.3"
info:
  title: Purchase orders
  version: "1.0.0"
paths:
  /api/v1/purchase-orders/{id}:
    get:
      operationId: getPurchaseOrder
      responses:
        "200":
          description: The order
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PurchaseOrderResponse"
components:
  schemas:
    PurchaseOrderResponse:
      type: object
      required: [data]
      properties:
        data:
          type: object
          required: [type, id, attributes]
          properties:
            type:
              type: string
              enum: [purchase-orders]
            id:
              type: string
            attributes:
              type: object
              required: [status]
              properties:
                status:
                  type: string

# ✅ Correct: v1 marks the old field; v2 ships without it
openapi: "3.0.3"
info:
  title: Purchase orders
  version: "1.0.0"
paths:
  /api/v1/purchase-orders/{id}:
    get:
      operationId: getPurchaseOrder
      responses:
        "200":
          description: The order
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PurchaseOrderResponseV1"
  /api/v2/purchase-orders/{id}:
    get:
      operationId: getPurchaseOrderV2
      responses:
        "200":
          description: The order
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PurchaseOrderResponseV2"
components:
  schemas:
    PurchaseOrderResponseV1:
      type: object
      required: [data]
      properties:
        data:
          type: object
          required: [type, id, attributes]
          properties:
            type:
              type: string
              enum: [purchase-orders]
            id:
              type: string
            attributes:
              type: object
              required: [status]
              properties:
                status:
                  type: string
                legacyStatus:
                  type: string
                  deprecated: true
                  description: Removed in v2 after 2026-12-01. Use status.
    PurchaseOrderResponseV2:
      type: object
      required: [data]
      properties:
        data:
          type: object
          required: [type, id, attributes]
          properties:
            type:
              type: string
              enum: [purchase-orders]
            id:
              type: string
            attributes:
              type: object
              required: [status]
              properties:
                status:
                  type: string
```

- Stay on `/api/v1` when you only add optional fields or new paths. Bump to `/api/v2` when a documented field is removed, renamed, or changes type.

## Public vs internal

A public spec is what customers will call. Admin paths, internal scores, and secrets do not belong there.

```yaml
# ❌ Incorrect: public spec lists an internal score and an admin refund
openapi: "3.0.3"
info:
  title: Purchase orders
  version: "1.0.0"
paths:
  /api/v1/purchase-orders/{id}:
    get:
      operationId: getPurchaseOrder
      responses:
        "200":
          description: The order
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PurchaseOrderResponse"
  /api/v1/admin/purchase-orders/{id}/refund:
    post:
      operationId: refundPurchaseOrder
      responses:
        "204":
          description: Refunded
components:
  schemas:
    PurchaseOrderResponse:
      type: object
      required: [data]
      properties:
        data:
          type: object
          required: [type, id, attributes]
          properties:
            type:
              type: string
              enum: [purchase-orders]
            id:
              type: string
            attributes:
              type: object
              required: [status]
              properties:
                status:
                  type: string
                stripeCustomerId:
                  type: string
                internalRiskScore:
                  type: number

# ✅ Correct: public spec is only the customer API
openapi: "3.0.3"
info:
  title: Purchase orders
  version: "1.0.0"
paths:
  /api/v1/purchase-orders/{id}:
    get:
      operationId: getPurchaseOrder
      security:
        - bearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: The order
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PurchaseOrderResponse"
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    PurchaseOrderResponse:
      type: object
      required: [data]
      properties:
        data:
          type: object
          required: [type, id, attributes]
          properties:
            type:
              type: string
              enum: [purchase-orders]
            id:
              type: string
            attributes:
              type: object
              required: [status]
              properties:
                status:
                  type: string
                paidAt:
                  type: string
                  format: date-time
                  nullable: true
```

- An internal spec may list admin paths. Do not publish it on the same docs page as the public spec.
- Do not put tokens, webhook secrets, or internal hostnames in examples.
