# Server

Prefer request data in props or `React.cache()`, parallel fetches through
composition, and lean props across the client boundary over module-scope
state, awaiting parents, and whole objects in the payload — so server renders
don’t leak between users, waterfall, or bloat the RSC payload. Covers RSC and
Server Action patterns in `.tsx`, not generic Node handlers or plain server
`.ts` services.

## No request data in module scope

Server renders can run concurrently in one process. Mutable module variables
for request-scoped data cause races and cross-user leaks.

```tsx
// ❌ Incorrect: module state shared across concurrent requests
let currentUser: User | null = null

export default async function Page() {
  currentUser = await auth()

  return <Dashboard />
}

function Dashboard() {
  return <div>{currentUser?.name}</div>
}

// ✅ Correct: keep request data in the render tree (props) or React.cache()
export default async function Page() {
  const user = await auth()

  return <Dashboard user={user} />
}

interface DashboardProps {
  user: User | null
}

function Dashboard({ user }: DashboardProps) {
  return <div>{user?.name}</div>
}
```

Safe at module scope: immutable static assets/config, keyed cross-request caches, singletons that never hold user/request data.

## Parallel fetch and streaming via composition

An async parent that `await`s blocks everything below it: child fetches start
only after the parent’s resolves, and nothing streams until the slowest one
finishes. Split independent fetches into sibling async components (or
`children`) so they start together, and wrap the slow part — not the whole
layout — in `<Suspense>` so the shell renders first.

```tsx
// ❌ Incorrect: Page awaits the header — Sidebar’s fetch starts late and the shell waits for both
export default async function Page() {
  const headerContent = await fetchHeader()

  return (
    <div>
      <div>{headerContent}</div>
      <Sidebar />
    </div>
  )
}

async function Sidebar() {
  const sidebarItems = await fetchSidebarItems()

  return <nav>{sidebarItems.map(renderItem)}</nav>
}

// ✅ Correct: sibling async components fetch in parallel; Suspense streams the sidebar behind a fallback
import { Suspense } from 'react'

async function Header() {
  const headerContent = await fetchHeader()

  return <div>{headerContent}</div>
}

export default function Page() {
  return (
    <div>
      <Header />
      <Suspense fallback={<SidebarSkeleton />}>
        <Sidebar />
      </Suspense>
    </div>
  )
}
```

- Put the boundary around the part that needs the data. A boundary around the
  whole page shows only the fallback until every fetch inside it resolves.

## Minimize RSC serialization

Props crossing the server→client boundary are serialized into the payload. Pass only fields the client uses.

```tsx
// ❌ Incorrect: serializes the whole user object — client uses one field
export default async function Page() {
  const user = await fetchUser()

  return <Profile user={user} />
}

// ✅ Correct: pass only what the client needs
export default async function Page() {
  const user = await fetchUser()

  return <Profile name={user.name} />
}
```

Serialization dedupes by **reference**, not value. Prefer one prop and transform on the client over sending original + derived copies from the server.

```tsx
// ❌ Incorrect: two arrays — primitives duplicated in the payload
<ClientList usernames={usernames} usernamesOrdered={usernames.toSorted()} />

// ✅ Correct: send once; sort/filter/map on the client
<ClientList usernames={usernames} />
```

Exception: send derived data when the transform is expensive or the client never needs the original.

## Per-request dedupe with `React.cache()`

Use `cache()` so auth, DB, and other non-`fetch` work runs once per request across the tree.

```typescript
// ✅ Correct: deduped within one request
import { cache } from 'react'

async function loadCurrentUser() {
  const session = await auth()

  if (!session?.user?.id) {
    return null
  }

  return db.user.findUnique({ where: { id: session.user.id } })
}

export const getCurrentUser = cache(loadCurrentUser)
```

The cache key compares arguments with shallow `Object.is` equality — prefer primitive (or stable) arguments.

```typescript
// ❌ Incorrect: inline object args — new reference every call, always miss
async function loadUserById({ userId }: { userId: number }) {
  return db.user.findUnique({ where: { id: userId } })
}

const getUserById = cache(loadUserById)

getUserById({ userId: 1 })
getUserById({ userId: 1 })

// ✅ Correct: primitive args hit the cache
async function loadUserById(userId: number) {
  return db.user.findUnique({ where: { id: userId } })
}

const getUserById = cache(loadUserById)

getUserById(1)
getUserById(1)
```

A framework that memoizes same-URL `fetch` per request doesn’t cover DB, auth, filesystem, or other async work — still wrap those in `React.cache()`.

## Defer non-blocking side effects

Defer logging, analytics, and notifications with the host framework’s post-response API, and never await them on the render path — each awaited side effect adds its latency to the response.
