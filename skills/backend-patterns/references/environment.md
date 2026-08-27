# Environment

Prefer an environment object whose required fields are checked at process start
over reading `process.env` inside handlers, so a missing required value stops
the process at start rather than during a later request.

## Validation at process start

Reading `process.env` inside a handler postpones detection of a missing required value until that handler runs. Check the values when the module is first evaluated and throw if a required field is absent.

```typescript
// ❌ Incorrect: process.env read inside the handler
export async function signAccessToken(userId: string): Promise<string> {
  const jwtSecret = process.env.JWT_SECRET
  return signJwt(userId, jwtSecret)
}

// ✅ Correct: checked when the module is first evaluated
type Environment = {
  jwtSecret: string
  databaseUrl: string
}

function parseEnvironment(): Environment {
  const jwtSecret = process.env.JWT_SECRET
  const databaseUrl = process.env.DATABASE_URL

  if (jwtSecret === undefined || jwtSecret === '') {
    throw new Error('JWT_SECRET is required')
  }

  if (databaseUrl === undefined || databaseUrl === '') {
    throw new Error('DATABASE_URL is required')
  }

  return { jwtSecret, databaseUrl }
}

const environment = parseEnvironment()

export async function signAccessToken(userId: string): Promise<string> {
  return signJwt(userId, environment.jwtSecret)
}
```

## Explicit schema

The operator `?? ''` replaces a missing value with an empty string, and postfix `!` does not check that a value is present, so the value may still be `undefined` when the program runs; either form lets the process start without a required value. Read the variables into an object with required string fields and throw if a field is absent.

```typescript
// ❌ Incorrect: ?? '' and postfix !
export function loadJwtSecret(): string {
  return process.env.JWT_SECRET ?? ''
}

export function loadDatabaseUrl(): string {
  return process.env.DATABASE_URL!
}

// ✅ Correct: object with required string fields; throw if a value is absent
type Environment = {
  jwtSecret: string
  databaseUrl: string
}

function parseEnvironment(): Environment {
  const jwtSecret = process.env.JWT_SECRET
  const databaseUrl = process.env.DATABASE_URL

  if (typeof jwtSecret !== 'string' || jwtSecret.length === 0) {
    throw new Error('JWT_SECRET is required')
  }

  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    throw new Error('DATABASE_URL is required')
  }

  return { jwtSecret, databaseUrl }
}

export const environment = parseEnvironment()
```

- Use the function the repository already uses to read environment variables. If you would add a package for that purpose, ask first.

## One source

A second call to `dotenv.config`, or a string written in the source, is a second source of values, separate from `process.env` as read by the rest of the application.

```typescript
// ❌ Incorrect: string in source and a second dotenv.config
import dotenv from 'dotenv'

dotenv.config({ path: '.env.production' })

const jwtSecret = 'hardcoded-jwt-secret'

export async function signAccessToken(userId: string): Promise<string> {
  return signJwt(userId, jwtSecret)
}

// ✅ Correct: the repository's environment object; values from process.env
import { environment } from './environment'

export async function signAccessToken(userId: string): Promise<string> {
  return signJwt(userId, environment.jwtSecret)
}
```
