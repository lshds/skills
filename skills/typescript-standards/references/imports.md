# Imports

Prefer the project's path alias (e.g. `~/`, `@/`) over deep relatives. Use
`import type` for type-only imports and `with` for import attributes.

## Path alias + `import type`

Path aliases survive refactors; `import type` strips type-only symbols from the runtime bundle.

```typescript
// ❌ Incorrect: type as value import; deep relative — breaks on moves
import { User } from '../../../types/user'
import { formatDate } from '../../../utils/date.utils'

// ✅ Correct: import type; project path alias
import type { User } from '~/types/user'
import { formatDate } from '~/utils/date.utils'
```

## Import attributes

`assert { }` is the superseded import-attribute syntax: deprecated in TS 6 and an error in TS 7. `with { }` is the standard form.

```typescript
// ❌ Incorrect: assert syntax — deprecated in TS 6, fails to compile on TS 7
import defaultSettings from './default-settings.json' assert { type: 'json' }

// ✅ Correct: import attributes use with
import defaultSettings from './default-settings.json' with { type: 'json' }
```
