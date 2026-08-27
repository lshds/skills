# Routing

Prefer lazy `loadComponent` / `loadChildren`, functional guards, and
`withComponentInputBinding()`. Lazy chunks split the bundle — not a reason for
feature-folder trees. Import from the observed screen folder (`pages/` on
greenfield, `src/app/` when that’s the tree). Don’t invent `layout/` to move
CLI files.

## Lazy routes

Lazy-load heavy screens from the observed page folder. `loadChildren` is a
chunk split, not a nested feature directory. Import paths below assume
greenfield `pages/` — point them at `src/app/` when that’s the tree.

```typescript
// ❌ Incorrect: eager imports for every heavy screen
export const routes: Routes = [
  { path: 'admin', component: AdminDashboardPage },
  { path: 'settings', component: SettingsPage },
]

// ✅ Correct: lazy from pages/ — chunk ≠ feature-tree folder
export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: HomePage },
  {
    path: 'admin',
    loadChildren: () =>
      import('./pages/admin/admin.routes').then(
        (adminRoutes) => adminRoutes.adminRoutes,
      ),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./pages/settings/settings-page').then(
        (settingsPage) => settingsPage.SettingsPage,
      ),
  },
  { path: '**', component: NotFoundPage },
]
```

## Router config

Enable input binding and scroll restoration when the app needs them.

```typescript
// ❌ Incorrect: bare provideRouter when the app uses route inputs
providers: [provideRouter(routes)]

// ✅ Correct: withComponentInputBinding + scroll restoration
provideRouter(
  routes,
  withComponentInputBinding(),
  withInMemoryScrolling({
    scrollPositionRestoration: 'enabled',
    anchorScrolling: 'enabled',
  }),
)
```

## Route inputs

Bind path/query/`data` with `input()` — don’t freeze the snapshot.

```typescript
// ❌ Incorrect: snapshot-only params that miss updates
userId = inject(ActivatedRoute).snapshot.paramMap.get('id')

// ✅ Correct: input() matching the param name (path: users/:id)
readonly id = input.required<string>()
readonly parsedUserId = computed(() => {
  const parsedValue = Number(this.id())

  if (Number.isNaN(parsedValue)) {
    return undefined
  }

  return parsedValue
})
```

- Query params and static `data` bind the same way when names match.

## Route providers

Provide on the route tree — not root — when the service is only for that area.
Scope is a router concern, not folder layout.

```typescript
// ❌ Incorrect: root-provide a service only used under /admin
@Injectable({ providedIn: 'root' })
export class AdminService {}

// ✅ Correct: providers on the route
{
  path: 'admin',
  providers: [AdminService],
  children: [
    { path: '', component: AdminDashboardPage },
    { path: 'users', component: AdminUsersPage },
  ],
}
```

## Functional guards

Prefer `CanActivateFn` / `CanDeactivateFn` over class guards.

```typescript
// ❌ Incorrect: class CanActivate / CanDeactivate for new guards
@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  canActivate() {
    return inject(AuthService).isAuthenticated()
  }
}

// ✅ Correct: functional guards
export const authGuard: CanActivateFn = (
  activatedRoute,
  routerState,
) => {
  const authService = inject(AuthService)
  const router = inject(Router)

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: routerState.url },
    })
  }

  return true
}

export const unsavedChangesGuard: CanDeactivateFn<{
  canDeactivate: () => boolean
}> = (component) => {
  if (component.canDeactivate()) {
    return true
  }

  return confirm('Discard unsaved changes?')
}
```

- Factories (`createRoleGuard(allowedRoles)`) when the same check needs
  parameters.

## Resolvers

Use a `ResolveFn` only when the route must not activate without the data
(missing entity fails navigation, title comes from the entity, a guard needs
the value). Bind the result with `input()`. For in-page loading/error UI, or
params that change while the page stays open, read `input()` from
`httpResource` on the page — don’t subscribe in `ngOnInit`.

```typescript
// ❌ Incorrect: subscribe in ngOnInit (neither resolver nor httpResource)
ngOnInit() {
  const userId = this.activatedRoute.snapshot.paramMap.get('id')
  if (userId === null) {
    return
  }
  this.userApi.fetchUserById(userId).subscribe((user) => {
    this.user = user
  })
}

// ✅ Correct: ResolveFn when navigation must have the data
export function readResolvedUserName(
  routeSnapshot: ActivatedRouteSnapshot,
): string {
  const resolvedUser = routeSnapshot.data['user']

  if (
    typeof resolvedUser !== 'object' ||
    resolvedUser === null ||
    !('name' in resolvedUser)
  ) {
    return 'User'
  }

  const userName = resolvedUser.name

  if (typeof userName !== 'string') {
    return 'User'
  }

  return userName
}

export const userResolver: ResolveFn<User> = (activatedRoute) => {
  const userId = activatedRoute.paramMap.get('id')

  if (userId === null) {
    return inject(Router).createUrlTree(['/users'])
  }

  return inject(UserApi).fetchUserById(userId)
}

{
  path: 'users/:id',
  loadComponent: () =>
    import('./pages/user-detail/user-detail-page').then(
      (userDetailPage) => userDetailPage.UserDetailPage,
    ),
  resolve: { user: userResolver },
  title: readResolvedUserName,
}
// Page: readonly user = input.required<User>()
```

```typescript
// ❌ Incorrect: ResolveFn when the view should own loading/error
{
  path: 'users/:id',
  resolve: { user: userResolver },
}

export class UserDetailPage {
  readonly user = input.required<User>()
}

// ✅ Correct: httpResource on the page when the view owns loading/error
export class UserDetailPage {
  readonly id = input.required<string>()
  readonly userResource = httpResource<User>(() => {
    const userId = this.id()
    return `/api/users/${userId}`
  })
}
```

## Nested routes

Parent layout component + children — a router tree, not a nested folder tree.
Place the files in the observed roots (`layout/` / `pages/` on greenfield,
`src/app/` when that’s the tree).

```typescript
// ❌ Incorrect: sibling routes without a shared parent
{ path: 'products', component: ProductListPage },
{ path: 'products/:id', component: ProductDetailPage },

// ✅ Correct: parent layout + children
{
  path: 'products',
  component: ProductsLayout,
  children: [
    { path: '', component: ProductListPage },
    { path: ':id', component: ProductDetailPage },
  ],
}
```

## Preloading

Default is fine. Mark only hot lazy routes and wire a strategy that reads that
flag — `data: { preload: true }` does nothing by itself. Don’t preload every
chunk.

```typescript
// ❌ Incorrect: eager heavy screen / PreloadAllModules
{ path: 'dashboard', component: DashboardPage }
provideRouter(routes, withPreloading(PreloadAllModules))

// ✅ Correct: lazy + strategy that honors data.preload
@Injectable({ providedIn: 'root' })
export class HotPreloadStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    const isPreloadEnabled = route.data?.['preload'] === true

    if (!isPreloadEnabled) {
      return of(null)
    }

    return load()
  }
}

provideRouter(
  [
    {
      path: 'dashboard',
      loadComponent: () =>
        import('./pages/dashboard/dashboard-page').then(
          (dashboardPage) => dashboardPage.DashboardPage,
        ),
      data: { preload: true },
    },
  ],
  withPreloading(HotPreloadStrategy),
)
```
