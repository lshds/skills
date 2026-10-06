# Forms

Greenfield: Signal Forms (`form()`, `[formField]`, schema validators). If the
repo already uses Reactive Forms, stay on that stack. One form system per app.
Don’t convert `FormGroup` to Signal Forms unless the user asks.

## Match vs migrate

New forms follow the stack already in the repo. Empty app / greenfield uses
Signal Forms. Mixing `form()` and `FormGroup` in the same app splits APIs,
validation, and templates — don’t introduce the other stack as a drive-by.

## Signal Forms

Model state in a signal. Wrap it with `form()` and a schema. Bind controls with
`[formField]`. Import `FormField` on the component.

```typescript
import { Component, signal } from '@angular/core'
import { FormControl, FormGroup } from '@angular/forms'
import {
  FormField,
  email,
  form,
  minLength,
  pattern,
  required,
} from '@angular/forms/signals'

// ❌ Incorrect: untyped FormGroup / template-driven mix on greenfield
loginForm = new FormGroup({
  email: new FormControl(''),
  password: new FormControl(''),
})

// ✅ Correct: model signal + form() + schema validators
@Component({
  selector: 'app-login',
  imports: [FormField],
  templateUrl: './login.html',
})
export class LoginPage {
  readonly loginModel = signal({
    email: '',
    password: '',
    address: {
      city: '',
      postalCode: '',
    },
  })

  readonly loginForm = form(this.loginModel, (schemaPath) => {
    required(schemaPath.email, { message: 'Email is required' })
    email(schemaPath.email, { message: 'Enter a valid email address' })
    required(schemaPath.password, { message: 'Password is required' })
    minLength(schemaPath.password, 8)
    required(schemaPath.address.city)
    required(schemaPath.address.postalCode)
    pattern(schemaPath.address.postalCode, /^\d{5}$/)
  })
}
```

```html
<!-- ❌ Incorrect: formControlName on a Signal Form -->
<input formControlName="email" />
<input formControlName="password" />

<!-- ✅ Correct: [formField] -->
<input type="email" [formField]="loginForm.email" />
<input type="password" [formField]="loginForm.password" />
<input [formField]="loginForm.address.city" />
<input [formField]="loginForm.address.postalCode" />
```

## Repeating rows

Hold the array on the model signal. Validate each item with `applyEach`. Add
and remove rows by updating the model — the field tree follows.

```typescript
import { signal } from '@angular/core'
import { applyEach, form, min, required } from '@angular/forms/signals'

// ❌ Incorrect: rebuild the whole form to add a row — field state resets
addOrderItem() {
  const nextItems = [...this.orderModel().items, { product: '', quantity: 1 }]
  this.orderForm = form(signal({ items: nextItems }))
}

// ✅ Correct: applyEach + immutable model update
readonly orderModel = signal({
  items: [{ product: '', quantity: 1 }],
})

readonly orderForm = form(this.orderModel, (schemaPath) => {
  applyEach(schemaPath.items, (item) => {
    required(item.product)
    min(item.quantity, 1)
  })
})

addOrderItem() {
  this.orderModel.update((order) => ({
    ...order,
    items: [...order.items, { product: '', quantity: 1 }],
  }))
}

removeOrderItem(itemIndex: number) {
  this.orderModel.update((order) => ({
    ...order,
    items: order.items.filter((_orderItem, index) => index !== itemIndex),
  }))
}
```

```html
<!-- ❌ Incorrect: *ngFor + ngModel on a Signal Form array -->
<div *ngFor="let orderItem of orderModel().items; let itemIndex = index">
  <input [(ngModel)]="orderItem.product" />
</div>

<!-- ✅ Correct: @for + [formField] on the field tree -->
@for (orderItem of orderForm.items; track $index) {
  <input [formField]="orderItem.product" />
  <input type="number" [formField]="orderItem.quantity" />
  <button type="button" (click)="removeOrderItem($index)">Remove</button>
}
```

## Validators

Put rules on the schema — don’t only check in submit. Use `validate()` for
cross-field rules.

```typescript
import { signal } from '@angular/core'
import { form, minLength, required, validate } from '@angular/forms/signals'

// ❌ Incorrect: only check equality in submit — no field error state
submitPasswordForm() {
  if (this.passwordModel().password !== this.passwordModel().confirmPassword) {
    return
  }
}

// ✅ Correct: schema validators + validate() for cross-field
readonly passwordModel = signal({
  password: '',
  confirmPassword: '',
})

readonly passwordForm = form(this.passwordModel, (schemaPath) => {
  required(schemaPath.password)
  minLength(schemaPath.password, 8)
  required(schemaPath.confirmPassword)
  validate(schemaPath.confirmPassword, ({ value, valueOf }) => {
    if (value() === valueOf(schemaPath.password)) {
      return
    }

    return { kind: 'passwordMismatch', message: 'Passwords must match' }
  })
})
```

## Submit

Use `submit()` from `@angular/forms/signals`. It marks fields touched and skips
the action when the form is invalid. Submit the model signal, not a parallel
object.

```typescript
import { submit } from '@angular/forms/signals'

// ❌ Incorrect: submit without going through submit()
async submitLoginForm() {
  await this.authApi.submit(this.loginModel())
}

// ✅ Correct: submit() — touches fields, runs only when valid
async submitLoginForm() {
  await submit(this.loginForm, async () => {
    await this.authApi.submit(this.loginModel())
    this.loginModel.set({
      email: '',
      password: '',
      address: { city: '', postalCode: '' },
    })
  })
}
```

## Field errors

Render `errors()` on the field after touch — not a single global banner only.

```html
<!-- ❌ Incorrect: one global error, never per-field -->
@if (submitFailed) {
  <p>Form is invalid</p>
}

<!-- ✅ Correct: per-field errors when invalid && touched -->
<input type="email" [formField]="loginForm.email" />
@if (loginForm.email().invalid() && loginForm.email().touched()) {
  @for (fieldError of loginForm.email().errors(); track fieldError.kind) {
    <span>{{ fieldError.message }}</span>
  }
}
```

## Custom controls with FormValueControl

A custom control for Signal Forms implements `FormValueControl<T>` and exposes
its value as a `model()` — `[formField]` keeps that model and the field in
sync. A new `ControlValueAccessor` adds a provider and callback plumbing that
Signal Forms doesn’t need.

```typescript
import { Component, forwardRef, model, signal } from '@angular/core'
import { NG_VALUE_ACCESSOR } from '@angular/forms'
import type { ControlValueAccessor } from '@angular/forms'
import type { FormValueControl } from '@angular/forms/signals'

// ❌ Incorrect: new ControlValueAccessor for a Signal Forms control
@Component({
  selector: 'app-clearable-input',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ClearableInput),
      multi: true,
    },
  ],
  template: `
    <input
      #textInput
      [value]="text()"
      (input)="updateText(textInput.value)"
      (blur)="markTouched()"
    />
    <button type="button" (click)="updateText('')">Clear</button>
  `,
})
export class ClearableInput implements ControlValueAccessor {
  protected readonly text = signal('')
  private notifyChange: (text: string) => void = () => {}
  private notifyTouched: () => void = () => {}

  writeValue(text: string) {
    this.text.set(text)
  }

  registerOnChange(onChange: (text: string) => void) {
    this.notifyChange = onChange
  }

  registerOnTouched(onTouched: () => void) {
    this.notifyTouched = onTouched
  }

  updateText(text: string) {
    this.text.set(text)
    this.notifyChange(text)
  }

  markTouched() {
    this.notifyTouched()
  }
}

// ✅ Correct: FormValueControl — the value model is the whole contract
@Component({
  selector: 'app-clearable-input',
  template: `
    <input
      #textInput
      [value]="value()"
      (input)="value.set(textInput.value)"
      (blur)="touched.set(true)"
    />
    <button type="button" (click)="value.set('')">Clear</button>
  `,
})
export class ClearableInput implements FormValueControl<string> {
  readonly value = model('')
  readonly touched = model(false)
}
```

```html
<!-- ✅ Correct: bound like a native input -->
<app-clearable-input [formField]="profileForm.nickname" />
```

- Boolean controls (switches, custom checkboxes) implement
  `FormCheckboxControl` with `readonly checked = model(false)` instead of a
  `value` model.
- `value` (or `checked`) is the only required member. Declare optional inputs
  such as `disabled`, `required`, or `errors` only when the control renders
  them — the field state fills them.
- Existing `ControlValueAccessor` components in Reactive Forms code stay as
  they are.

## Reactive Forms

When the repo already uses `FormGroup` / `NonNullableFormBuilder`, keep that
stack for new forms in the same app. Don’t start Signal Forms beside it unless
the user asks to migrate.

```typescript
import { inject, signal } from '@angular/core'
import { NonNullableFormBuilder, Validators } from '@angular/forms'
import { form } from '@angular/forms/signals'

// ❌ Incorrect: Signal Forms beside the repo’s existing FormGroup forms
readonly profileModel = signal({ email: '' })
readonly profileForm = form(this.profileModel)

// ✅ Correct: continue Reactive Forms when that’s what the repo uses
private readonly formBuilder = inject(NonNullableFormBuilder)
readonly profileForm = this.formBuilder.group({
  email: ['', [Validators.required, Validators.email]],
})
```

Grow arrays in place and surface errors before submitting.

```typescript
import { inject } from '@angular/core'
import { NonNullableFormBuilder, Validators } from '@angular/forms'

// ❌ Incorrect: submit an invalid form without surfacing errors
async submitOrder() {
  await this.orderApi.submit(this.orderForm.value)
}

// ✅ Correct: FormArray push; markAllAsTouched when invalid, then getRawValue
private readonly formBuilder = inject(NonNullableFormBuilder)
private readonly orderApi = inject(OrderApi)

readonly orderForm = this.formBuilder.group({
  items: this.formBuilder.array([this.createOrderItem()]),
})

get orderItems() {
  return this.orderForm.controls.items
}

addOrderItem() {
  this.orderItems.push(this.createOrderItem())
}

async submitOrder() {
  if (this.orderForm.invalid) {
    this.orderForm.markAllAsTouched()
    return
  }

  await this.orderApi.submit(this.orderForm.getRawValue())
  this.orderForm.reset()
}

private createOrderItem() {
  return this.formBuilder.group({
    product: ['', Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
  })
}
```

- Build with `NonNullableFormBuilder` so `reset()` doesn’t widen values to
  `null`.
- `push` / `removeAt` on the `FormArray` — rebuilding the group to add a row
  drops every row’s value and touched state.
- Bind rows with `formArrayName="items"`, then
  `@for (orderItem of orderItems.controls; track $index; let itemIndex = $index)`
  around `[formGroupName]="itemIndex"` and `formControlName` inputs — not
  `*ngFor` + `ngModel`.
- Put sync, cross-field, and async validators on the controls — not only in
  submit — and render per-field errors when the control is invalid and touched
  (`profileForm.controls.email.errors?.['required']`).

## Migrate incrementally

Only during an approved migration from Reactive Forms: bridge the two stacks
one control at a time instead of rewriting a large form in one change. Remove
the bridge once the form is fully on Signal Forms — it is not an end state.

```typescript
import { signal } from '@angular/core'
import { FormControl, FormGroup } from '@angular/forms'
import { required } from '@angular/forms/signals'
import { SignalFormControl, compatForm } from '@angular/forms/signals/compat'

// ✅ Correct: signal form that still embeds an existing reactive control
readonly billingAddressControl = new FormControl('', { nonNullable: true })
readonly checkoutModel = signal({
  email: '',
  billingAddress: this.billingAddressControl,
})
readonly checkoutForm = compatForm(this.checkoutModel, (schemaPath) => {
  required(schemaPath.email)
})

// ✅ Correct: signal-form leaf inside an existing FormGroup
readonly nicknameControl = new SignalFormControl('', (nickname) => {
  required(nickname)
})
readonly profileForm = new FormGroup({
  nickname: this.nicknameControl,
  email: new FormControl('', { nonNullable: true }),
})
```

```html
<!-- ✅ Correct: SignalFormControl binds through its fieldTree -->
<form [formGroup]="profileForm">
  <input [formField]="nicknameControl.fieldTree" />
  <input formControlName="email" />
</form>
```

- `compatForm` wraps an existing `FormGroup` / `FormControl` inside a signal
  form — the new parent moves first, reactive children follow later.
- `SignalFormControl` goes the other way: a signal-form leaf inside an existing
  `FormGroup`, bound with `[formField]` on its `.fieldTree`.
