# Caching

Prefer `'use cache'` functions that take the user or tenant id as an argument
and tag with it over cached reads with no owner in the key, so one caller's
payload is never served to the next. Read cookies and headers outside the
cached scope and pass the ids in; invalidate with `updateTag` in Server
Actions and `revalidateTag(tag, 'max')` in Route Handlers. This applies once
`cacheComponents: true` is on; a repo still on `unstable_cache` keeps it.

## Scope the cache to the user or tenant

The cache key comes from the function's arguments. A cached read with no
`userId` argument stores one profile and serves it to every caller.

```tsx
// ❌ Incorrect: no user in the arguments — one cached profile is served to every caller
import { cacheTag } from 'next/cache'

async function fetchProfile() {
  'use cache'
  cacheTag('profile')

  return database.profile.findFirst()
}

// ✅ Correct: the session is read outside; userId is the argument and the tag
import { cacheLife, cacheTag } from 'next/cache'
import { redirect } from 'next/navigation'

async function fetchProfileByUserId(userId: string) {
  'use cache'
  cacheTag(`user-${userId}`)
  cacheLife({ revalidate: 60 })

  return database.profile.findUnique({ where: { id: userId } })
}

export default async function ProfilePage() {
  const session = await getSession()

  if (!session) {
    redirect('/sign-in')
  }

  const profile = await fetchProfileByUserId(session.userId)

  return <p>{profile?.name}</p>
}
```

- `getSession()` stands for the repo's session helper; it reads cookies, so it
  stays outside every `'use cache'` scope.
- Org-wide reads take `organizationId` the same way —
  `fetchInvoicesByOrganizationId(organizationId)` tagged
  `org-${organizationId}`. A no-argument `fetchInvoices()` tagged `'invoices'`
  serves one tenant's list to every tenant.
- Nested `'use cache'` functions that depend on root params (`next/root-params`):
  run 16.3.8+ (the September 2026 advisory fixed root params missing from
  nested cache keys) and pass the root-param value into the inner cached
  function as an argument.
- If the repo wraps reads in `unstable_cache` and has not turned on
  `cacheComponents`, keep that helper and put the user or tenant id in
  `keyParts` and `tags`. Don't add a second cache API beside it.

## `updateTag` in actions, `revalidateTag` in handlers

`revalidateTag(tag, 'max')` marks the entry stale and keeps serving it while
it refreshes, so in a Server Action the user who just acted sees the old
value. `updateTag` expires the tag so the next read sees the write.

```typescript
// ❌ Incorrect: revalidateTag in a Server Action — stale-while-revalidate still shows the unread badge
'use server'

import { revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'

export async function markNotificationsRead() {
  const session = await getSession()

  if (!session) {
    redirect('/sign-in')
  }

  await database.notification.updateMany({
    where: { userId: session.userId, readAt: null },
    data: { readAt: new Date() },
  })
  revalidateTag(`user-${session.userId}`, 'max')
}

// ✅ Correct: updateTag on the same user tag — the next render reads the write
'use server'

import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'

export async function markNotificationsRead() {
  const session = await getSession()

  if (!session) {
    redirect('/sign-in')
  }

  await database.notification.updateMany({
    where: { userId: session.userId, readAt: null },
    data: { readAt: new Date() },
  })
  updateTag(`user-${session.userId}`)
}
```

- `updateTag` is for Server Actions. A Route Handler that writes calls
  `revalidateTag(tag, 'max')` with the same tag after the write; the second
  argument is required on 16, and the single-argument form is the pre-16
  signature.

## Let `cacheComponents` own the cache story

`cacheComponents: true` replaces `experimental.dynamicIO` and `experimental.ppr`
(16). With it on, caching is decided by `'use cache'` scopes and their
`cacheLife`. Route segment config and `fetch` revalidate options are the
previous model; mixing them in gives one page two cache stories.

```tsx
// ❌ Incorrect: segment config plus fetch revalidate on a cacheComponents app — a second cache story beside 'use cache'
export const revalidate = 300

export default async function PricingPage() {
  const response = await fetch('https://billing.example.com/plans', {
    next: { revalidate: 300 },
  })
  const plans = parsePlans(await response.json())

  return <PlanTable plans={plans} />
}

// ✅ Correct: the read is a 'use cache' function with its own lifetime and tag
import { cacheLife, cacheTag } from 'next/cache'

async function fetchPlans(): Promise<Plan[]> {
  'use cache'
  cacheLife({ revalidate: 300 })
  cacheTag('plans')

  const response = await fetch('https://billing.example.com/plans')

  return parsePlans(await response.json())
}

export default async function PricingPage() {
  const plans = await fetchPlans()

  return <PlanTable plans={plans} />
}
```

- Don't add `export const dynamic`, `revalidate`, or `fetchCache` to a segment
  once `cacheComponents` is on.
- Plans are the same for everyone, so a shared `'plans'` tag is right; anything
  personalized follows the user / tenant rule above.

## When `'use cache: private'` is OK

The default stays: read `cookies()` / `headers()` / `searchParams` outside the
cached function and pass the values in as arguments.

- `'use cache: private'` (needs `cacheComponents`) is the exception for a
  cached scope that must read cookies or headers itself — compliance forbids
  storing the result server-side, or the code that reads them cannot be
  refactored to take arguments.
- Its results are never stored in the server cache, only in browser memory for
  the `cacheLife` `stale` time, and it runs on every server render — it saves
  no server work.
- It is not available in Route Handlers.
