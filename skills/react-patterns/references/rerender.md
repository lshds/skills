# Re-render

Avoid remounts and redundant effects — derive during render, measure before
memoizing, and keep side effects in event handlers. Apply the heading that
matches the symptom — not every section.

## Don’t define components inside components

Creates a new type every render → remount, lost focus/state.

```tsx
// ❌ Incorrect: remounts every render — new component type each pass
interface UserProfileProps {
  user: User
  theme: string
}

function UserProfile({ user, theme }: UserProfileProps) {
  const Avatar = () => (
    <img src={user.avatarUrl} className={theme === 'dark' ? 'dark' : 'light'} />
  )

  return <Avatar />
}

// ✅ Correct: module-scope + props — stable type, state preserved
interface AvatarProps {
  src: string
  theme: string
}

function Avatar({ src, theme }: AvatarProps) {
  return <img src={src} className={theme === 'dark' ? 'dark' : 'light'} />
}

function UserProfile({ user, theme }: UserProfileProps) {
  return <Avatar src={user.avatarUrl} theme={theme} />
}
```

## Derive during render — not in effects

Derived values belong in render — syncing them through state + effect adds an extra cycle for no gain.

```tsx
// ❌ Incorrect: redundant state + effect — extra render cycle
const [fullName, setFullName] = useState('')

useEffect(() => {
  setFullName(`${firstName} ${lastName}`)
}, [firstName, lastName])

// ✅ Correct: derive during render
const fullName = `${firstName} ${lastName}`
```

Don’t sync props → state in an effect to “reset” on identity change. Remount with `key` instead:

```tsx
// ❌ Incorrect: reset via effect — loses local state on every identity change poorly
useEffect(() => {
  setComment('')
}, [userId])

// ✅ Correct: parent remounts Chat when recipient changes
<Chat key={userId} userId={userId} />
```

## Interaction logic in event handlers

User-driven side effects should run from the handler — not via a flag that an effect watches.

```tsx
// ❌ Incorrect: action as state + effect — indirect and harder to follow
const [hasSubmitted, setHasSubmitted] = useState(false)

useEffect(() => {
  if (hasSubmitted) {
    post('/api/register')
  }
}, [hasSubmitted])

return <button onClick={() => setHasSubmitted(true)}>Submit</button>

// ✅ Correct: call side effects from the handler
const handleSubmit = () => {
  post('/api/register')
}

return <button onClick={handleSubmit}>Submit</button>
```

## Narrow effect dependencies

Depend on primitives or derived booleans so effects don’t re-fire on every object identity or pixel change.

```tsx
// ❌ Incorrect: object / continuous number as deps — fires too often
useEffect(() => {
  track(user)
}, [user])

useEffect(() => {
  if (windowWidth < 768) {
    setIsMobile(true)
  }
}, [windowWidth])

// ✅ Correct: primitives / derived boolean — effect runs only when meaning changes
useEffect(() => {
  track(userId)
}, [userId])

useEffect(() => {
  if (!isMobile) {
    return
  }

  /* ... */
}, [isMobile])
```

## Subscribe to derived booleans

Subscribe to the boolean you need — not a continuous value that changes more often than the UI cares about.

```tsx
// ❌ Incorrect: re-render on every pixel — width changes constantly
const windowWidth = useWindowWidth()
const isMobile = windowWidth < 768

// ✅ Correct: subscribe to the boolean you need
const isMobile = useMediaQuery('(max-width: 767px)')
```

## Split independent hook work

Split memoized work by dependency so unrelated inputs don’t recompute everything together.

```tsx
// ❌ Incorrect: unrelated work shares deps — one change recomputes all
const sortedItems = useMemo(() => {
  const filteredItems = filterItems(items, searchQuery)

  return sortItems(filteredItems, sortKey)
}, [items, searchQuery, sortKey])

// ✅ Correct: split by dependency — filter and sort invalidate independently
const filteredItems = useMemo(
  () => filterItems(items, searchQuery),
  [items, searchQuery],
)
const sortedItems = useMemo(
  () => sortItems(filteredItems, sortKey),
  [filteredItems, sortKey],
)
```

## Transient values in refs

High-frequency values that don’t drive UI belong in refs — putting them in state causes re-render storms.

```tsx
// ❌ Incorrect: mouse position as state → re-render storm
const [pointerPosition, setPointerPosition] = useState({ x: 0, y: 0 })

useEffect(() => {
  const handlePointerMove = (event: PointerEvent) => {
    setPointerPosition({ x: event.clientX, y: event.clientY })
  }

  window.addEventListener('pointermove', handlePointerMove)

  return () => window.removeEventListener('pointermove', handlePointerMove)
}, [])

// ✅ Correct: ref when UI doesn’t need to re-render
const pointerPositionRef = useRef({ x: 0, y: 0 })

useEffect(() => {
  const handlePointerMove = (event: PointerEvent) => {
    pointerPositionRef.current = { x: event.clientX, y: event.clientY }
  }

  window.addEventListener('pointermove', handlePointerMove)

  return () => window.removeEventListener('pointermove', handlePointerMove)
}, [])
```

## Defer reads to usage points

Read volatile data at the usage point so the whole component doesn’t re-render on unrelated changes.

```tsx
// ❌ Incorrect: subscribe whole component to search params
const searchParams = useSearchParams()

return <button onClick={() => share(searchParams.get('id'))}>Share</button>

// ✅ Correct: read at the usage point — no re-render on unrelated param changes
return (
  <button
    onClick={() => {
      const resourceId = new URLSearchParams(window.location.search).get('id')
      share(resourceId)
    }}
  >
    Share
  </button>
)
```

## Transitions for non-urgent updates

Mark frequent / expensive updates that must not block input as transitions. Keep urgent state (typed text) outside the transition.

```tsx
// ❌ Incorrect: expensive filter blocks typing
const handleChange = (nextSearchQuery: string) => {
  setSearchQuery(nextSearchQuery)
  setResults(filterAll(nextSearchQuery))
}

// ✅ Correct: urgent input + transition for heavy work
const [isPending, startTransition] = useTransition()
const [searchQuery, setSearchQuery] = useState('')
const [results, setResults] = useState<Result[]>([])

const handleChange = (nextSearchQuery: string) => {
  setSearchQuery(nextSearchQuery)

  startTransition(() => {
    setResults(filterAll(nextSearchQuery))
  })
}

return (
  <>
    {isPending ? <Spinner /> : null}
    <input
      value={searchQuery}
      onChange={(event) => handleChange(event.target.value)}
    />
    <ResultsList results={results} />
  </>
)
```

High-frequency listeners (scroll, pointer) that only drive secondary UI: wrap the setState in `startTransition` (or skip state and use a ref — see above).

## `useDeferredValue` for expensive derived renders

When a prop / local value drives heavy filtering or visualization, defer the expensive side so the input stays snappy. Memoize against the deferred value; otherwise the work still runs every render.

```tsx
// ❌ Incorrect: filter on every keystroke against urgent query
interface SearchProps {
  items: Item[]
}

function Search({ items }: SearchProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const filteredItems = useMemo(
    () => items.filter((item) => fuzzyMatch(item, searchQuery)),
    [items, searchQuery],
  )

  return (
    <>
      <input
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
      />
      <ResultsList results={filteredItems} />
    </>
  )
}

// ✅ Correct: defer expensive derived work — input stays responsive
function Search({ items }: SearchProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const filteredItems = useMemo(
    () => items.filter((item) => fuzzyMatch(item, deferredSearchQuery)),
    [items, deferredSearchQuery],
  )
  const isStale = searchQuery !== deferredSearchQuery

  return (
    <>
      <input
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
      />
      <div style={{ opacity: isStale ? 0.7 : 1 }}>
        <ResultsList results={filteredItems} />
      </div>
    </>
  )
}
```

Prefer the repo’s data-library pending state when it already covers the fetch.
