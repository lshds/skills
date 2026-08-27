# Imports

Prefer the project's path alias (e.g. `~/`, `@/`) over deep relatives. Use
`import type` for type-only imports.

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
