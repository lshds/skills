# ARIA

Prefer native HTML over ARIA when a native control fits. Wrong ARIA misleads
assistive tech — skip the attribute rather than guess.

## Naming

Prefer visible text, `<label>`, or `aria-labelledby`. Use `aria-label` only when
there is no visible name. Use `aria-describedby` for supplement, not as the name.

```html
<!-- ❌ Incorrect: aria-label on a div with no role; icon button unnamed -->
<div aria-label="Delete item">
  <svg>…</svg>
</div>
<button type="button"><svg>…</svg></button>

<!-- ✅ Correct: name a real control; hide decorative graphics -->
<button type="button" aria-label="Delete item">
  <svg aria-hidden="true">…</svg>
</button>

<section aria-labelledby="orders-heading">
  <h2 id="orders-heading">Recent orders</h2>
</section>
```

- Don’t use `aria-label` to override visible text with a different string.

## Disclosure

Toggle with a real `<button>`, `aria-expanded`, and `aria-controls`. Hide
collapsed content so it leaves the a11y tree.

```html
<!-- ❌ Incorrect: clickable heading, no expanded/controls, panel always in tree -->
<h3 onclick="toggle()">Shipping details</h3>
<div id="panel-1">…</div>

<!-- ✅ Correct: button + expanded + controls + hidden when collapsed -->
<button type="button" aria-expanded="false" aria-controls="panel-1">
  Shipping details
</button>
<div id="panel-1" hidden>…</div>
```

## Tabs

Use `tablist` / `tab` / `tabpanel` with `aria-selected` and `aria-labelledby`.
Only the selected tab is in the tab order; arrows move between tabs.

```html
<!-- ❌ Incorrect: tabs as plain buttons with no roles or keyboard map -->
<div>
  <button type="button">Overview</button>
  <button type="button">Activity</button>
</div>
<div>Overview panel</div>

<!-- ✅ Correct: tablist/tab/tabpanel; selected tab tabindex 0, others -1 -->
<div role="tablist" aria-label="Account">
  <button type="button" role="tab" aria-selected="true" aria-controls="panel-overview" id="tab-overview" tabindex="0">
    Overview
  </button>
  <button type="button" role="tab" aria-selected="false" aria-controls="panel-activity" id="tab-activity" tabindex="-1">
    Activity
  </button>
</div>
<div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview">Overview panel</div>
<div role="tabpanel" id="panel-activity" aria-labelledby="tab-activity" hidden>Activity panel</div>
```

- Keyboard: Left/Right (or Up/Down if vertical); Home/End to ends.

## Listbox

Open from a button (`aria-expanded`, `aria-haspopup`, `aria-controls`). Arrow
keys move; Enter/Space activate; Escape closes and returns focus to the opener.
Prefer native `<select>` for a simple single choice.

```html
<!-- ❌ Incorrect: mouse-only custom list with no listbox/option roles -->
<button type="button">Choose plan</button>
<ul>
  <li onclick="pick('pro')">Pro</li>
</ul>

<!-- ✅ Correct: opener + listbox/option (or use native select) -->
<button
  type="button"
  aria-expanded="true"
  aria-haspopup="listbox"
  aria-controls="plan-list"
>
  Choose plan
</button>
<ul id="plan-list" role="listbox" aria-label="Plan">
  <li role="option" aria-selected="true">Pro</li>
  <li role="option" aria-selected="false">Team</li>
</ul>
```

## Menu

Use `menu` / `menuitem` for a set of actions (rename, delete) — not for picking
one value (that’s listbox / `<select>`) and not for site nav (that’s `<nav>`).
Open from a button (`aria-expanded`, `aria-haspopup="menu"`, `aria-controls`).
Arrows move; Enter/Space activate; Escape closes and returns focus to the opener.

```html
<!-- ❌ Incorrect: mouse-only action list with no menu semantics -->
<button type="button">More</button>
<ul>
  <li onclick="rename()">Rename</li>
  <li onclick="remove()">Delete</li>
</ul>

<!-- ✅ Correct: opener + menu of actions -->
<button
  type="button"
  aria-expanded="true"
  aria-haspopup="menu"
  aria-controls="more-menu"
>
  More
</button>
<div id="more-menu" role="menu" aria-label="More">
  <button type="button" role="menuitem">Rename</button>
  <button type="button" role="menuitem">Delete</button>
</div>
```

## Live regions

Announce dynamic status without stealing focus. Default polite/`role="status"`;
use assertive/`role="alert"` only for urgent errors.

```html
<!-- ❌ Incorrect: status text with no live region — AT may miss updates -->
<div class="toast">Saved</div>

<!-- ✅ Correct: polite status; assertive only for urgent errors -->
<div role="status" aria-live="polite" aria-atomic="true">Saved</div>
<div role="alert">Payment failed — check your card</div>
```

## Common traps

Avoid redundant roles, hidden focusable nodes, and name mismatches.

```html
<!-- ❌ Incorrect: redundant role; aria-hidden on focusable; fake button -->
<button type="button" role="button">Save</button>
<button type="button" aria-hidden="true">Open</button>
<div role="button" onclick="save()">Save</div>

<!-- ✅ Correct: native control; never hide focusable; real button -->
<button type="button">Save</button>
<button type="button">Open</button>
<button type="button" onclick="save()">Save</button>
```

- `aria-label` must agree with visible text when both exist.
- Custom composites need arrow keys plus Enter/Space — not mouse-only selection.
