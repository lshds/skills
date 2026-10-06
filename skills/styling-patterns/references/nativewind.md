# NativeWind

Prefer stable NativeWind v4 on a Tailwind CSS v3 config over the v5 release
candidate so builds don’t depend on pre-release packages. Inside a NativeWind v4
app, `tailwind.config.js` and the `@tailwind` directives are the correct setup —
the web Tailwind v4 CSS-first entry does not apply there. Match the major the
repo already runs, and don’t mix `StyleSheet` with `className` in one feature.

## Match the repo

Use NativeWind when that’s the project’s styling system, and keep one system per
feature — `StyleSheet.create` beside `className` splits every style decision in
two. Detect the major before touching tooling: v4 has
`withNativeWind(config, { input })` in Metro, `tailwind.config.js` with
`nativewind/preset`, `@tailwind` directives, and `nativewind/babel`; v5 has
`withNativewind` with no `input`,
`@import 'nativewind/theme'`, and `react-native-css` in `package.json`. Don’t
change majors unless asked.

```tsx
import { StyleSheet, View } from 'react-native'

// ❌ Incorrect: StyleSheet and className together
const styles = StyleSheet.create({ box: { padding: 16 } })

export function Box() {
  return <View className="flex-1" style={styles.box} />
}

// ✅ Correct: NativeWind only
export function Box() {
  return <View className="flex-1 p-4 gap-3" />
}
```

Stay on the surface’s existing system — don’t introduce `className` into a
StyleSheet-only feature.

```tsx
import { StyleSheet, View } from 'react-native'

// ❌ Incorrect: className in a StyleSheet-only surface
export function Box() {
  return <View className="p-4" />
}

// ✅ Correct: StyleSheet when that is the surface’s system
const styles = StyleSheet.create({ box: { padding: 16 } })

export function Box() {
  return <View style={styles.box} />
}
```

## Entry and tooling

Wire Babel, Metro, the Tailwind config, and one global CSS entry together — a
missing piece compiles without error and `className` does nothing on device.
Metro and Babel configs stay CommonJS. Match the repo’s paths; don’t invent a
second stack.

```js
// ❌ Incorrect: Metro without NativeWind — className never compiles (metro.config.js)
const { getDefaultConfig } = require('expo/metro-config')

module.exports = getDefaultConfig(__dirname)

// ✅ Correct: withNativeWind wraps the default config and points at the CSS entry
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

const config = getDefaultConfig(__dirname)

module.exports = withNativeWind(config, { input: './global.css' })
```

```js
// ❌ Incorrect: plain Expo preset — JSX never routes className through NativeWind (babel.config.js)
module.exports = function (api) {
  api.cache(true)

  return { presets: ['babel-preset-expo'] }
}

// ✅ Correct: jsxImportSource plus the NativeWind Babel preset
module.exports = function (api) {
  api.cache(true)

  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  }
}
```

```js
// ❌ Incorrect: no NativeWind preset and no content globs — utilities never generate (tailwind.config.js)
module.exports = {
  theme: { extend: {} },
}

// ✅ Correct: content covers every file that uses className; NativeWind preset applied
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: { extend: {} },
}
```

```css
/* ❌ Incorrect: web Tailwind v4 entry in a NativeWind v4 app — v4 compiles with Tailwind v3 */
@import 'tailwindcss';

/* ✅ Correct: Tailwind v3 directives are the NativeWind v4 entry (global.css) */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

```tsx
import { View } from 'react-native'

// ❌ Incorrect: no global CSS import, or re-importing it in leaf screens
export default function Screen() {
  return <View className="flex-1" />
}

// ✅ Correct: import global CSS once at the top-most app component
import './global.css'

export default function App() {
  return <View className="flex-1 items-center justify-center" />
}
```

- For TypeScript, use a dedicated ambient file `nativewind-env.d.ts` containing
  `/// <reference types="nativewind/types" />` — not `nativewind.d.ts`, and not
  a name that collides with a folder, such as `app.d.ts` beside `/app`.

## Tokens

Follow the repo’s NativeWind theme — semantic colors in `tailwind.config.js`
`theme.extend` — and keep one color system. Semantic utilities over scattered hex
at call sites.

```js
// ✅ Correct: semantic color tokens in the Tailwind theme (tailwind.config.js)
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        label: '#1a1a1a',
        surface: '#fafafa',
        brand: '#2563eb',
      },
    },
  },
}
```

```tsx
import { Text } from 'react-native'

// ❌ Incorrect: raw hex at the call site
export function Title() {
  return <Text className="text-[#1a1a1a]">Title</Text>
}

// ✅ Correct: semantic theme token
export function Title() {
  return <Text className="text-label">Title</Text>
}
```

## Layout

Prefer `flex`, `gap`, and the repo’s spacing scale. Use unitless layout — not
`rem` / CSS stylesheet habits on native.

```tsx
import type { ReactNode } from 'react'
import { View } from 'react-native'

interface CardProps {
  children: ReactNode
}

// ❌ Incorrect: magic arbitrary spacing
export function Card({ children }: CardProps) {
  return <View className="p-[17px] mb-[13px] gap-[9px]">{children}</View>
}

// ✅ Correct: scale utilities
export function Card({ children }: CardProps) {
  return <View className="p-4 mb-3 gap-2">{children}</View>
}
```

## Motion

Prefer short press feedback over looping animation. Gate decorative motion on
the OS reduce-motion setting so always-on pulse chrome doesn’t ignore
accessibility settings. Use the repo’s reduce-motion helper when it has one;
otherwise `useReducedMotion()` from `react-native-reanimated` when Reanimated is
installed.

```tsx
import { View } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'

// ❌ Incorrect: decorative looping motion always on
export function PulseDot() {
  return <View className="animate-pulse size-3 rounded-full bg-brand" />
}

// ✅ Correct: decorative motion only when the OS setting allows it
export function PulseDot() {
  const isReduceMotionEnabled = useReducedMotion()

  return (
    <View
      className={
        isReduceMotionEnabled
          ? 'size-3 rounded-full bg-brand'
          : 'animate-pulse size-3 rounded-full bg-brand'
      }
    />
  )
}
```

Without Reanimated, read the setting from `AccessibilityInfo` and subscribe to
`reduceMotionChanged` so a settings change applies without a restart.

```tsx
import { useEffect, useState } from 'react'
import { AccessibilityInfo, View } from 'react-native'

function useReduceMotionEnabled(): boolean {
  // Assume reduced until the setting resolves so motion never flashes on.
  const [isReduceMotionEnabled, setIsReduceMotionEnabled] = useState(true)

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setIsReduceMotionEnabled)

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setIsReduceMotionEnabled,
    )

    return () => subscription.remove()
  }, [])

  return isReduceMotionEnabled
}

// ✅ Correct: same gate, driven by react-native’s AccessibilityInfo
export function PulseDot() {
  const isReduceMotionEnabled = useReduceMotionEnabled()

  return (
    <View
      className={
        isReduceMotionEnabled
          ? 'size-3 rounded-full bg-brand'
          : 'animate-pulse size-3 rounded-full bg-brand'
      }
    />
  )
}
```

## Primitives and className

Apply utilities to RN primitives (`View`, `Text`, `Pressable`, `TextInput`). No
DOM tags. Prefer theme token classes over raw hex or arbitrary values.

```tsx
import { Text } from 'react-native'

// ❌ Incorrect: DOM tags and web-only utilities
export function Title() {
  return <div className="hover:underline text-[14px] m-[13px]">Title</div>
}

// ✅ Correct: RN primitives and tokenized utilities
export function Title() {
  return <Text className="text-base text-label font-medium">Title</Text>
}
```

## Third-party components

Third-party components such as `expo-image` don’t accept `className` out of the
box — the prop is dropped and no style applies. Register them once with
`cssInterop` so `className` maps to `style`, or `remapProps` when the component
takes a differently named style prop.

```tsx
import { Image } from 'expo-image'
import { cssInterop } from 'nativewind'

interface AvatarProps {
  uri: string
}

// ❌ Incorrect: className on an unregistered third-party component
export function Avatar({ uri }: AvatarProps) {
  return <Image source={{ uri }} className="size-12 rounded-full" />
}

// ✅ Correct: register once at module scope, then use className
cssInterop(Image, { className: 'style' })

export function Avatar({ uri }: AvatarProps) {
  return <Image source={{ uri }} className="size-12 rounded-full" />
}
```

## Interaction

Prefer press/active utilities the platform understands — not hover-only as the
primary feedback on native.

```tsx
import { Pressable, Text } from 'react-native'

// ❌ Incorrect: hover-only primary feedback on native
export function Row() {
  return <Pressable className="hover:bg-surface"><Text>Row</Text></Pressable>
}

// ✅ Correct: press feedback
export function Row() {
  return (
    <Pressable className="active:bg-surface p-3 rounded-lg">
      <Text>Row</Text>
    </Pressable>
  )
}
```

## Composition

Use static class strings. NativeWind compiles classes to React Native
`StyleSheet` objects at build time — dynamic interpolation forces runtime style
resolution and hurts performance. Prefer complete utilities. Use the repo’s
`cn` / clsx when present — don’t invent `clsx` + `tailwind-merge` mid-feature;
`cn` does not fix partial strings. Use a style object when the value is dynamic
or the API expects a style prop.

```tsx
import { View } from 'react-native'

interface BoxProps {
  isPrimary: boolean
}

// ❌ Incorrect: dynamic interpolation — resolved at runtime
export function Box({ isPrimary }: BoxProps) {
  return <View className={`p-4 bg-${isPrimary ? 'primary' : 'danger'}`} />
}

// ✅ Correct: static strings — both classes visible at build time
export function Box({ isPrimary }: BoxProps) {
  return (
    <View className={isPrimary ? 'p-4 bg-primary' : 'p-4 bg-danger'} />
  )
}
```

```tsx
import type { ReactNode } from 'react'
import { Pressable } from 'react-native'

import { cn } from '../lib/cn'

// ❌ Incorrect: inventing cn / clsx + tailwind-merge mid-feature, or partial strings inside cn
interface ButtonProps {
  className?: string
  color: 'primary' | 'danger'
}

export function Button({ className, color }: ButtonProps) {
  return <Pressable className={cn(`bg-${color} p-4`, className)} />
}

// ✅ Correct: complete static strings; merge with repo cn when already present
interface ButtonProps {
  className?: string
  children: ReactNode
}

export function Button({ className, children }: ButtonProps) {
  return (
    <Pressable className={cn('bg-primary p-4 rounded-lg', className)}>
      {children}
    </Pressable>
  )
}
```

```tsx
import { View } from 'react-native'

interface PanelProps {
  height: number
}

// ❌ Incorrect: dynamic height forced into a class string
export function Panel({ height }: PanelProps) {
  return <View className={`h-[${height}px]`} />
}

// ✅ Correct: style object for dynamic values
export function Panel({ height }: PanelProps) {
  return <View style={{ height }} />
}
```

## When v5 is OK

NativeWind v5 is a release candidate, and its docs say it is not intended for
production use. Use it only when the repo already runs it or the user explicitly
accepts an RC; never propose moving a v4 app to v5 while it is pre-release.

```css
/* ✅ Correct: v5 CSS-first entry (global.css) */
@import 'tailwindcss/theme.css' layer(theme);
@import 'tailwindcss/preflight.css' layer(base);
@import 'tailwindcss/utilities.css';

@import 'nativewind/theme';
```

- Pin exact versions, no ranges: `nativewind@5.0.0-rc.0` with
  `react-native-css@3.1.0-rc.0` (a matched pair), plus `tailwindcss@4.1.12`,
  `@tailwindcss/postcss@4.1.12`, and `lightningcss@1.30.1` — a floating range
  pulls a mismatched RC.
- Metro uses `withNativewind(getDefaultConfig(__dirname))` from
  `nativewind/metro` with no `input` option. No `nativewind/babel` preset or
  `jsxImportSource`, no `tailwind.config.js`; PostCSS runs `@tailwindcss/postcss`.
- Tokens live in CSS `@theme`; use `@config` only when the repo already has an
  advanced JS config.
- Register third-party components with `styled()` from `nativewind`;
  `cssInterop` / `remapProps` are deprecated in v5.
- The TypeScript ambient file references `react-native-css/types` instead of
  `nativewind/types`.
