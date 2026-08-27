# Components

Prefer tests that exercise user-visible behavior. Mount the component, interact
like a user, assert what appears — not internals.

## Behavior over implementation

Query and assert what the user sees and does. Avoid poking component state,
instance fields, or CSS class lists as the primary signal.

```tsx
// .tsx — ❌ Incorrect: asserts implementation details — brittle to refactors
expect(componentInstance.isSubmitting).toBe(false)
expect(root.querySelector('.login-form__input--email')).toBeTruthy()
expect(document.querySelector('[data-testid="isSubmitting"]')).toHaveTextContent(
  'false',
)

// .tsx — ✅ Correct: asserts user-visible behavior
const handleSubmit = vi.fn()
const email = 'user@example.com'
const password = 'secret-password'

render(<LoginForm onSubmit={handleSubmit} />)

await userEvent.type(screen.getByLabelText('Email'), email)
await userEvent.type(screen.getByLabelText('Password'), password)
await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

expect(handleSubmit).toHaveBeenCalledWith({ email, password })
```

```typescript
// .ts — ❌ Incorrect: asserts implementation details — brittle to refactors
expect(componentInstance.isSubmitting).toBe(false)
expect(root.querySelector('.login-form__input--email')).toBeTruthy()
expect(document.querySelector('[data-testid="isSubmitting"]')).toHaveTextContent(
  'false',
)

// .ts — ✅ Correct: asserts user-visible behavior
const handleSubmit = vi.fn()
const email = 'user@example.com'
const password = 'secret-password'

await render(LoginFormComponent, {
  on: { submit: handleSubmit },
})

await userEvent.type(screen.getByLabelText('Email'), email)
await userEvent.type(screen.getByLabelText('Password'), password)
await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

expect(handleSubmit).toHaveBeenCalledWith({ email, password })
```

## Mount / render

Wire the component with the project's `render` (or equivalent). Match the
component file type; queries and `userEvent` afterward are the same.

```tsx
// .tsx — ❌ Incorrect: fireEvent / CSS / native querySelector as the primary path
fireEvent.change(document.querySelector('.search-input')!, {
  target: { value: 'notebooks' },
})
fireEvent.click(document.querySelector('.search-btn')!)

// .tsx — ✅ Correct: userEvent through accessible queries
const handleSearch = vi.fn()
const searchQuery = 'notebooks'

render(<SearchBox onSearch={handleSearch} />)

await userEvent.type(
  screen.getByRole('searchbox', { name: 'Search' }),
  searchQuery,
)
await userEvent.click(screen.getByRole('button', { name: 'Search' }))

expect(handleSearch).toHaveBeenCalledWith(searchQuery)
```

```typescript
// .ts — ❌ Incorrect: fireEvent / CSS / native querySelector as the primary path
fireEvent.change(document.querySelector('.search-input')!, {
  target: { value: 'notebooks' },
})
fireEvent.click(document.querySelector('.search-btn')!)

// .ts — ✅ Correct: userEvent through accessible queries
const handleSearch = vi.fn()
const searchQuery = 'notebooks'

await render(SearchBoxComponent, { on: { search: handleSearch } })

await userEvent.type(
  screen.getByRole('searchbox', { name: 'Search' }),
  searchQuery,
)
await userEvent.click(screen.getByRole('button', { name: 'Search' }))

expect(handleSearch).toHaveBeenCalledWith(searchQuery)
```

## Avoid snapshot spam

Prefer explicit assertions on the outcome that matters. Broad DOM snapshots
break on unrelated markup and hide intent.

```tsx
// .tsx — ❌ Incorrect: full-tree snapshot as the only assertion
expect(root).toMatchSnapshot()

// .tsx — ✅ Correct: assert the visible result
expect(screen.getByText('$19.99')).toBeInTheDocument()
```

```typescript
// .ts — ❌ Incorrect: full-tree snapshot as the only assertion
expect(root).toMatchSnapshot()

// .ts — ✅ Correct: assert the visible result
expect(screen.getByText('$19.99')).toBeInTheDocument()
```

## Props, inputs, and callbacks

Treat the public contract as what the parent passes in and what the child
emits (props / inputs / outputs / callbacks). Assert calls and arguments; do
not re-test parent container logic inside the child test.

```tsx
// .tsx — ❌ Incorrect: re-implements parent business rules inside the child test
const handleChange = vi.fn()

render(<QuantityStepper value={1} onChange={handleChange} />)

await userEvent.click(screen.getByRole('button', { name: 'Increase' }))
expect(cartTotalCents).toBe(2_000)

// .tsx — ✅ Correct: asserts the child notified the parent with the new value
const handleChange = vi.fn()

render(<QuantityStepper value={1} onChange={handleChange} />)

await userEvent.click(screen.getByRole('button', { name: 'Increase' }))

expect(handleChange).toHaveBeenCalledWith(2)
```

```typescript
// .ts — ❌ Incorrect: re-implements parent business rules inside the child test
const handleChange = vi.fn()

await render(QuantityStepperComponent, {
  inputs: { value: 1 },
  on: { change: handleChange },
})

await userEvent.click(screen.getByRole('button', { name: 'Increase' }))
expect(cartTotalCents).toBe(2_000)

// .ts — ✅ Correct: asserts the child notified the parent with the new value
const handleChange = vi.fn()

await render(QuantityStepperComponent, {
  inputs: { value: 1 },
  on: { change: handleChange },
})

await userEvent.click(screen.getByRole('button', { name: 'Increase' }))

expect(handleChange).toHaveBeenCalledWith(2)
```
