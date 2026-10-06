# Lists

Prefer `FlashList` v2 for long or dynamic data, and `ScrollView` / `View` +
`map` for short fixed content — the wrong choice either mounts every row or
adds list ceremony with no win. Use `FlatList` when the repo doesn’t have
`@shopify/flash-list` installed or the list is small and simple.

## Virtualized lists

Virtualized lists recycle off-screen rows so long/dynamic data doesn’t mount
every item at once. FlashList v2 measures rows itself — no size estimate.

```tsx
// ❌ Incorrect: ScrollView + map for unbounded lists — all rows mount at once
<ScrollView>
  {items.map((item) => (
    <ItemRow key={item.id} item={item} />
  ))}
</ScrollView>

// ✅ Correct: FlashList for dynamic/long data — recycles off-screen rows
import { FlashList } from '@shopify/flash-list'
import { Text } from 'react-native'

interface ItemRowProps {
  item: Item
}

export function ItemRow({ item }: ItemRowProps) {
  return <Text>{item.title}</Text>
}

<FlashList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <ItemRow item={item} />}
  contentInsetAdjustmentBehavior="automatic"
/>
```

- `keyExtractor` from stable identity (`id`), not array index.
- Keep `renderItem` light; extract row components.
- `FlatList` (same `data` / `keyExtractor` / `renderItem` props) when
  `@shopify/flash-list` isn’t installed — adding it is a new dependency, so ask
  first (`npx expo install @shopify/flash-list`) — or when the list is small
  and simple.
- Use `SectionList` for sectioned data when the screen is on `FlatList`.

## FlashList v1 to v2

When `@shopify/flash-list` 2.x is installed, v1 props are leftovers: v2 sizes
rows automatically and handles chat-style lists without flipping the list.

```tsx
// ❌ Incorrect: v1 props on FlashList 2.x — the size estimate is gone in v2
<FlashList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <ItemRow item={item} />}
  estimatedItemSize={72}
/>

// ✅ Correct: v2 — no size estimate
<FlashList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <ItemRow item={item} />}
/>
```

- Remove `estimatedItemSize` from every FlashList.
- Chat lists: replace `inverted` with `maintainVisibleContentPosition` and keep
  messages in chronological order; check its options in the installed
  package’s types.
- Type refs as `FlashListRef<Item>`.
- On FlashList 1.x, keep the v1 props until the repo upgrades.

## Short / static lists

`ScrollView` (or a plain `View`) + `map` is fine when the item count is small
and known — forms, settings rows, a handful of cards. Don’t reach for a
virtualized list just because something is a “list.”

```tsx
// ❌ Incorrect: FlatList for a handful of static rows — extra API, no win
<FlatList
  data={settings}
  keyExtractor={(setting) => setting.id}
  renderItem={({ item: setting }) => <SettingsRow setting={setting} />}
/>

// ✅ Correct: short, fixed content — all rows mount; that’s fine
<ScrollView contentInsetAdjustmentBehavior="automatic">
  {settings.map((setting) => (
    <SettingsRow key={setting.id} setting={setting} />
  ))}
</ScrollView>
```

- Unbounded, paginated, or “could grow a lot” → virtualized; dozens of fixed
  rows in a screen → `ScrollView` / `View` + `map`.

## Feeds and safe area

Prefer pull-to-refresh on feeds and system inset adjustment on lists — not
web-style refresh buttons.

```tsx
// ❌ Incorrect: refresh button instead of the native pull gesture
<Button title="Refresh" onPress={handleRefresh} />
<FlashList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <ItemRow item={item} />}
/>

// ✅ Correct: RefreshControl on a virtualized list
<FlashList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <ItemRow item={item} />}
  refreshControl={
    <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
  }
  contentInsetAdjustmentBehavior="automatic"
/>
```
