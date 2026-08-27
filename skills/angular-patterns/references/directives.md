# Directives

Prefer attribute directives with signal inputs and the `host` object. Compose
behaviors with `hostDirectives`. Don’t invent structural directives for
conditionals or loops.

## Attribute directives

Use a camelCase attribute selector, signal inputs, and `host` — not
`@HostBinding` or kebab selectors.

```typescript
// ❌ Incorrect: HostBinding decorators + kebab attribute selector
@Directive({ selector: '[app-highlight]' })
export class Highlight {
  @Input('app-highlight') color = 'yellow'
  @HostBinding('style.backgroundColor') bg = this.color
}

// ✅ Correct: camelCase selector + readonly signal input + host
@Directive({
  selector: '[appHighlight]',
  host: {
    '[style.backgroundColor]': 'highlightColor()',
  },
})
export class Highlight {
  readonly highlightColor = input('yellow', { alias: 'appHighlight' })
}
```

## Document listeners

Wire document/window listeners through `host` and emit domain outputs.

```typescript
// ❌ Incorrect: manual document.addEventListener in the directive
@Directive({ selector: '[appClickOutside]' })
export class ClickOutside implements OnInit, OnDestroy {
  ngOnInit() {
    document.addEventListener('click', this.onDocumentClick)
  }
  ngOnDestroy() {
    document.removeEventListener('click', this.onDocumentClick)
  }
}

// ✅ Correct: host listener + output
@Directive({
  selector: '[appClickOutside]',
  host: {
    '(document:click)': 'emitIfOutside($event)',
  },
})
export class ClickOutside {
  private readonly hostElement = inject(ElementRef<HTMLElement>)
  readonly clickedOutside = output<void>()

  emitIfOutside(mouseEvent: MouseEvent) {
    const clickTarget = mouseEvent.target

    if (!(clickTarget instanceof Node)) {
      return
    }

    if (this.hostElement.nativeElement.contains(clickTarget)) {
      return
    }

    this.clickedOutside.emit()
  }
}
```

## Host directives

Compose reusable behaviors onto components instead of duplicating host bindings.

```typescript
// ❌ Incorrect: copy the same host class bindings into every chip
@Component({
  selector: 'app-chip',
  host: {
    '[class.disabled]': 'disabled()',
    '[class.hovered]': 'isHovered()',
  },
  template: `<ng-content />`,
})
export class AppChip {
  readonly disabled = input(false, { transform: booleanAttribute })
  readonly isHovered = signal(false)
}

// ✅ Correct: hostDirectives with exposed inputs/outputs
@Directive({
  selector: '[disableable]',
  host: {
    '[class.disabled]': 'isDisabled()',
  },
})
export class Disableable {
  readonly isDisabled = input(false, {
    alias: 'disabled',
    transform: booleanAttribute,
  })
}

@Component({
  selector: 'app-chip',
  hostDirectives: [
    { directive: Disableable, inputs: ['disabled'] },
    { directive: Hoverable, outputs: ['hoverChange'] },
  ],
  template: `<ng-content />`,
})
export class AppChip {
  private readonly disableable = inject(Disableable)
  readonly chipActivated = output<void>()

  activateChip() {
    if (this.disableable.isDisabled()) {
      return
    }

    this.chipActivated.emit()
  }
}
```

- Expose host-directive `inputs` / `outputs` when the parent needs them.

## Structural directives

Reserve custom structural directives for portals, overlays, or one-shot lazy
insertion. Do not reimplement show/hide or loops — use built-in `@if` / `@for` /
`@switch` in the template instead.

```html
<!-- ❌ Incorrect: custom *appIf instead of built-in control flow -->
<div *appIf="isVisible()">Row</div>

<!-- ✅ Correct: built-in control flow for show/hide and loops -->
@if (isVisible()) {
  <div>Row</div>
}
@for (item of items(); track item.id) {
  <app-row [item]="item" />
}
```

```typescript
// ❌ Incorrect: custom structural *appIf for show/hide
@Directive({ selector: '[appIf]' })
export class AppIf {
  readonly appIf = input(false)
}

// ✅ Correct: custom structural only for portals / overlays
@Directive({ selector: '[appPortal]' })
export class AppPortal {
  readonly overlayHost = input.required<HTMLElement>()
}
```
