# Metadata

Prefer `generateMetadata` that loads the record through the page's own loader
over a hard-coded `metadata` title, so the title and Open Graph tags match the
record the user opened. Call `notFound()` when the record is missing, in
metadata and page alike.

## `generateMetadata` from the page's data load

A static `title: 'Product'` labels every product the same in tabs, search
results, and link previews. Load the record with the loader the page uses,
deduplicated per request, and 404 when it is missing.

```tsx
// ❌ Incorrect: one hard-coded title for every product, and a missing slug renders an empty page
export const metadata = {
  title: 'Product',
}

export default async function ProductPage({
  params,
}: PageProps<'/products/[slug]'>) {
  const { slug: productSlug } = await params
  const product = await fetchProductBySlug(productSlug)

  return <h1>{product?.name}</h1>
}

// ✅ Correct: generateMetadata and the page share one deduplicated loader that 404s when missing
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'

const loadProduct = cache(async (productSlug: string) => {
  const product = await fetchProductBySlug(productSlug)

  if (!product) {
    notFound()
  }

  return product
})

export async function generateMetadata({
  params,
}: PageProps<'/products/[slug]'>): Promise<Metadata> {
  const { slug: productSlug } = await params
  const product = await loadProduct(productSlug)

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

export default async function ProductPage({
  params,
}: PageProps<'/products/[slug]'>) {
  const { slug: productSlug } = await params
  const product = await loadProduct(productSlug)

  return <h1>{product.name}</h1>
}
```

- Static `metadata` with a title template lives on the root layout; pages
  override it with `generateMetadata` only when the title depends on data.

## Known slugs and per-record images

These follow the same load: the record behind the URL drives the output.

- `generateStaticParams` lists the slugs to prerender at build time; the page
  still awaits `params` and calls `notFound()` for a slug the list did not
  include.
- A per-record Open Graph image comes from `openGraph.images` in
  `generateMetadata`, or from a sibling `opengraph-image.tsx` that awaits its
  `params` and loads the record by the same slug. One static image in the
  layout's `metadata` shows the same preview for every product.
