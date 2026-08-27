---
name: accessibility-patterns
description: >-
  Accessibility guidelines for interactive UI. This skill should be used when
  writing, reviewing, or refactoring accessible UI to ensure keyboard, focus,
  ARIA, and screen-reader support. Prefer native HTML semantics over custom
  ARIA. Triggers on tasks involving a11y, accessibility, ARIA, keyboard, screen
  reader, focus trap, dialog, modal, tabs, menu, listbox, disclosure,
  aria-live, form errors, alt text, landmarks, headings, or skip links.
---

# Accessibility Skills

Practical a11y for forms depth, dialogs and focus, and ARIA naming and widgets.
Prefer native HTML semantics over custom roles.

**Domain:** interactive web UI accessibility — keyboard, focus, names, ARIA,
and screen-reader behavior in HTML.
**Owns:** native semantics vs ARIA; keyboard and tab order; focus in overlays;
form required/invalid association and form-level announcements; ARIA widgets
(disclosure, tabs, menu, listbox); live regions; page names (labels, alt,
headings, landmarks, skip links).
**Does not own:** stack-agnostic loading / empty / error copy or submit-guard
timing; tokens, reduced-motion, or focus-ring styling; React Native
`accessibility*` props; TypeScript language rules; or framework form-control
wiring.

## When to activate

- Naming pages and controls (labels, alt, headings, landmarks, skip links)
- Building or reviewing forms for required state, linked errors, or submit announcements
- Creating or fixing dialogs and overlays (focus in, trap, Escape, restore)
- Implementing widgets that need ARIA (disclosure, tabs, menu, listbox)
- Adding or correcting `aria-*` names, states, or live regions
- Implementing keyboard navigation for composites or custom controls
- Addressing a11y lint, audit, or code-review feedback

## Core Concepts

### Write vs review

- Pick one mode from the user ask — don’t mix output shapes
- **Write** (implement, fix, refactor): apply these defaults in the UI; no review report unless asked
- **Review**: named scope only; report concrete misses in this skill’s domain (keyboard, focus, names, ARIA widgets, form error association, live regions)
- Skip findings outside that domain

### Native first

Prefer native semantics. Add ARIA only when no native element fits — and then
use the correct role, state, and name. Incomplete or wrong ARIA misleads
assistive tech; skip the attribute rather than guess.

### Keyboard

Every interactive control is reachable and operable by keyboard alone. Keep DOM
order as the tab order — never `tabIndex` greater than `0`. Activate with
Enter/Space; Escape closes overlays. Arrow keys move within composites
(listbox, menu, tabs).

### Page names

Visible label, heading, or text is the name. Wire `<label for>`, `alt`,
landmarks, and a skip link so AT and keyboard users can find content without
ARIA. See [page-semantics.md](references/page-semantics.md).

### Focus management

On open: save the trigger and move focus into the dialog. While open: Tab cycles
inside only; Escape closes; background stays inert / non-operable. On close:
restore focus to the trigger. Prefer native `<dialog>.showModal()`, the repo’s
dialog primitive, or an established focus-trap helper over a hand-rolled trap.
See [dialogs.md](references/dialogs.md).

### Forms depth

Required state, error association (`aria-invalid` / `aria-describedby` / alert),
fieldset groups, autocomplete, and submit live feedback — beyond a visible label
alone. See [forms-a11y.md](references/forms-a11y.md).

### Naming and live regions

Prefer visible text, `<label>`, or `aria-labelledby` over `aria-label`. Use
`aria-describedby` for hints, warnings, and errors. Icon-only controls need an
accessible name; hide decorative icons with `aria-hidden`. Announce dynamic
status without stealing focus — polite / `role="status"` by default; assertive /
`role="alert"` only for urgent errors.
See [aria.md](references/aria.md).

### Common mistakes

| ❌ Incorrect | ✅ Correct |
| --- | --- |
| Redundant ARIA on a native control (`role="button"` on `<button>`, `aria-required` with `required`) | Native semantics only; ARIA only to fill a gap |
| Icon-only control with no name | `aria-label` (or visible text) on a real `<button>` |
| Untitled `div` overlay as a modal | Native `<dialog>` (or repo primitive) with a visible title |
| Orphaned error text next to a field | `aria-invalid` + `aria-describedby`; one form-level `role="alert"` |
| `tabIndex` greater than `0` | DOM order, or `0` / `-1` for roving tabindex |

## Practice areas

Read the reference for the task — don’t load every file.

| Area | Reference |
| --- | --- |
| Labels / alt / headings / landmarks | [page-semantics.md](references/page-semantics.md) |
| Forms a11y | [forms-a11y.md](references/forms-a11y.md) |
| Dialogs | [dialogs.md](references/dialogs.md) |
| ARIA | [aria.md](references/aria.md) |
