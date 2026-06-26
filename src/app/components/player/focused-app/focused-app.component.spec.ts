// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { ComnAuthQuery, Theme } from '@cmusei/crucible-common';
import { FocusedAppService } from '../../../services/focused-app/focused-app.service';
import { FocusedAppComponent } from './focused-app.component';
import { renderComponent } from '../../../test-utils/render-component';

// Angular's DomSanitizer returns an opaque object for bypass calls;
// to assert what the component emits, unwrap the known internal shape.
function unwrap(safe: unknown): string {
  const withChanged = safe as { changingThisBreaksApplicationSecurity?: string };
  return withChanged?.changingThisBreaksApplicationSecurity ?? String(safe);
}

async function renderFocused(
  overrides: { url?: string; theme?: Theme } = {},
) {
  const { url = 'about:blank', theme = 'light-theme' as Theme } = overrides;

  const focusedAppUrl = new BehaviorSubject<string>(url);
  const userTheme$ = new BehaviorSubject<Theme>(theme);

  const rendered = await renderComponent(FocusedAppComponent, {
    declarations: [FocusedAppComponent],
    providers: [
      { provide: FocusedAppService, useValue: { focusedAppUrl } },
      { provide: ComnAuthQuery, useValue: { userTheme$ } },
    ],
  });

  return { ...rendered, focusedAppUrl, userTheme$ };
}

describe('FocusedAppComponent', () => {
  /**
   * Verifies: FocusedAppComponent instantiates successfully.
   * Interacts with: renderFocused harness with FocusedAppService/ComnAuthQuery stubs.
   * Data: default renderFocused() (about:blank URL, light theme).
   */
  it('creates the component', async () => {
    const { fixture } = await renderFocused();
    expect(fixture.componentInstance).toBeTruthy();
  });

  /**
   * Verifies: focusedAppUrl$ emits the source URL unchanged when it carries no theme query param.
   * Interacts with: focusedAppUrl$ stream combining FocusedAppService.focusedAppUrl and userTheme$.
   * Data: renderFocused override url 'https://example.test/app'.
   * Why: unwraps the DomSanitizer-bypassed value via its internal changingThisBreaksApplicationSecurity field to assert the string.
   */
  it('emits the URL as-is when it has no ?theme= placeholder', async () => {
    const { fixture } = await renderFocused({
      url: 'https://example.test/app',
    });
    const emitted = await firstValueFrom(
      fixture.componentInstance.focusedAppUrl$,
    );
    expect(unwrap(emitted)).toBe('https://example.test/app');
  });

  /**
   * Verifies: an existing leading ?theme= value is rewritten to the current theme while preserving other params.
   * Interacts with: focusedAppUrl$ stream, userTheme$ subject.
   * Data: renderFocused override url with ?theme=light-theme&foo=1 and dark-theme.
   */
  it('replaces existing ?theme= query param with current theme', async () => {
    const { fixture } = await renderFocused({
      url: 'https://example.test/app?theme=light-theme&foo=1',
      theme: 'dark-theme' as Theme,
    });
    const emitted = await firstValueFrom(
      fixture.componentInstance.focusedAppUrl$,
    );
    expect(unwrap(emitted)).toBe(
      'https://example.test/app?theme=dark-theme&foo=1',
    );
  });

  /**
   * Verifies: a non-leading &theme= value is rewritten to the current theme while preserving earlier params.
   * Interacts with: focusedAppUrl$ stream, userTheme$ subject.
   * Data: renderFocused override url with ?foo=1&theme=light-theme and dark-theme.
   */
  it('replaces existing &theme= query param with current theme', async () => {
    const { fixture } = await renderFocused({
      url: 'https://example.test/app?foo=1&theme=light-theme',
      theme: 'dark-theme' as Theme,
    });
    const emitted = await firstValueFrom(
      fixture.componentInstance.focusedAppUrl$,
    );
    expect(unwrap(emitted)).toBe(
      'https://example.test/app?foo=1&theme=dark-theme',
    );
  });

  /**
   * Verifies: ngOnDestroy completes the private unsubscribe$ subject.
   * Interacts with: fixture.destroy(), spy on the component's unsubscribe$ complete method.
   * Data: default renderFocused().
   */
  it('completes unsubscribe$ on destroy', async () => {
    const { fixture } = await renderFocused();
    const complete = vi.spyOn(
      fixture.componentInstance['unsubscribe$'] as { complete: () => void },
      'complete',
    );
    fixture.destroy();
    expect(complete).toHaveBeenCalled();
  });
});
