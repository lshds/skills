# Server

RSC and Server Action patterns in `.tsx` — no request data in module scope,
parallel fetch via composition, lean serialization, and `React.cache()`. Use
runtime `after()` (e.g. Next) only when the host provides it. Not generic Node
handlers or plain server `.ts` services.

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

## Parallel fetch via composition

RSC children run sequentially under a parent that `await`s. Split independent fetches into sibling async components (or `children`) so they start together.

```tsx
// ❌ Incorrect: Sidebar waits for Page’s fetch — server waterfall
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

// ✅ Correct: sibling async components fetch in parallel
async function Header() {
  const headerContent = await fetchHeader()

  return <div>{headerContent}</div>
}

async function Sidebar() {
  const sidebarItems = await fetchSidebarItems()

  return <nav>{sidebarItems.map(renderItem)}</nav>
}

export default function Page() {
  return (
    <div>
      <Header />
      <Sidebar />
    </div>
  )
}
```

## Minimize RSC serialization

Props crossing the server→client boundary are serialized into the payload. Pass only fields the client uses.

```tsx
// ❌ Incorrect: serializes the whole user object — client uses one field
async function Page() {
  const user = await fetchUser()

  return <Profile user={user} />
}

// ✅ Correct: pass only what the client needs
async function Page() {
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

Use `cache()` so auth, DB, and other non-`fetch` work runs once per request across the tree. Prefer primitive (or stable) arguments — shallow `Object.is` equality.

```typescript
import { cache } from 'react'

// ✅ Correct: deduped within one request
async function loadCurrentUser() {
  const session = await auth()

  if (!session?.user?.id) {
    return null
  }

  return db.user.findUnique({ where: { id: session.user.id } })
}

export const getCurrentUser = cache(loadCurrentUser)

// ❌ Incorrect: inline object args — new reference every call, always miss
const getUser = cache(async (params: { userId: number }) => {
  return db.user.findUnique({ where: { id: params.userId } })
})

getUser({ userId: 1 })
getUser({ userId: 1 })

// ✅ Correct: primitive args hit the cache
async function loadUserById(userId: number) {
  return db.user.findUnique({ where: { id: userId } })
}

const getUserById = cache(loadUserById)
```

In Next.js, same-URL `fetch` is already memoized per request — still use `React.cache()` for DB, auth, filesystem, and other async work.

## `after()` for non-blocking work

**Runtime-specific:** use `after()` only when the host provides it (e.g. Next.js `import { after } from 'next/server'`). Plain React RSC does not define a portable `after` API — if the runtime has no equivalent, keep post-response work in the platform’s documented hook or run it only after the response path the framework already supports.

When `after` exists, schedule logging, analytics, notifications, and similar side effects after the response is sent so they don’t block TTFB.

```typescript
import { after } from 'next/server' // example host API — not portable React

// ❌ Incorrect: logging blocks the response
export async function POST(request: Request) {
  await updateDatabase(request)
  await logUserAction({ /* … */ })

  return Response.json({ status: 'success' })
}

// ✅ Correct: respond first; side effects run after (when the runtime offers `after`)
export async function POST(request: Request) {
  await updateDatabase(request)

  after(async () => {
    await logUserAction({ /* … */ })
  })

  return Response.json({ status: 'success' })
}
```

- Applies in Server Actions, Route Handlers, and Server Components only when that runtime documents `after` (or an equivalent).
- Failures inside the callback still need a path (try/catch or reported rejection) — `after` owns scheduling, not silent drops.
