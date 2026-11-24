// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ComnSettingsService } from '@cmusei/crucible-common';

/**
 * The footer under every page, made small: the product at the left, the
 * repository and the framework it belongs to at the right.
 */
@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="footer">
      <span class="notice">{{ productName }}.</span>
      <span class="notice">
        <a
          class="repo"
          href="https://github.com/cmu-sei/crucible"
          target="_blank"
          rel="noopener"
          aria-label="Crucible on GitHub"
          title="Crucible on GitHub"
          ><svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              fill="currentColor"
              d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
            /></svg
        ></a>
        Part of the Crucible Framework.
      </span>
    </footer>
  `,
  styles: [
    `
      :host {
        display: block;
        flex: none;
      }

      .footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        height: 24px;
        padding: 0 16px;
        border-top: 1px solid var(--pl-line);
        background: var(--pl-surface);
        font-size: 11px;
        color: var(--pl-faint);
      }

      .repo {
        display: inline-flex;
        vertical-align: -2px;
        margin-right: 4px;
        color: inherit;
      }

      .repo:hover {
        color: var(--pl-ink);
      }

      .repo svg {
        width: 12px;
        height: 12px;
      }

      .notice {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `,
  ],
})
export class FooterComponent {
  protected readonly productName: string =
    (inject(ComnSettingsService).settings as { AppTopBarText?: string })
      .AppTopBarText || 'Player';
}
