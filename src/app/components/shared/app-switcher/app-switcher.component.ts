// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';

/** One of the sibling apps. One without a URL isn't listed. */
export interface SwitcherApp {
  id: string;
  name: string;
  url?: string | null;
}

/**
 * A grid button in front of the product's name that opens a menu of the sibling apps. Each opens in a new window.
 * Hidden when there are no others, so an app with nothing configured shows no control.
 */
@Component({
  selector: 'app-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatIconButton,
    MatIcon,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatTooltip,
  ],
  template: `
    @if (others().length) {
      <button
        matIconButton
        class="dots"
        [attr.aria-label]="label()"
        [matTooltip]="label()"
        [matMenuTriggerFor]="menu"
      >
        <mat-icon aria-hidden="true" fontIcon="mdi-dots-grid" />
      </button>
      <mat-menu #menu="matMenu" class="app-switcher-menu">
        <div class="app-switcher-title">{{ label() }}</div>
        @for (app of others(); track app.id) {
          <a mat-menu-item [href]="app.url!" target="_blank" rel="noopener">
            <span class="app-switcher-badge" aria-hidden="true">{{
              initial(app)
            }}</span>
            <span>{{ app.name }}</span>
          </a>
        }
      </mat-menu>
    }
  `,
  styleUrl: './app-switcher.component.scss',
})
export class AppSwitcherComponent {
  /** Every app, this one included, in the order to list them. */
  readonly apps = input<SwitcherApp[]>([]);
  /** This app's id, which the list leaves out. */
  readonly self = input.required<string>();
  /** The menu's title and the button's name, e.g. "Crucible apps". */
  readonly label = input('Apps');

  protected readonly others = computed(() =>
    this.apps().filter((a) => a.id !== this.self() && !!a.url),
  );

  protected initial(app: SwitcherApp): string {
    return app.name.trim()[0] ?? '?';
  }
}
