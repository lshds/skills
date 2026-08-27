# Hooks

Call hooks at the top level — custom hooks are `use*`. Effects sync externals,
not derived state you could compute during render.

## Rules

Hooks must run at the top level in the same order every render — never after conditions or early returns.

```tsx
// ❌ Incorrect: hooks in conditions / after early return — breaks Rules of Hooks
interface ProfileProps {
  user: User | null
}

function Profile({ user }: ProfileProps) {
  if (!user) {
    return null
  }

  const [isOpen, setIsOpen] = useState(false)
  return <Panel isOpen={isOpen} />
}

// ✅ Correct: hooks at top level, above early returns
function Profile({ user }: ProfileProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (!user) {
    return null
  }

  return <Panel isOpen={isOpen} />
}
```

Custom hooks are named `use*` and encapsulate reusable stateful logic.

## Custom hooks

Extract repeated stateful concerns; keep components thin.

```tsx
// ❌ Incorrect: same effect + state copied into every screen
function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedValue, setDebouncedValue] = useState(searchQuery)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(searchQuery), 300)
    return () => window.clearTimeout(timeoutId)
  }, [searchQuery])

  return <Results searchQuery={debouncedValue} />
}

// ✅ Correct: hook owns the stateful concern — reusable across screens
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs)

    return () => window.clearTimeout(timeoutId)
  }, [value, delayMs])

  return debouncedValue
}
```

Don’t hand-roll a general-purpose data-fetching hook when the repo already has React Query, router loaders, or server components — extend that stack instead.

## Effects

Effects synchronize with external systems (DOM, subscriptions, non-React APIs). Don’t use them to derive renderable state.

```tsx
// ❌ Incorrect: missing cleanup / object dep / derive in effect
useEffect(() => {
  const intervalId = setInterval(() => sync(user), 1000)
}, [user])

// ✅ Correct: cleanup + primitive deps — stable subscription per userId
useEffect(() => {
  const intervalId = setInterval(() => sync(userId), 1000)

  return () => clearInterval(intervalId)
}, [userId])
```

List real dependencies; don’t disable the lint rule to silence missing deps. Prefer primitive deps (`user.id`) over object deps (`user`).
