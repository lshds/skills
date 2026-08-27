# Metadata

Prefer `generateMetadata` and `notFound()` over a hard-coded title, so each
page’s title and Open Graph match the record the user opened.

## `generateMetadata`

Static `metadata` on the layout is the default. Override per page from the
same data the page already loads.

```tsx
// ❌ Incorrect: hard-coded title that ignores the product
export const metadata = {
  title: 'Product',
}

interface ProductPageProps {
  params: Promise<{ slug: string }>
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug: productSlug } = await params

  const product = await fetchProductBySlug(productSlug)

  return <h1>{product?.name}</h1>
}

// ✅ Correct: generateMetadata + notFound when missing
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

interface ProductPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug: productSlug } = await params

  const product = await fetchProductBySlug(productSlug)

  if (product === null) {
    return {}
  }

  return {
    title: product.name,
    description: product.summary,
    openGraph: {
      title: product.name,
      description: product.summary,
      images: [{ url: product.imageUrl, width: 1200, height: 630 }],
    },
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug: productSlug } = await params

  const product = await fetchProductBySlug(productSlug)

  if (product === null) {
    notFound()
  }

  return <h1>{product.name}</h1>
}
```

## `generateStaticParams`

List the slugs you want at build time. The page still `await`s `params` and
calls `notFound()` for an unknown slug.

```tsx
// ❌ Incorrect: no static params — every slug waits until request time
interface ProductPageProps {
  params: Promise<{ slug: string }>
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug: productSlug } = await params

  const product = await fetchProductBySlug(productSlug)

  return <h1>{product?.name}</h1>
}

// ✅ Correct: known slugs at build time; page still awaits params and 404s unknowns
import { notFound } from 'next/navigation'

export async function generateStaticParams() {
  const products = await database.product.findMany({
    select: { slug: true },
  })

  return products.map((product) => ({ slug: product.slug }))
}

interface ProductPageProps {
  params: Promise<{ slug: string }>
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug: productSlug } = await params

  const product = await fetchProductBySlug(productSlug)

  if (product === null) {
    notFound()
  }

  return <h1>{product.name}</h1>
}
```

## Open Graph image file

A sibling `opengraph-image.tsx` (or `.png`) becomes the OG image for that
segment when you do not pass `openGraph.images` in metadata.

```tsx
// ❌ Incorrect: one static image for every product
export const metadata = {
  openGraph: {
    images: [{ url: '/og.png', width: 1200, height: 630 }],
  },
}

// ✅ Correct: opengraph-image.tsx reads the same slug as the page
import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

interface OpenGraphImageProps {
  params: Promise<{ slug: string }>
}

export default async function OpenGraphImage({
  params,
}: OpenGraphImageProps) {
  const { slug: productSlug } = await params

  const product = await fetchProductBySlug(productSlug)

  const imageTitle = product?.name ?? 'Catalog'

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          height: '100%',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 64,
        }}
      >
        {imageTitle}
      </div>
    ),
    size,
  )
}
```
