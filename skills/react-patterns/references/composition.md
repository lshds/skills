# Composition

Prefer `children` and compound parts over boolean prop matrices — callers choose structure without every combination living in one component.

## Children over flags

Compose with `children` and parts so callers choose structure instead of a boolean prop matrix.

```tsx
// ❌ Incorrect: boolean prop matrix — every combo lives in one component
interface CardProps {
  title: string
  showHeader?: boolean
  isCompact?: boolean
  isAdmin?: boolean
}

// ✅ Correct: compose with children / parts — caller chooses structure
interface CardChildrenProps {
  children: React.ReactNode
}

export function Card({ children }: CardChildrenProps) {
  return <div className="card">{children}</div>
}

export function CardHeader({ children }: CardChildrenProps) {
  return <header className="card-header">{children}</header>
}
```

## Compound components

Use when parent and children must share state (tabs, disclosure, menu):

```tsx
// ❌ Incorrect: mega-component with mutually exclusive props — hard to extend
interface TabsProps {
  tabs: string[]
  activeTab: string
  onChange: (tabId: string) => void
  renderPanel: (tabId: string) => React.ReactNode
}

// ✅ Correct: compound parts share context — each piece stays focused
interface TabsContextValue {
  activeTab: string
  setActiveTab: (tabId: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

interface TabsRootProps {
  defaultTab: string
  children: React.ReactNode
}

export function Tabs({ defaultTab, children }: TabsRootProps) {
  const [activeTab, setActiveTab] = useState(defaultTab)

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </TabsContext.Provider>
  )
}

function useTabs() {
  const tabsContext = useContext(TabsContext)

  if (!tabsContext) {
    throw new Error('Tab components must be used within Tabs')
  }

  return tabsContext
}

interface TabProps {
  tabId: string
  children: React.ReactNode
}

export function Tab({ tabId, children }: TabProps) {
  const { activeTab, setActiveTab } = useTabs()

  const handleClick = () => {
    setActiveTab(tabId)
  }

  return (
    <button
      type="button"
      aria-selected={activeTab === tabId}
      onClick={handleClick}
    >
      {children}
    </button>
  )
}
```
