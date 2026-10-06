---
name: nextjs-patterns
description: >-
  Next.js App Router house guidelines for `app/` routes and `proxy.ts`. This
  skill should be used when writing, reviewing, or refactoring pages, proxy,
  Server Actions, route handlers, streaming, slots, metadata, or cache to
  ensure gated mutations, correct handler statuses, and user-scoped cache.
  Prefer Server Components and tagged `'use cache'` reads over client fetching
  and unscoped caches. Triggers on page.tsx, route.ts, proxy.ts, use cache,
  cacheTag, updateTag, catchError, next/root-params, or generateMetadata.
---

# Next.js Skills

Next ships API docs that match the installed version. This skill only records
the house decisions those docs leave open: where gates, cache scopes, and
boundaries go.

**Domain:** Next.js App Router conventions in `app/` and `proxy.ts`.
**Owns:** special-file roles and typed, awaited `params`; `catchError` and
`next/root-params`; the `'use client'` leaf; proxy matcher and gate shape;
session and authorization in actions and handlers; `redirect()` vs
`{ kind: 'error' }`; 401 / 403 / 404 / 201 + `Location`; streaming, slots,
and metadata placement; user- or tenant-scoped `'use cache'`.
**Does not own:** React hooks, composition, or RSC serialization beyond “props
across the boundary must be serializable”; authz / IDOR threat modeling or
token transport; HTTP resource design — the full status vocabulary,
pagination, and error envelope design; TypeScript language rules; CSS.

## When to activate

- Adding or placing `page.tsx`, `layout.tsx`, `loading.tsx`, or `route.ts`
- Choosing the `'use client'` boundary or serializing server→client props
- Writing or reviewing `proxy.ts` matchers and public- vs protected-first gates
- Gating a Server Action or Route Handler and mapping it to 401 / 403 / 404 / 201
- Streaming with `loading.tsx` / `<Suspense>` or recovering with `catchError`
- Adding a parallel `@` slot, an intercepting modal, or `generateMetadata`
- Caching or invalidating reads with `'use cache'`, `cacheTag`, or `updateTag`

## Core Concepts

### Write vs review

- Pick one mode from the user ask — don’t mix output shapes
- **Write** (implement, fix, refactor): apply these defaults in `app/` /
  `proxy.ts`; no review report unless asked
- **Review**: named scope only; report concrete misses in this skill’s domain
- Skip findings outside that domain

### Match the repo

Read installed versions from `package.json` and the lockfile (plus
`next.config.ts`). Follow the patterns already in the tree; greenfield
defaults apply only where nothing contradicts them. When code lags behind what
the installed version supports, finish the task in the existing style, then
propose the migration once — old → new, why, file count, risk — and wait for a
yes. Never fold it into the current change. In review, report the gap as a
finding instead.

Keep one cache stack and one gate stack: extend the cache API and session
helper the app already uses instead of adding a second one beside it.

Version signals:

- `middleware.ts` + `export function middleware` → `proxy.ts` + `export function proxy`
- `experimental.dynamicIO` / `experimental.ppr` → `cacheComponents: true`
- `unstable_cache` / `fetch(url, { next: { revalidate } })` → `'use cache'` + `cacheLife` + `cacheTag`, once `cacheComponents` is on
- `revalidateTag(tag)` → `updateTag(tag)` in actions / `revalidateTag(tag, 'max')` in handlers
- Hand-written `{ params: Promise<{ id: string }> }` props → `PageProps<'/products/[id]'>` / `RouteContext<'/api/products/[id]'>`
- `[lang]` prop drilling → `next/root-params`; class error boundary around server content → `catchError`

### File conventions

One role per special file; only `page` and `route` publish a URL. Type props
with the generated `PageProps` / `LayoutProps`, `await` `params` /
`searchParams`, and narrow each query value. Trust required segments (`[id]`);
call `notFound()` / `redirect()` as statements outside `try` / `catch`. See
[file-conventions.md](references/file-conventions.md).

### Section boundaries and root params

On 16.3+, a section that should fail and retry alone gets a `catchError`
boundary from `next/error` (it lets `notFound()` / `redirect()` through;
`error.tsx` stays segment-wide), and a Server Component reads a root segment
such as `[lang]` with `next/root-params` instead of prop drilling. See
[file-conventions.md](references/file-conventions.md).

### Server vs client

Server Components are the default. `'use client'` only on the leaf that needs
hooks, events, or browser APIs; `cookies()` / `headers()` stay in server
files; props across the boundary are serializable. Never `fetch` your own
`/api/products` from a Server Component. See
[server-vs-client.md](references/server-vs-client.md).

### Proxy

`proxy.ts` exports a named `proxy` with one matcher that skips `_next` and
static files and includes `/(api|trpc)`. Public-first (protect a short list)
or protected-first (allow a short list). Proxy is an optimistic cookie check,
not the only gate. See [proxy.md](references/proxy.md).

### Server Actions

`'use server'` functions are public endpoints: read the session and scope the
write to its owner before mutating. `redirect()` without a session;
`{ kind: 'error', message }` for failures the form shows; `updateTag` on the
read path's tag. See [server-actions.md](references/server-actions.md).

### Route handlers

`await` `params` from `RouteContext`, check the session, and scope the query
to its owner. 401 not signed in, 403 signed in without permission, 404
missing, 201 + `Location` on create — every failure through the repo's error
envelope. See [route-handlers.md](references/route-handlers.md).

### Streaming

Fast shell first; slow reads in async children behind `<Suspense>`.
`loading.tsx` for the segment, inline Suspense for islands, `key` to remount
on filter change. Instant Navigations (16.3) are opt-in (`cacheComponents` +
`partialPrefetching`): follow them only when the repo enables them, guarded in
tests by `@next/playwright` `instant()`. See [streaming.md](references/streaming.md).

### Slots

Parallel `@slot` folders become `LayoutProps` entries with their own loading
UI; every slot needs a `default.tsx`. Intercepting `(.)` shows a modal on
client navigation, the full `page.tsx` on refresh. See [slots.md](references/slots.md).

### Metadata

`generateMetadata` loads the record through the page's own loader and calls
`notFound()` when it is missing. Per-record Open Graph via `openGraph` or
`opengraph-image`. See [metadata.md](references/metadata.md).

### Caching

`'use cache'` takes the user or tenant id as an argument with `cacheTag` in
the same scope; cookies are read outside. `updateTag` in actions,
`revalidateTag(tag, 'max')` in handlers; no `dynamic` / `revalidate` /
`fetchCache` segment config under `cacheComponents`. `'use cache: private'`
only when the scope must read cookies itself. See [caching.md](references/caching.md).

### Common mistakes

| ❌ Incorrect | ✅ Correct |
| --- | --- |
| Trust proxy alone for a mutation | Session + owner-scoped query inside the action or handler |
| Cache a profile without a user/tenant argument | Pass `userId` into the cached function and tag with it |
| `revalidateTag(tag, 'max')` in a Server Action | `updateTag(tag)` so the user reads their own write |
| `if (!slug)` on a required segment; `return notFound()` | Trust the segment; `notFound()` as a statement |
| Server Component `fetch`es its own `/api/products` | Call the data function the Route Handler uses |
| Pages Router APIs in `app/` — `next/router`, `getServerSideProps`, `next/head` | `next/navigation`, an async Server Component, `generateMetadata` |

## Practice areas

Read the reference for the task — don’t load every file.

| Area | Reference |
| --- | --- |
| `page` / `layout` / `PageProps` / `params` / `searchParams` / `notFound` / `catchError` / `next/root-params` | [file-conventions.md](references/file-conventions.md) |
| Server vs client / `'use client'` leaf / `cookies()` / serializable props / own Route Handler / `server-only` | [server-vs-client.md](references/server-vs-client.md) |
| `proxy.ts` / matcher / public- vs protected-first / not the only gate | [proxy.md](references/proxy.md) |
| Server Actions / session / owner scope / `redirect` / `{ kind: 'error' }` / `updateTag` / `refresh` | [server-actions.md](references/server-actions.md) |
| Route handlers / `RouteContext` / error envelope / 401 / 403 / 404 / 201 / `Location` | [route-handlers.md](references/route-handlers.md) |
| `loading.tsx` / Suspense islands / filter `key` | [streaming.md](references/streaming.md) |
| Parallel `@` slots / `LayoutProps` / `default.tsx` / intercepting modals | [slots.md](references/slots.md) |
| `generateMetadata` / `generateStaticParams` / Open Graph / `opengraph-image` | [metadata.md](references/metadata.md) |
| `'use cache'` / `cacheTag` / `cacheLife` / `updateTag` / `revalidateTag` / `'use cache: private'` / `cacheComponents` | [caching.md](references/caching.md) |
