// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';

/** One of the sibling apps. One without a URL isn't listed. */
export interface SwitcherApp {
  id: string;
  name: string;
  url?: string | null;
}

/**
 * A small grid in front of the product's name that opens the sibling apps, on hover or click. Each opens in a new
 * window. Hidden when there are no others, so an app with nothing configured shows no control.
 */
@Component({
  selector: 'app-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(mouseenter)': 'show()',
    '(mouseleave)': 'hideSoon()',
    '(focusout)': 'blurred($event)',
    '(keydown.escape)': 'escape()',
    '(document:click)': 'outside($event)',
  },
  template: ` @if (others().length) {
    <button
      type="button"
      class="dots"
      [attr.aria-label]="label()"
      [title]="label()"
      aria-haspopup="true"
      [attr.aria-expanded]="open()"
      (click)="toggle()"
    >
      <svg viewBox="0 0 12 12" aria-hidden="true">
        @for (y of grid; track y) {
          @for (x of grid; track x) {
            <circle [attr.cx]="x" [attr.cy]="y" r="1.1" />
          }
        }
      </svg>
    </button>
    @if (open()) {
      <nav class="menu" [attr.aria-label]="label()">
        <div class="title">{{ label() }}</div>
        @for (app of others(); track app.id) {
          <a class="row" [href]="app.url!" target="_blank" rel="noopener">
            <span class="badge" aria-hidden="true">{{ initial(app) }}</span>
            <span class="name">{{ app.name }}</span>
          </a>
        }
      </nav>
    }
  }`,
  styles: [
    `
      :host {
        position: relative;
        display: flex;
        align-items: center;
      }
      :host(:empty) {
        display: none;
      }
      .dots {
        display: grid;
        place-items: center;
        width: 22px;
        height: 22px;
        padding: 0;
        margin-left: -4px;
        border: 0;
        border-radius: 6px;
        background: none;
        color: var(--pl-faint);
        cursor: pointer;
        transition:
          color 120ms,
          background 120ms;
      }
      .dots:hover,
      .dots[aria-expanded='true'] {
        color: var(--pl-accent);
        background: var(--pl-accent-soft);
      }
      .dots:focus-visible {
        outline: 2px solid var(--pl-accent);
        outline-offset: 1px;
      }
      .dots svg {
        width: 12px;
        height: 12px;
        fill: currentColor;
      }
      .menu {
        position: absolute;
        top: calc(100% + 6px);
        left: -4px;
        z-index: 50;
        min-width: 220px;
        padding: 6px;
        background: var(--pl-surface);
        border: 1px solid var(--pl-line);
        border-radius: var(--pl-radius);
        box-shadow: 0 12px 32px -12px rgb(var(--pl-shadow) / 0.45);
      }
      /* The gap above is part of the hover target, so moving down to the menu doesn't close it. */
      .menu::before {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        top: -8px;
        height: 8px;
      }
      .title {
        padding: 4px 8px 6px;
        font-size: var(--pl-small);
        color: var(--pl-muted);
      }
      .row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 8px;
        border-radius: 6px;
        color: var(--pl-ink);
        text-decoration: none;
      }
      .row:hover,
      .row:focus-visible {
        background: var(--pl-accent-soft);
        outline: none;
      }
      .badge {
        display: grid;
        place-items: center;
        flex: none;
        width: 22px;
        height: 22px;
        border-radius: 6px;
        background: var(--pl-canvas);
        border: 1px solid var(--pl-line);
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
      }
      .name {
        font-weight: 500;
        white-space: nowrap;
      }
    `,
  ],
})
export class AppSwitcherComponent implements OnDestroy {
  /** Every app, this one included, in the order to list them. */
  readonly apps = input<SwitcherApp[]>([]);
  /** This app's id, which the list leaves out. */
  readonly self = input.required<string>();
  /** The menu's title and the button's name, e.g. "Crucible apps". */
  readonly label = input('Apps');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private timer?: ReturnType<typeof setTimeout>;

  protected readonly grid = [2, 6, 10];
  protected readonly open = signal(false);
  /** Opened by a click, so it stays open when the pointer leaves, until a click outside, Escape or the focus leaving. */
  private pinned = false;
  protected readonly others = computed(() =>
    this.apps().filter((a) => a.id !== this.self() && !!a.url),
  );

  protected initial(app: SwitcherApp): string {
    return app.name.trim()[0] ?? '?';
  }

  protected show(): void {
    clearTimeout(this.timer);
    this.open.set(true);
  }

  protected hideSoon(): void {
    clearTimeout(this.timer);
    if (!this.pinned) this.timer = setTimeout(() => this.open.set(false), 200);
  }

  protected toggle(): void {
    clearTimeout(this.timer);
    this.pinned = !this.pinned;
    this.open.set(this.pinned);
  }

  protected outside(event: MouseEvent): void {
    if (
      this.open() &&
      !this.host.nativeElement.contains(event.target as Node | null)
    )
      this.close();
  }

  protected blurred(event: FocusEvent): void {
    if (
      event.relatedTarget &&
      !this.host.nativeElement.contains(event.relatedTarget as Node)
    )
      this.close();
  }

  protected escape(): void {
    if (!this.open()) return;
    this.close();
    this.host.nativeElement
      .querySelector<HTMLButtonElement>('button.dots')
      ?.focus();
  }

  private close(): void {
    clearTimeout(this.timer);
    this.pinned = false;
    this.open.set(false);
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }
}
