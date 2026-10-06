# Client Data

Use the repo’s data library for remote reads. Dedupe in-flight requests and
share cache across mounts — don’t hand-roll fetch in `useEffect`. When the app
already passes promises into Suspense, read them with `use()`.

## Deduplicate remote reads

Share cache and in-flight requests across mounts via the repo’s data library instead of per-mount `fetch`.

```tsx
// ❌ Incorrect: each mount fetches — no shared cache
export function UserList() {
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => {
    fetch('/api/users')
      .then((response) => response.json())
      .then(setUsers)
  }, [])

  return <List users={users} />
}

// ✅ Correct: shared cache / dedup via repo library
export function UserList() {
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  })

  return <List users={users ?? []} />
}
```

Same idea with SWR: `useSWR('/api/users', fetchJson)` — one in-flight request shared across instances. Don’t hand-roll cacheable fetch-in-`useEffect` or a parallel `useQuery`.

## Read a passed promise with `use()`

`use()` suspends until a promise resolves, so the promise must already exist
when the component renders. A promise created during render is a new promise
on every render — the component suspends again each time and never settles.
Create it outside the reading component (a Server Component or a cache) and
pass it down; wrap only the part that reads it in `<Suspense>`.

```tsx
// ❌ Incorrect: promise created during render — a new promise each render, so it keeps suspending
'use client'

import { use } from 'react'

import { fetchOrders } from './orders-api'
import { OrderRows } from './OrderRows'

interface OrderHistoryProps {
  customerId: string
}

export function OrderHistory({ customerId }: OrderHistoryProps) {
  const orders = use(fetchOrders(customerId))

  return <OrderRows orders={orders} />
}

// ✅ Correct: the Server Component starts the fetch and passes the promise; the client reads it inside Suspense
// CustomerOrders.tsx (Server Component)
import { Suspense } from 'react'

import { fetchOrders } from './orders-api'
import { OrderHistory } from './OrderHistory'
import { OrdersSkeleton } from './OrdersSkeleton'

interface CustomerOrdersProps {
  customerId: string
}

export function CustomerOrders({ customerId }: CustomerOrdersProps) {
  const ordersPromise = fetchOrders(customerId)

  return (
    <Suspense fallback={<OrdersSkeleton />}>
      <OrderHistory ordersPromise={ordersPromise} />
    </Suspense>
  )
}

// OrderHistory.tsx
'use client'

import { use } from 'react'

import type { Order } from './orders-api'
import { OrderRows } from './OrderRows'

interface OrderHistoryProps {
  ordersPromise: Promise<Order[]>
}

export function OrderHistory({ ordersPromise }: OrderHistoryProps) {
  const orders = use(ordersPromise)

  return <OrderRows orders={orders} />
}
```

- Pass the promise un-awaited — awaiting it in the parent blocks the parent’s
  whole render instead of only the Suspense boundary.
- Unlike other hooks, `use()` may be called conditionally (inside an `if`),
  but still only in a component or hook body.
- A rejected promise throws to the nearest error boundary — wrap the reader in
  one, or `.catch` the promise where it’s created to resolve to a fallback.
- Only when the app already uses Suspense / `use` — don’t introduce a parallel
  loading model beside the repo’s data library.

## Global event listeners

Don’t register N window/document listeners for N hook instances. Share one subscription (module-level registry, context, or the repo’s subscription helper).

```tsx
// ❌ Incorrect: N instances = N listeners — scales poorly
export function useKeyboardShortcut(shortcutKey: string, onShortcut: () => void) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === shortcutKey) {
        onShortcut()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcutKey, onShortcut])
}

// ✅ Correct: one listener, many callbacks — shared registry + teardown when empty
const shortcutCallbacks = new Map<string, Set<() => void>>()
let isListening = false

function handleKeyDown(event: KeyboardEvent) {
  shortcutCallbacks.get(event.key)?.forEach((onShortcut) => onShortcut())
}

function ensureListener() {
  if (isListening) {
    return
  }

  isListening = true
  window.addEventListener('keydown', handleKeyDown)
}

function releaseListenerIfIdle() {
  if (shortcutCallbacks.size > 0) {
    return
  }

  window.removeEventListener('keydown', handleKeyDown)
  isListening = false
}

export function useKeyboardShortcut(shortcutKey: string, onShortcut: () => void) {
  useEffect(() => {
    ensureListener()

    const callbacksForKey = shortcutCallbacks.get(shortcutKey) ?? new Set<() => void>()
    callbacksForKey.add(onShortcut)
    shortcutCallbacks.set(shortcutKey, callbacksForKey)

    return () => {
      const callbacks = shortcutCallbacks.get(shortcutKey)

      if (!callbacks) {
        return
      }

      callbacks.delete(onShortcut)

      if (callbacks.size === 0) {
        shortcutCallbacks.delete(shortcutKey)
      }

      releaseListenerIfIdle()
    }
  }, [shortcutKey, onShortcut])
}
```

## Passive scroll/touch listeners

When you only observe scroll or touch and don’t call `preventDefault`, register listeners as passive so the browser can optimize scrolling.

```tsx
// ❌ Incorrect: non-passive scroll/touch when you only observe — blocks scrolling
document.addEventListener('touchstart', handleTouch)
document.addEventListener('wheel', handleWheel)

// ✅ Correct: passive when you don’t call preventDefault — scroll stays smooth
document.addEventListener('touchstart', handleTouch, { passive: true })
document.addEventListener('wheel', handleWheel, { passive: true })
```
