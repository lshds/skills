# SSR

Prefer transfer cache over refetching the same GETs. Gate browser APIs with
`afterNextRender` / `isPlatformBrowser` so server and client markup match.

## Browser-only code

Don’t touch `window` / `document` during construction or SSR — init after
render.

```typescript
// ❌ Incorrect: DOM in the constructor / field initializer
export class AnalyticsChart {
  private readonly chart = new ChartLib(document.getElementById('chart')!)
}

// ✅ Correct: afterNextRender (browser-only)
export class AnalyticsChart {
  constructor() {
    afterNextRender(() => {
      const chartElement = document.getElementById('chart')

      if (chartElement === null) {
        return
      }

      new ChartLib(chartElement)
    })
  }
}
```

## Browser globals

Tokens that are `null` on the server — don’t assume `localStorage` exists.

```typescript
// ❌ Incorrect: assume localStorage always exists
export const LOCAL_STORAGE = new InjectionToken<Storage>('LocalStorage', {
  providedIn: 'root',
  factory: () => localStorage,
})

// ✅ Correct: null on the server
export const LOCAL_STORAGE = new InjectionToken<Storage | null>('LocalStorage', {
  providedIn: 'root',
  factory: () =>
    isPlatformBrowser(inject(PLATFORM_ID)) ? localStorage : null,
})
```

- Usage: `this.storage?.getItem(storageKey) ?? null`

## Hydration mismatches

Avoid first-paint values that differ server vs client (clocks, random, “now”).

```typescript
// ❌ Incorrect: Date.now() / locale time in the field initializer
@Component({ template: `<p>{{ now }}</p>` })
export class LiveClock {
  now = new Date().toLocaleTimeString()
}

// ✅ Correct: fill after render
@Component({
  template: `<p>{{ currentTime() }}</p>`,
})
export class LiveClock {
  readonly currentTime = signal('')

  constructor() {
    afterNextRender(() => {
      this.currentTime.set(new Date().toLocaleTimeString())
    })
  }
}
```

## Client hydration

Enable hydration for SSR apps; add event replay when early clicks matter.

```typescript
// ❌ Incorrect: SSR without client hydration
bootstrapApplication(App, { providers: [provideRouter(routes)] })

// ✅ Correct: hydrate + replay early clicks
provideClientHydration(withEventReplay())
```

- `@defer (hydrate on idle)` for incremental hydration.
- `ngSkipHydration` only for intentional dynamic islands.

## Render modes

Match mode to the page — don’t SSR auth dashboards or client-render static docs.

```typescript
// ❌ Incorrect: one mode for everything
export const serverRoutes: ServerRoute[] = [
  { path: '**', renderMode: RenderMode.Client },
]

// ✅ Correct: prerender / server / client by route
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'products/:id', renderMode: RenderMode.Server },
  { path: 'dashboard', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Server },
]
```

- Prerender = static; Server = personalized; Client = auth-only UI.

## HTTP transfer cache

Reuse SSR GET responses on the client.

```typescript
// ❌ Incorrect: no transfer cache — duplicate network + flash
provideClientHydration()

// ✅ Correct: transfer cache with a filter
provideClientHydration(
  withHttpTransferCacheOptions({
    includeRequestsWithAuthHeaders: false,
    filter: (httpRequest) => !httpRequest.url.includes('/api/realtime'),
  }),
)
```

- Manual `TransferState` only for non-HTTP payloads.

## Meta / SEO

Stable title/meta from the route or resolved data — not client-only random
updates.

```typescript
// ❌ Incorrect: title only after browser render / random
constructor() {
  afterNextRender(() => {
    this.title.setTitle('Product ' + Math.random())
  })
}

// ✅ Correct: route title (+ resolved data when needed)
{
  path: 'products/:id',
  component: ProductDetailPage,
  title: 'Product',
  resolve: { product: productResolver },
}
```
