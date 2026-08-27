# Authorization

Check that the caller may act on this resource on every request.
Authentication alone does not stop IDOR or mass assignment.

## Auth inside handlers and Server Actions

Exported mutation handlers, route functions, and `"use server"` actions are public entry points. Call authn + authz **inside** each one before mutate — middleware, layouts, or page guards alone are not enough.

```typescript
// ❌ Incorrect: no auth gate inside the handler / action
export async function deleteUser(userId: string) {
  await database.user.delete({ where: { id: userId } })
}

// ✅ Correct: authn + authz inside before mutate
export async function deleteUser(userId: string) {
  await assertCanDeleteUser(userId)

  await database.user.delete({ where: { id: userId } })
}
```

Same rule for Express/Fastify route handlers and Next.js Server Actions — gate in the exported function body.

## Next.js middleware is not the authz boundary

`middleware.ts` / `proxy` matchers protect navigations and some route handlers, but **Server Actions**, route handlers outside the matcher, and direct `"use server"` calls can still run without that gate. Treat middleware as defense-in-depth for pages — not as the only check.

```typescript
// ❌ Incorrect: auth only in middleware — Server Action still callable without the gate
// middleware.ts
export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('session')

  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}

// app/actions.ts — not covered by trusting middleware alone
export async function deleteOrder(orderId: string) {
  await database.order.delete({ where: { id: orderId } })
}

// ✅ Correct: authn + authz inside the Server Action (middleware may still redirect UI)
export async function deleteOrder(orderId: string) {
  await assertCanDeleteOrder(orderId)

  await database.order.delete({ where: { id: orderId } })
}
```

- Matcher gaps (`/api/*`, Server Actions, RSC mutations) mean middleware-only checks leave sinks open.
- Vite SPAs have no Next middleware — put the same checks on the API/BFF handlers the client calls.

## Object-level access

Fetching by ID without scoping to the caller lets any authenticated user read another user's resources.

```typescript
// ❌ Incorrect: IDOR — any authed user can read any order
app.get('/api/orders/:id', requireAuth, async (request, response) => {
  const order = await database.order.findUnique({
    where: { id: request.params.id },
  })
  response.json(order)
})

// ✅ Correct: scope query to caller's ownership
app.get('/api/orders/:id', requireAuth, async (request, response) => {
  const order = await database.order.findFirst({
    where: { id: request.params.id, userId: request.user.id },
  })

  if (!order) {
    return response.sendStatus(404)
  }

  response.json(order)
})
```

## Mass assignment

Spreading `request.body` onto privileged fields lets clients set `role`, `isAdmin`, or ownership flags.

```typescript
import { z } from 'zod'

// ❌ Incorrect: mass assignment — client sets role / isAdmin via body
app.patch('/api/users/:id', requireAuth, async (request, response) => {
  const user = await database.user.update({
    where: { id: request.params.id },
    data: { ...request.body },
  })
  response.json(user)
})

// ✅ Correct: allowlist patch fields; deny by default for privileged keys
const updateUserSchema = z.object({
  displayName: z.string().min(1).max(80),
  // role / isAdmin intentionally omitted
})

app.patch('/api/users/:id', requireAuth, async (request, response) => {
  const isSelf = request.params.id === request.user.id

  if (!isSelf && !request.user.isAdmin) {
    return response.sendStatus(403)
  }

  const userUpdate = updateUserSchema.parse(request.body)
  const user = await database.user.update({
    where: { id: request.params.id },
    data: userUpdate,
  })

  response.json(user)
})
```

- Deny by default — never trust client-supplied roles or ownership flags.
- Apply the same object-level check on update and delete, not only on read.
