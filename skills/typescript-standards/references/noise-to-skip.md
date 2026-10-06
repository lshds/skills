# Noise to Skip

Omit obvious annotations, extra wrappers, `else` after `return`, spelled-out
`undefined`, boolean wrappers, and locals that only exist to be returned. Let
inference speak.

## Prefer inference

Redundant type annotations and `else` after `return` add noise without improving safety.

```typescript
// ❌ Incorrect: redundant annotation; else after return
const title: string = 'Dashboard'

if (!user) {
  return
} else {
  notifyUser(user)
}

// ✅ Correct: inference; bare return; no else after return
const title = 'Dashboard'

if (!user) {
  return
}

notifyUser(user)
```

## Spelled-out `undefined`

`undefined` is already the default for uninitialized variables, omitted
parameters, and bare `return`. Use optional chaining instead of
`!== undefined` guards.

```typescript
// ❌ Incorrect: undefined written out where it is already the default
let selectedId: string | undefined = undefined

function formatPrice(amount: number, currency: string | undefined = undefined) {
  return `${amount} ${currency ?? 'SEK'}`
}

const cityName = address !== undefined ? address.city : undefined

if (onChange !== undefined) {
  onChange(nextValue)
}

// ✅ Correct: rely on the default; optional chaining for reads and calls
let selectedId: string | undefined

function formatPrice(amount: number, currency?: string) {
  return `${amount} ${currency ?? 'SEK'}`
}

const cityName = address?.city

onChange?.(nextValue)
```

## Booleans as expressions

Wrapping a condition in `if` / `return true` / `return false`, a `? true : false`
ternary, or `=== true` restates a value that is already a boolean.

```typescript
// ❌ Incorrect: boolean wrapped in branches, ternaries, and comparisons to true
const MAX_CART_ITEMS = 50

interface Customer {
  age: number
  hasConsented: boolean
  couponCode?: string
}

function isEligible(customer: Customer) {
  if (customer.age >= 18 && customer.hasConsented === true) {
    return true
  }

  return false
}

function describeCart(customer: Customer, itemCount: number) {
  const isOverLimit = itemCount > MAX_CART_ITEMS ? true : false
  const hasCoupon = customer.couponCode ? true : false

  return { isOverLimit, hasCoupon }
}

// ✅ Correct: return and assign the expression; Boolean() for a non-boolean value
const MAX_CART_ITEMS = 50

interface Customer {
  age: number
  hasConsented: boolean
  couponCode?: string
}

function isEligible(customer: Customer) {
  return customer.age >= 18 && customer.hasConsented
}

function describeCart(customer: Customer, itemCount: number) {
  const isOverLimit = itemCount > MAX_CART_ITEMS
  const hasCoupon = Boolean(customer.couponCode)

  return { isOverLimit, hasCoupon }
}
```

## Return the expression

Don’t assign just to return on the next line. Keep the local only when the
name adds meaning, or a guard sits between the two.

```typescript
// ❌ Incorrect: a local that only exists to be returned
function formatGreeting(customerName: string) {
  const greeting = `Hello, ${customerName}`
  return greeting
}

// ✅ Correct: return the expression
function formatGreeting(customerName: string) {
  return `Hello, ${customerName}`
}
```
