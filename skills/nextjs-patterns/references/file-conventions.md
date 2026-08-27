# File Conventions

Prefer one special file per role and `await` on `params` / `searchParams` over
sync params, so only `page` / `route` publish a URL and dynamic data is ready
before render.

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
  searchParams: Promise<{ tab?: string }>
}

export default async function ProductPage({
  params,
  searchParams,
}: ProductPageProps) {
  const [{ id: productId }, { tab: selectedTab }] = await Promise.all([
    params,
    searchParams,
  ])

  const product = await fetchProductById(productId)

  if (product === null) {
    notFound()
  }

  return (
    <article>
      <h1>{product.name}</h1>
      <p>{selectedTab ?? 'overview'}</p>
    </article>
  )
}
```

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
