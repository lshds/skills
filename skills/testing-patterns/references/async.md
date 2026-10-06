# Async

Don’t sleep and hope. Wait for `findBy*`, `waitFor`, or fake timers so the
test is reliable every run. Examples use React Testing Library; `findBy*` and
`waitFor` work the same in the other Testing Library flavors — only `render`
differs (Angular: `await render(UserProfileComponent, { inputs: { userId: 'user_123' } })`).

## Await visible outcomes

Wait for the UI or promise that proves the async work finished. Never
`sleep` or `setTimeout` to “hope” the update landed.

```tsx
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import { UserProfile } from './UserProfile'

// ❌ Incorrect: fixed sleep — flaky under load
it('should show the user name', async () => {
  render(<UserProfile userId="user_123" />)

  await new Promise((resolve) => setTimeout(resolve, 500))

  expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
})

// ✅ Correct: findBy waits until the text appears (or times out)
it('should show the user name', async () => {
  render(<UserProfile userId="user_123" />)

  expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
})
```

## waitFor for conditions

When the assertion is not a single query, wrap it in `waitFor` so retries
stop as soon as the condition holds.

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { expect, it } from 'vitest'

import { Inbox } from './Inbox'

// ❌ Incorrect: immediate assert before async state settles
it('should show the unread count', () => {
  render(<Inbox />)

  expect(screen.getByRole('status')).toHaveTextContent('3 unread')
})

// ✅ Correct: wait until the status reflects loaded data
it('should show the unread count', async () => {
  render(<Inbox />)

  await waitFor(() => {
    expect(screen.getByRole('status')).toHaveTextContent('3 unread')
  })
})
```

## Fake timers

For debounce, intervals, and scheduled work, control time explicitly. Advance
timers instead of waiting wall-clock delays.

```typescript
const DEBOUNCE_MS = 300

// ❌ Incorrect: real timer delay slows the suite and flakes in CI
it('should emit after debounce', async () => {
  const handleSearch = vi.fn()
  const debouncedSearch = createDebouncedSearch(handleSearch, DEBOUNCE_MS)
  const searchQuery = 'notebooks'

  debouncedSearch(searchQuery)
  await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 50))

  expect(handleSearch).toHaveBeenCalledWith(searchQuery)
})

// ✅ Correct: fake timers — advance to the debounce boundary
it('should emit after debounce', () => {
  vi.useFakeTimers()

  const handleSearch = vi.fn()
  const debouncedSearch = createDebouncedSearch(handleSearch, DEBOUNCE_MS)
  const searchQuery = 'notebooks'

  debouncedSearch(searchQuery)
  vi.advanceTimersByTime(DEBOUNCE_MS)

  expect(handleSearch).toHaveBeenCalledWith(searchQuery)

  vi.useRealTimers()
})
```
