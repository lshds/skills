# HTTP

Prefer `httpResource` / `resource` for reactive reads. Bind status from the
resource — don’t keep parallel flags. Use `HttpClient` for mutations and
operator-heavy pipelines. Functional interceptors only.

## httpResource and resource

Page GETs that show loading/error or re-run when `input()` / signals change
belong in `httpResource` on the page (typed, no manual `json()` casts; return
`undefined` when params aren’t ready) — don’t fetch in `ngOnInit`. Use a route
`ResolveFn` only when navigation must not start without the data.

```typescript
// ❌ Incorrect: manual subscribe + flags for every GET
users: User[] = []
loading = false
error: string | null = null

ngOnInit() {
  this.loading = true
  this.http.get<User[]>('/api/users').subscribe({
    next: (users) => (this.users = users),
    error: () => (this.error = 'failed'),
    complete: () => (this.loading = false),
  })
}

// ✅ Correct: httpResource tied to route input / signal params
readonly id = input.required<string>()

userResource = httpResource<User>(() => {
  const userId = this.id()
  return userId ? `/api/users/${userId}` : undefined
})

searchQuery = signal('')

searchResource = httpResource<SearchResult[]>(() => {
  const searchQuery = this.searchQuery()
  return searchQuery.length >= 2
    ? `/api/search?q=${searchQuery}`
    : undefined
})
```

- Use `resource` for non-HTTP async work.

## Resource status

Bind `isLoading`, `error`, `hasValue`, and `value` from the resource — don’t
keep parallel flags beside a subscribe.

```html
<!-- ❌ Incorrect: hand-rolled flags beside a raw subscribe -->
@if (loading) {
  <p>Loading…</p>
} @else if (error) {
  <p>{{ error }}</p>
} @else {
  <h1>{{ user?.name }}</h1>
}

<!-- ✅ Correct: resource status helpers -->
@if (userResource.isLoading()) {
  <p>Loading…</p>
} @else if (userResource.error(); as loadError) {
  <p>{{ loadError.message }}</p>
} @else if (userResource.hasValue()) {
  <h1>{{ userResource.value().name }}</h1>
}
```

## Service layer and mutations

Keep URLs and CRUD in injectable services. Use `HttpClient` for POST/PATCH/DELETE.

```typescript
// ❌ Incorrect: HttpClient calls scattered in every component
export class UserProfilePage {
  private readonly httpClient = inject(HttpClient)
  replaceUser(user: User) {
    return this.httpClient.put(`/api/users/${user.id}`, user)
  }
}

// ✅ Correct: service owns endpoints; components call the service
@Injectable({ providedIn: 'root' })
export class UserApi {
  private readonly httpClient = inject(HttpClient)
  private readonly usersBaseUrl = '/api/users'

  fetchUserById(userId: string) {
    return this.httpClient.get<User>(`${this.usersBaseUrl}/${userId}`)
  }

  updateUser(userId: string, userPatch: Partial<User>) {
    return this.httpClient.patch<User>(`${this.usersBaseUrl}/${userId}`, userPatch)
  }
}
```

## Interceptors

Prefer functional interceptors with `provideHttpClient(withInterceptors([...]))`.

```typescript
// ❌ Incorrect: class-based HttpInterceptor for new apps
@Injectable()
export class ApiPrefixInterceptor implements HttpInterceptor {
  intercept(request: HttpRequest<unknown>, next: HttpHandler) {
    return next.handle(request)
  }
}

// ✅ Correct: functional interceptors + provideHttpClient
export const apiPrefixInterceptor: HttpInterceptorFn = (request, next) => {
  const apiUrl = inject(API_URL)
  const isAbsoluteUrl = request.url.startsWith('http')

  if (isAbsoluteUrl) {
    return next(request)
  }

  return next(request.clone({ url: `${apiUrl}${request.url}` }))
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([apiPrefixInterceptor])),
  ],
}
```

## Cancellation and debounce

`resource` / `httpResource` cancel in-flight work when params change. For
Observable search, use `switchMap` + `debounceTime` via `toObservable` /
`toSignal` — don’t leave overlapping GETs.

```typescript
// ❌ Incorrect: new subscribe per keystroke without cancelling prior
searchUsers(searchQuery: string) {
  this.httpClient
    .get(`/api/search?q=${searchQuery}`)
    .subscribe((searchResults) => (this.searchResults = searchResults))
}

// ✅ Correct: switchMap cancels prior requests
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
