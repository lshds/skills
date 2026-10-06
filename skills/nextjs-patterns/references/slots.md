# Slots

Prefer parallel `@` slots with their own `loading.tsx`, and an intercepting
`(.)` modal backed by a full page, over one page that awaits every panel, so
each panel streams on its own and a refresh or shared link still renders the
full route. Every slot gets a `default.tsx`.

## Parallel slots for independent panels

A folder named `@analytics` becomes an `analytics` prop on the layout. With its
own `page.tsx` and `loading.tsx`, a slow panel no longer blocks the main
column.

```tsx
// ❌ Incorrect: one page awaits every panel — the slowest query holds the whole dashboard
export default async function DashboardPage() {
  const [analyticsStats, teamMembers] = await Promise.all([
    fetchAnalyticsStats(),
    fetchTeamMembers(),
  ])

  return (
    <div>
      <AnalyticsChart analyticsStats={analyticsStats} />
      <TeamList teamMembers={teamMembers} />
    </div>
  )
}

// ✅ Correct: @analytics and @team are slots; LayoutProps types children and both slots
// app/dashboard/layout.tsx
export default function DashboardLayout({
  children,
  analytics,
  team,
}: LayoutProps<'/dashboard'>) {
  return (
    <div>
      <main>{children}</main>
      <aside>{analytics}</aside>
      <aside>{team}</aside>
    </div>
  )
}

// app/dashboard/@analytics/page.tsx
export default async function AnalyticsSlot() {
  const analyticsStats = await fetchAnalyticsStats()

  return <AnalyticsChart analyticsStats={analyticsStats} />
}

// app/dashboard/@analytics/loading.tsx
export default function AnalyticsLoading() {
  return <ChartSkeleton />
}

// app/dashboard/@team/page.tsx
export default async function TeamSlot() {
  const teamMembers = await fetchTeamMembers()

  return <TeamList teamMembers={teamMembers} />
}
```

## `default.tsx` for every slot

On a full page load of a URL where a slot has no matching page, Next renders
that slot's `default.tsx`; without one, the route 404s.

```text
# ❌ Incorrect: no default.tsx — a refresh on /dashboard/settings 404s because @analytics has no settings page
app/dashboard/settings/page.tsx
app/dashboard/@analytics/page.tsx

# ✅ Correct: default.tsx fills @analytics on URLs it has no page for
app/dashboard/settings/page.tsx
app/dashboard/@analytics/page.tsx
app/dashboard/@analytics/default.tsx
```

- `default.tsx` returns `null` or the panel's quiet empty state.

## Intercepting modal plus the full page

`(.)photos/[id]` inside `@modal` intercepts `/photos/[id]` on client
navigation and renders it in the modal slot. A refresh or shared link skips the
interception, so the real `app/photos/[id]/page.tsx` must exist.

```text
# ❌ Incorrect: modal only — a refresh or shared link on /photos/42 has no full page to render
app/layout.tsx
app/@modal/(.)photos/[id]/page.tsx

# ✅ Correct: intercept for client navigation, full page for refresh, default for the empty slot
app/layout.tsx
app/@modal/(.)photos/[id]/page.tsx
app/@modal/default.tsx
app/photos/[id]/page.tsx
```

```tsx
// ✅ Correct: the root layout renders the slot; the modal loads the photo the full page loads
// app/layout.tsx
export default function RootLayout({ children, modal }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body>
        {children}
        {modal}
      </body>
    </html>
  )
}

// app/@modal/(.)photos/[id]/page.tsx
import { notFound } from 'next/navigation'

export default async function PhotoModal({
  params,
}: PageProps<'/photos/[id]'>) {
  const { id: photoId } = await params
  const photo = await fetchPhotoById(photoId)

  if (!photo) {
    notFound()
  }

  return (
    <dialog open>
      <PhotoDetail photo={photo} />
    </dialog>
  )
}

// app/@modal/default.tsx
export default function ModalDefault() {
  return null
}
```

- `app/photos/[id]/page.tsx` is an ordinary page that loads the same photo with
  `fetchPhotoById` and renders `<PhotoDetail>` with the rest of the route's
  chrome.
