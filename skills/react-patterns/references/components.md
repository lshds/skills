# Components

Prefer function components with typed props — one primary component per file, defaults in the signature, `null` for an empty render, and stable list keys keep trees predictable and easy to scan.

## Declaration

Prefer named function components with an explicit props interface — avoid `React.FC`, classes, and untyped defaults.

```tsx
// ❌ Incorrect: class component / React.FC / default export + untyped props
export const UserCard: React.FC<UserCardProps> = ({ userId, onSelect }) => {
  return <button onClick={() => onSelect(userId)}>Select</button>
}

export default function UserCard(props) {
  return <div onClick={props.onSelect}>Select</div>
}

// ✅ Correct: named export function + props interface — intent is explicit
interface UserCardProps {
  userId: string
  onSelect: (userId: string) => void
}

export function UserCard({ userId, onSelect }: UserCardProps) {
  return (
    <button type="button" onClick={() => onSelect(userId)}>
      Select
    </button>
  )
}
```

## Props

- Prefer `interface` for props objects (`type` for unions / aliases only).
- Avoid `React.FC` — it obscures the props type and implies `children`.
- Destructure props in the signature.
- Callbacks: `on*` props; local handlers: `handle*`.
- Pass a handler that takes no arguments (or just the event) directly — `onClick={handleSave}`, not `() => handleSave()`. Keep the arrow when the handler takes other arguments; passing it directly hands it the event instead.

## `ref` is a prop (React 19)

`forwardRef` adds a wrapper, forces an `export const` instead of
`export function`, and splits the props type from the ref type. On React 19,
function components take `ref` like any other prop.

```tsx
// ❌ Incorrect: forwardRef wrapper — not needed on React 19
import { forwardRef } from 'react'

interface TextFieldProps {
  label: string
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField({ label }, ref) {
    return (
      <label>
        {label}
        <input ref={ref} />
      </label>
    )
  },
)

// ✅ Correct: ref is a regular prop on the function component
import type { Ref } from 'react'

interface TextFieldProps {
  label: string
  ref?: Ref<HTMLInputElement>
}

export function TextField({ label, ref }: TextFieldProps) {
  return (
    <label>
      {label}
      <input ref={ref} />
    </label>
  )
}
```

- On React 18, keep `forwardRef`.
- Create a DOM ref with `useRef<HTMLInputElement>(null)`, not `undefined` —
  the `ref` prop takes `RefObject<T | null>`, so an `undefined` initial value
  fails to type-check.

## Optional props

Spelled-out `=== undefined` checks in the body hide the default and bury the
callback behind a guard. Default in the destructured signature; call optional
callbacks with `?.()`.

```tsx
// ❌ Incorrect: default and optional callback resolved with undefined checks in the body
interface ToastProps {
  toastId: string
  message: string
  tone?: 'info' | 'error'
  onDismiss?: (toastId: string) => void
}

export function Toast({ toastId, message, tone, onDismiss }: ToastProps) {
  const toastTone = tone === undefined ? 'info' : tone

  const handleDismiss = () => {
    if (onDismiss !== undefined) {
      onDismiss(toastId)
    }
  }

  return (
    <div role="status" data-tone={toastTone}>
      {message}
      <button type="button" onClick={handleDismiss}>
        Dismiss
      </button>
    </div>
  )
}

// ✅ Correct: default in the signature; optional callback via ?.()
interface ToastProps {
  toastId: string
  message: string
  tone?: 'info' | 'error'
  onDismiss?: (toastId: string) => void
}

export function Toast({
  toastId,
  message,
  tone = 'info',
  onDismiss,
}: ToastProps) {
  const handleDismiss = () => {
    onDismiss?.(toastId)
  }

  return (
    <div role="status" data-tone={tone}>
      {message}
      <button type="button" onClick={handleDismiss}>
        Dismiss
      </button>
    </div>
  )
}
```

## Render nothing with `null`

A bare `return` in a component reads like a forgotten branch. Return `null`
when there is nothing to render — the TypeScript bare-`return` default does not
apply to components.

```tsx
// ❌ Incorrect: bare return — looks like a missing branch, not an empty render
interface ErrorBannerProps {
  message?: string
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  if (!message) {
    return
  }

  return <p role="alert">{message}</p>
}

// ✅ Correct: null says "render nothing"
interface ErrorBannerProps {
  message?: string
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  if (!message) {
    return null
  }

  return <p role="alert">{message}</p>
}
```

## Children

Type `children` explicitly when the component accepts them:

```tsx
// ❌ Incorrect: implicit children via React.FC — obscures the public API
export const Panel: React.FC<{ title: string }> = ({ title, children }) => (
  <section>
    <h2>{title}</h2>
    {children}
  </section>
)

// ✅ Correct: children typed on the props interface
interface PanelProps {
  title: string
  children: React.ReactNode
}

export function Panel({ title, children }: PanelProps) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  )
}
```

## Lists

Keys must come from stable identity so reorder and insert don’t scramble state or focus.

```tsx
// ❌ Incorrect: index keys when list can reorder — state and focus break
{users.map((user, index) => (
  <UserRow key={index} user={user} />
))}

// ✅ Correct: key from stable identity — rows survive reorder
{users.map((user) => (
  <UserRow key={user.id} user={user} />
))}
```

Use array index only when the list is static and never reorders.

## Blank lines between statements

In component modules, put a blank line between logically separate steps: after locals before a guard `if`, and after a closed `if` / `else` block before the next `return` or JSX. That spacing is part of readable React control flow (early exits vs happy-path UI) — don’t clump declaration, guard, and happy-path return.

```tsx
// ❌ Incorrect: clumped control flow — hard to scan exits
const user = getUserById(userId)
if (!user) {
  notFound()
}
return <UserProfile user={user} />

// ✅ Correct: blank line before the guard and before the happy-path return
const user = getUserById(userId)

if (!user) {
  notFound()
}

return <UserProfile user={user} />
```

## Files

- One primary component per file; filename matches the component (`UserCard.tsx`).
- Colocate small helpers in the same file; extract when reused or the file is hard to scan.
- Default export only when the framework requires it (e.g. some router entry files).
