# Dialogs

Prefer the platform `<dialog>` with `showModal()` or the repo’s dialog primitive
over a hand-built overlay so focus moves in, the background goes inert, and
Escape closes without custom code. Non-modal overlays (menus, disclosures,
toasts) use `popover` instead of dialog machinery. Build a custom
`role="dialog"` only when neither fits.

## Structure and naming

Use native `<dialog>` and a visible title via `aria-labelledby`. Optional
`aria-describedby` for supporting copy. Don’t add `role="dialog"` or
`aria-modal` on native `<dialog>` — the element already provides them.

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
```

## Focus sequence

On open: save the trigger, move focus into the dialog. While open: Tab cycles
inside only. On close: restore focus to the trigger — keyboard users otherwise
restart from the top of the page.

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
```

```js
const openButton = document.getElementById('open');
const confirmDialog = document.getElementById('confirm-dialog');

if (!openButton || !confirmDialog) {
  throw new Error('Missing #open or #confirm-dialog');
}

openButton.addEventListener('click', () => confirmDialog.showModal());
confirmDialog.addEventListener('close', () => openButton.focus());
```

- The `close` event fires for every way the dialog closes (button, Escape,
  confirmed action, light dismiss), so one listener restores focus for all.

## Escape and an inert background

Escape closes the dialog (unless a nested layer owns Escape), and nothing behind
it stays operable. `showModal()` gives both. Without it, put `inert` on the
background: `aria-hidden="true"` on a container with focusable descendants
hides them from screen readers while Tab still reaches them, so keyboard users
land on silent controls.

```html
<!-- ❌ Incorrect: aria-hidden page wrapper — its link and search field stay tabbable but silent -->
<div class="page" aria-hidden="true">
  <a href="/orders">Orders</a>
  <input type="search" aria-label="Search orders" />
</div>
<div class="modal">
  <h2>Confirm delete</h2>
  <button type="button">Close</button>
</div>

<!-- ✅ Correct: showModal() — background inert, Escape closes -->
<div class="page">
  <a href="/orders">Orders</a>
  <input type="search" aria-label="Search orders" />
</div>
<dialog id="confirm-dialog" aria-labelledby="modal-title">
  <h2 id="modal-title">Confirm delete</h2>
  <button type="button">Close</button>
</dialog>
```

## Light dismiss with closedby

Backdrop click to dismiss is fine when the product wants it. Declare it with
`closedby="any"` instead of wiring a click handler; support varies across
browsers, but Escape still closes a modal dialog without the attribute, so
nothing breaks where it is missing.

```html
<!-- ✅ Correct: light dismiss on a low-stakes dialog; the close listener still restores focus -->
<dialog id="share-dialog" aria-labelledby="share-title" closedby="any">
  <h2 id="share-title">Share report</h2>
  <button type="button">Copy link</button>
</dialog>
```

- Keep light dismiss off destructive or multi-step dialogs, where a stray click
  would discard the user’s work.

## Non-modal overlays use popover

Menus, disclosures, and toasts don’t block the page, so modal dialog machinery
(focus trap, `aria-modal`, inert background) is wrong for them. `popover` with
a `popovertarget` button gives top-layer rendering, Escape, and light dismiss
with no script.

```html
<!-- ❌ Incorrect: modal dialog semantics on a non-modal filter panel — blocks and traps the page -->
<button type="button" id="filters-trigger">Filters</button>
<div class="filters-overlay" role="dialog" aria-modal="true" aria-label="Filters" hidden>
  <label><input type="checkbox" name="in-stock" /> In stock</label>
</div>

<!-- ✅ Correct: popover opened by its invoker button -->
<button type="button" popovertarget="filters-panel">Filters</button>
<div id="filters-panel" popover>
  <label><input type="checkbox" name="in-stock" /> In stock</label>
</div>
```

- `popover` only handles showing and hiding; it adds no role. A popover menu or
  listbox still needs its own roles and arrow-key map.
- Toasts that must not light-dismiss use `popover="manual"` and still need a
  live region (`role="status"`) so the message is announced.

## When a custom dialog is OK

Only when native `<dialog>` and the repo primitive are both unavailable: give
the overlay `role="dialog"`, `aria-modal="true"`, and the visible title; set
`inert` on the page while it is open; move focus in; close on Escape; and
restore focus to the trigger.

```html
<!-- ✅ Correct: named modal dialog; the page is made inert while it is open -->
<div class="page">
  <button type="button" id="open">Delete</button>
</div>
<div
  id="confirm-overlay"
  role="dialog"
  aria-modal="true"
  aria-labelledby="confirm-title"
  tabindex="-1"
  hidden
>
  <h2 id="confirm-title">Confirm delete</h2>
  <button type="button">Cancel</button>
  <button type="button">Delete</button>
</div>
```

```js
const openButton = document.getElementById('open');
const page = document.querySelector('.page');
const confirmOverlay = document.getElementById('confirm-overlay');

if (!openButton || !page || !confirmOverlay) {
  throw new Error('Missing #open, .page, or #confirm-overlay');
}

function openConfirmOverlay() {
  page.inert = true;
  confirmOverlay.hidden = false;
  confirmOverlay.focus();
}

function closeConfirmOverlay() {
  confirmOverlay.hidden = true;
  page.inert = false;
  openButton.focus();
}

openButton.addEventListener('click', openConfirmOverlay);
confirmOverlay.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeConfirmOverlay();
  }
});
```

- Keep the overlay outside the inert container — `inert` on an ancestor makes
  the dialog itself unreachable.
- Use the repo’s focus-trap helper or an established library for Tab cycling
  (portals, dynamic content, nested overlays); hand-roll a trap only when no
  helper exists and the task requires it.
