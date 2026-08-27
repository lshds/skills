# Error Boundaries

Catch render and lifecycle errors in a child tree — not async failures or
event-handler throws — so one broken feature doesn’t take down the whole app.

## Boundary shape

Wrap a feature island with a safe fallback — boundaries catch render/lifecycle errors, not async or click throws.

```tsx
// ❌ Incorrect: wrap every tiny leaf / expect to catch async + click errors
<FeatureErrorBoundary>
  <button onClick={() => throw new Error('nope')}>Click</button>
</FeatureErrorBoundary>

// ✅ Correct: route / feature island with safe fallback
interface FeatureErrorBoundaryProps {
  children: React.ReactNode
  onRetry?: () => void
}

interface FeatureErrorBoundaryState {
  error: Error | null
}

export class FeatureErrorBoundary extends React.Component<
  FeatureErrorBoundaryProps,
  FeatureErrorBoundaryState
> {
  state: FeatureErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): FeatureErrorBoundaryState {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert">
          <p>Something went wrong.</p>
          <button
            type="button"
            onClick={() => {
              this.setState({ error: null })
              this.props.onRetry?.()
            }}
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
```

Wrap a feature island at the route or panel level; `onRetry` resets UI and can reload data:

```tsx
// ✅ Correct: feature island boundary — onRetry resets UI + reloads data
<FeatureErrorBoundary onRetry={refetch}>
  <FeaturePanel />
</FeatureErrorBoundary>
```

## Placement

- Wrap route or feature islands, not every tiny component.
- Fallback copy stays safe — no stack traces or internals to end users.
- Use the shared boundary from the design system / app shell when one exists.
- Async / event / domain failures are not boundary territory — handle those outside the boundary.
