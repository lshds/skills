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
// ❌ Incorrect: rebuild the whole form to add a row
addOrderItem() {
  this.orderForm = form(signal({ items: [/* all previous + new */] }))
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
// ❌ Incorrect: only check equality in submit — no field error state
submitLoginForm() {
  if (this.loginModel().password !== this.loginModel().confirmPassword) {
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
      return undefined
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

## Reactive Forms

When the repo already uses `FormGroup` / `NonNullableFormBuilder`, keep that
stack for new forms in the same app. Don’t start Signal Forms beside it unless
the user asks to migrate.

```typescript
// ❌ Incorrect: new Signal Forms stack beside existing FormGroup
private readonly formBuilder = inject(NonNullableFormBuilder)
readonly legacyProfileForm = this.formBuilder.group({
  email: this.formBuilder.control('', { validators: [Validators.email] }),
})
readonly profileModel = signal({ email: '' })
readonly profileForm = form(this.profileModel)

// ✅ Correct: continue Reactive Forms when that’s what the repo uses
private readonly formBuilder = inject(NonNullableFormBuilder)
readonly profileForm = this.formBuilder.group({
  email: ['', [Validators.required, Validators.email]],
  password: ['', [Validators.required, Validators.minLength(8)]],
})
```

Build with `NonNullableFormBuilder` so reset doesn’t widen to `null`. Push and
remove `FormArray` rows instead of rebuilding the group. Bind with
`formArrayName` / `formGroupName` and `@for`. Put sync, cross-field, and async
validators on the control — not only in submit. On submit, `markAllAsTouched`
when invalid, then `getRawValue()`.

```typescript
// ❌ Incorrect: recreate the whole form to add a row
addOrderItem() {
  this.orderForm = this.formBuilder.group({
    items: [this.createOrderItem()],
  })
}

// ✅ Correct: FormArray push
orderForm = this.formBuilder.group({
  items: this.formBuilder.array([this.createOrderItem()]),
})

get orderItems() {
  return this.orderForm.controls.items
}

addOrderItem() {
  this.orderItems.push(this.createOrderItem())
}
```

```typescript
// ❌ Incorrect: submit invalid form without surfacing errors
async submitLoginForm() {
  await this.authApi.submit(this.loginForm.value)
}

// ✅ Correct: markAllAsTouched; submit getRawValue
async submitLoginForm() {
  if (this.loginForm.invalid) {
    this.loginForm.markAllAsTouched()
    return
  }

  await this.authApi.submit(this.loginForm.getRawValue())
  this.loginForm.reset()
}
```

```html
<!-- ❌ Incorrect: unbound inputs / *ngFor without formArrayName -->
<div *ngFor="let orderItem of orderItems; let itemIndex = index">
  <input [(ngModel)]="orderItem.product" />
</div>

<!-- ✅ Correct: formArrayName + formGroupName + @for -->
<div formArrayName="items">
  @for (orderItem of orderItems.controls; track $index; let itemIndex = $index) {
    <div [formGroupName]="itemIndex">
      <input formControlName="product" />
    </div>
  }
</div>

<input formControlName="email" />
@if (loginForm.controls.email.invalid && loginForm.controls.email.touched) {
  @if (loginForm.controls.email.errors?.['required']) {
    <span>Email is required</span>
  }
}
```
