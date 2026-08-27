# Advanced

Prefer stable subscriptions when effects meet changing callbacks — use `useEffectEvent` or refs so externals stay wired without re-running on every handler identity change.

## useEffectEvent (preferred)

Stable callback that always sees latest props/state. Prefer over manual refs when the React version has it. Do not put the Effect Event in the effect deps array — its identity intentionally changes every render.

```tsx
// ❌ Incorrect: Effect Event in deps — re-runs every render
const onSearchEffect = useEffectEvent(onSearch)

useEffect(() => {
  const timeoutId = setTimeout(() => onSearchEffect(searchQuery), 300)

  return () => clearTimeout(timeoutId)
}, [searchQuery, onSearchEffect])

// ✅ Correct: reactive values only — subscription stays stable
const onSearchEffect = useEffectEvent(onSearch)

useEffect(() => {
  const timeoutId = setTimeout(() => onSearchEffect(searchQuery), 300)

  return () => clearTimeout(timeoutId)
}, [searchQuery])
```

Same for subscriptions — depend on `eventName`, call the Effect Event inside:

```tsx
// ❌ Incorrect: Effect Event in subscription deps — re-binds every render
function useWindowEvent(eventName: string, onEvent: (event: Event) => void) {
  const handleEvent = useEffectEvent(onEvent)

  useEffect(() => {
    window.addEventListener(eventName, handleEvent)

    return () => window.removeEventListener(eventName, handleEvent)
  }, [eventName, handleEvent])
}

// ✅ Correct: reactive values only — listener stays registered
function useWindowEvent(eventName: string, onEvent: (event: Event) => void) {
  const handleEvent = useEffectEvent(onEvent)

  useEffect(() => {
    window.addEventListener(eventName, handleEvent)

    return () => window.removeEventListener(eventName, handleEvent)
  }, [eventName])
}
```

## Event handlers in refs (fallback)

When `useEffectEvent` isn’t available — store the callback in a ref so the subscription doesn’t re-bind on every handler identity change.

```tsx
// ❌ Incorrect: re-subscribes when handler identity changes
function useWindowEvent(eventName: string, onEvent: (event: Event) => void) {
  useEffect(() => {
    window.addEventListener(eventName, onEvent)

    return () => window.removeEventListener(eventName, onEvent)
  }, [eventName, onEvent])
}

// ✅ Correct: ref keeps subscription stable — latest handler without re-binding
function useWindowEvent(eventName: string, onEvent: (event: Event) => void) {
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
function AppBootstrap() {
  useEffect(() => {
    loadFromStorage()
  }, [])

  return null
}

// ✅ Correct: once per app load — module guard survives remounts
let hasInitialized = false

function AppBootstrap() {
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
