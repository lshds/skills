# Advanced

Prefer `useEffectEvent` (React 19.2+) over re-subscribing when an Effect calls a changing callback, so timers and listeners stay wired while still seeing the latest props and state. Older React keeps the latest-value ref fallback.

## `useEffectEvent` for non-reactive logic (React 19.2+)

An Effect Event reads the latest props and state without making the Effect re-run when they change. Listing it in the dependency array undoes that — its identity intentionally changes every render, so the Effect would re-run every render.

```tsx
// ❌ Incorrect: Effect Event in deps — re-runs every render
const handleSearch = useEffectEvent(onSearch)

useEffect(() => {
  const timeoutId = setTimeout(() => handleSearch(searchQuery), 300)

  return () => clearTimeout(timeoutId)
}, [searchQuery, handleSearch])

// ✅ Correct: reactive values only — subscription stays stable
const handleSearch = useEffectEvent(onSearch)

useEffect(() => {
  const timeoutId = setTimeout(() => handleSearch(searchQuery), 300)

  return () => clearTimeout(timeoutId)
}, [searchQuery])
```

Same for subscriptions — depend on `eventName`, call the Effect Event inside:

```tsx
// ❌ Incorrect: Effect Event in subscription deps — re-binds every render
export function useWindowEvent(eventName: string, onEvent: (event: Event) => void) {
  const handleEvent = useEffectEvent(onEvent)

  useEffect(() => {
    window.addEventListener(eventName, handleEvent)

    return () => window.removeEventListener(eventName, handleEvent)
  }, [eventName, handleEvent])
}

// ✅ Correct: reactive values only — listener stays registered
export function useWindowEvent(eventName: string, onEvent: (event: Event) => void) {
  const handleEvent = useEffectEvent(onEvent)

  useEffect(() => {
    window.addEventListener(eventName, handleEvent)

    return () => window.removeEventListener(eventName, handleEvent)
  }, [eventName])
}
```

## Effect Event rules

An Effect Event is a piece of an Effect, not a general stable callback. Used anywhere else it reads values at the wrong time or hides a real dependency.

- Declare it in the same component or custom hook as the Effect that calls it — don’t return it from a hook or receive it as a prop.
- Call it only from inside Effects (directly, or from a timer or listener the Effect set up) — not during render, not passed to children, not used as an `onClick` handler. Event handlers already see the latest values; pass them a plain function.
- Never list it in a dependency array.
- Don’t wrap a function in `useEffectEvent` just to silence the exhaustive-deps lint. If the Effect should re-run when a value changes, that value is a dependency; only the part that must read the latest value without re-running belongs in the Effect Event.

```tsx
// ❌ Incorrect: roomId hidden in an Effect Event to quiet the lint — the chat never reconnects when the room changes
const connectToRoom = useEffectEvent(() => createConnection(roomId))

useEffect(() => {
  const connection = connectToRoom()
  connection.connect()

  return () => connection.disconnect()
}, [])

// ✅ Correct: roomId stays a dependency; only the theme read for the toast is non-reactive
const handleConnected = useEffectEvent(() => {
  showToast('Connected', theme)
})

useEffect(() => {
  const connection = createConnection(roomId)
  connection.on('connected', handleConnected)
  connection.connect()

  return () => connection.disconnect()
}, [roomId])
```

## Event handlers in refs (before React 19.2)

On React older than 19.2, store the latest callback in a ref so the subscription doesn’t re-bind on every handler identity change.

```tsx
// ❌ Incorrect: re-subscribes when handler identity changes
export function useWindowEvent(eventName: string, onEvent: (event: Event) => void) {
  useEffect(() => {
    window.addEventListener(eventName, onEvent)

    return () => window.removeEventListener(eventName, onEvent)
  }, [eventName, onEvent])
}

// ✅ Correct: ref keeps subscription stable — latest handler without re-binding
export function useWindowEvent(eventName: string, onEvent: (event: Event) => void) {
  const onEventRef = useRef(onEvent)

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    const handleEvent = (event: Event) => {
      onEventRef.current(event)
    }

    window.addEventListener(eventName, handleEvent)

    return () => window.removeEventListener(eventName, handleEvent)
  }, [eventName])
}
```

## App init once per load

Don’t rely on `useEffect([])` in a component for process-wide init — components remount (and Strict Mode double-invokes). Prefer entry-module init or a module-level guard:

```tsx
// ❌ Incorrect: re-runs on remount / Strict Mode double-invoke
export function AppBootstrap() {
  useEffect(() => {
    loadFromStorage()
  }, [])

  return null
}

// ✅ Correct: once per app load — module guard survives remounts
let hasInitialized = false

export function AppBootstrap() {
  useEffect(() => {
    if (hasInitialized) {
      return
    }

    hasInitialized = true
    loadFromStorage()
  }, [])

  return null
}
```
