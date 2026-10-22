# Error Boundaries

Catch render and lifecycle errors in a child tree — not event-handler throws or
async callbacks such as timers and promise chains in effects — so one broken
feature doesn’t take down the whole app. Errors thrown inside a transition or
Action, and a rejected promise read with `use()`, do reach the nearest boundary.

## Boundary shape

Wrap a feature island with a safe fallback — boundaries catch render/lifecycle errors, not click throws or async callbacks.

```tsx
// ❌ Incorrect: wrap every tiny leaf / expect to catch click errors
<FeatureErrorBoundary>
  <button onClick={() => { throw new Error('nope') }}>Click</button>
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

  handleRetry = () => {
    this.setState({ error: null })
    this.props.onRetry?.()
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert">
          <p>Something went wrong.</p>
          <button type="button" onClick={this.handleRetry}>
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
<FeatureErrorBoundary onRetry={refetchFeaturePanel}>
  <FeaturePanel />
</FeatureErrorBoundary>
```

## Placement

- Wrap route or feature islands, not every tiny component.
- Fallback copy stays safe — no stack traces or internals to end users.
- Use the shared boundary from the design system / app shell when one exists.
- Event-handler throws, async callbacks (timers, promise chains in effects), and domain failures are not boundary territory — handle those outside the boundary.
