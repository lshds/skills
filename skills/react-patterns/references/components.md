# Components

Prefer function components with typed props — one primary component per file and stable list keys keep trees predictable and easy to scan.

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
