# Client Data

Use the repo’s data library for remote reads. Dedupe in-flight requests and
share cache across mounts — don’t hand-roll fetch in `useEffect`.

## Deduplicate remote reads

Share cache and in-flight requests across mounts via the repo’s data library instead of per-mount `fetch`.

```tsx
// ❌ Incorrect: each mount fetches — no shared cache
function UserList() {
  const [users, setUsers] = useState([])

  useEffect(() => {
    fetch('/api/users')
      .then((response) => response.json())
      .then(setUsers)
  }, [])

  return <List users={users} />
}

// ✅ Correct: shared cache / dedup via repo library
function UserList() {
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  })

  return <List users={users ?? []} />
}
```

Same idea with SWR: `useSWR('/api/users', fetcher)` — one in-flight request shared across instances. Don’t hand-roll cacheable fetch-in-`useEffect` or a parallel `useQuery`.

## Suspense boundaries

When using Suspense / `use()`, don’t block the whole tree on one fetch — wrap the part that needs data.

```tsx
// ❌ Incorrect: layout waits on data — shell can’t render until fetch completes
async function Panel() {
  const panelContent = await fetchPanelContent()

  return (
    <section>
      <Header />
      <DataDisplay panelContent={panelContent} />
      <Footer />
    </section>
  )
}

// ✅ Correct: shell renders; data streams inside the boundary
function Panel() {
  return (
    <section>
      <Header />
      <Suspense fallback={<Skeleton />}>
        <DataDisplay />
      </Suspense>
      <Footer />
    </section>
  )
}

async function DataDisplay() {
  const panelContent = await fetchPanelContent()

  return <div>{panelContent.body}</div>
}
```

Only when the app already uses Suspense/`use` — don’t introduce a parallel loading model beside the repo’s data library.

## Global event listeners

Don’t register N window/document listeners for N hook instances. Share one subscription (module-level registry, context, or the repo’s subscription helper).

```tsx
// ❌ Incorrect: N instances = N listeners — scales poorly
function useKeyboardShortcut(shortcutKey: string, onShortcut: () => void) {
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

function useKeyboardShortcut(shortcutKey: string, onShortcut: () => void) {
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
