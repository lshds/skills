# File Conventions

Prefer one special file per role and `await` on `params` / `searchParams` over
sync params, so only `page` / `route` publish a URL and dynamic data is ready
before render. Trust required segments, narrow `searchParams`, and call
`notFound()` / `redirect()` as statements.

## One role per file

Only special filenames become routes or segment UI. Other files in the same
folder are colocated modules — they are not URLs.

```tsx
// ❌ Incorrect: move a colocated helper out of app/ — it was never a route
// lib/format-price.ts (relocated only because it lived under app/)
export function formatPrice(amountInCents: number) {
  return `$${(amountInCents / 100).toFixed(2)}`
}

// ✅ Correct: page.tsx owns /products/[id]; the helper sits beside it
// app/products/[id]/page.tsx
// app/products/[id]/format-price.ts
export function formatPrice(amountInCents: number) {
  return `$${(amountInCents / 100).toFixed(2)}`
}
```

- If the repo already keeps shared helpers in `lib/`, put new shared helpers
  there — don’t invent a second home.
- Prefix a folder with `_` when it should not be a route segment
  (`app/products/[id]/_lib/format-price.ts`).
- `layout.tsx` wraps the segment.
- `page.tsx` is the route UI.
- `loading.tsx` is the Suspense fallback for the segment.
- `error.tsx` is the error UI.
- `not-found.tsx` is the 404 UI.
- `route.ts` is the HTTP handler.
- `template.tsx` remounts on navigation.
- `default.tsx` fills an empty parallel slot.

## Await `params` and `searchParams`

`params` and `searchParams` are Promises. Await them before you read fields.

```tsx
// ❌ Incorrect: read params as a plain object
interface ProductPageProps {
  params: { id: string }
}

export default function ProductPage({ params }: ProductPageProps) {
  const productId = params.id

  return <h1>{productId}</h1>
}

// ✅ Correct: await the Promise
import { notFound } from 'next/navigation'

interface ProductPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ProductPage({
  params,
  searchParams,
}: ProductPageProps) {
  const [{ id: productId }, { tab: rawTab }] = await Promise.all([
    params,
    searchParams,
  ])

  const selectedTab = typeof rawTab === 'string' ? rawTab : 'overview'

  const product = await fetchProductById(productId)

  if (!product) {
    notFound()
  }

  return (
    <article>
      <h1>{product.name}</h1>
      <p>{selectedTab}</p>
    </article>
  )
}
```

## Trust required segments; guard `searchParams`

A required dynamic segment (`[id]`, `[slug]`) only matches a non-empty
string, so re-checking it adds a dead branch. `searchParams` come from the
caller: any key can be missing or repeated (`?tab=a&tab=b` gives an array).

```tsx
// ❌ Incorrect: re-checks a required segment; types a query value as a single string
import { notFound } from 'next/navigation'

interface OrderPageProps {
  params: Promise<{ orderId: string }>
  searchParams: Promise<{ view?: string }>
}

export default async function OrderPage({
  params,
  searchParams,
}: OrderPageProps) {
  const [{ orderId }, { view: orderView }] = await Promise.all([
    params,
    searchParams,
  ])

  if (!orderId) {
    notFound()
  }

  const order = await fetchOrderById(orderId)

  if (!order) {
    notFound()
  }

  return <OrderSummary order={order} view={orderView ?? 'summary'} />
}

// ✅ Correct: trust the segment; narrow the query value before use
import { notFound } from 'next/navigation'

interface OrderPageProps {
  params: Promise<{ orderId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function OrderPage({
  params,
  searchParams,
}: OrderPageProps) {
  const [{ orderId }, { view: rawView }] = await Promise.all([
    params,
    searchParams,
  ])

  const orderView = typeof rawView === 'string' ? rawView : 'summary'

  const order = await fetchOrderById(orderId)

  if (!order) {
    notFound()
  }

  return <OrderSummary order={order} view={orderView} />
}
```

- Only an optional catch-all (`[[...slug]]`) can be missing — its param is
  `string[] | undefined`. A catch-all (`[...slug]`) is a non-empty `string[]`.
- A required segment is present, not validated. Parse its format (number,
  UUID) before a lookup that throws on bad input, and call `notFound()` when
  it does not parse — otherwise `/orders/abc` becomes a 500 instead of a 404.

## `notFound()` and `redirect()` end the render

Both return `never` and throw internally. `return notFound()` reads as if a
value comes back, and a follow-up `?.` or re-check guards a state TypeScript
already ruled out.

```tsx
// ❌ Incorrect: return in front of notFound(); optional chain after the guard
import { notFound } from 'next/navigation'

interface InvoicePageProps {
  params: Promise<{ invoiceId: string }>
}

export default async function InvoicePage({ params }: InvoicePageProps) {
  const { invoiceId } = await params

  const invoice = await fetchInvoiceById(invoiceId)

  if (!invoice) {
    return notFound()
  }

  return <h1>{invoice?.number}</h1>
}

// ✅ Correct: call notFound() as a statement; TypeScript narrows invoice after it
import { notFound } from 'next/navigation'

interface InvoicePageProps {
  params: Promise<{ invoiceId: string }>
}

export default async function InvoicePage({ params }: InvoicePageProps) {
  const { invoiceId } = await params

  const invoice = await fetchInvoiceById(invoiceId)

  if (!invoice) {
    notFound()
  }

  return <h1>{invoice.number}</h1>
}
```

- Call `redirect()` / `notFound()` outside `try` / `catch` — a surrounding
  `catch` swallows the navigation.

## Thin layouts

Add a `layout.tsx` only when the segment shares chrome (nav, shell). Nested
layouts that only pass `children` through add work for no UI.

```tsx
// ❌ Incorrect: passthrough layout with no shared chrome
import type { ReactNode } from 'react'

interface SettingsLayoutProps {
  children: ReactNode
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return children
}

// ✅ Correct: layout owns shared chrome
import type { ReactNode } from 'react'

interface SettingsLayoutProps {
  children: ReactNode
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <div>
      <nav>
        <a href="/settings/profile">Profile</a>
        <a href="/settings/billing">Billing</a>
      </nav>
      {children}
    </div>
  )
}
```

## Root layout

The root `layout.tsx` sets `html`, `lang`, and default `metadata`. Load a font
with `next/font` when the app does not already set one.

```tsx
// ❌ Incorrect: body only — missing html, lang, and default metadata
import type { ReactNode } from 'react'

interface RootLayoutProps {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return <body>{children}</body>
}

// ✅ Correct: html lang, metadata, and font on the root
import { Inter } from 'next/font/google'
import type { ReactNode } from 'react'

const interFont = Inter({ subsets: ['latin'] })

export const metadata = {
  title: { default: 'Catalog', template: '%s | Catalog' },
  description: 'Product catalog',
}

interface RootLayoutProps {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className={interFont.className}>{children}</body>
    </html>
  )
}
```
