# Memoization

Prefer React Compiler’s automatic memoization over hand-written `memo` /
`useMemo` / `useCallback` so components stay plain functions and no dependency
array can drift out of date. Greenfield React 19 apps assume React Compiler 1.0
with eslint-plugin-react-hooks `recommended`. Repos without the compiler follow
the “Without React Compiler” sections: don’t pre-optimize — memoize only when
measured, or when a child truly needs stable references. Enabling the compiler
in an existing repo adds a dependency and config, so follow the repo and never
propose it as part of a change.

## Let React Compiler memoize

The compiler already caches derived values, handlers, and JSX per component.
Hand-written memo on top adds dependency arrays to maintain and hides which
code is actually hot.

```tsx
// ❌ Incorrect: hand-written memo under React Compiler — extra deps arrays that can go stale
import { memo, useCallback, useMemo } from 'react'

import { OrderRows } from './OrderRows'
import type { Order } from './order'

interface OpenOrdersProps {
  orders: Order[]
  onArchive: (orderIds: string[]) => void
}

export const OpenOrders = memo(function OpenOrders({
  orders,
  onArchive,
}: OpenOrdersProps) {
  const openOrders = useMemo(
    () => orders.filter((order) => order.status === 'open'),
    [orders],
  )

  const handleArchiveAll = useCallback(() => {
    onArchive(openOrders.map((order) => order.id))
  }, [onArchive, openOrders])

  return (
    <>
      <OrderRows orders={openOrders} />
      <button type="button" onClick={handleArchiveAll}>
        Archive all
      </button>
    </>
  )
})

// ✅ Correct: plain function component — the compiler memoizes the filter, the handler, and the JSX
export function OpenOrders({ orders, onArchive }: OpenOrdersProps) {
  const openOrders = orders.filter((order) => order.status === 'open')

  const handleArchiveAll = () => {
    onArchive(openOrders.map((order) => order.id))
  }

  return (
    <>
      <OrderRows orders={openOrders} />
      <button type="button" onClick={handleArchiveAll}>
        Archive all
      </button>
    </>
  )
}
```

- The `recommended` config of eslint-plugin-react-hooks flags code that breaks
  the Rules of React (for example mutating props or state during render). The
  compiler skips code it can’t prove safe, so fix the flagged code instead of
  wrapping it in manual memo.
- In a repo that already has the compiler, new code adds no manual memo.
  Existing `useMemo` / `useCallback` / `memo` stays until the user approves
  removing it — removing memo can change what the compiler caches, so do it as
  its own change and re-test.

## Manual memo is an escape hatch

With the compiler on, hand-written memo is the exception and needs a reason a
reader can verify.

- A measured hot spot the compiler doesn’t cover — profile first, confirm the
  compiler skipped the component or its caching doesn’t help, then add the
  narrowest `useMemo` or `memo` boundary.
- An explicit referential-stability contract with a non-React consumer — an
  options object handed to an imperative widget, or a callback registered with
  a subscription API that re-initializes on a new identity. Write `useMemo` /
  `useCallback` so the guarantee lives in the code, not in whatever the
  compiler chose to cache.
- Leave a one-line comment naming the measurement or the consumer, so the next
  reader doesn’t delete the memo as redundant.

## Opt out with `'use no memo'` while debugging

When a component misbehaves only under the compiler, opt that one component out
while you isolate the cause — turning the compiler off app-wide hides whether
the bug is in the component or in the compiler output.

```tsx
// ✅ Correct: temporary opt-out for one component while isolating a suspected compiler issue
import type { Invoice } from './invoice'

interface InvoiceTotalsProps {
  invoice: Invoice
}

export function InvoiceTotals({ invoice }: InvoiceTotalsProps) {
  'use no memo'

  return <p>{invoice.totalLabel}</p>
}
```

- Put the directive as the first statement of the component or hook body; it
  opts out only that function.
- Remove it once the cause is fixed — a forgotten directive silently drops
  memoization for that component.

## Without React Compiler: extract expensive work past early returns

Don’t run expensive work (or memo) before an early return that skips rendering
the result.

```tsx
// ❌ Incorrect: work runs even when loading — wasted compute on every render
interface ProfileProps {
  user: User
  isLoading: boolean
}

export function Profile({ user, isLoading }: ProfileProps) {
  const avatar = useMemo(() => {
    const avatarId = computeAvatarId(user)

    return <Avatar avatarId={avatarId} />
  }, [user])

  if (isLoading) {
    return <Skeleton />
  }

  return <div>{avatar}</div>
}

// ✅ Correct: extract past early return; memo only if measured
interface UserAvatarProps {
  user: User
}

const UserAvatar = memo(function UserAvatar({ user }: UserAvatarProps) {
  const avatarId = computeAvatarId(user)

  return <Avatar avatarId={avatarId} />
})

export function Profile({ user, isLoading }: ProfileProps) {
  if (isLoading) {
    return <Skeleton />
  }

  return <UserAvatar user={user} />
}
```

## Without React Compiler: stable defaults for memoized children

An inline default (`onClick = () => {}`, `tags = []`) creates a new identity
every render, so a memoized child that receives it re-renders even when the
caller passed nothing.

```tsx
// ❌ Incorrect: inline default is a new function every render — AvatarButton’s memo never skips
import { memo } from 'react'

interface AvatarButtonProps {
  onClick: () => void
}

const AvatarButton = memo(function AvatarButton({ onClick }: AvatarButtonProps) {
  return (
    <button type="button" onClick={onClick}>
      Avatar
    </button>
  )
})

interface UserAvatarProps {
  onClick?: () => void
}

export function UserAvatar({ onClick = () => {} }: UserAvatarProps) {
  return <AvatarButton onClick={onClick} />
}

// ✅ Correct: module-scope default keeps one identity — AvatarButton’s memo can skip
const NOOP_ON_CLICK = () => {}

export function UserAvatar({ onClick = NOOP_ON_CLICK }: UserAvatarProps) {
  return <AvatarButton onClick={onClick} />
}
```

## Without React Compiler: skip `useMemo` for cheap primitives

Cheap boolean/primitive expressions don’t need `useMemo` — the hook overhead
outweighs the work.

```tsx
// ❌ Incorrect: overhead > work — useMemo costs more than the boolean
const isLoading = useMemo(
  () => user.isLoading || notifications.isLoading,
  [user.isLoading, notifications.isLoading],
)

// ✅ Correct: cheap boolean — no useMemo
const isLoading = user.isLoading || notifications.isLoading
```
