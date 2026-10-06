# Route Handlers

Prefer awaiting `params` from the generated `RouteContext`, checking the
session before any write, and returning the status that matches the outcome
over sync params and a blanket 403 or 200, so callers can tell signed-out,
forbidden, missing, and created apart. Every failure goes through the repo's
error envelope. The full status vocabulary, pagination, and envelope design
belong to the HTTP contract surface; this file covers only the statuses that
follow from the session and the lookup.

## Use the repo's error envelope

A handler that returns `{ error: 'Unauthorized' }` next to one that returns
`{ message: 'Not found' }` gives clients two body shapes to parse for one API.
Define the envelope once and send every failure through it.

```typescript
// ✅ Correct: one helper owns the error body; handlers pass status, code, and message
// lib/http-errors.ts
import { NextResponse } from 'next/server'

export function buildErrorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status })
}
```

- When the repo already has an envelope helper, call it — `buildErrorResponse`
  in this file stands in for it. Don't hand-write an error body per handler.
- `getSession()` below stands for the repo's session helper (the session or
  `null`), and `database` for its data client. Use the ones the app has; don't
  add a second auth library.

## Await `params` from `RouteContext`

Dynamic segments arrive as a Promise; a sync `{ params: { id: string } }` type
reads it as a plain object and gets `undefined`.

- Type the second argument with the generated
  `RouteContext<'/api/products/[id]'>` and `await routeContext.params` before
  the query, as every handler below does. A repo that hand-writes
  `{ params: Promise<{ id: string }> }` keeps it until the user approves the
  migration.
- Return 404 through the envelope when the row is missing — `200 null` hides
  the miss from the caller.

## 401 vs 403

401 means there is no session. 403 means there is a session that may not do
this. One 403 for both tells a signed-out caller "no permission" instead of
"sign in".

```typescript
// ❌ Incorrect: one 403 for both cases — a signed-out caller never gets a sign-in prompt
import { NextResponse } from 'next/server'

export async function POST() {
  const session = await getSession()

  if (!session || session.role !== 'admin') {
    return buildErrorResponse(403, 'forbidden', 'Only admins can rebuild reports')
  }

  const salesReport = await rebuildSalesReport()

  return NextResponse.json(salesReport)
}

// ✅ Correct: 401 without a session, 403 for a signed-in caller without the role
import { NextResponse } from 'next/server'

export async function POST() {
  const session = await getSession()

  if (!session) {
    return buildErrorResponse(401, 'unauthenticated', 'Sign in to rebuild reports')
  }

  if (session.role !== 'admin') {
    return buildErrorResponse(403, 'forbidden', 'Only admins can rebuild reports')
  }

  const salesReport = await rebuildSalesReport()

  return NextResponse.json(salesReport)
}
```

## Scope the query to the session owner

A matching URL param is not proof of access. Put the owner in the query so
another user's id reads as missing instead of returning their row.

```typescript
// ❌ Incorrect: loads by URL id alone — any signed-in caller can read another user's project
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  routeContext: RouteContext<'/api/projects/[id]'>,
) {
  const session = await getSession()

  if (!session) {
    return buildErrorResponse(401, 'unauthenticated', 'Sign in to view projects')
  }

  const { id: projectId } = await routeContext.params
  const project = await database.project.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    return buildErrorResponse(404, 'not_found', 'Project not found')
  }

  return NextResponse.json(project)
}

// ✅ Correct: the session owner is part of the where — another user's id is a 404
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  routeContext: RouteContext<'/api/projects/[id]'>,
) {
  const session = await getSession()

  if (!session) {
    return buildErrorResponse(401, 'unauthenticated', 'Sign in to view projects')
  }

  const { id: projectId } = await routeContext.params
  const project = await database.project.findFirst({
    where: { id: projectId, ownerId: session.userId },
  })

  if (!project) {
    return buildErrorResponse(404, 'not_found', 'Project not found')
  }

  return NextResponse.json(project)
}
```

- When the URL names a tenant (`/api/organizations/[orgId]`), compare it to
  `session.organizationId` and return 403 on a mismatch before loading
  anything.
- Writes follow the same rule: check the session and scope `update` /
  `delete` to the owner before mutating.

## Create returns 201 with `Location`

A 200 on create hides whether a row was inserted and where it lives. Return
201 with a `Location` header that points at the new resource.

```typescript
// ❌ Incorrect: 200 with no Location — the client cannot tell a create from an update or find the new row
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const session = await getSession()

  if (!session) {
    return buildErrorResponse(401, 'unauthenticated', 'Sign in to create products')
  }

  const productTitle = readProductTitle(await request.json())

  if (!productTitle) {
    return buildErrorResponse(400, 'invalid_body', 'A product title is required')
  }

  const product = await database.product.create({
    data: { title: productTitle, ownerId: session.userId },
  })

  return NextResponse.json(product)
}

// ✅ Correct: 201 plus a Location header for the new product
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const session = await getSession()

  if (!session) {
    return buildErrorResponse(401, 'unauthenticated', 'Sign in to create products')
  }

  const productTitle = readProductTitle(await request.json())

  if (!productTitle) {
    return buildErrorResponse(400, 'invalid_body', 'A product title is required')
  }

  const product = await database.product.create({
    data: { title: productTitle, ownerId: session.userId },
  })

  return NextResponse.json(product, {
    status: 201,
    headers: { Location: `/api/products/${product.id}` },
  })
}
```

- `readProductTitle` stands for the repo's body validation: it returns the
  title when the body has a non-empty string `title`, otherwise `undefined`.
