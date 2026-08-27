# Server Actions

Prefer a session check inside the `'use server'` function over trusting the
layout or proxy, so a direct action call cannot mutate without auth.

## Check session inside the action

Layouts and proxy do not run for every action call. Read the session (repo
`getSession()` helper, or `cookies()`) at the top of the action.

```typescript
// ❌ Incorrect: mutate with no session check
'use server'

export async function createPost(formData: FormData) {
  const postTitle = readPostTitleFromForm(formData)

  if (postTitle === undefined) {
    return { kind: 'error', message: 'Title is required' }
  }

  await database.post.create({ data: { title: postTitle } })
}

// ✅ Correct: session first, then write
'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function createPost(formData: FormData) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value

  if (sessionToken === undefined) {
    redirect('/sign-in')
  }

  const postTitle = readPostTitleFromForm(formData)

  if (postTitle === undefined) {
    return { kind: 'error', message: 'Title is required' }
  }

  const session = await getSession(sessionToken)

  await database.post.create({
    data: { title: postTitle, authorId: session.userId },
  })
  revalidatePath('/posts')

  return { kind: 'ok' }
}

function readPostTitleFromForm(formData: FormData) {
  const postTitle = formData.get('title')

  if (typeof postTitle !== 'string' || postTitle.length === 0) {
    return
  }

  return postTitle
}
```

## `redirect` vs error result

Use `redirect()` when the caller has no session and the action came from a
form post. Return `{ kind: 'error', message }` when the UI should keep the
form and show a message.

```typescript
// ❌ Incorrect: throw on a recoverable cart failure — the form cannot show the message
'use server'

export async function addToCart(productId: string) {
  const session = await requireSession()

  await database.cart.upsert({
    where: {
      sessionId_productId: { sessionId: session.id, productId },
    },
    update: { quantity: { increment: 1 } },
    create: { sessionId: session.id, productId, quantity: 1 },
  })
}

// ✅ Correct: redirect when unsigned; return { kind: 'error' } for the UI
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

type AddToCartResult =
  | { kind: 'ok' }
  | { kind: 'error'; message: string }

export async function addToCart(productId: string): Promise<AddToCartResult> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value

  if (sessionToken === undefined) {
    redirect('/sign-in')
  }

  const session = await getSession(sessionToken)

  try {
    await database.cart.upsert({
      where: {
        sessionId_productId: { sessionId: session.id, productId },
      },
      update: { quantity: { increment: 1 } },
      create: { sessionId: session.id, productId, quantity: 1 },
    })

    return { kind: 'ok' }
  } catch {
    return { kind: 'error', message: 'Could not add the item to the cart' }
  }
}
```

## Authorize the resource

Signed-in is not enough. Confirm the caller may act on this row before delete
or update.

```typescript
// ❌ Incorrect: any signed-in user can delete any project
'use server'

export async function deleteProject(projectId: string) {
  await requireSession()

  await database.project.delete({ where: { id: projectId } })

  return { kind: 'ok' }
}

// ✅ Correct: ownership (or role) checked before mutate
'use server'

import { updateTag } from 'next/cache'

type DeleteProjectResult =
  | { kind: 'ok' }
  | { kind: 'error'; message: string }

export async function deleteProject(
  projectId: string,
): Promise<DeleteProjectResult> {
  const session = await requireSession()

  const project = await database.project.findUnique({
    where: { id: projectId },
  })

  const canDeleteProject =
    project !== null && project.ownerId === session.userId

  if (!canDeleteProject) {
    return { kind: 'error', message: 'You cannot delete this project' }
  }

  await database.project.delete({ where: { id: projectId } })
  updateTag(`user-${session.userId}`)

  return { kind: 'ok' }
}
```

- `requireSession()` is the repo’s helper if it exists — otherwise `cookies()`
  plus a lookup. Don’t invent a second auth library.
