# NativeWind

Prefer NativeWind v5 CSS-first (`@import` + `@theme`, no babel plugin) on
greenfield. Don’t mix StyleSheet with `className`, and don’t silently upgrade
v4.

## Match the repo

Use NativeWind when that’s the project’s styling system. Don’t combine
`StyleSheet.create` and `className` on the same feature UI. Detect v4 vs v5 from
Metro / CSS / config before changing tooling. On greenfield, `withNativewind`
has no `input` arg. If the repo is still on v4 (`withNativeWind` + `input`,
`tailwind.config`, `@tailwind` / babel), match that stack — don’t silently
upgrade.

```tsx
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

Wire Metro and PostCSS for v5 greenfield. No `tailwind.config.js`, no
`@tailwind` directives, no `nativewind/babel` / `jsxImportSource`. Metro config
stays CommonJS. Match the repo’s paths — don’t invent a second stack or skip
`withNativewind`. One global CSS entry with Tailwind layers + `nativewind/theme`;
import it once at the top-most app component. Prefer `@theme` / `@utility` in
CSS; use `@config` only if the repo already has an advanced JS config.

```js
// ❌ Incorrect: Metro without NativeWind, or legacy input option
module.exports = getDefaultConfig(__dirname)
module.exports = withNativeWind(config, { input: './global.css' })

// ✅ Correct: withNativewind wraps the default config (no input arg)
const { getDefaultConfig } = require('expo/metro-config')
const { withNativewind } = require('nativewind/metro')

module.exports = withNativewind(getDefaultConfig(__dirname))
```

```js
// ❌ Incorrect: leftover NativeWind babel preset / jsxImportSource
module.exports = function (api) {
  api.cache(true)
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  }
}

// ✅ Correct: no NativeWind babel config — Metro applies the plugin
module.exports = function (api) {
  api.cache(true)
  return { presets: ['babel-preset-expo'] }
}
```

```js
// ❌ Incorrect: JS Tailwind config / nativewind/preset (tailwind.config.js)
module.exports = {
  content: ['./App.tsx', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: { extend: {} },
}

// ✅ Correct: PostCSS with @tailwindcss/postcss (postcss.config.mjs)
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

```css
/* ❌ Incorrect: legacy @tailwind directives / missing nativewind/theme */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ✅ Correct: CSS layers + NativeWind theme */
@import 'tailwindcss/theme.css' layer(theme);
@import 'tailwindcss/preflight.css' layer(base);
@import 'tailwindcss/utilities.css';

@import 'nativewind/theme';
```

```tsx
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

- Pin `lightningcss` in `package.json` `overrides` only when the repo or install
  guide requires it — don’t invent a version.
- For TypeScript, use a dedicated ambient file (e.g. `nativewind-env.d.ts`) with
  `/// <reference types="react-native-css/types" />` — not `nativewind.d.ts`,
  not `nativewind/types`, and not a name that collides with a folder like
  `app.d.ts` beside `/app`.

## Tokens

Follow the repo’s NativeWind theme (`@theme` in CSS + `nativewind/theme`). No
second color system. Semantic utilities over scattered hex; prefer `oklch` on
greenfield.

```css
/* ❌ Incorrect: bare :root vars expected to become utilities; magic hex */
:root {
  --label: #1a1a1a;
}

/* ✅ Correct: semantic tokens in @theme */
@theme {
  --color-label: oklch(25% 0.02 280);
  --color-surface: oklch(98% 0.01 280);
}
```

```tsx
// ❌ Incorrect: raw hex
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
// ❌ Incorrect: magic arbitrary spacing
export function Card({ children }: { children: React.ReactNode }) {
  return <View className="p-[17px] mb-[13px] gap-[9px]">{children}</View>
}

// ✅ Correct: scale utilities
export function Card({ children }: { children: React.ReactNode }) {
  return <View className="p-4 mb-3 gap-2">{children}</View>
}
```

## Motion

Prefer short press feedback over looping animation. Gate decorative motion with
the repo’s reduce-motion helper so always-on pulse chrome doesn’t ignore
accessibility settings.

```tsx
// ❌ Incorrect: decorative looping motion always on
export function PulseDot() {
  return <View className="animate-pulse size-3 rounded-full bg-brand" />
}

// ✅ Correct: decorative motion only when the repo allows it
export function PulseDot({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <View
      className={
        reduceMotion
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

Third-party components such as Reanimated or FlashList don’t accept `className`
out of the box. Register them with `styled()` so `className` maps to `style`.
`cssInterop` / `remapProps` are deprecated — don’t introduce them on new work.

```tsx
// ❌ Incorrect: className on an unregistered third-party component / cssInterop
import { cssInterop } from 'nativewind'
import Animated from 'react-native-reanimated'

cssInterop(Animated.View, { className: 'style' })

export function Panel() {
  return <Animated.View className="bg-surface p-4" />
}

// ✅ Correct: register with styled(), then use className
import { styled } from 'nativewind'
import Animated from 'react-native-reanimated'

const AnimatedView = styled(Animated.View)

export function Panel() {
  return <AnimatedView className="bg-surface p-4" />
}
```

## Interaction

Prefer press/active utilities the platform understands — not hover-only as the
primary feedback on native.

```tsx
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
// ❌ Incorrect: dynamic interpolation — resolved at runtime
export function Box({ isPrimary }: { isPrimary: boolean }) {
  return <View className={`p-4 bg-${isPrimary ? 'primary' : 'danger'}`} />
}

// ✅ Correct: static strings — both classes visible at build time
export function Box({ isPrimary }: { isPrimary: boolean }) {
  return (
    <View className={isPrimary ? 'p-4 bg-primary' : 'p-4 bg-danger'} />
  )
}
```

```tsx
// ❌ Incorrect: inventing cn / clsx + tailwind-merge mid-feature, or partial strings inside cn
export function Button({
  className,
  color,
}: {
  className?: string
  color: 'primary' | 'danger'
}) {
  return <Pressable className={cn(`bg-${color} p-4`, className)} />
}

// ✅ Correct: complete static strings; merge with repo cn when already present
export function Button({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <Pressable className={cn('bg-primary p-4 rounded-lg', className)}>
      {children}
    </Pressable>
  )
}
```

```tsx
// ❌ Incorrect: dynamic height forced into a class string
export function Panel({ height }: { height: number }) {
  return <View className={`h-[${height}px]`} />
}

// ✅ Correct: style object for dynamic values
export function Panel({ height }: { height: number }) {
  return <View style={{ height }} />
}
```
