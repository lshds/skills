# Rendering

Prefer explicit conditionals over `&&` with numbers — a falsy `0` renders as
text. Check optional lists with `?.length` in a ternary.

## Conditional render: ternary over `&&`

`0 && <Component />` renders `0`. Prefer explicit boolean / ternary.

```tsx
// ❌ Incorrect: falsy number renders as text
{count && <Badge count={count} />}

// ✅ Correct: explicit boolean / ternary — nothing leaks when count is 0
{count > 0 ? <Badge count={count} /> : null}
```

## Optional lists: `?.length` in a ternary

An undefined check plus a length comparison says the same thing twice.
`?.length` covers both a missing list and an empty one.

```tsx
// ❌ Incorrect: spelled-out undefined check plus a length comparison
{items !== undefined && items.length > 0 && <ItemList items={items} />}

// ✅ Correct: one optional-chain length check in a ternary
{items?.length ? <ItemList items={items} /> : null}
```

## Keep markup in the component

React Compiler already caches static JSX, so hoisting it to module scope “for
performance” buys nothing and moves markup away from the component that
renders it. Without the compiler it is still a pre-optimization the
measure-first rule doesn’t allow. Keep markup next to the component unless the
repo already extracts shared static nodes.
