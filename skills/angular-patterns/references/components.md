# Components

Prefer standalone components with signal inputs/outputs and the `host` object.
OnPush is already the default — don’t set it on every decorator.

## Change detection

Omit `changeDetection` (OnPush is the compiler default). The old check-always
strategy is `ChangeDetectionStrategy.Eager` — `ng update` stamps that on
existing components; leave it. Don’t rewrite `Eager` components to OnPush
unless the user asks.

Greenfield is zoneless. Don’t add `provideZonelessChangeDetection()` or
`provideZoneChangeDetection()`. If the repo still uses Zone.js, keep it and
ask before migrating.

```typescript
// ❌ Incorrect: redundant OnPush; re-enable Zone.js on a zoneless app
@Component({
  selector: 'app-user-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2>{{ name() }}</h2>`,
})
export class UserCard {}

bootstrapApplication(App, {
  providers: [provideZoneChangeDetection()],
})

// ✅ Correct: omit changeDetection; zoneless needs no zone provider
@Component({
  selector: 'app-user-card',
  template: `<h2>{{ userName() }}</h2>`,
})
export class UserCard {
  readonly userName = input.required<string>()
}

bootstrapApplication(App, { providers: [provideRouter(routes)] })
```

- Older check-always apps: set `OnPush` on new components when that’s still required.
- Existing `provideZoneChangeDetection()` / `zone.js` polyfill: match the repo.

## Declaration

Don’t set `standalone: true` (default). Prefer named class exports and signal
I/O over decorator I/O.

```typescript
// ❌ Incorrect: decorator I/O + HostBinding
@Component({
  selector: 'app-user-card',
  template: `<h2>{{ name }}</h2>`,
})
export class UserCard {
  @Input({ required: true }) name!: string
  @Output() selected = new EventEmitter<string>()
  @HostBinding('class.active') isActive = false
}

// ✅ Correct: readonly signal I/O + host object (no changeDetection)
@Component({
  selector: 'app-user-card',
  host: { '[class.active]': 'isActive()' },
  template: `<h2>{{ displayName() }}</h2>`,
})
export class UserCard {
  readonly userName = input.required<string>()
  readonly isActive = input(false, { transform: booleanAttribute })
  readonly userSelected = output<string>()
  protected readonly displayName = computed(() => this.userName())

  selectUser() {
    this.userSelected.emit(this.userName())
  }
}
```

- Also: `model()` for two-way; `numberAttribute` / `booleanAttribute` transforms;
  `is…` / `has…` boolean names; `outputFromObservable` only for RxJS interop.

## Class members

Angular APIs first (inject, inputs/outputs, queries), then methods. `readonly`
for Angular-initialized fields; `protected` for template-only members.

```typescript
// ❌ Incorrect: methods before APIs; public template-only fields
export class UserProfile {
  saveUserData() {
    this.userSaved.emit()
  }
  userId = input.required<string>()
  fullName = computed(() => `${this.firstName()} ${this.lastName()}`)
  firstName = input.required<string>()
  lastName = input.required<string>()
}

// ✅ Correct: APIs first; protected template helpers
export class UserProfile {
  private readonly userApi = inject(UserApi)
  readonly userId = input.required<string>()
  readonly firstName = input.required<string>()
  readonly lastName = input.required<string>()
  readonly userSaved = output<void>()
  protected readonly fullName = computed(
    () => `${this.firstName()} ${this.lastName()}`,
  )

  saveUserData() {
    this.userSaved.emit()
  }
}
```

## Host bindings

Put classes, styles, and attrs in `host` — not `@HostBinding` / `@HostListener`.

```typescript
// ❌ Incorrect: @HostBinding / @HostListener
@HostBinding('class.expanded') get expandedClass() {
  return this.isExpanded()
}
@HostListener('click') onClick() {
  this.toggleExpanded()
}

// ✅ Correct: host object on the decorator
@Component({
  selector: 'app-expand-panel',
  host: {
    '[class.expanded]': 'isExpanded()',
    '(click)': 'toggleExpanded()',
  },
  template: `<ng-content />`,
})
export class ExpandPanel {
  protected readonly isExpanded = signal(false)

  toggleExpanded() {
    this.isExpanded.update((isCurrentlyExpanded) => !isCurrentlyExpanded)
  }
}
```

## Queries

Prefer signal queries over decorator queries.

```typescript
// ❌ Incorrect: decorator queries
@ViewChild('container') container!: ElementRef
@ContentChildren(Tab) tabs!: QueryList<Tab>

// ✅ Correct: readonly signal queries
readonly galleryContainer =
  viewChild.required<ElementRef<HTMLDivElement>>('container')
readonly tabPanels = contentChildren(Tab)
```

- Multi-slot projection with `select` when needed.

## Lifecycle

Skip `ngOnInit` when field initializers, `input()`, `httpResource`, or
`afterNextRender` already cover the work. If a hook is required, implement the
interface and keep it thin.

```typescript
// ❌ Incorrect: fetch and setup dumped in ngOnInit
export class UserProfile implements OnInit {
  users: User[] = []
  ngOnInit() {
    this.httpClient.get<User[]>('/api/users').subscribe((users) => {
      this.users = users
    })
    this.logger.setMode('info')
  }
}

// ✅ Correct: no hook — resource + afterNextRender
export class UserProfile {
  private readonly logger = inject(Logger)
  readonly headingRef = viewChild<ElementRef<HTMLHeadingElement>>('heading')
  readonly userId = input.required<string>()
  readonly userResource = httpResource<User>(
    () => `/api/users/${this.userId()}`,
  )

  constructor() {
    this.logger.setMode('info')

    afterNextRender(() => {
      this.focusHeading()
    })
  }

  private focusHeading() {
    this.headingRef()?.nativeElement.focus()
  }
}
```

## Presentation focus

Keep components about the UI. Domain rules live in shared helpers; the
component derives — it doesn’t re-wrap the helper as a pass-through method.

```typescript
// ❌ Incorrect: validation regex only in the component
export class CheckoutPage {
  isEmailValid(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }
}

// ✅ Correct: helper in a util; component derives a signal
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export class CheckoutPage {
  readonly email = input.required<string>()
  protected readonly emailIsValid = computed(() => isValidEmail(this.email()))
}
```
