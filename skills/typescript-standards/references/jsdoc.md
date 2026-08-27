# JSDoc

Short purpose-first docs for non-obvious TypeScript APIs: what it does, what it
takes, what it returns, with links to the types. Don’t restate types TypeScript
already shows, and skip comments on small internal helpers when the signature is
clear enough.

## When to document

Skip JSDoc when the name and types already make the function clear. Write it when callers need more than the signature — a named API response shape, units or format on an argument, or a failure mode that isn’t obvious.

```typescript
// ❌ Incorrect: obvious export — name and types already say everything
/**
 * Fetches a user by id.
 */
export async function fetchUserById(userId: string): Promise<User> {
  return loadUser(userId)
}

// ✅ Correct: no JSDoc — clear enough on its own
export async function fetchUserById(userId: string): Promise<User> {
  return loadUser(userId)
}
```

## Function blocks

Start with a short description of what the function does. Then list each argument with `@param` when the meaning isn’t in the type, say what it returns with `@returns` (and link the return type), add `@throws` when that matters, and use `@see` for *related* types — not the same type already linked in `@returns`. Don’t paste TypeScript types in braces like `{string}`.

```typescript
// ❌ Incorrect: repeats TS types; no links; long duplicate paragraphs
/**
 * Fetches all available regions from the regions API.
 *
 * This function retrieves a list of regions where data is available,
 * including their geographical coordinates and forecast availability.
 *
 * @param {string} locale
 * @returns {Promise<RegionsResponse>}
 * @throws {Error}
 */
export async function fetchRegions(
  locale: string,
): Promise<RegionsResponse> {
  return getRegions(locale)
}

// ✅ Correct: short description; link the response; @see for related types only
/**
 * Fetches regions from the regions API, including coordinates and whether
 * a forecast exists for each entry.
 *
 * @param locale - Locale sent to the API (for example `'sv'` or `'en'`)
 * @returns A {@link RegionsResponse} with the region list
 * @throws {HttpRequestError} When the HTTP request fails or returns a non-OK status
 *
 * @see {@link Region} for one region entry
 */
export async function fetchRegions(
  locale: string,
): Promise<RegionsResponse> {
  return getRegions(locale)
}
```

- Description — one or two short lines about what it does. Don’t add a second paragraph that says the same thing again.
- `@param name - …` — only when meaning, units, or allowed values aren’t clear from the type. Not `{string}`.
- `@returns` — what you get back, with a link to named return types.
- `@throws` — when callers need to know. Prefer a specific error type when you have one.
- `@see` — related types, not a repeat of the `@returns` link.
- `@example` / `@todo` / `@deprecated` — optional, only when useful.

## Don’t repeat the typechecker

Don’t write `@param {string}` or `@returns {Promise<…>}` when the signature already has those types. Link named types in `@returns` / `@see` instead. Add `@param` only when it adds format, units, or constraints the type doesn’t show.

```typescript
// ❌ Incorrect: JSDoc type braces that mirror the signature; obvious @param text
/**
 * Loads a user for account settings.
 *
 * @param {string} userId - The user id
 * @returns {Promise<User | undefined>}
 */
export async function fetchUserById(
  userId: string,
): Promise<User | undefined> {
  return loadUser(userId)
}

// ✅ Correct: link the type; @param only for format the type doesn’t capture
/**
 * @param userId - Auth-session account id (`user_…`), not the display username
 * @returns The {@link User}, or `undefined` if none exists
 * @see {@link User}
 */
export async function fetchUserById(
  userId: string,
): Promise<User | undefined> {
  return loadUser(userId)
}
```

## Visibility

Don’t put `@private` or `@public` on every function. Skip comments on file-local helpers when the signature is clear enough. Use `@internal` only on package exports that aren’t a stable public API, and only when that isn’t already obvious from the name.

```typescript
// ❌ Incorrect: visibility tags on every local and export
/**
 * @private
 * @summary Internal parse step
 */
function parseRow(rawPayload: unknown): Row { /* … */ }

/**
 * @public
 * @summary Public entry
 */
export function parseRows(rawPayloads: unknown[]): Row[] { /* … */ }

// ✅ Correct: bare helper and export when the code is clear
function parseRow(rawPayload: unknown): Row { /* … */ }

export function parseRows(rawPayloads: unknown[]): Row[] {
  return rawPayloads.map(parseRow)
}

// ✅ Correct: @internal when “don’t rely on this” isn’t obvious from the name
/**
 * @internal Used by the settings package — not a stable app API
 */
export function parseRowsForSettingsPackage(rawPayloads: unknown[]): Row[] {
  return rawPayloads.map(parseRow)
}
```

## Variables / constants

Don’t put a JSDoc block on every `const` or `let`. Add a comment only when the name and type don’t make the meaning, units, or limits clear enough.

```typescript
// ❌ Incorrect: obvious local — no need for a block
/**
 * @constant {number} retryCount
 */
const retryCount = 3

// ✅ Correct: bare when the name is enough
const retryCount = 3
export const QUERY_STALE_TIME_MS = 60_000

// ✅ Correct: comment when the “why” or hidden rule isn’t in the name
/**
 * Must stay under the gateway’s 15s idle limit — clients that exceed it get dropped.
 */
export const SETTINGS_HANDSHAKE_TIMEOUT_MS = 10_000
```

## Comment prose

In comments, wrap code tokens (identifiers, string literals, paths) in single quotes so they stand out from the prose. Only write the comment when the why isn’t obvious from the name.

```typescript
// ❌ Incorrect: double quotes around a token; restates an obvious name
/**
 * Retries "fetchRegions" up to three times.
 */
export async function fetchRegionsWithRetry(
  locale: string,
): Promise<RegionsResponse> {
  return retry(() => getRegions(locale), 3)
}

// ✅ Correct: single quotes; comment explains the non-obvious limit
/**
 * Retries 'getRegions' at most 3 times — the gateway drops the fourth attempt.
 */
export async function fetchRegionsWithRetry(
  locale: string,
): Promise<RegionsResponse> {
  return retry(() => getRegions(locale), 3)
}
```
