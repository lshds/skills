# Memoization

Don’t pre-optimize. Add `memo` / `useMemo` / `useCallback` only when measured,
or when a child truly needs stable references.

## Extract expensive work past early returns

Don’t run expensive work (or memo) before an early return that skips rendering the result.

```tsx
// ❌ Incorrect: work runs even when loading — wasted compute on every render
interface ProfileProps {
  user: User
  isLoading: boolean
}

function Profile({ user, isLoading }: ProfileProps) {
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

function Profile({ user, isLoading }: ProfileProps) {
  if (isLoading) {
    return <Skeleton />
  }

  return <UserAvatar user={user} />
}
```

If the repo uses React Compiler, skip manual `memo` / `useMemo` / `useCallback` unless you still need an explicit boundary.

## Stable defaults for memoized components

Inline default functions create a new identity every render and defeat `memo`.

```tsx
// ❌ Incorrect: new function every render breaks memo
interface UserAvatarProps {
  onClick?: () => void
}

const UserAvatar = memo(function UserAvatar({
  onClick = () => {},
}: UserAvatarProps) {
  return <button type="button" onClick={onClick} />
})

// ✅ Correct: stable module-scope default — memo can skip re-render
const NOOP_ON_CLICK = () => {}

const UserAvatar = memo(function UserAvatar({
  onClick = NOOP_ON_CLICK,
}: UserAvatarProps) {
  return <button type="button" onClick={onClick} />
})
```

## Don’t useMemo simple primitives

Cheap boolean/primitive expressions don’t need `useMemo` — the hook overhead outweighs the work.

```tsx
// ❌ Incorrect: overhead > work — useMemo costs more than the boolean
const isLoading = useMemo(
  () => user.isLoading || notifications.isLoading,
  [user.isLoading, notifications.isLoading],
)

// ✅ Correct: cheap boolean — no useMemo
const isLoading = user.isLoading || notifications.isLoading
```
