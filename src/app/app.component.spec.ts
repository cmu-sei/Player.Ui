// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import {
  ComnAuthQuery,
  ComnAuthService,
  ComnHeaderBarModule,
  ComnSettingsService,
} from '@cmusei/crucible-common';
import { AppComponent } from './app.component';
import { renderComponent } from './test-utils/render-component';

type Theme = 'light-theme' | 'dark-theme';

async function renderApp(providers: Provider[]) {
  return renderComponent(AppComponent, {
    declarations: [AppComponent],
    imports: [ComnHeaderBarModule],
    providers,
  });
}

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
        queryParamMap: of(
          convertToParamMap(queryTheme == null ? {} : { theme: queryTheme }),
        ),
        params: of({}),
        paramMap: of(convertToParamMap({})),
        queryParams: of({}),
        snapshot: {
          params: {},
          paramMap: convertToParamMap({}),
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

  /**
   * Verifies: document title is set from the AppTitle config value during init.
   * Interacts with: Title.setTitle spy, ComnSettingsService stub.
   * Data: setup() override with appTitle 'My Player'.
   */
  it('sets the document title from AppTitle setting', async () => {
    const ctx = setup({ appTitle: 'My Player' });
    await renderApp(ctx.providers);
    expect(ctx.setTitle).toHaveBeenCalledWith('My Player');
  });

  /**
   * Verifies: body gains the darkMode class when the user theme stream emits dark.
   * Interacts with: ComnAuthQuery.userTheme$ stub, document.body classList.
   * Data: setup() override with initialTheme 'dark-theme'.
   */
  it('applies darkMode body class when theme is dark', async () => {
    const ctx = setup({ initialTheme: 'dark-theme' });
    await renderApp(ctx.providers);
    expect(document.body.classList.contains('darkMode')).toBe(true);
  });

  /**
   * Verifies: body has no darkMode class when the theme stream emits light.
   * Interacts with: ComnAuthQuery.userTheme$ stub, document.body classList.
   * Data: setup() override with initialTheme 'light-theme'.
   */
  it('does not apply darkMode body class when theme is light', async () => {
    const ctx = setup({ initialTheme: 'light-theme' });
    await renderApp(ctx.providers);
    expect(document.body.classList.contains('darkMode')).toBe(false);
  });

  /**
   * Verifies: --mat-sys-primary and --mat-sys-on-primary body styles are written from top-bar color settings.
   * Interacts with: ComnSettingsService stub, document.body inline style.
   * Data: setup() overrides topBarColor '#AB1234' and topBarTextColor '#EEEEEE'.
   */
  it('writes primary color CSS variables from settings', async () => {
    const ctx = setup({
      topBarColor: '#AB1234',
      topBarTextColor: '#EEEEEE',
    });
    await renderApp(ctx.providers);
    expect(document.body.style.getPropertyValue('--mat-sys-primary')).toBe(
      '#AB1234',
    );
    expect(document.body.style.getPropertyValue('--mat-sys-on-primary')).toBe(
      '#EEEEEE',
    );
  });

  /**
   * Verifies: a valid theme query param is forwarded to ComnAuthService.setUserTheme.
   * Interacts with: ActivatedRoute.queryParamMap stub, ComnAuthService.setUserTheme spy.
   * Data: setup() override queryTheme 'dark-theme'.
   */
  it('calls setUserTheme when ?theme=dark-theme is in the query params', async () => {
    const ctx = setup({ queryTheme: 'dark-theme' });
    await renderApp(ctx.providers);
    expect(ctx.setUserTheme).toHaveBeenCalledWith('dark-theme');
  });

  /**
   * Verifies: an unrecognized theme query value falls back to 'light-theme'.
   * Interacts with: ActivatedRoute.queryParamMap stub, ComnAuthService.setUserTheme spy.
   * Data: setup() override queryTheme 'some-other-theme'.
   */
  it('coerces unknown theme query param to light', async () => {
    const ctx = setup({ queryTheme: 'some-other-theme' });
    await renderApp(ctx.providers);
    expect(ctx.setUserTheme).toHaveBeenCalledWith('light-theme');
  });

  /**
   * Verifies: theme subscription is torn down on destroy so later userTheme$ emits are ignored.
   * Interacts with: fixture.destroy(), ComnAuthQuery.userTheme$ subject, setUserTheme spy.
   * Data: default setup(); asserts call count is unchanged after a post-destroy emit.
   * Why: emits 'dark-theme' after destroy and compares against the pre-destroy call count
   *       to prove no leaked subscription, rather than asserting an absolute count.
   */
  it('cleans up subscriptions on destroy', async () => {
    const ctx = setup();
    const { fixture } = await renderApp(ctx.providers);
    fixture.destroy();
    const callsBefore = ctx.setUserTheme.mock.calls.length;
    ctx.userTheme$.next('dark-theme');
    expect(ctx.setUserTheme.mock.calls.length).toBe(callsBefore);
  });
});
