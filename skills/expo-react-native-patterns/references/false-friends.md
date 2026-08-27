# False Friends

False friends are web APIs and UX patterns that look portable but fail on
native — prefer the RN/Expo equivalent and redesign for thumb-first mobile,
not a 1:1 pixel port of the web UI.

## Elements and events

Map DOM elements and web events to RN primitives — all text must sit in
`Text`, and handlers receive values directly.

```tsx
// ❌ Incorrect: DOM tags / onClick / e.target.value on native
<div onClick={handleClick}>
  <span>{title}</span>
  <input onChange={(event) => setName(event.target.value)} />
</div>

// ✅ Correct: View / Text / TextInput / onPress / onChangeText
interface SaveRowProps {
  title: string
  name: string
  onNameChange: (name: string) => void
  onSave: () => void
}

export function SaveRow({ title, name, onNameChange, onSave }: SaveRowProps) {
  return (
    <View>
      <Text>{title}</Text>
      <TextInput value={name} onChangeText={onNameChange} />
      <Pressable onPress={onSave}>
        <Text>Save</Text>
      </Pressable>
    </View>
  )
}
```

| Web | Native |
| --- | --- |
| `img` | `expo-image` / `Image` (explicit size or flex parent) |
| `button` / `a` | `Pressable` + `Link` (`asChild`) |
| `.map` long lists | `FlatList` / FlashList |

## Layout and styling

Flex defaults to **column**, nothing scrolls unless wrapped, and there is no CSS
cascade or `position: fixed`.

```tsx
// ❌ Incorrect: assume row flex / body scroll / fixed chrome
<div style={{ display: 'flex' }}> {/* web default row */}
  <header style={{ position: 'fixed' }} />
  {longContent}
</div>

// ✅ Correct: column flex + explicit ScrollView + absolute + insets when pinning
<View style={{ flex: 1, gap: 12 }}>
  <ScrollView contentInsetAdjustmentBehavior="automatic">
    {longContent}
  </ScrollView>
</View>
```

| Web | Native |
| --- | --- |
| `px` / `rem` / CSS files | unitless dp; StyleSheet / repo styling system |
| `@media` | `useWindowDimensions` / `Platform` |
| CSS transitions | Reanimated |

## Navigation and data

Relative fetches and browser storage don’t transfer — use Expo Router and
absolute `EXPO_PUBLIC_*` URLs.

```tsx
// ❌ Incorrect: relative fetch / window.location / cookie session assumptions
await fetch('/api/me')
window.location.href = '/login'

// ✅ Correct: absolute API URL + expo-router
await fetch(`${process.env.EXPO_PUBLIC_API_URL}/me`)
router.replace('/login')
```

| Web | Native |
| --- | --- |
| React Router / Next routes | Expo Router file routes |
| `localStorage` cookies/session | prefs store + SecureStore tokens |
| RSC / Server Actions in the tree | client fetch + API routes |
| `window` / `document` | none (or Expo DOM / WebView island) |

## UX redesign

If a screenshot of the native screen could pass for the web version, redesign
until it could pass for something the OS shipped.

```tsx
// ❌ Incorrect: top nav links + hover menu + refresh button restyled for mobile
<TopNav />
<button onMouseEnter={handleShowMenu}>More</button>
<button onClick={handleRefresh}>Refresh</button>

// ✅ Correct: bottom tabs, long-press menu, pull-to-refresh
<Tabs />
<Pressable onLongPress={handleShowMenu}>
  <Text>More</Text>
</Pressable>
<FlatList refreshControl={<RefreshControl … />} />
```

| Web pattern | Native prefer |
| --- | --- |
| Page modal / dialog | Form sheet / bottom sheet |
| Multi-column dashboard | Single column + stack / tabs |
| Stripe.js for digital goods | Store IAP (policy), not a web SDK swap |
