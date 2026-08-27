# Events

Prefer handlers named for the **action** they perform, not the DOM event. Keep
template and host bindings readable at the call site.

## Handler naming

Name the method for what it does (verb-noun), not for the browser event.

```typescript
// ❌ Incorrect: named for the triggering event
@Component({
  template: `<button type="button" (click)="handleClick()">Save</button>`,
})
export class UserProfile {
  private readonly userApi = inject(UserApi)
  readonly profile = input.required<User>()

  handleClick() {
    this.userApi.saveUserProfile(this.profile())
  }
}

// ✅ Correct: named for the action (verb-noun)
@Component({
  template: `<button type="button" (click)="saveUserData()">Save</button>`,
})
export class UserProfile {
  private readonly userApi = inject(UserApi)
  readonly profile = input.required<User>()

  saveUserData() {
    this.userApi.saveUserProfile(this.profile())
  }
}
```

## Keyboard

Prefer Angular key modifiers with specific action handlers.

```html
<!-- ❌ Incorrect: one opaque keydown sink for every shortcut -->
<textarea (keydown)="handleKeydown($event)"></textarea>

<!-- ✅ Correct: key modifiers + action names -->
<textarea
  (keydown.control.enter)="commitNotes()"
  (keydown.control.space)="showSuggestions()"
></textarea>
```

- Fall back to a verb-noun handler like `handleKeyboardShortcut` only when
  branching on many keys inside one method.

## Host and output events

Wire host listeners to action methods; emit domain `output()`s from those
methods — don’t expose raw DOM event names on the public API.

```typescript
// ❌ Incorrect: public API named after the DOM event
readonly click = output<void>()
onClick() {
  this.click.emit()
}

// ✅ Correct: domain output + action method
readonly userSaved = output<void>()

saveUserData() {
  this.userSaved.emit()
}
```
