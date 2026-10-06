# Environment

Prefer an environment object whose required fields are checked at process start
over reading `process.env` inside handlers, so a missing required value stops
the process at start rather than during a later request.

## Validation at process start

Reading `process.env` inside a handler postpones detection of a missing required value until that handler runs. The operator `?? ''` and postfix `!` hide it as well: `?? ''` replaces a missing value with an empty string, and `!` only tells the type checker the value is present, so either form lets the process start without it. Read the variables once, when the environment module is first evaluated, into an object with required string fields, and throw if a field is absent.

```typescript
// ❌ Incorrect: process.env read inside the handler — a missing JWT_SECRET surfaces on the first sign-in, not at start
import { signJwt } from './jwt'

export async function signAccessToken(userId: string): Promise<string> {
  const jwtSecret = process.env.JWT_SECRET

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is required')
  }

  return signJwt(userId, jwtSecret)
}

// ❌ Incorrect: ?? '' starts the process with an empty secret; postfix ! checks nothing
export function loadJwtSecret(): string {
  return process.env.JWT_SECRET ?? ''
}

export function loadDatabaseUrl(): string {
  return process.env.DATABASE_URL!
}

// ✅ Correct: environment.ts — required string fields, checked when the module is first evaluated
interface Environment {
  jwtSecret: string
  databaseUrl: string
}

function parseEnvironment(): Environment {
  const jwtSecret = process.env.JWT_SECRET
  const databaseUrl = process.env.DATABASE_URL

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is required')
  }

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required')
  }

  return { jwtSecret, databaseUrl }
}

export const environment = parseEnvironment()
```

- Use the function the repository already uses to read environment variables. If you would add a package for that purpose, ask first.

## One source

A second call to `dotenv.config`, or a string written in the source, is a second source of values, separate from `process.env` as read by the rest of the application. Handlers import the one environment object and read nothing else.

```typescript
// ❌ Incorrect: string in source and a second dotenv.config
import dotenv from 'dotenv'
import { signJwt } from './jwt'

dotenv.config({ path: '.env.production' })

const JWT_SECRET = 'hardcoded-jwt-secret'

export async function signAccessToken(userId: string): Promise<string> {
  return signJwt(userId, JWT_SECRET)
}

// ✅ Correct: the repository's environment object; values from process.env, checked at start
import { environment } from './environment'
import { signJwt } from './jwt'

export async function signAccessToken(userId: string): Promise<string> {
  return signJwt(userId, environment.jwtSecret)
}
```
