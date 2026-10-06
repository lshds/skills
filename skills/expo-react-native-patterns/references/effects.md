# Effects

Motion, blur, glass, and gradients. Prefer what the repo already ships — don’t
replace working `Animated`, `expo-linear-gradient`, or solid chrome with newer
APIs unless the task or project already uses them.

## Motion

Prefer Reanimated over RN `Animated` for **new** motion when Reanimated is
already a dependency. Use entering / exiting / layout transitions for state
changes; prefer transforms over animating `width` / `height`.

```tsx
// ❌ Incorrect: layout width animation for enters
<Animated.View style={{ width: isOpen ? 200 : 0 }} />

// ✅ Correct: Reanimated entering + layout + transforms (when Reanimated is in use)
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated'

<Animated.View
  entering={FadeIn}
  exiting={FadeOut}
  layout={LinearTransition}
/>
```

- Reanimated 4 requires `react-native-worklets` installed beside it — check
  both when adding or upgrading Reanimated.
- Keep most UI motion under ~300ms; prefer springs for drag / settle.
- Scroll-driven motion: `useScrollViewOffset` + `interpolate(..., 'clamp')`.
- Keyboard inset motion: `useAnimatedKeyboard` when animating with the keyboard.
- Gate non-essential animation on reduced motion when available.
- Haptics on meaningful commits only (and not on top of native controls that
  already fire them).

## Gradients

Use the gradient approach the project already uses. `expo-linear-gradient` is
fine and widely supported — don’t migrate it away by default.

```tsx
// ❌ Incorrect: one-off LinearGradient while the app renders gradients through a shared Gradient wrapper
import { LinearGradient } from 'expo-linear-gradient'

<LinearGradient colors={['#000', 'transparent']} style={{ height: 120 }} />

// ✅ Correct: same API / wrapper the project already uses
import { Gradient } from '@/components/Gradient'

<Gradient colors={['#000', 'transparent']} style={{ height: 120 }} />
```

- `experimental_backgroundImage` CSS gradient strings are **opt-in**: only when
  the repo already uses that experimental style prop. Not a default
  replacement for `expo-linear-gradient`.

## Blur and glass

Prefer `expo-blur` system material tints when the repo uses blur (they adapt to
dark mode). Liquid glass / `expo-glass-effect` only when the SDK supports it
**and** the product already depends on it — always keep a blur or solid
fallback. Don’t nest blur views.

```tsx
// ❌ Incorrect: light/dark-only blur / GlassView with no fallback
<BlurView tint="light" />
<GlassView>{children}</GlassView>

// ✅ Correct: system material; glass only when available + already adopted
import { BlurView } from 'expo-blur'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'

interface GlassFallbackProps {
  children: React.ReactNode
}

export function GlassFallback({ children }: GlassFallbackProps) {
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView isInteractive style={{ borderRadius: 16 }}>
        {children}
      </GlassView>
    )
  }

  return (
    <BlurView
      tint="systemMaterial"
      intensity={80}
      style={{ borderRadius: 16, overflow: 'hidden' }}
    >
      {children}
    </BlurView>
  )
}
```

- `BlurView` needs `overflow: 'hidden'` to clip `borderRadius`.
- Use `isInteractive` on `GlassView` for buttons / pressables.
- Keep blur intensity readable (roughly 50–100).
