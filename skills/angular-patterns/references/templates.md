# Templates

Prefer native control flow and direct class/style bindings. Keep template
expressions thin — derive values in the class with `computed`.

## Control flow

Use `@if` / `@for`. Do not use `*ngIf` or `*ngFor`.

```html
<!-- ❌ Incorrect: structural directives -->
<div *ngIf="loading; else ready" class="spinner"></div>
<ng-template #ready>
  <div *ngFor="let item of items; trackBy: trackId">
    {{ item.name }}
  </div>
</ng-template>

<!-- ✅ Correct: native control flow -->
@if (isLoading()) {
  <div class="spinner"></div>
} @else {
  @for (listItem of items(); track listItem.id) {
    <div>{{ listItem.name }}</div>
  } @empty {
    <p>No items</p>
  }
}
```

## Switch

Use `@switch` — not `*ngSwitch`.

```html
<!-- ❌ Incorrect: ngSwitch structural directives -->
<div [ngSwitch]="status()">
  <span *ngSwitchCase="'pending'">Pending</span>
  <span *ngSwitchCase="'active'">Active</span>
  <span *ngSwitchDefault>Unknown</span>
</div>

<!-- ✅ Correct: native @switch -->
@switch (status()) {
  @case ('pending') {
    <span>Pending</span>
  }
  @case ('active') {
    <span>Active</span>
  }
  @default {
    <span>Unknown</span>
  }
}
```

## Class and style bindings

Prefer `[class.]` / `[style.]` (or `[class]` / `[style]` objects). Do not use
`ngClass` or `ngStyle`.

```html
<!-- ❌ Incorrect: ngClass / ngStyle -->
<div [ngClass]="{ active: listItem.isActive }" [ngStyle]="{ color: textColor }"></div>

<!-- ✅ Correct: direct bindings -->
<div [class.active]="listItem.isActive" [style.color]="textColor()"></div>
```

## Signals in templates

Read signals with `value()`. Prefer signal-backed state over `async` pipe when
you already own a signal. No heavy filtering, mapping, or formatting in the
template — move that to `computed` or helpers.

```html
<!-- ❌ Incorrect: logic and async pipe when a signal already exists -->
{{ (users$ | async)?.filter(isActive).length }}

<!-- ✅ Correct: precomputed signal -->
{{ activeUserCount() }}
```

## Defer and images

Use `@defer` for below-fold or heavy UI. Prefer `NgOptimizedImage` for static
assets (`ngSrc` + width/height; `priority` for LCP). Import `NgOptimizedImage`
on the component — `ngSrc` does nothing without it.

```html
<!-- ❌ Incorrect: eager heavy UI / raw img without dimensions -->
<app-heavy-chart [data]="chartData()" />
<img src="/hero.png" alt="Hero" />

<!-- ✅ Correct: defer below-fold -->
@defer (on viewport) {
  <app-heavy-chart [data]="chartData()" />
} @placeholder {
  <div class="chart-placeholder">Loading…</div>
}
```

```typescript
// ❌ Incorrect: ngSrc without NgOptimizedImage in imports
@Component({
  selector: 'app-hero',
  template: `
    <img ngSrc="/hero.png" width="1200" height="600" priority alt="Hero" />
  `,
})
export class Hero {}

// ✅ Correct: NgOptimizedImage in imports
@Component({
  selector: 'app-hero',
  imports: [NgOptimizedImage],
  template: `
    <img ngSrc="/hero.png" width="1200" height="600" priority alt="Hero" />
  `,
})
export class Hero {}
```
