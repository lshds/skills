# Route Handlers

Prefer `await params` and the status that matches the failure over sync params
and a single 403, so callers get 401, 403, 404, or 201 for the real outcome.

## `await params`

Dynamic segments arrive as a Promise. Await before you query.

```typescript
// ❌ Incorrect: treat params as a sync object
import { NextResponse } from 'next/server'

interface ProductRouteContext {
  params: { id: string }
}

export async function GET(
  request: Request,
  routeContext: ProductRouteContext,
) {
  const productId = routeContext.params.id

  const product = await database.product.findUnique({
    where: { id: productId },
  })

  return NextResponse.json(product)
}

// ✅ Correct: await params, 404 when missing
import { NextResponse } from 'next/server'

interface ProductRouteContext {
  params: Promise<{ id: string }>
}

export async function GET(
  request: Request,
  routeContext: ProductRouteContext,
) {
  const { id: productId } = await routeContext.params

  const product = await database.product.findUnique({
    where: { id: productId },
  })

  if (product === null) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(product)
}
```

## 401 vs 403

401 means no session. 403 means there is a session that may not do this.

```typescript
// ❌ Incorrect: 403 for a signed-out caller
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function DELETE() {
  const cookieStore = await cookies()
  const hasSession = cookieStore.get('session') !== undefined

  if (!hasSession) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ ok: true })
}

// ✅ Correct: 401 unsigned, 403 signed-in without permission
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function DELETE() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value

  if (sessionToken === undefined) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const session = await getSession(sessionToken)

  const isAdmin = session.role === 'admin'

  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ ok: true })
}
```

## Ownership

Scope the query to the session owner. A matching URL param is not proof.

```typescript
// ❌ Incorrect: trust the URL orgId — any signed-in caller can read another org
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

interface OrganizationRouteContext {
  params: Promise<{ orgId: string }>
}

export async function GET(
  request: Request,
  routeContext: OrganizationRouteContext,
) {
  const { orgId: requestedOrganizationId } = await routeContext.params

  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value

  if (sessionToken === undefined) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const organization = await database.organization.findUnique({
    where: { id: requestedOrganizationId },
  })

  return NextResponse.json(organization)
}

// ✅ Correct: compare the session org to the URL, then load that org
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

interface OrganizationRouteContext {
  params: Promise<{ orgId: string }>
}

export async function GET(
  request: Request,
  routeContext: OrganizationRouteContext,
) {
  const [{ orgId: requestedOrganizationId }, cookieStore] = await Promise.all([
    routeContext.params,
    cookies(),
  ])

  const sessionToken = cookieStore.get('session')?.value

  if (sessionToken === undefined) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const session = await getSession(sessionToken)

  const isSameOrganization = session.organizationId === requestedOrganizationId

  if (!isSameOrganization) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const organization = await database.organization.findUnique({
    where: { id: session.organizationId },
  })

  if (organization === null) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(organization)
}
```

## Create returns 201

A 200 on create hides whether the row was inserted. Return 201 plus `Location`
so the client can tell insert from update.

```typescript
// ❌ Incorrect: 200 on create — the client cannot tell insert from update
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const session = await requireSession()

  const requestBody: unknown = await request.json()
  const productTitle = readProductTitleFromBody(requestBody)

  const product = await database.product.create({
    data: { title: productTitle, ownerId: session.userId },
  })

  return NextResponse.json(product)
}

// ✅ Correct: 201 after a successful create
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value

  if (sessionToken === undefined) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const requestBody: unknown = await request.json()
  const productTitle = readProductTitleFromBody(requestBody)

  if (productTitle === undefined) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const session = await getSession(sessionToken)

  const product = await database.product.create({
    data: { title: productTitle, ownerId: session.userId },
  })

  return NextResponse.json(product, { status: 201 })
}

function readProductTitleFromBody(requestBody: unknown) {
  if (
    typeof requestBody !== 'object' ||
    requestBody === null ||
    !('title' in requestBody)
  ) {
    return
  }

  if (typeof requestBody.title !== 'string' || requestBody.title.length === 0) {
    return
  }

  return requestBody.title
}
```
