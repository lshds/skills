# UI

Prefer native chrome, RN primitives, and the repo’s design system — web DOM
tags and removed RN modules break on native or fight platform look-and-feel.
Match packages and APIs the project already uses; don’t migrate existing code
for a newer Expo pattern. For **new** UI, you may suggest a modern option
(e.g. `@expo/ui`, Reanimated, system blur) — state it as a choice and let the
user decide; don’t apply it silently. Load `expo-ui` / `effects` references
only when the task needs `@expo/ui`, motion, blur, glass, or gradients.

## Library preferences

Use maintained Expo / community packages the project already depends on — not
removed RN core modules or parallel libs for the same job.

```tsx
// ❌ Incorrect: removed RN SafeAreaView / DOM img / legacy expo-av
import { SafeAreaView, Image } from 'react-native'
import { Audio } from 'expo-av'

<SafeAreaView>
  <img src={uri} />
</SafeAreaView>

// ✅ Correct: safe-area-context, expo-image, expo-audio / expo-video
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { useAudioPlayer } from 'expo-audio'
```

- Prefer Reanimated over RN `Animated` for **new** motion when the repo already
  uses Reanimated; don’t rip out working `Animated` code.
- Prefer `process.env.EXPO_OS` only when the repo already uses it.
- Try Expo Go first for SDK features it ships; custom native / non-Go modules →
  development client.

## Safe area and scrolling

Prefer headers, tabs, or list
`contentInsetAdjustmentBehavior="automatic"` over wrapping every screen in
`SafeAreaView`. Cover top and bottom insets. Apply the same inset prop on
`FlatList` / `SectionList`, not only `ScrollView`.

```tsx
// ❌ Incorrect: SafeAreaView wrapper + padding on the ScrollView itself
<SafeAreaView>
  <ScrollView style={{ padding: 16 }}>
    <Content />
  </ScrollView>
</SafeAreaView>

// ✅ Correct: system inset adjustment + contentContainerStyle
<ScrollView
  contentInsetAdjustmentBehavior="automatic"
  contentContainerStyle={{ padding: 16, gap: 12 }}
>
  <Content />
</ScrollView>
```

- A Stack route’s first child is usually that ScrollView / list.
- Prefer `useWindowDimensions` over `Dimensions.get()`; flex over hard-coded
  screen math. Nothing scrolls unless you wrap it.

## Layout and styling

Flex is always on with default **column**. Prefer gap, continuous border curves,
and stack titles over web-style chrome.

```tsx
// ❌ Incorrect: margin soup / legacy shadows / custom page title
<View style={{ marginBottom: 8 }}>
  <Text style={{ fontSize: 28 }}>Settings</Text>
  <View style={{ shadowOpacity: 0.2, elevation: 4 }} />
</View>

// ✅ Correct: gap, boxShadow, navigation owns the title
<Stack.Title>Settings</Stack.Title>
<View
  style={{
    gap: 12,
    borderCurve: 'continuous',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  }}
>
  <Row />
</View>
```

- Prefer padding over margin where possible.
- Style each node — no CSS cascade (except some `Text` props to nested `Text`).
- Don’t mix a second styling system in one feature.

## Colors

Follow the repo’s palette / theme. Don’t introduce a second color system or
rewrite a working hex/`PlatformColor` table to chase a newer API.

```tsx
// ❌ Incorrect: ad-hoc hex in every screen — drifts from the design system
<Text style={{ color: '#1a1a1a' }}>Title</Text>

// ✅ Correct: shared semantic tokens from the repo’s theme
import { colors } from '@/theme/colors'

<Text style={{ color: colors.label }}>Title</Text>
```

- If the project already uses `Color` from `expo-router`, keep using it (with a
  web hex `default` via `Platform.select`). Don’t adopt it just because it’s
  newer.
- Don’t pass dynamic `Color` / `PlatformColor` into Reanimated styles — use
  static colors there.
- Some third-party props (e.g. `tintColor` on `expo-image`) accept only
  `string` — cast when needed.

## Text and controls

Use selectable / tabular text where it helps, and platform-native controls over
restyled web widgets.

```tsx
// ❌ Incorrect: non-selectable error / custom toggle that looks like a checkbox
<Text>{errorMessage}</Text>
<Pressable onPress={() => setIsOn((currentIsOn) => !currentIsOn)}>
  <Text>{isOn ? 'On' : 'Off'}</Text>
</Pressable>

// ✅ Correct: selectable errors; Switch for binary settings
<Text selectable>{errorMessage}</Text>
<Switch value={isOn} onValueChange={handleValueChange} />
```

- Mode (≤4 short labels) → segmented control; keep labels short and avoid
  custom colors so native dark mode still works.
- Continuous value → slider; date/time → DateTimePicker; many options → picker /
  menu.
- Modal → Stack `modal` / form sheet.
- Settings rows → grouped list; `@expo/ui` `FieldGroup` only when the repo
  already uses `@expo/ui`.
- Long feed → FlatList / FlashList — not `@expo/ui` `List`.
- Counters: `{ fontVariant: 'tabular-nums' }`. Format large counts for display
  (`1.4M`, `38k`) when exact digits aren’t required.
- `TextInput`: match `keyboardType` / `secureTextEntry` / `returnKeyType` to
  the field; multiline needs `textAlignVertical="top"`.
- Label controls above or to the left; group related controls in sections.
- Prefer controls with built-in haptics (`Switch`, DateTimePicker) — don’t add
  extra `expo-haptics` on top of them.

## Icons

Use the icon set and helper the repo already ships. Don’t introduce a second
icon library in the same feature.

```tsx
// ❌ Incorrect: second icon library beside the repo’s set
<FontAwesome name="home" />

// ✅ Correct: same icon helper / set the project already uses
<Icon name="home" size={24} />
```

- Keep sizes consistent (`16` / `20` / `24` / `32`); match weight to nearby text.
- SF Symbols (`expo-image` `sf:…`) are an iOS option only if the project
  already uses them — not a cross-platform substitute for Ionicons / Material /
  FontAwesome.

## Media

Gate camera / location / notifications behind the repo’s permission UI.
`MediaLibrary.saveToLibraryAsync` needs a local file path — write base64 to
disk first.

```tsx
// ❌ Incorrect: pass a data URI / base64 string to the media library
await MediaLibrary.saveToLibraryAsync(base64DataUri)

// ✅ Correct: write bytes to a cache file, then save that URI
import { File, Paths } from 'expo-file-system'

const photoFile = new File(Paths.cache, 'shot.jpg')
// write bytes, then:
await MediaLibrary.saveToLibraryAsync(photoFile.uri)
```

- Full-screen camera: hide the nav header; use `mirror` on the front camera.
- Request camera permission eagerly; media-library permission lazily (on save /
  pick).
- Prefer system chrome the SDK/repo already uses for camera UI — don’t add
  liquid glass unless the product already depends on it.
