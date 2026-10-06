# Streaming

Prefer a fast shell with each slow read in its own async child behind
`<Suspense>` over a page that awaits every fetch, so the header paints before
the slow call finishes. Use `loading.tsx` for the segment's first paint and
inline `<Suspense>` for islands; remount an island with `key` when its filters
change.

## `loading.tsx` for the segment, Suspense for slow islands

`loading.tsx` wraps the whole segment, so a page that awaits every call shows
the segment skeleton until the slowest one finishes. Move each slow read into
the child that renders it and give that child its own boundary.

```tsx
// ❌ Incorrect: the page awaits reviews with the product — only loading.tsx shows until reviews finish
import { notFound } from 'next/navigation'

export default async function ProductPage({
  params,
}: PageProps<'/products/[id]'>) {
  const { id: productId } = await params
  const [product, productReviews] = await Promise.all([
    fetchProductById(productId),
    fetchReviewsByProductId(productId),
  ])

  if (!product) {
    notFound()
  }

  return (
    <article>
      <h1>{product.name}</h1>
      <ReviewList productReviews={productReviews} />
    </article>
  )
}

// ✅ Correct: loading.tsx covers the segment's first paint; reviews stream in their own island
// app/products/[id]/loading.tsx
export default function ProductLoading() {
  return <ProductSkeleton />
}

// app/products/[id]/page.tsx
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

interface ProductReviewsProps {
  productId: string
}

export default async function ProductPage({
  params,
}: PageProps<'/products/[id]'>) {
  const { id: productId } = await params
  const product = await fetchProductById(productId)

  if (!product) {
    notFound()
  }

  return (
    <article>
      <h1>{product.name}</h1>
      <Suspense fallback={<ReviewListSkeleton />}>
        <ProductReviews productId={productId} />
      </Suspense>
    </article>
  )
}

async function ProductReviews({ productId }: ProductReviewsProps) {
  const productReviews = await fetchReviewsByProductId(productId)

  return <ReviewList productReviews={productReviews} />
}
```

- Give each independent island its own `<Suspense>` so one slow panel does not
  hold the others.

## Remount the island with `key` when filters change

A new search string on the same page keeps the already revealed boundary, so
the previous results stay on screen while the new ones load. A `key` built from
the filters remounts the boundary and shows the fallback again.

```tsx
// ❌ Incorrect: no key — the previous category's products stay on screen while the new filter loads
import { Suspense } from 'react'

export default async function ProductsPage({
  searchParams,
}: PageProps<'/products'>) {
  const { category: rawCategory } = await searchParams
  const selectedCategory =
    typeof rawCategory === 'string' ? rawCategory : 'all'

  return (
    <Suspense fallback={<ProductListSkeleton />}>
      <ProductList selectedCategory={selectedCategory} />
    </Suspense>
  )
}

// ✅ Correct: key on the boundary remounts the island, so the fallback shows for each new filter
import { Suspense } from 'react'

interface ProductListProps {
  selectedCategory: string
}

export default async function ProductsPage({
  searchParams,
}: PageProps<'/products'>) {
  const { category: rawCategory } = await searchParams
  const selectedCategory =
    typeof rawCategory === 'string' ? rawCategory : 'all'

  return (
    <Suspense key={selectedCategory} fallback={<ProductListSkeleton />}>
      <ProductList selectedCategory={selectedCategory} />
    </Suspense>
  )
}

async function ProductList({ selectedCategory }: ProductListProps) {
  const products = await fetchProductsByCategory(selectedCategory)

  return (
    <ul>
      {products.map((product) => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
  )
}
```

- Build the key from every filter the island reads (category and page, for
  example); a filter left out of the key keeps stale results when only it
  changes.
