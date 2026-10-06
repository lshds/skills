---
name: backend-patterns
description: >-
  Language-agnostic backend guidelines for server request paths. This skill
  should be used when writing, reviewing, or refactoring handlers and services
  to ensure sound request-path I/O, validation, caching, and job offload.
  Prefer non-blocking I/O and validating once at the boundary. Triggers on
  request-thread I/O, boundary validation, cache keys / TTL / invalidation,
  hoisting static I/O, post-response side effects, queues / workers / DLQ,
  swallowed errors, N+1, unbounded hot-path lists, request-path logs, log
  levels, request id, server environment, or `process.env` read at startup.
---

# Backend Skills

Language-agnostic server request path: async I/O, where input is validated,
cache shared across requests, config and server environment read at startup,
work done after the response, work moved to a queue, and basic failure and
data-access checks on that path. Prefer validating once at the boundary and
non-blocking I/O.

**Domain:** how the request and handler path behaves inside one process,
across backend stacks.
**Owns:** async I/O and timeouts on the request thread; cache shared across
requests (keys, expiry and size limit, clearing on write); config and server
environment read once at startup; work done after the response; job offload,
idempotent job handlers, dead-letter queue; where request input is validated;
request-path logs (fields, levels, request id); basic checks on that path (no
silently dropped failures, no query per row, no unbounded lists, a transaction
when several writes must succeed or fail together).
**Does not own:** the error taxonomy and how failures map to responses, retry
and backoff policy, or the choice between throwing and returning; query and
transaction design beyond that spot-check, schema modeling, migrations, ORM
setup, or rolling a schema change out in stages; HTTP response envelopes and
status contracts; language rules such as typing and naming; authorization or
secrets; or storage in the client.

## When to activate

- Writing new request handlers or service paths
- Reviewing async or I/O on the request thread
- Adding or tightening boundary validation for external input
- Introducing or reviewing cross-request caches (keys, TTL, invalidation, stampede)
- Loading config or the server environment (`process.env`) at startup
- Scheduling post-response logging/analytics, or adding request-path logs
- Offloading heavy or unreliable work to a queue / worker
- Spot-checking a handler for swallowed errors, N+1, or unbounded lists on the hot path

## Core Concepts

### Write vs review

- Pick one mode from the user ask — don’t mix output shapes
- **Write** (implement, fix, refactor): apply these defaults on the request path; no review report unless asked
- **Review**: named scope only; report concrete misses in this skill’s domain
- Skip findings outside that domain

### Async / I/O

- Use the platform’s idiomatic non-blocking concurrency; never block the request thread on I/O.
- Propagate cancellation/timeouts where the platform supports it.
- No in-process memory as source of truth across instances.

### Async jobs

- Put heavy or unreliable work (emails, exports, webhooks) on the repo’s existing queue. Don’t invent a new one, and don’t run it on the request thread.
- Jobs can run more than once — the queue may deliver the same job again — so the handler must be safe to run twice for the same job id.
- Send the message to a dead-letter queue when the queue’s retries run out. Leave retrying to the queue: don’t block the request or loop retries inside the handler.
- Don’t wait for the job to finish before you respond, unless the client needs the result.

### Cross-request cache

- Cache only data reused across requests, with an explicit key (resource + tenant/version as needed). Never put current user or session in a shared key or in module-level state.
- Give every entry a TTL and a max size (LRU or equivalent). On serverless, use shared storage (e.g. Redis) when more than one process needs the same data.
- When you write, delete or version the cache key. A TTL is not enough for data you just changed.
- On a miss, load from the source and then set the cache. On a write, update the source first, then drop the cache key — don’t write both unless the repo already does.
- If many requests miss the same key at once, let one of them load the data. Don’t let all of them hit the source together.

### Hoist static I/O

- Load request-invariant assets (config, templates, fonts, static files) once at module/startup scope — not inside every handler.
- Don’t hoist per-user or mutable runtime files. Immutable static loads at startup are fine; request/user mutable state is not.
- Validate or parse loaded config at the boundary before treating it as trusted shape.

### Environment

- Prefer reading `process.env` at startup into an object with required string fields, so a missing value surfaces there rather than in a handler.
- Prefer the repo’s environment helper when it has one. If it doesn’t and you would add a package for it, ask first.
- See [environment.md](references/environment.md).

### Post-response side effects

- Don’t await logging, analytics, or notifications before returning the response when they aren’t required for correctness.
- Use the runtime’s post-response hook when the platform provides one; otherwise schedule owned work with an explicit failure path so errors aren’t swallowed.

### Logging

- Log on the repo logger as objects, with the request id on every line. Use `debug` / `info` / `warn` / `error` for what happened — `warn` is for a fallback or degraded path, not a normal cache miss.
- Don’t use `console.log` when the repo already has a logger. If there isn’t one, `console.log` is fine — ask the user if they want a logger added.
- See [logging.md](references/logging.md).

### Validation

Placement and frequency only (not schema libraries, rate limits, or response shaping):

- Validate request/external input shape at the handler/controller boundary, then trust it inward.
- Do not re-validate the same shape deeper in services unless the data crossed another trust boundary (the response of an outbound call, or a queue message).

### Error handling

Don’t swallow failures on the request path — no empty `catch`, no logging and then answering as if it worked. The error taxonomy and how failures map to responses belong to error-handling design, not here.

### Data access

A spot-check on the request path; deeper query and transaction design belongs to the data-access layer.

- No query per row in a loop (N+1) — batch or join.
- No unbounded list on the hot path — paginate or limit.
- One transaction when several writes must succeed or fail together.

### Common mistakes

| ❌ Incorrect | ✅ Correct |
| --- | --- |
| Await analytics/notifications before respond | Return first; schedule owned post-response work |
| Module-level `currentUser` / tenant | Pass identity per request; never cache request identity globally |
| Read config/template file inside every handler | Hoist immutable static loads at startup |
| Empty `catch` / log-and-succeed on the request path | Let the failure propagate instead of answering as if it worked |
| `console.log` when the repo already has a logger | Object fields on `logger.info` |
| `process.env.JWT_SECRET` inside a handler | Checked `environment.jwtSecret` at process start |
| N+1 or unbounded list on the hot path | Batch/join; paginate or limit before return |

## Practice areas

Read the reference for the task — don’t load every file.

| Area | Reference |
| --- | --- |
| Request-path logs / structured fields / log levels / `warn` vs cache miss / request id / child logger / one logger | [logging.md](references/logging.md) |
| Server environment / `process.env` read at startup / required fields / `?? ''` and `!` / `dotenv` / one source | [environment.md](references/environment.md) |
