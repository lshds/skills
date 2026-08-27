---
name: error-handling-patterns
description: >-
  Language-agnostic error handling guidelines for application boundaries.
  This skill should be used when designing, reviewing, or refactoring error
  paths to ensure safe client messages and correct taxonomy. Prefer typed
  operational errors and one edge mapping. Triggers on tasks involving error
  handlers, status mapping, logging/cause chains, retries, degradation,
  unowned async or partial batch failures, or choosing throw vs return when
  absence is a normal outcome.
---

# Error Handling Skills

Language-agnostic error taxonomy and edge mapping: operational vs unexpected,
typed app errors, safe client messages, throw vs return, logging/cause chains,
retries, and degradation. Prefer typed operational errors and one edge mapping.

**Domain:** in-process error taxonomy and edge mapping — classify the failure,
signal it (throw vs return), and map it once at the application edge.
**Owns:** operational vs unexpected; typed app errors (`code` / `kind` /
`message` / `details` / `cause`); throw vs return when absence is a routine
caller outcome; deriving a transport signal from `kind` **once** at the edge
(HTTP `statusCode`, or retry / dead-letter / exit code elsewhere); safe client
messages vs server logs; retry / fail-fast / degrade policy; owned async
failure paths and partial-batch failure contracts.
**Does not own:** request-thread I/O, caching, or validation placement; HTTP/JSON
envelope nesting or resource URL design; client UI loading / empty / error
views; authn/authz rules (only the `kind` after a decision exists); schema and
migrations; metrics and traces.

## When to activate

- Designing expected failures vs bugs for an operation
- Reviewing handlers or error middleware for leaks, mixed idioms, or wrong `kind`
- Choosing throw vs return when absence or miss is a routine caller outcome
- Mapping `kind` once to HTTP status, or to retry / dead-letter / exit code
- Deciding what to log vs return (no stack / SQL / identifiers in `message`)
- Adding retries, fail-fast rules, a circuit breaker, or a defined fallback
- Owning async failure paths: unhandled tasks or partial-batch contracts

## Core Concepts

### Write vs review

Pick one mode from the user ask — don’t mix output shapes. Use the repo’s error
type; don’t invent a new one.

- **Design:** a short list the team can implement. Cover the points that apply;
  skip the rest: **Kinds**, **Throw vs return**, **At the edge**, **Client vs
  log**, **Retry**, **Async**
- **Review:** same headings; report only problems — generic `Error`, throw for a
  routine miss, `kind` or `cause` in JSON, `statusCode` as a JSON field unless
  this API already returns it, leak in `message`, retry of a non-idempotent
  write, fire-and-forget or a batch that hides failed items

### Throw vs return

Throw / raise when the operation cannot succeed and callers should not treat absence as normal. Return a missing or empty result when absence is a routine outcome callers handle — don’t throw for “not found” that the happy path routinely branches on.

- Match the API contract to the failure mode: throwing means success is the only happy path; returning means missing is part of the type/contract.
- Prefer the repo’s error types when throwing operational failures — don’t invent a one-off shape at the call site.
- Don’t leak raw infrastructure messages (driver text, stacks, vendor bodies) in thrown/raised messages.

See [throw-vs-return.md](references/throw-vs-return.md).

### Operational vs unexpected

- **Operational:** expected failure (`not_found`, `conflict`, `validation`, `rate_limited`, `unavailable`). Client: stable `code` + safe message. Server: warn/info; no stack spam for routine cases.
- **Unexpected:** bug or invariant break. Client: generic safe message. Server: error with stack/`cause` + correlation id.
- Classify before wrapping. Never swallow errors. Follow the repo’s error idiom — don’t mix styles in one module. Panics only for unrecoverable programmer bugs.

### Typed application errors

Prefer one in-process app error shape the edge can map:

- `code` — stable machine id, `snake_case` (e.g. `user_not_found`); don’t rename once clients depend on it
- `message` — safe, human-oriented; no PII, secrets, identifiers, or internals
- `kind` — closed `snake_case` token from the table (e.g. `not_found`); not a sentence, not `SCREAMING_SNAKE`. The edge **derives** its transport signal from `kind` — never set independently
- `details` — optional field-level extras; `cause` — optional underlying error (server-only)

This shape stays in-process. Map it **once** at the edge. The client body is `code` + safe `message` (+ `details` when allowed). `kind` and `cause` stay on the server. HTTP `statusCode` is the response status (`404`), not a JSON field — unless this API already returns that field.

**HTTP edge** — derive `statusCode` from `kind`:

| `kind` | `statusCode` |
| --- | --- |
| `malformed` | `400` |
| `validation` | `422` |
| `unauthenticated` | `401` |
| `forbidden` | `403` |
| `not_found` | `404` |
| `conflict` | `409` |
| `rate_limited` | `429` |
| `unavailable` | `503` (or `502` when this edge is a gateway/proxy) |
| `unexpected` | `500` |

**Non-HTTP edges** (workers, queues, CLI) — same `kind` table, different signal; do not invent a parallel taxonomy. `malformed` / `validation` / `not_found` / `unauthenticated` / `forbidden` / `conflict` → fail without retry (CLI: non-zero exit; queue: dead-letter or drop per contract). `unavailable` → retry only when the work is transient and idempotent. `unexpected` → fail, log stack/`cause`, do not retry in a loop.

Surface operational errors from services; map at the edge. Preserve `cause` when wrapping. Aggregate field errors — fail with one response that lists all issues.

### Where errors are handled

- **Handler / middleware** — map app error → transport failure + safe payload; unexpected → internal failure. Do not serialize the in-process object as-is.
- **Service** — surface operational errors; add context when wrapping
- **Repository / ports** — translate store/upstream failures into typed app errors

Transport signal only at the edge. Don’t wrap only to propagate unchanged. Clean up resources on failure paths.

### Client vs server surface

**Clients get:** `code`, safe `message`, and the HTTP status (or retry / dead-letter / exit). Field `details` when allowed. Not `kind` or `cause`. Not `statusCode` as a JSON field unless this API already returns it. No stacks, SQL, paths, hostnames, tokens, or raw upstream payloads.

**Servers log:** `code`, kind/status, correlation id, enough identifiers to reproduce — not secrets. Log once at the boundary that owns the decision.

See [logging.md](references/logging.md).

### Upstream, retries, resilience

Retry only transient, idempotent work (or writes with an idempotency key). Fail fast on `validation`, `unauthenticated`, `not_found`, `conflict`. Upstream failures become your own `unavailable` error, not the vendor body.

Prefer a defined fallback over a hard internal failure when the product allows it — and always log that you degraded. Open a circuit when retries against an already-failing dependency would cascade.

See [retries.md](references/retries.md).

### Concurrent failure paths

Every async task is awaited, joined, or owned by an explicit failure path — no unowned fire-and-forget. For batches, pick all-or-nothing or per-item **before** the loop; don’t drop failures and return the rest as full success.

See [concurrent.md](references/concurrent.md).

### Common mistakes

| ❌ Incorrect | ✅ Correct |
| --- | --- |
| 500 for `malformed` / `validation` / `not_found` | Typed error → mapped `kind` (HTTP: 400 / 422 / 404) |
| Leak SQL / driver / stack to client | Safe `message` + `code`; keep `cause` server-side |
| Throw for routine not-found (callers try/catch a miss) | Return missing/empty; throw only when the resource is required |
| Unowned fire-and-forget | Await, join, or attach an explicit failure path |
| Wrap only to rethrow unchanged | Propagate as-is, or wrap with `cause` + useful context |

## Practice areas

Read the reference for the task — don’t load every file.

| Area | Reference |
| --- | --- |
| Throw vs return / required vs optional lookup | [throw-vs-return.md](references/throw-vs-return.md) |
| Logging / cause chains / client vs server | [logging.md](references/logging.md) |
| Retries / degradation / circuit breaker | [retries.md](references/retries.md) |
| Unowned async / partial batch failures | [concurrent.md](references/concurrent.md) |
