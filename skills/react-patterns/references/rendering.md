# Rendering

Prefer explicit conditionals over `&&` with numbers — a falsy `0` renders as
text.

## Conditional render: ternary over `&&`

`0 && <Component />` renders `0`. Prefer explicit boolean / ternary.

```tsx
// ❌ Incorrect: falsy number renders as text
{count && <Badge count={count} />}

// ✅ Correct: explicit boolean / ternary — nothing leaks when count is 0
{count > 0 ? <Badge count={count} /> : null}
```

## Keep markup in the component

Hoisting static JSX “for performance” fights the no-pre-optimize default and
React Compiler. Keep markup next to the component unless the repo already
extracts shared static nodes.
