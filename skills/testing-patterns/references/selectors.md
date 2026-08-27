# Selectors

Prefer accessible queries first. Fall back to `data-testid` only when role,
label, or text can’t identify the element.

## Priority order

Use this order: role + name → label → text → test id. Never lead with
CSS classes, XPath, or positional `nth-child` selectors. The test id value is
your identifier — pick a stable name for that control.

```typescript
// ❌ Incorrect: brittle CSS and DOM structure
page.locator('.btn.btn-primary.submit-button')
page.locator('div > form > div:nth-child(2) > input')
cy.get('.login-form input:first')

// ✅ Correct: accessible queries, then test id as last resort
page.getByRole('button', { name: 'Submit' })
page.getByLabel('Email address')
page.getByText('Welcome back')
page.getByTestId('chart-canvas')
```

## Role and name

Interactive controls should be reachable by role and accessible name — the same
signals assistive tech uses.

```typescript
// ❌ Incorrect: class-based query for a labeled button
screen.getByClassName('primary-cta')

// ✅ Correct: role + accessible name
screen.getByRole('button', { name: 'Save changes' })
```

## Labels for fields

Prefer `getByLabel` / `getByLabelText` for form controls wired to visible labels.

```typescript
// ❌ Incorrect: placeholder or index as the primary locator
screen.getByPlaceholderText('you@example.com')
page.locator('input').nth(0)

// ✅ Correct: label association
screen.getByLabelText('Email')
page.getByLabel('Email')
```

## Test id as escape hatch

Add `data-testid` when the element has no reliable role, label, or unique text
(canvas, chart, icon-only without a name yet). Do not sprinkle test ids on every
node.

```tsx
// .tsx markup — ❌ Incorrect: test id on a clearly labeled control
<button data-testid="submit-button" type="submit">Submit</button>

// .tsx markup — ✅ Correct: labeled control needs no test id; canvas does
<button type="submit">Submit</button>
<canvas data-testid="revenue-chart" aria-label="Revenue chart" />
```

```html
<!-- .ts component template — ❌ Incorrect: test id on a clearly labeled control -->
<button data-testid="submit-button" type="submit">Submit</button>

<!-- .ts component template — ✅ Correct: labeled control needs no test id; canvas does -->
<button type="submit">Submit</button>
<canvas data-testid="revenue-chart" aria-label="Revenue chart"></canvas>
```
