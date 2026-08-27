# Streaming

Prefer a fast shell plus `<Suspense>` around slow children over awaiting every
fetch in the page, so the header paints before the slow call finishes.

## Colocate the slow fetch

A parent that `await`s everything blocks the whole page. Move the slow read
into the child that renders it.

```tsx
// ❌ Incorrect: page awaits reviews before any markup
interface ProductPageProps {
  params: Promise<{ id: string }>
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id: productId } = await params

  const [product, productReviews] = await Promise.all([
    fetchProductById(productId),
    fetchReviewsByProductId(productId),
  ])

  return (
    <article>
      <h1>{product.name}</h1>
      <ReviewList productReviews={productReviews} />
    </article>
  )
}

// ✅ Correct: product is the shell; reviews stream in
import { Suspense } from 'react'
import { notFound } from 'next/navigation'

interface ProductPageProps {
  params: Promise<{ id: string }>
}

interface ProductReviewsProps {
  productId: string
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id: productId } = await params

  const product = await fetchProductById(productId)

  if (product === null) {
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

## `loading.tsx` vs inline Suspense

`loading.tsx` wraps the whole segment. Use it for the route’s first paint.
Use inline `<Suspense>` for islands that should stream after the shell.

```tsx
// ❌ Incorrect: page awaits every island — loading.tsx never gets a shell
interface OrderPageProps {
  params: Promise<{ id: string }>
}

export default async function OrderPage({ params }: OrderPageProps) {
  const { id: orderId } = await params

  const [order, orderEvents, orderNotes] = await Promise.all([
    fetchOrderById(orderId),
    fetchOrderEventsByOrderId(orderId),
    fetchOrderNotesByOrderId(orderId),
  ])

  return (
    <article>
      <h1>Order {order.number}</h1>
      <EventList orderEvents={orderEvents} />
      <NoteList orderNotes={orderNotes} />
    </article>
  )
}

// ✅ Correct: loading.tsx for the [id] segment; Suspense for each island
// app/orders/[id]/loading.tsx
export default function OrderLoading() {
  return <OrderDetailSkeleton />
}

// app/orders/[id]/page.tsx
import { Suspense } from 'react'
import { notFound } from 'next/navigation'

interface OrderPageProps {
  params: Promise<{ id: string }>
}

interface OrderTimelineProps {
  orderId: string
}

interface OrderNotesProps {
  orderId: string
}

export default async function OrderPage({ params }: OrderPageProps) {
  const { id: orderId } = await params

  const order = await fetchOrderById(orderId)

  if (order === null) {
    notFound()
  }

  return (
    <article>
      <h1>Order {order.number}</h1>
      <Suspense fallback={<TimelineSkeleton />}>
        <OrderTimeline orderId={orderId} />
      </Suspense>
      <Suspense fallback={<NotesSkeleton />}>
        <OrderNotes orderId={orderId} />
      </Suspense>
    </article>
  )
}

async function OrderTimeline({ orderId }: OrderTimelineProps) {
  const orderEvents = await fetchOrderEventsByOrderId(orderId)

  return <EventList orderEvents={orderEvents} />
}

async function OrderNotes({ orderId }: OrderNotesProps) {
  const orderNotes = await fetchOrderNotesByOrderId(orderId)

  return <NoteList orderNotes={orderNotes} />
}
```

## Remount when filters change

A new search string should remount the suspended list so the fallback shows
again instead of keeping the previous result.

```tsx
// ❌ Incorrect: no key — the old list stays while new filters load
import { Suspense } from 'react'

interface ProductsPageProps {
  searchParams: Promise<{ category?: string; page?: string }>
}

interface ProductListProps {
  selectedCategory: string | undefined
  currentPage: number
}

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const { category: selectedCategory, page: rawPageValue } =
    await searchParams

  const currentPage = readPageNumber(rawPageValue)

  return (
    <div>
      <FilterSidebar />
      <Suspense fallback={<ProductListSkeleton />}>
        <ProductList
          selectedCategory={selectedCategory}
          currentPage={currentPage}
        />
      </Suspense>
    </div>
  )
}

// ✅ Correct: key remounts the island when filters change
import { Suspense } from 'react'

interface ProductsPageProps {
  searchParams: Promise<{ category?: string; page?: string }>
}

interface ProductListProps {
  selectedCategory: string | undefined
  currentPage: number
}

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const { category: selectedCategory, page: rawPageValue } =
    await searchParams

  const currentPage = readPageNumber(rawPageValue)

  return (
    <div>
      <FilterSidebar />
      <Suspense
        key={`${selectedCategory ?? 'all'}-${String(currentPage)}`}
        fallback={<ProductListSkeleton />}
      >
        <ProductList
          selectedCategory={selectedCategory}
          currentPage={currentPage}
        />
      </Suspense>
    </div>
  )
}

async function ProductList({
  selectedCategory,
  currentPage,
}: ProductListProps) {
  const products = await fetchProducts({
    selectedCategory,
    currentPage,
  })

  return (
    <ul>
      {products.map((product) => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
  )
}

function readPageNumber(rawPageValue: string | undefined) {
  if (rawPageValue === undefined) {
    return 1
  }

  const parsedPage = Number.parseInt(rawPageValue, 10)

  if (Number.isNaN(parsedPage) || parsedPage < 1) {
    return 1
  }

  return parsedPage
}
```
