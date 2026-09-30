# Server vs Client

Prefer Server Components for data, secrets, and first paint over
`'use client'` on the page, so the browser only loads the leaves that need
hooks or events. Server code calls data functions directly and guards its
modules with `server-only`.

## Default to the server

A file without `'use client'` is a Server Component. It can be async and can
read cookies, headers, and secrets. It cannot use `useState`, `useEffect`, or
click handlers.

```tsx
// ❌ Incorrect: Client Component just to render fetched data
'use client'

import { useEffect, useState } from 'react'

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    void fetch('/api/products')
      .then((response) => response.json())
      .then(setProducts)
  }, [])

  return (
    <ul>
      {products.map((product) => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
  )
}

// ✅ Correct: async Server Component fetches on the server
export default async function ProductsPage() {
  const products = await fetchProducts()

  return (
    <ul>
      {products.map((product) => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
  )
}
```

## `'use client'` only for interactivity

Mark the smallest leaf that needs the browser — not the page.

```tsx
// ❌ Incorrect: whole page is a Client Component for one button
'use client'

interface ProductPageProps {
  product: Product
}

export default function ProductPage({ product }: ProductPageProps) {
  const handleAddToCart = () => {
    void addToCart(product.id)
  }

  return (
    <article>
      <h1>{product.name}</h1>
      <button type="button" onClick={handleAddToCart}>
        Add to cart
      </button>
    </article>
  )
}

// ✅ Correct: server page + client leaf
import { notFound } from 'next/navigation'

import { AddToCartButton } from './add-to-cart-button'

interface ProductPageProps {
  params: Promise<{ id: string }>
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id: productId } = await params

  const product = await fetchProductById(productId)

  if (!product) {
    notFound()
  }

  return (
    <article>
      <h1>{product.name}</h1>
      <AddToCartButton productId={product.id} />
    </article>
  )
}

// add-to-cart-button.tsx
'use client'

import { addToCart } from './actions'

interface AddToCartButtonProps {
  productId: string
}

export function AddToCartButton({ productId }: AddToCartButtonProps) {
  const handleAddToCart = () => {
    void addToCart(productId)
  }

  return (
    <button type="button" onClick={handleAddToCart}>
      Add to cart
    </button>
  )
}
```

## Server-only APIs stay on the server

`cookies`, `headers`, and `next/server` throw in the browser. Import them only
from Server Components, Server Actions, or route handlers.

```tsx
// ❌ Incorrect: cookies() inside a Client Component
'use client'

import { cookies } from 'next/headers'

export function SessionGreeting() {
  const sessionToken = cookies().get('session')?.value

  return <p>{sessionToken}</p>
}

// ✅ Correct: read cookies on the server, pass serializable props
import { cookies } from 'next/headers'

export default async function AccountPage() {
  const cookieStore = await cookies()

  const isSignedIn = cookieStore.has('session')

  return <p>{isSignedIn ? 'Signed in' : 'Signed out'}</p>
}
```

## Call the data function, not your own Route Handler

A Server Component already runs on the server. Fetching your own
`/api/...` adds an HTTP round trip, needs an absolute URL per environment, and
drops the typed return value.

```tsx
// ❌ Incorrect: Server Component calls its own Route Handler over HTTP
export default async function ProductsPage() {
  const response = await fetch(`${process.env.APP_URL}/api/products`)
  const products: Product[] = await response.json()

  return (
    <ul>
      {products.map((product) => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
  )
}

// ✅ Correct: call the same function the Route Handler uses
import { fetchProducts } from '@/lib/products'

export default async function ProductsPage() {
  const products = await fetchProducts()

  return (
    <ul>
      {products.map((product) => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
  )
}
```

- Keep the Route Handler for callers outside the server render: Client
  Components, webhooks, mobile apps, and third parties.

## `import 'server-only'` on server modules

A module that reads the database or a secret can end up in the client bundle
through one careless import. `import 'server-only'` turns that import into a
build error instead of shipped code.

```typescript
// ❌ Incorrect: nothing stops a Client Component from importing this module
import { database } from '@/lib/database'

export async function fetchOrdersForUser(userId: string) {
  return database.order.findMany({ where: { userId } })
}

// ✅ Correct: a client import now fails the build
import 'server-only'

import { database } from '@/lib/database'

export async function fetchOrdersForUser(userId: string) {
  return database.order.findMany({ where: { userId } })
}
```

- Next.js resolves `server-only` itself — install the package only if lint
  flags the import as an extraneous dependency.

## Serializable props

Values that cross the server→client boundary must be JSON-serializable — no
functions, classes, or `Date` instances unless you pass a string.

```tsx
// ❌ Incorrect: pass a class instance and a function into a client child
'use client'

interface InvoicePanelProps {
  invoice: Invoice
  onPaid: () => void
}

export function InvoicePanel({ invoice, onPaid }: InvoicePanelProps) {
  return (
    <button type="button" onClick={onPaid}>
      {invoice.total}
    </button>
  )
}

// ✅ Correct: pass plain data; the client calls a Server Action
'use client'

import { markInvoicePaid } from './actions'

interface InvoicePanelProps {
  invoiceId: string
  totalCents: number
}

export function InvoicePanel({ invoiceId, totalCents }: InvoicePanelProps) {
  const handleMarkInvoicePaid = () => {
    void markInvoicePaid(invoiceId)
  }

  return (
    <button type="button" onClick={handleMarkInvoicePaid}>
      {totalCents}
    </button>
  )
}
```
