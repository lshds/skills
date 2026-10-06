# Components

Prefer function components with typed props — one primary component per file, defaults in the signature, `null` for an empty render, and stable list keys keep trees predictable and easy to scan. Apply the heading that matches the task.

## Declaration

Prefer named function components with an explicit props interface — avoid `React.FC`, classes, and untyped defaults.

```tsx
// ❌ Incorrect: React.FC / default export + untyped props
export const UserCard: React.FC<UserCardProps> = ({ userId, onSelect }) => {
  return <button type="button" onClick={() => onSelect(userId)}>Select</button>
}

export default function UserCard(props) {
  return <button type="button" onClick={() => props.onSelect(props.userId)}>Select</button>
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

## Ref callbacks return their cleanup (React 19)

Handling the `null` call to tear down forces the node into a separate ref so
the teardown can find it. On React 19, return a cleanup function from the ref
callback — setup and teardown share one closure.

```tsx
// ❌ Incorrect: teardown keyed on the null call — the node has to be stashed to remove the listener
import { useRef } from 'react'

function blockPinchZoom(event: WheelEvent) {
  if (event.ctrlKey) {
    event.preventDefault()
  }
}

export function ZoomCanvas() {
  const surfaceRef = useRef<HTMLDivElement | null>(null)

  const attachSurface = (surface: HTMLDivElement | null) => {
    if (!surface) {
      surfaceRef.current?.removeEventListener('wheel', blockPinchZoom)
      surfaceRef.current = null
      return
    }

    surface.addEventListener('wheel', blockPinchZoom, { passive: false })
    surfaceRef.current = surface
  }

  return <div ref={attachSurface} className="zoom-canvas" />
}

// ✅ Correct: the ref callback returns its cleanup — no null branch, no stashed node
function attachZoomSurface(surface: HTMLDivElement) {
  surface.addEventListener('wheel', blockPinchZoom, { passive: false })

  return () => surface.removeEventListener('wheel', blockPinchZoom)
}

export function ZoomCanvas() {
  return <div ref={attachZoomSurface} className="zoom-canvas" />
}
```

- A new callback identity runs the cleanup and the setup again on every
  render — define the callback at module scope when it reads nothing from the
  component, or let React Compiler keep it stable.
- On React 18, keep the `null` branch — React 18 ignores a returned function.

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

## Document metadata in the component (React 19)

Writing `document.title` from an Effect leaves the server-rendered page without
a title and shows the previous one until the Effect runs. On React 19,
`<title>` and `<meta>` rendered in a component hoist to `<head>`.

```tsx
// ❌ Incorrect: title set in an Effect — missing from the server render, stale until the Effect runs
import { useEffect } from 'react'

interface ProductPageProps {
  product: Product
}

export function ProductPage({ product }: ProductPageProps) {
  useEffect(() => {
    document.title = `${product.name} · Shop`
  }, [product.name])

  return <h1>{product.name}</h1>
}

// ✅ Correct: <title> and <meta> rendered with the component hoist to <head>
export function ProductPage({ product }: ProductPageProps) {
  return (
    <>
      <title>{`${product.name} · Shop`}</title>
      <meta name="description" content={product.summary} />
      <h1>{product.name}</h1>
    </>
  )
}
```

- Only when the framework doesn’t own metadata. If the router or framework
  has its own metadata API, use that — two sources render duplicate tags.
- Pass `<title>` one string (a template literal), not text mixed with
  expressions — React expects a single string child and warns on an array.

## Removed APIs

React 19 removed `propTypes` checks and `defaultProps` on function components
(both are silently ignored), string refs, and `ReactDOM.render`. Code that
still uses them loses its defaults and validation or fails at startup.

```tsx
// ❌ Incorrect: APIs React 19 removed — the default and the prop check are ignored, ReactDOM.render no longer exists
import PropTypes from 'prop-types'
import ReactDOM from 'react-dom'

import { App } from './App'

export function Badge({ label, tone }) {
  return <span data-tone={tone}>{label}</span>
}

Badge.defaultProps = { tone: 'info' }
Badge.propTypes = { label: PropTypes.string.isRequired }

ReactDOM.render(<App />, document.getElementById('root'))

// ✅ Correct: TypeScript props + default parameters; createRoot for the entry point
import { createRoot } from 'react-dom/client'

import { App } from './App'

interface BadgeProps {
  label: string
  tone?: 'info' | 'error'
}

export function Badge({ label, tone = 'info' }: BadgeProps) {
  return <span data-tone={tone}>{label}</span>
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Missing #root element')
}

createRoot(rootElement).render(<App />)
```

- String refs (`ref="searchInput"` read through `this.refs`) are gone — use
  `useRef` or a ref callback.

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
