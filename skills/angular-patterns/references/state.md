# State

Prefer signals for synchronous UI state. Share via services with private writable
signals and public readonly selectors — keep RxJS for real streams.

## Local signals

Use `signal` + `computed` — not `BehaviorSubject` for simple UI state.

```typescript
// ❌ Incorrect: BehaviorSubject for simple local UI state
private count$ = new BehaviorSubject(0)
count = this.count$.asObservable()
increment() {
  this.count$.next(this.count$.value + 1)
}

// ✅ Correct: signal + computed
itemCount = signal(0)
doubledCount = computed(() => this.itemCount() * 2)
incrementCount() {
  this.itemCount.update((currentCount) => currentCount + 1)
}
```

## Linked signals

Use `linkedSignal` when selection must track a source list — not an `effect`
that writes back.

```typescript
// ❌ Incorrect: effect resets selection when the list changes
menuOptions = signal(['A', 'B', 'C'])
selectedOption = signal('A')
constructor() {
  effect(() => this.selectedOption.set(this.menuOptions()[0]))
}

// ✅ Correct: linkedSignal
menuOptions = signal(['A', 'B', 'C'])
selectedOption = linkedSignal(() => this.menuOptions()[0] ?? 'A')
```

- Use the `source` / `computation` form when you need to keep a previous
  selection if it still exists in the list.

## Effects

`effect` for side effects with `onCleanup`. Derived state → `computed`.

```typescript
// ❌ Incorrect: effect to mirror derived state
effect(() => {
  this.fullName.set(`${this.firstName()} ${this.lastName()}`)
})

// ✅ Correct: computed for derived; effect for side effects
fullName = computed(() => `${this.firstName()} ${this.lastName()}`)

constructor() {
  effect((onCleanup) => {
    const searchQuery = this.searchQuery()
    const timerId = setTimeout(() => this.logSearchQuery(searchQuery), 300)
    onCleanup(() => clearTimeout(timerId))
  })
}
```

## Service state

Expose readonly signals; mutate only through service methods.

```typescript
// ❌ Incorrect: public writable signal
@Injectable({ providedIn: 'root' })
export class AuthService {
  user = signal<User | null>(null)
}

// ✅ Correct: private writable + asReadonly / computed
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userState = signal<User | null>(null)
  readonly user = this.userState.asReadonly()
  readonly isAuthenticated = computed(() => this.userState() !== null)

  clearUser() {
    this.userState.set(null)
  }
}
```

## Signal store shape

One private `state` signal + selectors/actions — not separate public writables
and an effect to derive.

```typescript
// ❌ Incorrect: related public signals + effect derive
readonly products = signal<Product[]>([])
readonly filterQuery = signal('')
readonly filteredProducts = signal<Product[]>([])
constructor() {
  effect(() => {
    const normalizedFilter = this.filterQuery().toLowerCase()
    this.filteredProducts.set(
      this.products().filter((product) =>
        product.name.toLowerCase().includes(normalizedFilter),
      ),
    )
  })
}

// ✅ Correct: one state + computed selectors
private readonly productListState = signal<{
  products: Product[]
  filterQuery: string
}>({
  products: [],
  filterQuery: '',
})
readonly products = computed(() => this.productListState().products)
readonly filteredProducts = computed(() => {
  const { products, filterQuery } = this.productListState()
  const normalizedFilter = filterQuery.toLowerCase()

  if (!normalizedFilter) {
    return products
  }

  return products.filter((product) =>
    product.name.toLowerCase().includes(normalizedFilter),
  )
})
setFilterQuery(filterQuery: string) {
  this.productListState.update((currentState) => ({
    ...currentState,
    filterQuery,
  }))
}
```

## RxJS interop

`toSignal` / `toObservable` at boundaries — not subscribe-into-a-field for
simple values. For HTTP search, prefer `httpResource` (cancels on param change)
or `switchMap` + `debounceTime` — don’t leave overlapping GETs.

```typescript
// ❌ Incorrect: subscribe into a field / new GET per keystroke
this.userService.users$.subscribe((users) => {
  this.users = users
})
searchUsers(searchQuery: string) {
  this.httpClient
    .get(`/api/search?q=${searchQuery}`)
    .subscribe((searchResults) => (this.searchResults = searchResults))
}

// ✅ Correct: toSignal at boundaries; httpResource for reactive HTTP reads
users = toSignal(this.userService.users$, { initialValue: [] })

searchQuery = signal('')
searchResource = httpResource<SearchResult[]>(() => {
  const searchQuery = this.searchQuery()
  return searchQuery.length >= 2
    ? `/api/search?q=${searchQuery}`
    : undefined
})

// Observable path when you need operators: debounce + switchMap
searchResults = toSignal(
  toObservable(this.searchQuery).pipe(
    debounceTime(300),
    distinctUntilChanged(),
    switchMap((searchQuery) =>
      this.httpClient.get<SearchResult[]>(`/api/search?q=${searchQuery}`),
    ),
  ),
  { initialValue: [] },
)
```

## Equality and untracked

Need `equal` when the same value arrives as a new object reference. Use
`untracked` to read without subscribing.

```typescript
// ❌ Incorrect: new object retriggers; accidental effect deps
user = signal({ id: 1, name: 'Ada' })
user.set({ id: 1, name: 'Ada' })
effect(() => {
  logAnalytics(this.user())
  logTheme(this.theme())
})

// ✅ Correct: equal + untracked
user = signal(
  { id: 1, name: 'Ada' },
  {
    equal: (previousUser, nextUser) =>
      previousUser.id === nextUser.id && previousUser.name === nextUser.name,
  },
)
effect(() => {
  logAnalytics(this.user())
  untracked(() => logTheme(this.theme()))
})
```
