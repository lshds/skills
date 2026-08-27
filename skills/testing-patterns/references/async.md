# Async

Don’t sleep and hope. Wait for `findBy*`, `waitFor`, or fake timers so the
test is reliable every run.

## Await visible outcomes

Wait for the UI or promise that proves the async work finished. Never
`sleep` or `setTimeout` to “hope” the update landed.

```tsx
// .tsx — ❌ Incorrect: fixed sleep — flaky under load
render(<UserProfile userId="user_123" />)

await new Promise((resolve) => setTimeout(resolve, 500))
expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()

// .tsx — ✅ Correct: findBy waits until the text appears (or times out)
render(<UserProfile userId="user_123" />)

expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
```

```typescript
// .ts — ❌ Incorrect: fixed sleep — flaky under load
await render(UserProfileComponent, { inputs: { userId: 'user_123' } })

await new Promise((resolve) => setTimeout(resolve, 500))
expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()

// .ts — ✅ Correct: findBy waits until the text appears (or times out)
await render(UserProfileComponent, { inputs: { userId: 'user_123' } })

expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
```

## waitFor for conditions

When the assertion is not a single query, wrap it in `waitFor` so retries
stop as soon as the condition holds.

```tsx
// .tsx — ❌ Incorrect: immediate assert before async state settles
render(<Inbox />)

expect(screen.getByRole('status')).toHaveTextContent('3 unread')

// .tsx — ✅ Correct: wait until the status reflects loaded data
render(<Inbox />)

await waitFor(() => {
  expect(screen.getByRole('status')).toHaveTextContent('3 unread')
})
```

```typescript
// .ts — ❌ Incorrect: immediate assert before async state settles
await render(InboxComponent)

expect(screen.getByRole('status')).toHaveTextContent('3 unread')

// .ts — ✅ Correct: wait until the status reflects loaded data
await render(InboxComponent)

await waitFor(() => {
  expect(screen.getByRole('status')).toHaveTextContent('3 unread')
})
```

## Fake timers

For debounce, intervals, and scheduled work, control time explicitly. Advance
timers instead of waiting wall-clock delays.

```typescript
// ❌ Incorrect: real timer delay slows the suite and flakes in CI
it('should emit after debounce', async () => {
  const handleSearch = vi.fn()
  const debouncedSearch = createDebouncedSearch(handleSearch, 300)
  const searchQuery = 'notebooks'
  debouncedSearch(searchQuery)
  await new Promise((resolve) => setTimeout(resolve, 350))
  expect(handleSearch).toHaveBeenCalledWith(searchQuery)
})

// ✅ Correct: fake timers — advance to the debounce boundary
it('should emit after debounce', () => {
  vi.useFakeTimers()

  const handleSearch = vi.fn()
  const DEBOUNCE_MS = 300
  const debouncedSearch = createDebouncedSearch(handleSearch, DEBOUNCE_MS)
  const searchQuery = 'notebooks'

  debouncedSearch(searchQuery)
  vi.advanceTimersByTime(DEBOUNCE_MS)

  expect(handleSearch).toHaveBeenCalledWith(searchQuery)

  vi.useRealTimers()
})
```
