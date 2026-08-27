---
name: nextjs-patterns
description: >-
  Next.js App Router guidelines for `app/` routes. This skill should be used
  when writing, reviewing, or refactoring pages, proxy, Server Actions, route
  handlers, streaming, slots, or cache to ensure current conventions and
  user-scoped cache. Prefer Server Components and `proxy.ts`. Triggers on
  page.tsx, loading.tsx, proxy.ts, use client, use server, generateMetadata,
  use cache, revalidateTag, or 401 vs 403.
---

# Next.js Skills

App Router files, server vs client, proxy, Server Actions, route handlers,
streaming, slots, metadata, and scoped cache. Prefer current App Router APIs;
match the repo.

**Domain:** Next.js App Router conventions in `app/` and `proxy.ts` — special
files, the server vs client boundary, request gates, handler status mapping,
streaming, slots, metadata, and user-scoped cache.
**Owns:** `page` / `layout` / `loading` / `error` / `not-found` / `route` /
`default` / `template`; `await params` and `searchParams`; `'use client'` only
on the interactive leaf; named `proxy` + matcher; public- vs protected-first;
session check inside the Server Action before mutate; `redirect()` vs
`{ kind: 'error' }`; 401 / 403 / 404 / 201 on route handlers; `loading.tsx` vs
inline `<Suspense>`; parallel `@` slots and intercepting `(.)` modals;
`generateMetadata` / `generateStaticParams` / `opengraph-image`; `'use cache'`
keyed and tagged by user or tenant.
**Does not own:** React hooks, composition, or RSC serialization beyond “props
across the boundary must be serializable”; authz / IDOR threat modeling or
token transport; HTTP resource design, pagination, or error envelopes beyond
those four statuses; TypeScript language rules; CSS.

## When to activate

- Adding or placing `page.tsx`, `layout.tsx`, `loading.tsx`, or `route.ts`
- Choosing the `'use client'` boundary or serializing server→client props
- Writing or reviewing `proxy.ts` matchers and public- vs protected-first gates
- Protecting a Server Action or returning `{ kind: 'error' }` / `redirect()`
- Implementing `app/api` handlers and 401 / 403 / 404 / 201
- Streaming slow data with `loading.tsx` or `<Suspense>`
- Adding a parallel `@` slot or an intercepting modal
- Writing `generateMetadata`, `generateStaticParams`, or user-scoped cache

## Core Concepts

### Write vs review

- Pick one mode from the user ask — don’t mix output shapes
- **Write** (implement, fix, refactor): apply these defaults in `app/` /
  `proxy.ts`; no review report unless asked
- **Review**: named scope only; report concrete misses in this skill’s domain
- Skip findings outside that domain

### Match the repo

Use `proxy.ts` and `'use cache'` on new code. Don’t invent a second cache or
gate stack beside what the app already uses. If you find an older
implementation (`middleware.ts`, `unstable_cache`), say so and ask whether to
replace it with the current recommendation — never swap it in before they
agree.

### File conventions

One role per special file — `page`, `layout`, `loading`, `error`, `not-found`,
`route`. `params` and `searchParams` are Promises: `await` them. Special files
own the URL; other files may sit beside them. Match the repo (`lib/` vs
colocated). Prefix a folder with `_` when it should not be a segment. See
[file-conventions.md](references/file-conventions.md).

### Server vs client

Server Components are the default (async, data, secrets). Add `'use client'`
only for hooks, events, or browser APIs. Props across the boundary must be
serializable. See [server-vs-client.md](references/server-vs-client.md).

### Proxy

`proxy.ts` exports a named `proxy` (default export is valid; prefer named) and
gates navigations. Public-first or protected-first via path prefixes. The
matcher skips `_next` and static files and includes `/(api|trpc)`. Proxy is
not the only auth check for actions. See [proxy.md](references/proxy.md).

### Server Actions

`'use server'` functions are public endpoints. Read the session and authorize
inside the action before mutate. `redirect()` when a form post has no session;
return `{ kind: 'error', message }` when the UI should show the failure. See
[server-actions.md](references/server-actions.md).

### Route handlers

`app/api/.../route.ts` with `await params`. 401 not signed in, 403 signed in
without permission, 404 missing resource, 201 created. Scope the query to the
session owner. See [route-handlers.md](references/route-handlers.md).

### Streaming

Render a fast shell first. Put slow fetches in their own async children behind
`<Suspense>`. Use `loading.tsx` for the segment; inline Suspense for islands.
Remount the island with `key` when filters change. See
[streaming.md](references/streaming.md).

### Slots

Parallel `@slot` folders become layout props with their own loading UI.
Intercepting `(.)` shows a modal on client navigation and the full `page.tsx`
on refresh. Add `default.tsx` so an empty slot does not 404. See
[slots.md](references/slots.md).

### Metadata

`generateMetadata` per page, `generateStaticParams` for known slugs,
`notFound()` when the record is missing. Open Graph via `openGraph` or
`opengraph-image`. See [metadata.md](references/metadata.md).

### Caching

Personalized data must not leak across users. `'use cache'` with `userId` as
an argument and `cacheTag` in the same scope. `updateTag` in actions;
`revalidateTag(tag, 'max')` in route handlers. See
[caching.md](references/caching.md).

### Common mistakes

| ❌ Incorrect | ✅ Correct |
| --- | --- |
| Import `cookies` / `headers` in a Client Component | Keep server-only APIs in Server Components or actions |
| Trust proxy alone for a mutation | Check session + authz inside the Server Action |
| Cache a profile without a user/tenant argument | Pass `userId` into the cached function and tag with it |
| 403 when the caller is signed out | 401 unsigned; 403 signed-in without permission |
| Read `params` / `searchParams` as a plain object | `await params` and `await searchParams` |

## Practice areas

Read the reference for the task — don’t load every file.

| Area | Reference |
| --- | --- |
| `page` / `layout` / `loading` / `params` | [file-conventions.md](references/file-conventions.md) |
| Server vs client / serializable props | [server-vs-client.md](references/server-vs-client.md) |
| `proxy.ts` / matchers / public- vs protected-first | [proxy.md](references/proxy.md) |
| Server Actions / session / `redirect` / `{ kind: 'error' }` | [server-actions.md](references/server-actions.md) |
| Route handlers / 401 / 403 / 404 / 201 | [route-handlers.md](references/route-handlers.md) |
| `loading.tsx` / Suspense islands / filter `key` | [streaming.md](references/streaming.md) |
| Parallel `@` slots / intercepting modals | [slots.md](references/slots.md) |
| `generateMetadata` / `generateStaticParams` / OG | [metadata.md](references/metadata.md) |
| `'use cache'` / `cacheTag` / user-scoped keys | [caching.md](references/caching.md) |
