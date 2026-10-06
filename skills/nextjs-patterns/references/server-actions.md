# Server Actions

Prefer reading the session and authorizing the row inside every `'use server'`
function over trusting the layout or proxy, so a direct POST to the action
cannot mutate without auth. Redirect when there is no session, return
`{ kind: 'error', message }` when the form should show the failure, and
invalidate the tag the read path caches with.

## Session and authorization inside the action

Every exported `'use server'` function is a public endpoint, and layouts and
proxy do not run for every call. Read the session, then scope the write to the
session owner so another user's id changes nothing.

```typescript
// ❌ Incorrect: no session check and an unscoped delete — anyone who can POST the action deletes any project
'use server'

export async function deleteProject(projectId: string) {
  await database.project.delete({ where: { id: projectId } })

  return { kind: 'ok' }
}

// ✅ Correct: session first; the owner is part of the delete; updateTag on the tag the list reads with
'use server'

import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'

type DeleteProjectResult = { kind: 'ok' } | { kind: 'error'; message: string }

export async function deleteProject(
  projectId: string,
): Promise<DeleteProjectResult> {
  const session = await getSession()

  if (!session) {
    redirect('/sign-in')
  }

  const { count: deletedCount } = await database.project.deleteMany({
    where: { id: projectId, ownerId: session.userId },
  })

  if (deletedCount === 0) {
    return { kind: 'error', message: 'You cannot delete this project' }
  }

  updateTag(`user-${session.userId}`)

  return { kind: 'ok' }
}
```

- `getSession()` stands for the repo's session helper (the session or `null`),
  and `database` for its data client. Use the ones the app has; don't add a
  second auth library.

## Invalidate the tag the read path uses

A write that leaves the cached read alone shows the author stale data on the
next render.

- Call `updateTag` with the tag the read path set (`cacheTag('posts')` →
  `updateTag('posts')`) so the next render reads the write. Use
  `revalidatePath` only when the repo invalidates by path.
- `refresh()` from `next/cache` refreshes the client router without
  invalidating cache entries; it does not replace `updateTag` when a cached
  read changed.

## `redirect()` vs an error result

`redirect()` fits a caller with no session — there is nothing to show until
they sign in. A recoverable failure should come back as a value so the form
stays and shows the message; a thrown error replaces the page with the error
boundary.

```typescript
// ❌ Incorrect: a failed insert throws — the error boundary replaces the form instead of showing a message
'use server'

import { redirect } from 'next/navigation'

export async function addToCart(productId: string) {
  const session = await getSession()

  if (!session) {
    redirect('/sign-in')
  }

  await database.cartItem.create({
    data: { userId: session.userId, productId },
  })
}

// ✅ Correct: redirect when signed out; return a typed error result the form can render
'use server'

import { redirect } from 'next/navigation'

type AddToCartResult = { kind: 'ok' } | { kind: 'error'; message: string }

export async function addToCart(productId: string): Promise<AddToCartResult> {
  const session = await getSession()

  if (!session) {
    redirect('/sign-in')
  }

  try {
    await database.cartItem.create({
      data: { userId: session.userId, productId },
    })
  } catch {
    return { kind: 'error', message: 'Could not add the item to the cart' }
  }

  return { kind: 'ok' }
}
```

- Keep `redirect()` outside the `try` — a surrounding `catch` swallows it.
