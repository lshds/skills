---
name: api-design
description: >-
  REST API contract guidelines for resource design and HTTP APIs. This skill
  should be used when designing, reviewing, naming, or versioning endpoints
  or OpenAPI-shaped contracts to ensure a consistent wire contract. Prefer
  one envelope style and real HTTP status codes. Triggers on resource URLs,
  HTTP methods, status codes, pagination, filtering, error envelopes,
  problem details, idempotency, versioning, REST-y routes, partner/public
  APIs, breaking changes, or API documentation (OpenAPI, Redoc, Scalar).
---

# API Design

REST API contracts for resource URLs, HTTP methods, status codes, pagination,
filtering, error envelopes, idempotency, and versioning. Prefer the resource
envelope on greenfield; keep an existing repo shape.

**Domain:** REST API contracts on the wire — resource URLs, methods, status
codes, envelopes, query, idempotency, and versioning.
**Owns:** path/method design, HTTP status usage, request/response envelopes,
query/pagination/sort/filter contracts, idempotency keys, URL versioning, and
breaking-change calls.
**Does not own:** in-process error types, logging, retries, handler validation
placement, or auth implementation — cover only how outcomes appear on the wire
(`401`/`403`, `Authorization` header name).

## When to activate

- Designing new API endpoints or resource URLs
- Reviewing existing API contracts for consistency
- Adding pagination, filtering, or sorting
- Shaping error responses and HTTP status codes
- Planning API versioning or a breaking change
- Stabilizing public/partner APIs before clients ship
- Publishing or reviewing API docs (e.g. OpenAPI, Redoc, Scalar)

## Core Concepts

### Design vs review

- Pick one mode from the user ask — don’t mix output shapes
- **Design** (new endpoints or a contract): ship the short contract in Output Format; no review report unless asked
- **Review**: named scope only; report under Output Format headings
- Propose migrating to the greenfield envelope only when the API is new or the user asked for a consistency pass. On an existing flat or alternate envelope, review against that shape — don’t force `type` / `attributes` onto it
- Skip findings outside that domain

### Match the repo

Read installed versions from `package.json` and the lockfile (plus the OpenAPI
spec file and the docs tool config). Follow the patterns already in the tree;
greenfield defaults apply only where nothing contradicts them. When code lags
behind what the installed version supports, finish the task in the existing
style, then propose the migration once — old → new, why, file count, risk — and
wait for a yes. Never fold it into the current change. In review, report the gap
as a finding instead.

Keep the envelope, casing, and docs tool already in the tree. Review a flat or
alternate envelope against its own shape: don’t force `type` / `attributes` onto
a mature API, and don’t invent a second envelope beside it. Greenfield uses the
resource envelope in [http-contract.md](references/http-contract.md).

Version signals:

- `openapi: "3.0.3"` → `openapi: "3.1.0"` (when every tool that reads the spec supports 3.1; Redoc and Scalar render it)
- `nullable: true` → `type: [string, "null"]` (OpenAPI 3.1 / JSON Schema 2020-12)
- schema-level `example: 120.5` → `examples: [120.5]` (OpenAPI 3.1)
- problem details documented against RFC 7807 → RFC 9457 (same shape; 9457 obsoletes 7807)

### Resource design

Nouns, plural, lowercase, kebab-case. Shallow nesting for sub-resources. Verbs
only for non-CRUD actions (`cancel`, `login`). Action endpoints may use a plain
JSON body (or no body). See [http-contract.md](references/http-contract.md).

### Naming rules

Paths: kebab-case. JSON attributes and query field names: `camelCase`
(`createdAt`, `sort=-createdAt`) unless the repo already uses another casing.
See [http-contract.md](references/http-contract.md).

### Methods & status codes

| Method | Use |
| --- | --- |
| GET | Read (safe, idempotent) |
| POST | Create or non-idempotent action |
| PUT | Full replace |
| PATCH | Partial update |
| DELETE | Remove → `204` (no body). Default: also `204` if already gone (idempotent). Use `404` only when the product must distinguish “was present.” |

| Code | When |
| --- | --- |
| 200 | OK with body (including empty collections: `data: []`) |
| 201 | Created (+ `Location`) |
| 204 | Success, no body (typical DELETE; also empty PUT/PATCH when intentional) |
| 400 | Malformed request (bad JSON, wrong types, missing required envelope) |
| 422 | Well-formed but semantically invalid (validation rules, business constraints) |
| 401 | Unauthenticated |
| 403 | Forbidden |
| 404 | Missing resource (not empty list) |
| 409 | Conflict |
| 429 | Rate limited (`Retry-After`) |
| 5xx | Unexpected / upstream |

Never return `200` with `{ success: false }` — use the status code. Status codes
are part of the public contract; clients branch on them.

### Request & response shapes

JSON:API-inspired subset: `data` / `type` / `id` / `attributes` / `errors` /
`links` / `meta` only. Out of scope: `relationships`, `included`, full JSON:API
content types. One contract for writes, success, and errors
(`Content-Type: application/json`). POST omits `id`; PATCH sends `id` plus
changed attributes; PUT sends `id` plus the full set. Never both `data` and
`errors`. The main alternative a repo may already use is RFC 9457 problem
details (`application/problem+json` with `type` / `title` / `status` / `detail` /
`instance`); when it does, keep that shape instead of adding `errors[]`. Worked
envelopes: [http-contract.md](references/http-contract.md).

### Pagination & query

Require pagination (or an explicit capped default) on collection GETs. Offset/limit
is `page[offset]` / `page[limit]`; cursor for large or changing feeds; stable sort
with an `id` tie-break. See [http-contract.md](references/http-contract.md).

### Idempotency, bulk, auth

GET/PUT/DELETE are idempotent by HTTP; unsafe POST accepts `Idempotency-Key` (an
IETF draft), and a replay returns the first response. Bulk is a collection
`/batch` with a max size and per-item errors. Wire auth is `Authorization` and
`401`/`403`. See [http-contract.md](references/http-contract.md).

### Versioning

Prefer URL version `/api/v1`. Bump to v2 only for breaking changes; optional fields
stay on v1. See [http-contract.md](references/http-contract.md).

### API docs

If they already exist (e.g. OpenAPI, Redoc, Scalar), keep them next to the
routes. Names, tags, and examples must match the live API. Do not create any
unless the user asked or confirmed. Greenfield specs use `openapi: "3.1.0"`. The
public spec holds only what customers call — hiding an operation or the download
button in the docs UI does not make it private.

### Common mistakes

| ❌ Incorrect | ✅ Correct |
| --- | --- |
| 200 + `{ success: false }` | Real HTTP status + `errors[]` |
| 500 for validation | 400 (malformed) / 422 (semantic) + `source.pointer` |
| 200 for create | 201 + `Location` |
| 200 + body for DELETE | 204 no body |
| 404 for empty list | 200 + `data: []` |
| Deep `/a/:id/b/:id/c/:id` trees | Shallow nesting or top-level resources with filters |
| Forcing JSON:API nesting on a mature flat API | Match repo envelope; fix status/naming first |
| `errors[]` on a new endpoint of a `problem+json` API | `application/problem+json` with the same members as the rest of the API |

## Output Format

**Design** — a short contract the team can implement:

1. **Routes** — method + path for each operation (noun resources; verbs only for non-CRUD actions)
2. **Status map** — success and main failure codes per operation
3. **Request / response** — envelope examples (or “match existing repo envelope” plus one example of that shape)
4. **Query** — pagination, filter, sort (stable tie-break)
5. **Breaking?** — stays on current version, or needs a bump + why

If the repo already has API docs (e.g. OpenAPI, Redoc, Scalar), update them.
If not, ask before adding any; skip unless the user says yes.

**Review** — report findings as:

- **Path / method** — noun resources, casing, shallow nesting, verb actions
- **Status codes** — real HTTP codes; no `200` + `{ success: false }`
- **Envelope** — `data` / `errors` / `links` / `meta` vs repo shape
- **Query** — pagination, filter, sort stability
- **Breaking?** — version bump needed or safe on current version

## Practice areas

Read the reference for the task — don’t load every file.

| Area | Reference |
| --- | --- |
| Resource URLs / envelopes / status / problem+json / RFC 9457 / pagination / Idempotency-Key / bulk / versioning | [http-contract.md](references/http-contract.md) |
| OpenAPI 3.1 spec / `components` / `nullable` / names / tags / writes / errors / Idempotency-Key / deprecation / public vs internal | [openapi.md](references/openapi.md) |
| Redoc / OpenAPI HTML docs / option casing / `hideDownloadButtons` / `x-tagGroups` | [redoc.md](references/redoc.md) |
| Scalar / API reference / spec `url` / `sources` / option names / `persistAuth` | [scalar.md](references/scalar.md) |
