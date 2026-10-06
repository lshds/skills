# Components

Prefer tests that exercise user-visible behavior over tests that read component
internals so refactors don’t turn green suites red. Mount the component,
interact through one `userEvent.setup()` session, and assert what appears.
Examples use React Testing Library; the same queries and `user` calls apply in
the other Testing Library flavors (Angular, Vue, Svelte) — only `render` and how
inputs and outputs are passed differ.

## Behavior over implementation

Query and assert what the user sees and does. Component state, test ids that
mirror internal flags, and CSS class lists change on every refactor without any
change in behavior.

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import { LoginForm } from './LoginForm'

// ❌ Incorrect: asserts internal state and styling hooks — brittle to refactors
it('should not be submitting initially', () => {
  render(<LoginForm onSubmit={vi.fn()} />)

  expect(screen.getByTestId('isSubmitting')).toHaveTextContent('false')
  expect(screen.getByRole('button', { name: 'Sign in' })).toHaveClass(
    'login-form__submit--idle',
  )
})

// ✅ Correct: asserts user-visible behavior
it('should submit the entered credentials', async () => {
  const user = userEvent.setup()
  const handleSubmit = vi.fn()
  const email = 'user@example.com'
  const password = 'secret-password'

  render(<LoginForm onSubmit={handleSubmit} />)

  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(handleSubmit).toHaveBeenCalledWith({ email, password })
})
```

## One user session per test

Wire the component with the project’s `render` (or its wrapper), then drive it
through a single `user` from `userEvent.setup()`, created before rendering.
`fireEvent` dispatches one synthetic event and skips the focus, keyboard, and
pointer sequence a real user produces; static `userEvent.click` calls start a
fresh session each time, so state such as held modifier keys isn’t shared.

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import { SearchBox } from './SearchBox'

// ❌ Incorrect: fireEvent and static userEvent calls — no real input sequence, no shared session
it('should search for the typed query', async () => {
  const handleSearch = vi.fn()

  render(<SearchBox onSearch={handleSearch} />)

  fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), {
    target: { value: 'notebooks' },
  })
  await userEvent.click(screen.getByRole('button', { name: 'Search' }))

  expect(handleSearch).toHaveBeenCalledWith('notebooks')
})

// ✅ Correct: one session created before render; every interaction awaited
it('should search for the typed query', async () => {
  const user = userEvent.setup()
  const handleSearch = vi.fn()
  const searchQuery = 'notebooks'

  render(<SearchBox onSearch={handleSearch} />)

  await user.type(screen.getByRole('searchbox', { name: 'Search' }), searchQuery)
  await user.click(screen.getByRole('button', { name: 'Search' }))

  expect(handleSearch).toHaveBeenCalledWith(searchQuery)
})
```

## Skip manual act

Testing Library already wraps `render` and user-event interactions in `act`, so
extra wrapping only adds noise. On React 19, `act` comes from `react` —
`react-dom/test-utils` no longer exports it.

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react-dom/test-utils'
import { expect, it } from 'vitest'

import { Counter } from './Counter'

// ❌ Incorrect: act from react-dom/test-utils (gone in React 19) around calls that are already wrapped
it('should increase the count', async () => {
  const user = userEvent.setup()

  render(<Counter />)

  await act(async () => {
    await user.click(screen.getByRole('button', { name: 'Increase' }))
  })

  expect(screen.getByRole('status')).toHaveTextContent('1')
})

// ✅ Correct: Testing Library handles act; assert the visible result
it('should increase the count', async () => {
  const user = userEvent.setup()

  render(<Counter />)

  await user.click(screen.getByRole('button', { name: 'Increase' }))

  expect(screen.getByRole('status')).toHaveTextContent('1')
})
```

- Reach for `act` (imported from `react`) only when the test updates state
  outside Testing Library — for example, pushing a value into an external store.

## Avoid snapshot spam

Prefer explicit assertions on the outcome that matters. Broad DOM snapshots
break on unrelated markup and hide intent.

```tsx
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import { PriceTag } from './PriceTag'

// ❌ Incorrect: full-tree snapshot as the only assertion
it('should render the price', () => {
  const { container } = render(<PriceTag amountCents={1_999} />)

  expect(container).toMatchSnapshot()
})

// ✅ Correct: assert the visible result
it('should render the price', () => {
  render(<PriceTag amountCents={1_999} />)

  expect(screen.getByText('$19.99')).toBeInTheDocument()
})
```

## Props, inputs, and callbacks

Treat the public contract as what the parent passes in and what the child
emits (props / inputs / outputs / callbacks). Assert calls and arguments; do
not re-test parent container logic inside the child test.

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import { QuantityStepper } from './QuantityStepper'

// ❌ Incorrect: recomputes the parent’s cart total inside the child test
it('should raise the cart total', async () => {
  const user = userEvent.setup()
  const handleChange = vi.fn()
  const unitPriceCents = 1_000

  render(<QuantityStepper value={1} onChange={handleChange} />)

  await user.click(screen.getByRole('button', { name: 'Increase' }))

  const [nextQuantity] = handleChange.mock.calls[0]
  expect(nextQuantity * unitPriceCents).toBe(2_000)
})

// ✅ Correct: asserts the child notified the parent with the new value
it('should report the increased quantity', async () => {
  const user = userEvent.setup()
  const handleChange = vi.fn()

  render(<QuantityStepper value={1} onChange={handleChange} />)

  await user.click(screen.getByRole('button', { name: 'Increase' }))

  expect(handleChange).toHaveBeenCalledWith(2)
})
```

- Angular Testing Library passes the same contract through `render`:
  `await render(QuantityStepperComponent, { inputs: { value: 1 }, on: { change: handleChange } })`.

## Vitest Browser Mode when the repo runs it

Applies only when `vitest.config.*` already enables `browser`; jsdom or
happy-dom stays the default when the repo uses them, and adding Browser Mode is
a new dependency, not a test fix. Since Vitest 4 the provider is a factory from
its own package, and browser context APIs import from `vitest/browser`.

```typescript
// ❌ Incorrect: legacy string provider (vitest.config.ts)
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: 'playwright',
      instances: [{ browser: 'chromium' }],
    },
  },
})

// ✅ Correct: provider factory from @vitest/browser-playwright
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
})
```

```typescript
// ❌ Incorrect: legacy context path in a browser test file
import { page } from '@vitest/browser/context'

// ✅ Correct: browser context APIs from vitest/browser
import { page } from 'vitest/browser'
```
