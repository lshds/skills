# SSR

Prefer transfer cache over refetching the same GETs. Gate browser APIs with
`afterNextRender` / `isPlatformBrowser` so server and client markup match. On
Angular 22, a bare `provideClientHydration()` is the whole hydration setup;
`@defer (hydrate on viewport | interaction | idle)` decides when each block
hydrates.

## Browser-only code

Don’t touch `window` / `document` during construction or SSR — init after
render.

```typescript
// ❌ Incorrect: DOM in the constructor / field initializer
export class AnalyticsChart {
  constructor() {
    const chartElement = document.getElementById('chart')

    if (!chartElement) {
      return
    }

    new ChartLib(chartElement)
  }
}

// ✅ Correct: afterNextRender (browser-only)
export class AnalyticsChart {
  constructor() {
    afterNextRender(() => {
      const chartElement = document.getElementById('chart')

      if (!chartElement) {
        return
      }

      new ChartLib(chartElement)
    })
  }
}
```

## Browser globals

Tokens that are `undefined` on the server — don’t assume `localStorage` exists.

```typescript
// ❌ Incorrect: assume localStorage always exists
export const LOCAL_STORAGE = new InjectionToken<Storage>('LocalStorage', {
  providedIn: 'root',
  factory: () => localStorage,
})

// ✅ Correct: undefined on the server
export const LOCAL_STORAGE = new InjectionToken<Storage | undefined>('LocalStorage', {
  providedIn: 'root',
  factory: () =>
    isPlatformBrowser(inject(PLATFORM_ID)) ? localStorage : undefined,
})
```

- Usage: `this.storage?.getItem(storageKey) ?? undefined`

## Hydration mismatches

Avoid first-paint values that differ server vs client (clocks, random, “now”).

```typescript
// ❌ Incorrect: Date.now() / locale time in the field initializer
@Component({ template: `<p>{{ currentTime }}</p>` })
export class LiveClock {
  currentTime = new Date().toLocaleTimeString()
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

Enable hydration for SSR apps — without it the client re-renders and throws
away the server DOM. On Angular 22, `provideClientHydration()` already turns
on incremental hydration, event replay, and the HTTP transfer cache.

```typescript
import type { ApplicationConfig } from '@angular/core'
import {
  provideClientHydration,
  withEventReplay,
  withIncrementalHydration,
} from '@angular/platform-browser'
import { provideRouter } from '@angular/router'
import { routes } from './app.routes'

// ❌ Incorrect: SSR without client hydration — the server DOM is discarded
export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes)],
}

// ❌ Incorrect: v22 — withIncrementalHydration() is deprecated, withEventReplay() is redundant
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideClientHydration(withIncrementalHydration(), withEventReplay()),
  ],
}

// ✅ Correct: v22 default — incremental hydration and event replay included
export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideClientHydration()],
}
```

- Angular 20–21: keep `withIncrementalHydration()` (and `withEventReplay()`
  where the repo has it) until the upgrade to 22, then drop them.
- Opt out of incremental hydration with
  `provideClientHydration(withNoIncrementalHydration())`.
- `ngSkipHydration` only for intentional dynamic islands.

## Incremental hydration

Wrap below-fold or rarely used server-rendered UI in `@defer` with a `hydrate`
trigger. The server HTML stays visible; the block’s code loads and hydrates
only when the trigger fires, so it stays out of the initial bundle.

```html
<!-- ❌ Incorrect: every widget hydrates up front with the rest of the page -->
<app-size-picker [sizes]="sizes()" />
<app-product-reviews [productId]="productId()" />
<app-related-products [productId]="productId()" />

<!-- ✅ Correct: hydrate each block when it is needed -->
@defer (hydrate on interaction) {
  <app-size-picker [sizes]="sizes()" />
}
@defer (hydrate on viewport) {
  <app-product-reviews [productId]="productId()" />
}
@defer (hydrate on idle) {
  <app-related-products [productId]="productId()" />
}
```

- `hydrate on interaction` for controls that matter only once touched;
  `hydrate on viewport` for below-fold content; `hydrate on idle` for
  low-priority UI that should still become interactive soon.

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

`provideClientHydration()` reuses SSR GET responses on the client by default.
Keep it on and narrow it with a filter — turning it off sends every SSR GET
again from the browser and flashes the page.

```typescript
import {
  provideClientHydration,
  withHttpTransferCacheOptions,
  withNoHttpTransferCache,
} from '@angular/platform-browser'

// ❌ Incorrect: transfer cache disabled — duplicate network + flash
provideClientHydration(withNoHttpTransferCache())

// ✅ Correct: default transfer cache minus endpoints that must stay live
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
