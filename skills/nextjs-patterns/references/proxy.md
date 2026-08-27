# Proxy

Prefer `proxy.ts` with a named `proxy` export and a matcher that skips static
files, so navigations are gated without slowing assets. A default export is
valid; named `proxy` is the house default.

## File and export

Place `proxy.ts` at the project root or next to `src/`. Prefer a named `proxy`
function. If the repo already has `middleware.ts`, keep that file and export
until the task asks to rename it.

```typescript
// ❌ Incorrect: no matcher — proxy runs on every static file
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  return NextResponse.next()
}

// ✅ Correct: named proxy + matcher that skips assets
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROXY_MATCHER = [
  '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  '/(api|trpc)(.*)',
] as const

export function proxy(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: PROXY_MATCHER,
}
```

## Public-first

Marketing and content sites: allow everything, protect a short list.

```typescript
// ❌ Incorrect: redirect every unsigned request — marketing pages require a session
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.get('session') !== undefined

  if (!hasSession) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  return NextResponse.next()
}

// ✅ Correct: protect only the listed prefixes
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROXY_MATCHER = [
  '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  '/(api|trpc)(.*)',
] as const

function isProtectedPath(pathname: string): boolean {
  return (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/api/private')
  )
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const hasSession = request.cookies.get('session') !== undefined

  if (isProtectedPath(pathname) && !hasSession) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: PROXY_MATCHER,
}
```

## Protected-first

Internal tools: block everything, allow a short public list.

```typescript
// ❌ Incorrect: block every path — sign-in is unreachable
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.get('session') !== undefined

  if (!hasSession) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  return NextResponse.next()
}

// ✅ Correct: allow the public list, protect the rest
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROXY_MATCHER = [
  '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  '/(api|trpc)(.*)',
] as const

function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/sign-up') ||
    pathname.startsWith('/api/public')
  )
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const hasSession = request.cookies.get('session') !== undefined

  if (!isPublicPath(pathname) && !hasSession) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: PROXY_MATCHER,
}
```

## Not the only gate

A matcher that covers pages does not cover every `'use server'` call. Check
the session again inside the action or route handler before you mutate.

```typescript
// ❌ Incorrect: action trusts that proxy already ran
'use server'

export async function deleteInvoice(invoiceId: string) {
  await database.invoice.delete({ where: { id: invoiceId } })
}

// ✅ Correct: session check lives in the action
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function deleteInvoice(invoiceId: string) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value

  if (sessionToken === undefined) {
    redirect('/sign-in')
  }

  await database.invoice.delete({ where: { id: invoiceId } })
}
```
