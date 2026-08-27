# State

Local state first — derive during render. Share via Context or a store only
when several components need the same client UI state.

## Derive during render

Don’t mirror props or filter results in state — derive them during render instead of syncing with effects. Syncing through an effect adds an extra render and stale copies.

```tsx
// ❌ Incorrect: mirror props / derived values in state — redundant sync
const [visibleItems, setVisibleItems] = useState(items)
useEffect(() => {
  setVisibleItems(items.filter((item) => item.isActive))
}, [items])

// ✅ Correct: derive during render — not stored
const visibleItems = items.filter((item) => item.isActive)
```

## Local UI state

Keep open/close, selection, and draft UI state local to the component that owns the interaction.

```tsx
// ✅ Correct: local UI state — open/close, selection, drafts
const [isOpen, setIsOpen] = useState(false)
```

## Lazy init for expensive defaults

Pass a function to `useState` so expensive defaults run once, not on every render.

```tsx
// ❌ Incorrect: expensive default re-runs every render
const [searchIndex, setSearchIndex] = useState(buildSearchIndex(items))

// ✅ Correct: lazy init for expensive defaults — runs once
const [searchIndex, setSearchIndex] = useState(() => buildSearchIndex(items))
```

## Functional updates

When the next value depends on the previous one, use a functional updater to avoid stale closures.

```tsx
// ❌ Incorrect: stale closure when next depends on prev
setItems([...items, item])

// ✅ Correct: functional update when next depends on prev
setItems((currentItems) => [...currentItems, item])
```

## Context + reducer (shared UI)

Use when several components share complex client state. Keep server/remote data in the repo’s data layer, not duplicated here.

```tsx
// ❌ Incorrect: prop-drill shared UI state through unrelated parents
function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return (
    <>
      <Toolbar selectedId={selectedId} onSelect={setSelectedId} />
      <Sidebar selectedId={selectedId} onSelect={setSelectedId} />
      <Panel selectedId={selectedId} />
    </>
  )
}

// ✅ Correct: Context + reducer for shared client UI
interface SelectionState {
  selectedId: string | null
}

type SelectionAction =
  | { type: 'select'; selectedId: string }
  | { type: 'clear' }

interface SelectionContextValue {
  state: SelectionState
  dispatch: React.Dispatch<SelectionAction>
}

function selectionReducer(
  state: SelectionState,
  action: SelectionAction,
): SelectionState {
  switch (action.type) {
    case 'select':
      return { selectedId: action.selectedId }
    case 'clear':
      return { selectedId: null }
    default: {
      const exhaustiveCheck: never = action
      return exhaustiveCheck
    }
  }
}

const SelectionContext = createContext<SelectionContextValue | null>(null)

interface SelectionProviderProps {
  children: React.ReactNode
}

export function SelectionProvider({ children }: SelectionProviderProps) {
  const [state, dispatch] = useReducer(selectionReducer, { selectedId: null })

  return (
    <SelectionContext.Provider value={{ state, dispatch }}>
      {children}
    </SelectionContext.Provider>
  )
}

export function useSelection() {
  const selectionContext = useContext(SelectionContext)

  if (!selectionContext) {
    throw new Error('useSelection must be used within SelectionProvider')
  }

  return selectionContext
}
```

Prefer the repo’s store (Zustand, etc.) when that is already the shared-state pattern — don’t add Context+reducer beside an existing store in the same feature.
