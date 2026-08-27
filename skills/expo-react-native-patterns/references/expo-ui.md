# Expo UI

Only apply this file when the repo already depends on `@expo/ui` (or the task
explicitly adopts it). Don’t add the package just to match these patterns.

## Host and universal components

Wrap every `@expo/ui` tree in `Host` from the package root. Prefer universal
components over SwiftUI / Compose splits when the API exists (universal needs
SDK 56+). Confirm props against the installed package’s `.d.ts`.

```tsx
// ❌ Incorrect: platform SwiftUI in a shared file / missing Host
import { Button } from '@expo/ui/swift-ui'

return <Button onPress={handleSave}>Save</Button>

// ✅ Correct: Host + universal components from @expo/ui
import { Host, Column, Button, Text } from '@expo/ui'

return (
  <Host matchContents>
    <Column>
      <Text>Hello</Text>
      <Button onPress={handleSave}>Save</Button>
    </Column>
  </Host>
)
```

- Decision order: (1) universal `@expo/ui`, (2) `swift-ui` / `jetpack-compose`
  only when universal lacks the API, (3) `@expo/ui/community/…` when replacing
  an existing community dependency.
- Universal building blocks: `Host`, `Column` / `Row`, `Button`, `Switch`,
  `Checkbox`, `Slider`, `TextInput`, `Picker`, `BottomSheet`, `Collapsible`,
  `List` / `ListItem`, `FieldGroup`.

## Lists and inputs

Don’t use `@expo/ui` `List` for large feeds — each `ListItem` runs on the JS
thread. `TextInput` takes `useNativeState`, not a plain string (needs
`react-native-worklets` for flicker-free updates).

```tsx
// ❌ Incorrect: @expo/ui List for a large feed / RN-style string value
<List>
  {users.map((user) => (
    <ListItem key={user.id}>{user.name}</ListItem>
  ))}
</List>
<TextInput value={text} onChangeText={setText} />

// ✅ Correct: FlatList for feeds; useNativeState for @expo/ui TextInput
import { FlatList } from 'react-native'
import { Host, TextInput, useNativeState } from '@expo/ui'

<FlatList
  data={users}
  keyExtractor={(user) => user.id}
  renderItem={({ item: user }) => <UserRow user={user} />}
/>

const inputText = useNativeState('')

<Host matchContents>
  <TextInput
    value={inputText}
    onChangeText={(nextText) => {
      'worklet'
      inputText.value = nextText
    }}
  />
</Host>
```

## Platform trees

`@expo/ui/swift-ui` is iOS-only; `@expo/ui/jetpack-compose` is Android-only —
wrong-platform imports crash. Never put platform-suffixed files under `app/`.
`Host` always comes from `@expo/ui`. Use `RNHostView` to embed RN children
inside a SwiftUI/Compose tree.

```tsx
// ❌ Incorrect: swift-ui Host import / platform-suffixed route under app/
// app/settings.ios.tsx
import { Host } from '@expo/ui/swift-ui'

// ✅ Correct: platform file under components/; Host from @expo/ui root
// components/SettingsForm.ios.tsx
import { Host } from '@expo/ui'
import { VStack, RNHostView } from '@expo/ui/swift-ui'
import { Pressable } from 'react-native'

<Host matchContents>
  <VStack>
    <RNHostView matchContents>
      <Pressable />
    </RNHostView>
  </VStack>
</Host>
```

- Compose `LazyColumn` needs `<Host style={{ flex: 1 }}>`; still not for large
  feeds — use FlatList / FlashList.
- Android icons: Material Symbols XML under `assets/` via
  `<Icon source={require('./icon.xml')} />`.

## Community drop-ins

Use community drop-ins only when **replacing** an existing RN UI dependency the
repo already has — not to introduce `@expo/ui` alongside a working library.

```tsx
// ❌ Incorrect: keep a parallel community sheet when migrating to @expo/ui
import BottomSheet from '@gorhom/bottom-sheet'

// ✅ Correct: API-compatible community drop-in (migration in progress)
import BottomSheet, {
  BottomSheetView,
} from '@expo/ui/community/bottom-sheet'
```

Drop-in import map when replacing an existing community dependency:

- `@gorhom/bottom-sheet` → `@expo/ui/community/bottom-sheet`
- `@react-native-community/datetimepicker` →
  `@expo/ui/community/datetime-picker`
- `@react-native-menu/menu` → `@expo/ui/community/menu`
- `react-native-pager-view` → `@expo/ui/community/pager-view`
- `@react-native-picker/picker` → `@expo/ui/community/picker`
- `@react-native-segmented-control/segmented-control` →
  `@expo/ui/community/segmented-control`
- `@react-native-community/slider` → `@expo/ui/community/slider`
- `@react-native-masked-view/masked-view` → `@expo/ui/community/masked-view`
