# Proxy

Prefer `proxy.ts` with a named `proxy` export and one matcher that skips
`_next` and static files over an unmatched or blanket gate, so navigations are
gated without slowing assets or locking users out of sign-in. Proxy makes an
optimistic cookie check; the page, Server Action, or Route Handler still
checks the session before it reads private data or writes.

## Named `proxy` with a matcher

Without a matcher, proxy runs for every script, image, and font request. The
matcher below skips `_next` and static files and always includes `/(api|trpc)`
so API calls pass through the gate too.

```typescript
// ❌ Incorrect: no matcher — proxy runs on every static asset request
import { NextResponse } from 'next/server'

export function proxy() {
  return NextResponse.next()
}

// ✅ Correct: named proxy plus a matcher that skips _next and static files and includes api/trpc
import { NextResponse } from 'next/server'

export function proxy() {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
```

- Later sections change only the `proxy` function; keep this `config`.
- Write the matcher as literals inline in `config` — it is analyzed at build
  time, and a value pulled from a variable is ignored.
- A default export is valid; a named `proxy` is the house default.
- `proxy.ts` runs on the Node.js runtime and replaces the deprecated
  `middleware.ts` (16). If the repo still has `middleware.ts`, keep its file
  and export until the user approves the rename.

## Public-first or protected-first

A blanket "no cookie → `/sign-in`" gate also locks marketing pages and
redirects `/sign-in` to itself. Pick the shape from the product: public-first
for marketing and content sites, protected-first for internal tools.

```typescript
// ❌ Incorrect: blanket gate — marketing pages need a session and /sign-in redirects to itself
import { NextResponse, type NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  if (!request.cookies.has('session')) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  return NextResponse.next()
}

// ✅ Correct: public-first — protect only the listed prefixes
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PREFIXES = ['/dashboard', '/settings']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtectedPath = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  )

  if (isProtectedPath && !request.cookies.has('session')) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  return NextResponse.next()
}

// ✅ Correct: protected-first — allow only the listed public paths
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PREFIXES = ['/sign-in', '/sign-up', '/api/public']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublicPath =
    pathname === '/' ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  if (!isPublicPath && !request.cookies.has('session')) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  return NextResponse.next()
}
```

## Proxy is not the only gate

Proxy only sees that a cookie exists, and a Server Action can be posted from
any page the prefix list leaves open. Check the session again inside the
action or Route Handler before you mutate.

```typescript
// ❌ Incorrect: the action trusts that proxy already ran — a direct POST deletes without a session
'use server'

export async function deleteInvoice(invoiceId: string) {
  await database.invoice.delete({ where: { id: invoiceId } })
}

// ✅ Correct: the action reads the session and scopes the delete to the caller's organization
'use server'

import { redirect } from 'next/navigation'

export async function deleteInvoice(invoiceId: string) {
  const session = await getSession()

  if (!session) {
    redirect('/sign-in')
  }

  await database.invoice.deleteMany({
    where: { id: invoiceId, organizationId: session.organizationId },
  })
}
```

- `getSession()` stands for the repo's session helper and `database` for its
  data client; use the ones the app has.
