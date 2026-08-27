# Slots

Prefer parallel `@` slots and an intercepting `(.)` modal over awaiting every
panel in one page, so each slot can load on its own and refresh still hits the
full route.

## Parallel slots

A folder named `@analytics` becomes an `analytics` prop on the layout. Give
the slot its own `page.tsx` and `loading.tsx` so a slow panel does not block
the main column.

```tsx
// ❌ Incorrect: page awaits every panel in one tree
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

// ✅ Correct: @analytics and @team are layout slots
// app/dashboard/layout.tsx
import type { ReactNode } from 'react'

interface DashboardLayoutProps {
  children: ReactNode
  analytics: ReactNode
  team: ReactNode
}

export default function DashboardLayout({
  children,
  analytics,
  team,
}: DashboardLayoutProps) {
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

## `default.tsx` for empty slots

A parallel slot 404s when the current URL has no matching page for that slot.
Add `default.tsx` that returns `null` (or a quiet placeholder).

```tsx
// ❌ Incorrect: no default — /dashboard/settings 404s the @analytics slot
// app/dashboard/@analytics/page.tsx exists, but settings has no matching page
export default async function AnalyticsSlot() {
  const analyticsStats = await fetchAnalyticsStats()

  return <AnalyticsChart analyticsStats={analyticsStats} />
}

// ✅ Correct: default fills the slot when this URL has no @analytics page
// app/dashboard/@analytics/default.tsx
export default function AnalyticsDefault() {
  return null
}
```

## Intercepting modal

`(.)photos/[id]` intercepts `/photos/[id]` on client navigation and renders
inside the `@modal` slot. The real `app/photos/[id]/page.tsx` still handles
refresh and shared links.

```tsx
// ❌ Incorrect: modal only — refresh and shared links have no full page
// app/@modal/(.)photos/[id]/page.tsx
import { notFound } from 'next/navigation'

interface PhotoModalProps {
  params: Promise<{ id: string }>
}

export default async function PhotoModal({ params }: PhotoModalProps) {
  const { id: photoId } = await params

  const photo = await fetchPhotoById(photoId)

  if (photo === null) {
    notFound()
  }

  return (
    <dialog open>
      <PhotoDetail photo={photo} />
    </dialog>
  )
}

// ✅ Correct: intercept for client nav; full page for refresh; default for empty slot
// app/layout.tsx
import type { ReactNode } from 'react'

interface RootLayoutProps {
  children: ReactNode
  modal: ReactNode
}

export default function RootLayout({ children, modal }: RootLayoutProps) {
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

interface PhotoModalProps {
  params: Promise<{ id: string }>
}

export default async function PhotoModal({ params }: PhotoModalProps) {
  const { id: photoId } = await params

  const photo = await fetchPhotoById(photoId)

  if (photo === null) {
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

// app/photos/[id]/page.tsx
import { notFound } from 'next/navigation'

interface PhotoPageProps {
  params: Promise<{ id: string }>
}

export default async function PhotoPage({ params }: PhotoPageProps) {
  const { id: photoId } = await params

  const photo = await fetchPhotoById(photoId)

  if (photo === null) {
    notFound()
  }

  return (
    <article>
      <PhotoDetail photo={photo} />
      <RelatedPhotos photoId={photoId} />
    </article>
  )
}
```
