# Forms A11y

Prefer native required, invalid, and labelled fields plus live announcements
over guessed ARIA. AT users get required state, linked errors, and submit
feedback.

## Required fields

Use native `required` (and `aria-required` when native validation is off). A
visual asterisk alone is not enough — hide the glyph from AT. Do not use
`aria-required` together with `required`.

```html
<!-- ❌ Incorrect: visual-only required cue — AT never hears required -->
<label for="email">Email *</label>
<input id="email" type="email" />

<!-- ✅ Correct: required on the control; decorative * hidden -->
<label for="email">
  Email <span aria-hidden="true">*</span>
</label>
<input id="email" type="email" required />
```

## Errors

Connect the message with `aria-describedby`, mark `aria-invalid`, and announce
with `role="alert"` (or a live region). Clear both when the field is valid again.
Put `role="alert"` on the form-level summary, not on each field message.

```html
<!-- ❌ Incorrect: orphaned error — not linked, not announced -->
<input id="email" type="email" />
<span class="error">Invalid email address</span>

<!-- ✅ Correct: describedby + invalid; alert is form-level (see Submit feedback) -->
<input
  id="email"
  type="email"
  aria-invalid="true"
  aria-describedby="email-error"
/>
<span id="email-error">Invalid email address</span>
```

- Only point `aria-describedby` at the error id while an error is shown.

## Groups

Name related controls with `<fieldset>` + `<legend>` (or an equivalent labelled
group) — a nearby heading alone is not the group name.

```html
<!-- ❌ Incorrect: radios with no group name -->
<label><input type="radio" name="ship" value="std" /> Standard</label>
<label><input type="radio" name="ship" value="exp" /> Express</label>

<!-- ✅ Correct: fieldset + legend names the group -->
<fieldset>
  <legend>Shipping speed</legend>
  <label><input type="radio" name="ship" value="std" /> Standard</label>
  <label><input type="radio" name="ship" value="exp" /> Express</label>
</fieldset>
```

## Autocomplete

Set meaningful `autocomplete` on identity and address fields so browsers can
fill what they already know instead of making users retype it.

```html
<!-- ❌ Incorrect: no autocomplete on identity fields -->
<label for="full-name">Full name</label>
<input id="full-name" type="text" />
<label for="email">Email</label>
<input id="email" type="email" />

<!-- ✅ Correct: autocomplete tokens match the field purpose -->
<label for="full-name">Full name</label>
<input id="full-name" type="text" autocomplete="name" />
<label for="email">Email</label>
<input id="email" type="email" autocomplete="email" />
```

- Don’t ask for the same information twice in one process (WCAG 3.3.7): pre-fill
  it from the earlier step or offer a choice such as “Billing address same as
  shipping”.

## Accessible authentication

Login and verification can’t rest on a memory or transcription test alone
(WCAG 3.3.8). Blocking paste or turning off autocomplete forces users to recall
and retype credentials; allowing paste and password managers satisfies the
criterion, and so do passkeys (WebAuthn).

```html
<!-- ❌ Incorrect: paste blocked, autocomplete off — password managers can’t fill, users must retype from memory -->
<label for="username">Email</label>
<input id="username" type="email" autocomplete="off" />
<label for="password">Password</label>
<input id="password" type="password" autocomplete="off" onpaste="return false" />

<!-- ✅ Correct: paste allowed; tokens let password managers and one-time-code autofill work -->
<label for="username">Email</label>
<input id="username" type="email" autocomplete="username" />
<label for="password">Password</label>
<input id="password" type="password" autocomplete="current-password" />
<label for="verification-code">Verification code</label>
<input id="verification-code" type="text" inputmode="numeric" autocomplete="one-time-code" />
```

- Use `autocomplete="new-password"` on sign-up and change-password fields so
  password managers offer to generate and save a new one.
- No cognitive function test (recalling a password, solving a puzzle,
  transcribing characters) without an alternative such as paste plus password
  managers, an emailed sign-in link, or a passkey.
- A code split into one input per digit must accept a pasted full code.

## Submit feedback

Announce form-level success/failure in a live region. Move focus to the first
invalid field or an error summary when many fields fail — don’t leave keyboard
users on Submit with silent errors.

```html
<!-- ❌ Incorrect: form-level error only as silent visual text -->
<p class="error">Fix the highlighted fields</p>

<!-- ✅ Correct: assertive/alert for blocking submit errors -->
<div role="alert">Fix the highlighted fields</div>
```

- Use polite/`role="status"` for success; assertive/`role="alert"` for blocking errors.
- One form-level alert — not on each field’s `aria-describedby` message.
