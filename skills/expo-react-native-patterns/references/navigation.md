# Navigation

Prefer Expo Router file-based routes with thin screens and serializable params —
layouts own chrome, screens stay testable, and ids survive deep links. Match the
repo’s Router / tabs setup; don’t migrate existing navigation for a newer API.
For **new** navigation, you may suggest options (e.g. NativeTabs,
`Stack.SearchBar`, Link previews) — state them as a choice and let the user
decide; don’t apply them silently.

## Route conventions

Routes live under `app/`; stacks are defined in `_layout.tsx`. Don’t add a
second navigator beside Router.

```tsx
// ❌ Incorrect: co-located util in app/ + hand-rolled navigator beside Router
// app/utils/format.ts
import { NavigationContainer } from '@react-navigation/native'

// ✅ Correct: routes only in app/; navigate with expo-router
import { Stack } from 'expo-router/stack'
import { Link, router } from 'expo-router'

export default function Layout() {
  return <Stack />
}
```

- Dynamic: `[id].tsx`; catch-all: `[...slug].tsx`; groups `(auth)` omit from URL.
- Prefer path aliases over deep relative imports when configured.
- SDK 56+: never import `@react-navigation/*` in app code — the bundler
  errors. Use `expo-router/react-navigation` (or `expo-router/js-stack` /
  `js-tabs` / `js-top-tabs` when those navigators are needed). Pre-56 can
  keep `@react-navigation/*` until upgrade.
- Header search: use `Stack.SearchBar` when the repo already does, or suggest it
  for new search UI — don’t retrofit every stack.
- Add `+not-found.tsx` for unmatched routes; `unstable_settings.anchor` for
  stack anchors.

## Link

Use `<Link>` (with `asChild` + `Pressable` for custom children) instead of
ad-hoc press handlers that only call `router.push` when a declarative link fits.

```tsx
// ❌ Incorrect: Pressable that only pushes — loses Link semantics / previews
<Pressable onPress={() => router.push('/settings')}>
  <Text>Settings</Text>
</Pressable>

// ✅ Correct: Link + asChild
import { Link } from 'expo-router'

<Link href="/settings" asChild>
  <Pressable>
    <Text>Settings</Text>
  </Pressable>
</Link>
```

- `Link.Trigger` / `Link.Preview` / `Link.Menu` only when the product already
  uses them (or the user opts in) — don’t bolt them onto every link.

## Titles, tabs, and stacks

Prefer stack titles and a Stack nested **inside** each tab — per-tab headers and
history. Root tabs often hide their own header.

```tsx
// ❌ Incorrect: custom in-page title + tabs without inner stacks
export default function HomeScreen() {
  return (
    <View>
      <Text style={{ fontSize: 28 }}>Home</Text>
      <Feed />
    </View>
  )
}

// ✅ Correct: Stack.Title / screen options; tabs wrap stacks
import { Stack } from 'expo-router/stack'

export default function HomeScreen() {
  return (
    <>
      <Stack.Title>Home</Stack.Title>
      <Feed />
    </>
  )
}
```

Typical tab layout — Stack nested inside each tab:

```text
app/
  _layout.tsx           — NativeTabs / Tabs (headerShown: false)
  (home)/
    _layout.tsx         — Stack
    index.tsx
  (settings)/
    _layout.tsx         — Stack
    index.tsx
  (home,settings)/
    info.tsx            — shared across tabs
```

- Keep the tab API the repo already uses (`Tabs` or `NativeTabs`). For new apps
  or new tab roots, you may suggest `NativeTabs` when the SDK supports it —
  user decides; don’t swap JS tabs mid-app.
- Shared screens: array/group routes (`(home,settings)/`) with anchors as needed.

## Modals and sheets

Prefer Stack `presentation` over custom modal components.

```tsx
// ❌ Incorrect: bespoke Modal overlay for a routed flow
import { Modal } from 'react-native'

<Modal visible={open}>{/* form */}</Modal>

// ✅ Correct: Stack modal / form sheet screens
<Stack.Screen name="modal" options={{ presentation: 'modal' }} />
<Stack.Screen
  name="sheet"
  options={{
    presentation: 'formSheet',
    sheetGrabberVisible: true,
    sheetAllowedDetents: [0.5, 1.0],
    contentStyle: { backgroundColor: 'transparent' },
  }}
/>
```

## Thin screens

Load data through existing hooks or loaders — not inline fetch plus chrome in
the route file.

```tsx
// ❌ Incorrect: fat screen — fetch + layout chrome in one file
export default function ProfileScreen() {
  const [user, setUser] = useState(null)
  useEffect(() => {
    fetch('/api/me').then((response) => response.json()).then(setUser)
  }, [])

  return (
    <View>
      <TabBar />
      <ProfileForm user={user} />
    </View>
  )
}

// ✅ Correct: thin screen — data via hooks / loaders
export default function ProfileScreen() {
  const { user, status } = useCurrentUser()

  if (status === 'loading') {
    return <LoadingState />
  }

  if (status === 'error' || !user) {
    return <ErrorState />
  }

  return <ProfileView user={user} />
}
```

## Params

Pass ids and simple serializable values; validate at the screen boundary.

```tsx
// ❌ Incorrect: large object stuffed into route params
router.push({ pathname: '/user', params: { user: JSON.stringify(user) } })

// ✅ Correct: id only; load full model in the screen
router.push(`/user/${user.id}`)
const { id: userId } = useLocalSearchParams<{ id: string }>()
```

- Pathname: `usePathname()`. Inside Expo DOM components, read params in the
  native parent and pass as props.
