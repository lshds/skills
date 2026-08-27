# Lists

Prefer virtualized lists for long or dynamic data, and `ScrollView` / `View` +
`map` for short fixed content — the wrong choice either mounts every row or
adds FlatList ceremony with no win.

## Virtualized lists

Virtualized lists recycle off-screen rows so long/dynamic data doesn’t mount
every item at once.

```tsx
// ❌ Incorrect: ScrollView + map for unbounded lists — all rows mount at once
<ScrollView>
  {items.map((item) => (
    <ItemRow key={item.id} item={item} />
  ))}
</ScrollView>

// ✅ Correct: FlatList for dynamic/long data — recycles off-screen rows
interface ItemRowProps {
  item: Item
}

export function ItemRow({ item }: ItemRowProps) {
  return <Text>{item.title}</Text>
}

<FlatList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <ItemRow item={item} />}
  contentInsetAdjustmentBehavior="automatic"
/>
```

- `keyExtractor` from stable identity (`id`), not array index.
- Keep `renderItem` light; extract row components.
- Use `SectionList` for sectioned data; FlashList when the repo already depends
  on it (preferred for large feeds).

## Short / static lists

`ScrollView` (or a plain `View`) + `map` is fine when the item count is small
and known — forms, settings rows, a handful of cards. Don’t reach for
`FlatList` just because something is a “list.”

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
<Button onPress={handleRefresh}>Refresh</Button>
<FlatList data={items} keyExtractor={(item) => item.id} renderItem={…} />

// ✅ Correct: RefreshControl on a virtualized list
<FlatList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <ItemRow item={item} />}
  refreshControl={
    <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
  }
  contentInsetAdjustmentBehavior="automatic"
/>
```
