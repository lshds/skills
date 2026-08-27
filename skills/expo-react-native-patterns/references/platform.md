# Platform

Prefer small `Platform.select` diffs — split files when native and web diverge
enough that inline conditionals hurt readability.

## Small differences

Keep platform diffs small and declarative — avoid DOM checks and huge inline OS trees on shared screens.

```tsx
// ❌ Incorrect: DOM APIs / giant inline platform trees on native screens
const paddingTop = typeof document !== 'undefined' ? 12 : 8
if (Platform.OS === 'ios') {
  /* hundreds of lines */
} else if (Platform.OS === 'android') {
  /* hundreds of lines */
}

// ✅ Correct: Platform.select for small style/API diffs
const paddingTop = Platform.select({ ios: 12, android: 8, default: 8 })
```

- When the repo already uses it, `process.env.EXPO_OS` is fine as the
  Expo-native alternative to `Platform.OS` for simple branches.

## File splits

Use platform file suffixes when UI or native APIs diverge enough that
conditionals hurt readability. Import without the extension.

```tsx
// ❌ Incorrect: platform-suffixed route under app/ / mismatched props
// app/settings.ios.tsx
export default function Settings({ title }: IosProps) {}

// ✅ Correct: splits under components/; identical props; default file required
// components/SettingsForm.tsx          — default
// components/SettingsForm.ios.tsx
// components/SettingsForm.android.tsx
interface SettingsFormProps {
  title: string
  onSave: () => void
}

export function SettingsForm({ title, onSave }: SettingsFormProps) {
  return <Text>{title}</Text>
}

// consumers import without the platform suffix
import { SettingsForm } from '@/components/SettingsForm'
```

- Supported: `.ios`, `.android`, `.native`, `.web`.
- Props must be identical across variants; always keep a non-suffixed default
  (even a no-op).
- Expo Router route files don’t support platform extensions — put splits in
  `components/` / `screens/`.
- Colocate `StyleSheet.create` at the bottom of the file when the repo uses it.
- Colocate tests: `formatDate.test.ts` next to `formatDate.ts`.

## Browser globals

No browser globals or web-only layout assumptions on native screens.

```tsx
// ❌ Incorrect: document / localStorage / fixed positioning assumptions
document.getElementById('root')
window.localStorage.setItem('theme', 'dark')

// ✅ Correct: RN / Expo APIs; absolute + safe-area insets when pinning
import { Platform } from 'react-native'
// prefs via repo storage helper; layout with flex + insets
```

- Client env: only `EXPO_PUBLIC_*` is inlined into the bundle; secrets stay
  server-side / SecureStore.
- Don’t copy hover-only affordances or multi-column denseness without a mobile
  layout.
