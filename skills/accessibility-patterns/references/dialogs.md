# Dialogs

Prefer the platform `<dialog>` or the repo’s dialog primitive. Otherwise: named
dialog, focus in, Tab trap, Escape to close, restore focus to the trigger.

## Structure and naming

Use native `<dialog>` and a visible title via `aria-labelledby`. Optional
`aria-describedby` for supporting copy. Don’t add `role="dialog"` or
`aria-modal` on native `<dialog>` — the element already provides them.
Otherwise: `role="dialog"`, `aria-modal="true"`, and the same visible title.

```html
<!-- ❌ Incorrect: untitled overlay — no dialog/modal semantics -->
<div class="modal">
  <button type="button">Close</button>
  <p>Confirm delete?</p>
</div>

<!-- ✅ Correct: native dialog, named by the visible title -->
<dialog aria-labelledby="modal-title">
  <h2 id="modal-title">Confirm delete</h2>
  <p>This cannot be undone.</p>
  <button type="button">Close</button>
</dialog>

<!-- Otherwise: named dialog with modal semantics -->
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  tabindex="-1"
>
  <h2 id="modal-title">Confirm delete</h2>
  <p>This cannot be undone.</p>
  <button type="button">Close</button>
</div>
```

## Focus sequence

On open: save the trigger, move focus into the dialog. While open: Tab cycles
inside only. On close: restore focus to the trigger.

```html
<!-- ❌ Incorrect: overlay opens; focus stays on the page trigger -->
<button type="button" id="open">Delete</button>
<div class="modal">
  <h2>Confirm delete</h2>
  <button type="button">Cancel</button>
  <button type="button">Delete</button>
</div>

<!-- ✅ Correct: showModal() moves focus in; restore to #open on close -->
<button type="button" id="open">Delete</button>
<dialog id="confirm-dialog" aria-labelledby="modal-title">
  <h2 id="modal-title">Confirm delete</h2>
  <button type="button">Cancel</button>
  <button type="button">Delete</button>
</dialog>

<!-- Otherwise: move focus into the overlay; restore to #open on close -->
<button type="button" id="open">Delete</button>
<div
  id="confirm-overlay"
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  tabindex="-1"
>
  <h2 id="modal-title">Confirm delete</h2>
  <button type="button">Cancel</button>
  <button type="button">Delete</button>
</div>
```

```js
const open = document.getElementById('open');
const dialog = document.getElementById('confirm-dialog');
open.addEventListener('click', () => dialog.showModal());
dialog.addEventListener('close', () => open.focus());
```

```js
// Otherwise (no <dialog> / primitive):
const overlay = document.getElementById('confirm-overlay');
open.addEventListener('click', () => overlay.focus());
// on close (button, Escape, or confirmed action): open.focus()
```

- Prefer the repo’s focus-trap helper or an established library for Tab cycling
  (portals, dynamic content, nested overlays).
- Don’t hand-roll a brittle trap unless no helper exists and the task requires it.
- On close (button, Escape, or confirmed action): restore focus to `#open`.

## Escape and background

Escape closes the dialog (unless a nested layer owns Escape). Background must
not stay operable — native `<dialog>.showModal()`, or `aria-modal` plus inert /
`aria-hidden`.

```html
<!-- ❌ Incorrect: “modal” with page chrome still tabbable behind it -->
<div class="page">…nav and forms still in tab order…</div>
<div class="modal">…</div>

<!-- ✅ Correct: showModal() — backdrop inert, Escape closes -->
<dialog id="confirm-dialog" aria-labelledby="modal-title">
  <h2 id="modal-title">Confirm delete</h2>
  <button type="button">Close</button>
</dialog>

<!-- Otherwise: modal dialog; background inert or aria-hidden while open -->
<div class="page" inert>…</div>
<div role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1">
  <h2 id="modal-title">Confirm delete</h2>
  <button type="button">Close</button>
</div>
```

- Backdrop click to dismiss is fine when product wants it — still restore focus.
- Always return focus to the trigger on close.
