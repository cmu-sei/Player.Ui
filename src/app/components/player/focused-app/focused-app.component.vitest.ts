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
  it('creates the component', async () => {
    const { fixture } = await renderFocused();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('emits the URL as-is when it has no ?theme= placeholder', async () => {
    const { fixture } = await renderFocused({
      url: 'https://example.test/app',
    });
    const emitted = await firstValueFrom(
      fixture.componentInstance.focusedAppUrl$,
    );
    expect(unwrap(emitted)).toBe('https://example.test/app');
  });

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
