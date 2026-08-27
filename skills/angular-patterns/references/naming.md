# Naming

Prefer hyphenated file names that match the primary TypeScript identifier.
Within a file, stay consistent with local conventions. If naming is unclear
(file, class, selector, event, or folder), ask the user before inventing a
name — don’t guess.

## File naming

Hyphenate multi-word files. Tests use the same base name with `.spec.ts`.
Component TypeScript, template, and styles share the same base name.

```text
# ❌ Incorrect: generic or mismatched names
UserProfileComponent.ts
userProfile.component.ts
helpers.ts
user-profile.component.spec.ts   # when class is UserProfile in user-profile.ts

# ✅ Correct: kebab file = Pascal class; colocated specs and assets
user-profile.ts          # export class UserProfile
user-profile.html
user-profile.scss        # or .css / .sass — match the repo
user-profile.spec.ts
user-profile-settings.scss   # extra style sheet — describe the variant
```

Avoid catch-all names like `utils.ts`, `helpers.ts`, or `common.ts` when the
file has no clear theme — split by concept instead.

## Selectors

Components use an app-specific element prefix. Attribute directives use the same
prefix with a **camelCase** attribute. If the prefix isn’t clear from the repo,
ask the user.

```typescript
// ❌ Incorrect: no prefix / kebab attribute directive
@Component({ selector: 'user-card' })
@Directive({ selector: '[highlight-text]' })

// ✅ Correct: app prefix; camelCase attribute directive
@Component({ selector: 'app-user-card' })
@Directive({ selector: '[appHighlight]' })
// or product prefix: [mrTooltip]
```
