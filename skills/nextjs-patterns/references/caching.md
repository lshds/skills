# Caching

Prefer `'use cache'` with the user or tenant id as an argument over an unscoped
tag, so one caller’s payload cannot be reused for the next.

## Scope the cache to the user

The cache key is derived from the function arguments. If `userId` is not an
argument, one user’s payload can be reused for the next.

```typescript
// ❌ Incorrect: cached profile with no user argument — shared across requests
import { cacheTag } from 'next/cache'

async function fetchProfile() {
  'use cache'
  cacheTag('profile')

  return database.profile.findFirst()
}

// ✅ Correct: userId is an argument and a tag
import { cacheLife, cacheTag } from 'next/cache'

async function fetchProfileByUserId(userId: string) {
  'use cache'
  cacheTag(`user-${userId}`)
  cacheLife({ revalidate: 60 })

  return database.profile.findUnique({ where: { id: userId } })
}

// profile-page.tsx — pass the session userId into the cached function
import { cookies } from 'next/headers'

export default async function ProfilePage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value

  if (sessionToken === undefined) {
    return <p>Not signed in</p>
  }

  const session = await getSession(sessionToken)

  const profile = await fetchProfileByUserId(session.userId)

  return <p>{profile?.name}</p>
}
```

## Invalidate after a write

In a Server Action, `updateTag` so the next read sees the write. In a route
handler, `revalidateTag(tag, 'max')`.

```typescript
// ❌ Incorrect: update the row and leave the tagged cache stale
'use server'

export async function updateProfile(formData: FormData) {
  const session = await requireSession()

  const profileName = readProfileNameFromForm(formData)

  if (profileName === undefined) {
    return { kind: 'error', message: 'Name is required' }
  }

  await database.profile.update({
    where: { id: session.userId },
    data: { name: profileName },
  })
}

// ✅ Correct: updateTag in the action with the same user tag
'use server'

import { updateTag } from 'next/cache'

type UpdateProfileResult =
  | { kind: 'ok' }
  | { kind: 'error'; message: string }

export async function updateProfile(
  formData: FormData,
): Promise<UpdateProfileResult> {
  const session = await requireSession()

  const profileName = readProfileNameFromForm(formData)

  if (profileName === undefined) {
    return { kind: 'error', message: 'Name is required' }
  }

  await database.profile.update({
    where: { id: session.userId },
    data: { name: profileName },
  })
  updateTag(`user-${session.userId}`)

  return { kind: 'ok' }
}

function readProfileNameFromForm(formData: FormData) {
  const profileName = formData.get('name')

  if (typeof profileName !== 'string' || profileName.length === 0) {
    return
  }

  return profileName
}

// ❌ Incorrect: route handler writes and leaves the tag warm
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const session = await requireSession()

  const requestBody: unknown = await request.json()

  await saveProfileForUser(session.userId, requestBody)

  return NextResponse.json({ ok: true })
}

// ✅ Correct: revalidateTag in the route handler after the write
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const session = await requireSession()

  const requestBody: unknown = await request.json()

  await saveProfileForUser(session.userId, requestBody)
  revalidateTag(`user-${session.userId}`, 'max')

  return NextResponse.json({ ok: true })
}
```

## Tenant scope

Org-wide reads take `organizationId` the same way — argument plus tag.

```typescript
// ❌ Incorrect: org list cached with a shared tag — tenants share one payload
import { cacheLife, cacheTag } from 'next/cache'

async function fetchInvoices() {
  'use cache'
  cacheTag('invoices')
  cacheLife({ revalidate: 300 })

  return database.invoice.findMany()
}

// ✅ Correct: organizationId is an argument and a tag
import { cacheLife, cacheTag } from 'next/cache'

async function fetchInvoicesByOrganizationId(organizationId: string) {
  'use cache'
  cacheTag(`org-${organizationId}`)
  cacheLife({ revalidate: 300 })

  return database.invoice.findMany({ where: { organizationId } })
}
```

- If the repo already wraps reads in `unstable_cache`, keep that helper and put
  the user or tenant id in `keyParts` and `tags`. Don’t add a second cache API
  beside it.
