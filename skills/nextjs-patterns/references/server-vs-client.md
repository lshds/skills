# Server vs Client

Prefer async Server Components for data, secrets, and first paint, with
`'use client'` only on the leaf that needs hooks, events, or browser APIs, so
the browser downloads only the interactive parts. Server code calls data
functions directly, keeps request APIs out of client files, and guards server
modules with `server-only`.

## `'use client'` only on the interactive leaf

`'use client'` on the page ships the whole tree to the browser and moves the
data load behind an effect and an HTTP call. A Server Component can be async
and read data directly; only the button needs the browser.

```tsx
// ❌ Incorrect: the whole page is a Client Component for one button — products load after hydration through /api
'use client'

import { useEffect, useState } from 'react'

import { addToCart } from './actions'

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
        <li key={product.id}>
          {product.name}
          <button type="button" onClick={() => void addToCart(product.id)}>
            Add to cart
          </button>
        </li>
      ))}
    </ul>
  )
}

// ✅ Correct: async server page; only the button is a Client Component
// app/products/page.tsx
import { AddToCartButton } from './add-to-cart-button'

export default async function ProductsPage() {
  const products = await fetchProducts()

  return (
    <ul>
      {products.map((product) => (
        <li key={product.id}>
          {product.name}
          <AddToCartButton productId={product.id} />
        </li>
      ))}
    </ul>
  )
}

// app/products/add-to-cart-button.tsx
'use client'

import { addToCart } from './actions'

interface AddToCartButtonProps {
  productId: string
}

export function AddToCartButton({ productId }: AddToCartButtonProps) {
  return (
    <button type="button" onClick={() => void addToCart(productId)}>
      Add to cart
    </button>
  )
}
```

## Request APIs stay out of client files

`cookies()` and `headers()` from `next/headers` are server-only; importing them
in a `'use client'` file fails the build. Read or change them in a Server
Component, Server Action, or Route Handler.

```tsx
// ❌ Incorrect: a Client Component awaits cookies() — next/headers cannot run in the browser bundle
'use client'

import { cookies } from 'next/headers'

export function SignOutButton() {
  const handleSignOut = async () => {
    const cookieStore = await cookies()
    cookieStore.delete('session')
  }

  return (
    <button type="button" onClick={handleSignOut}>
      Sign out
    </button>
  )
}

// ✅ Correct: cookies() runs in a Server Action; the form posts to it without 'use client'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export function SignOutForm() {
  const signOut = async () => {
    'use server'
    const cookieStore = await cookies()
    cookieStore.delete('session')
    redirect('/sign-in')
  }

  return (
    <form action={signOut}>
      <button type="submit">Sign out</button>
    </form>
  )
}
```

## Call the data function, not your own Route Handler

A Server Component already runs on the server. Fetching your own
`/api/products` adds an HTTP round trip, needs an absolute URL per environment, and drops the
typed return value.

```tsx
// ❌ Incorrect: Server Component calls its own Route Handler over HTTP
export default async function ProductsPage() {
  const response = await fetch(`${process.env.APP_URL}/api/products`)
  const products = parseProducts(await response.json())

  return <ProductList products={products} />
}

// ✅ Correct: call the same function the Route Handler uses
import { fetchProducts } from '@/lib/products'

export default async function ProductsPage() {
  const products = await fetchProducts()

  return <ProductList products={products} />
}
```

- Keep the Route Handler for callers outside the server render: Client
  Components, webhooks, mobile apps, and third parties.

## `import 'server-only'` on server modules

A module that reads the database or a secret can reach the client bundle
through one careless import. `import 'server-only'` turns that import into a
build error instead of shipped code.

```typescript
// ✅ Correct: the first import makes any Client Component import of this module fail the build
// lib/orders.ts
import 'server-only'

import { database } from '@/lib/database'

export async function fetchOrdersForUser(userId: string) {
  return database.order.findMany({ where: { userId } })
}
```

- Next.js resolves `server-only` itself — install the package only if lint
  flags the import as an extraneous dependency.

## Serializable props

Props that cross into a Client Component must be serializable: primitives,
plain objects, arrays, and Server Actions pass; class instances and ordinary
functions do not.

```tsx
// ❌ Incorrect: a class instance and a callback cross the server→client boundary
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

// ✅ Correct: plain data crosses; the client calls a Server Action
'use client'

import { markInvoicePaid } from './actions'

interface InvoicePanelProps {
  invoiceId: string
  totalCents: number
}

export function InvoicePanel({ invoiceId, totalCents }: InvoicePanelProps) {
  return (
    <button type="button" onClick={() => void markInvoicePaid(invoiceId)}>
      {totalCents}
    </button>
  )
}
```
