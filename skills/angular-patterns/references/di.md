# DI

Prefer `inject()` and explicit provider scopes. Root for true singletons;
component providers for instance-per-component.

## inject()

Use field `inject()` instead of constructor parameters for new code.

```typescript
// ❌ Incorrect: constructor injection as the default for new code
export class UserList {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly userService: UserService,
  ) {}
}

// ✅ Correct: inject() at field level
export class UserList {
  private readonly httpClient = inject(HttpClient)
  private readonly userService = inject(UserService)
}
```

- Options: `{ optional: true }`, `{ self: true }`, `{ skipSelf: true }`,
  `{ host: true }`.

## Provider scopes

Root for app-wide singletons. Component `providers` when state is local to that
tree — don’t put editor drafts in root.

```typescript
// ❌ Incorrect: everything in root when the state is local to one editor
@Injectable({ providedIn: 'root' })
export class EditorState {
  draftText = signal('')
}

// ✅ Correct: root for app-wide; component providers for per-instance state
@Injectable({ providedIn: 'root' })
export class AuthService {}

@Component({
  selector: 'app-document-editor',
  providers: [EditorState],
  template: `<ng-content />`,
})
export class DocumentEditor {
  private readonly editorState = inject(EditorState)
}
```

- `providers` — available to the component and content children.
- `viewProviders` — available to the view only (not projected content).

## Tokens and provider kinds

Prefer `InjectionToken` (and typed providers) over string/magic globals.

```typescript
// ❌ Incorrect: string token / imported mutable global
export let apiUrl = 'https://api.example.com'

// ✅ Correct: InjectionToken + app providers
export const API_URL = new InjectionToken<string>('API_URL')

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: API_URL, useValue: 'https://api.example.com' },
    {
      provide: Logger,
      useClass: environment.production ? RemoteLogger : ConsoleLogger,
    },
    { provide: AbstractLogger, useExisting: ConsoleLogger },
  ],
}
```

## Abstract class tokens

Prefer an abstract class as the token when you need a typed API surface.

```typescript
// ❌ Incorrect: string token for a logger API
export const LOGGER = 'Logger'

// ✅ Correct: abstract class token + concrete implementation
export abstract class Logger {
  abstract log(message: string): void
}

@Injectable()
export class ConsoleLogger extends Logger {
  log(message: string) {
    console.log(message)
  }
}
```

## Factory tokens

Self-provide tokens with factories when the value depends on the environment
(e.g. browser globals).

```typescript
// ❌ Incorrect: read window at import time
export const WINDOW = window

// ✅ Correct: factory token — null-safe outside the browser
export const WINDOW = new InjectionToken<Window | null>('Window', {
  providedIn: 'root',
  factory: () => (typeof window !== 'undefined' ? window : null),
})
```

## App initializer

Use `provideAppInitializer` for startup work (not legacy `APP_INITIALIZER`
factories unless the repo already uses them).

```typescript
// ❌ Incorrect: legacy APP_INITIALIZER multi-provider for new apps
{
  provide: APP_INITIALIZER,
  multi: true,
  useFactory: () => {
    const configService = inject(ConfigService)
    return () => configService.loadConfig()
  },
}

// ✅ Correct: provideAppInitializer
provideAppInitializer(() => {
  const configService = inject(ConfigService)
  return configService.loadConfig()
})
```

## Cleanup

Unsubscribe with `takeUntilDestroyed` or `DestroyRef.onDestroy`.

```typescript
// ❌ Incorrect: bare subscribe — leaks when the owner destroys
this.profileUpdates$.subscribe((profile) => this.renderProfile(profile))

// ✅ Correct: takeUntilDestroyed (pass DestroyRef outside constructor)
private readonly destroyRef = inject(DestroyRef)

constructor() {
  this.profileUpdates$
    .pipe(takeUntilDestroyed())
    .subscribe((profile) => this.renderProfile(profile))
}

watchLaterUpdates() {
  this.profileUpdates$
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe((profile) => this.renderProfile(profile))
}
```
