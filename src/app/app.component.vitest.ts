// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import {
  ComnAuthQuery,
  ComnAuthService,
  ComnSettingsService,
} from '@cmusei/crucible-common';
import { AppComponent } from './app.component';
import { renderComponent } from './test-utils/render-component';

type Theme = 'light-theme' | 'dark-theme';

function setup(
  overrides: {
    initialTheme?: Theme;
    queryTheme?: string | null;
    appTitle?: string;
    topBarColor?: string;
    topBarTextColor?: string;
  } = {},
) {
  const {
    initialTheme = 'light-theme',
    queryTheme = null,
    appTitle = 'Player',
    topBarColor = '#0F1D47',
    topBarTextColor = '#FFFFFF',
  } = overrides;

  const userTheme$ = new BehaviorSubject<Theme>(initialTheme);
  const setUserTheme = vi.fn();
  const setTitle = vi.fn();
  const navigate = vi.fn();

  const providers = [
    {
      provide: ComnAuthQuery,
      useValue: { userTheme$: userTheme$.asObservable() },
    },
    {
      provide: ComnAuthService,
      useValue: { setUserTheme },
    },
    {
      provide: ComnSettingsService,
      useValue: {
        settings: {
          AppTitle: appTitle,
          AppTopBarHexColor: topBarColor,
          AppTopBarHexTextColor: topBarTextColor,
        },
      },
    },
    { provide: Router, useValue: { navigate } },
    { provide: Title, useValue: { setTitle } },
    {
      provide: ActivatedRoute,
      useValue: {
        queryParamMap: of({
          get: (key: string) => (key === 'theme' ? queryTheme : null),
          has: (key: string) => key === 'theme' && queryTheme != null,
        }),
        params: of({}),
        paramMap: of({ get: () => null, has: () => false }),
        queryParams: of({}),
        snapshot: {
          params: {},
          paramMap: { get: () => null, has: () => false },
        },
      },
    },
  ];

  return { userTheme$, setUserTheme, setTitle, navigate, providers };
}

describe('AppComponent', () => {
  beforeEach(() => {
    document.body.classList.remove('darkMode');
    document.body.style.removeProperty('--mat-sys-primary');
    document.body.style.removeProperty('--mat-sys-on-primary');
  });

  it('creates the component', async () => {
    const { providers } = setup();
    const { fixture } = await renderComponent(AppComponent, {
      declarations: [AppComponent],
      providers,
    });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('sets the document title from AppTitle setting', async () => {
    const ctx = setup({ appTitle: 'My Player' });
    await renderComponent(AppComponent, {
      declarations: [AppComponent],
      providers: ctx.providers,
    });
    expect(ctx.setTitle).toHaveBeenCalledWith('My Player');
  });

  it('applies darkMode body class when theme is dark', async () => {
    const ctx = setup({ initialTheme: 'dark-theme' });
    await renderComponent(AppComponent, {
      declarations: [AppComponent],
      providers: ctx.providers,
    });
    expect(document.body.classList.contains('darkMode')).toBe(true);
  });

  it('does not apply darkMode body class when theme is light', async () => {
    const ctx = setup({ initialTheme: 'light-theme' });
    await renderComponent(AppComponent, {
      declarations: [AppComponent],
      providers: ctx.providers,
    });
    expect(document.body.classList.contains('darkMode')).toBe(false);
  });

  it('writes primary color CSS variables from settings', async () => {
    const ctx = setup({
      topBarColor: '#AB1234',
      topBarTextColor: '#EEEEEE',
    });
    await renderComponent(AppComponent, {
      declarations: [AppComponent],
      providers: ctx.providers,
    });
    expect(document.body.style.getPropertyValue('--mat-sys-primary')).toBe(
      '#AB1234',
    );
    expect(document.body.style.getPropertyValue('--mat-sys-on-primary')).toBe(
      '#EEEEEE',
    );
  });

  it('calls setUserTheme when ?theme=dark-theme is in the query params', async () => {
    const ctx = setup({ queryTheme: 'dark-theme' });
    await renderComponent(AppComponent, {
      declarations: [AppComponent],
      providers: ctx.providers,
    });
    expect(ctx.setUserTheme).toHaveBeenCalledWith('dark-theme');
  });

  it('coerces unknown theme query param to light', async () => {
    const ctx = setup({ queryTheme: 'some-other-theme' });
    await renderComponent(AppComponent, {
      declarations: [AppComponent],
      providers: ctx.providers,
    });
    expect(ctx.setUserTheme).toHaveBeenCalledWith('light-theme');
  });

  it('cleans up subscriptions on destroy', async () => {
    const ctx = setup();
    const { fixture } = await renderComponent(AppComponent, {
      declarations: [AppComponent],
      providers: ctx.providers,
    });
    fixture.destroy();
    const callsBefore = ctx.setUserTheme.mock.calls.length;
    ctx.userTheme$.next('dark-theme');
    expect(ctx.setUserTheme.mock.calls.length).toBe(callsBefore);
  });
});
