// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnvironmentProviders, Provider } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import {
  ComnAuthQuery,
  ComnAuthService,
  ComnHeaderBarModule,
  ComnSettingsService,
  CrucibleThemeService,
  provideCrucibleTheme,
} from '@cmusei/crucible-common';
import { AppComponent } from './app.component';
import { renderComponent } from './test-utils/render-component';
import { activatedRouteStub } from './test-utils/activated-route';

type Theme = 'light-theme' | 'dark-theme';

async function renderApp(providers: (Provider | EnvironmentProviders)[]) {
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
    colorSettings?: Record<string, string>;
  } = {},
) {
  const {
    initialTheme = 'light-theme',
    queryTheme = null,
    appTitle = 'Player',
    colorSettings = {},
  } = overrides;

  const userTheme$ = new BehaviorSubject<Theme>(initialTheme);
  const setUserTheme = vi.fn();
  const setTitle = vi.fn();
  const navigate = vi.fn();

  const providers: (Provider | EnvironmentProviders)[] = [
    provideHttpClient(),
    provideHttpClientTesting(),
    provideCrucibleTheme({ brand: { color: '#3B62A5', text: '#FFFFFF' } }),
    {
      provide: ComnAuthQuery,
      useValue: { userTheme$: userTheme$.asObservable() },
    },
    {
      provide: ComnAuthService,
      useValue: { setUserTheme } satisfies Pick<
        ComnAuthService,
        'setUserTheme'
      >,
    },
    {
      provide: ComnSettingsService,
      useValue: {
        settings: {
          AppTitle: appTitle,
          ...colorSettings,
        },
      },
    },
    {
      provide: Router,
      useValue: { navigate } satisfies Pick<Router, 'navigate'>,
    },
    {
      provide: Title,
      useValue: { setTitle } satisfies Pick<Title, 'setTitle'>,
    },
    {
      provide: ActivatedRoute,
      useValue: activatedRouteStub(
        queryTheme == null ? {} : { theme: queryTheme },
      ).route,
    },
  ];

  return { userTheme$, setUserTheme, setTitle, navigate, providers };
}

const THEME_PROPERTIES = [
  '--crucible-topbar-background',
  '--crucible-topbar-text',
  '--mat-sys-primary',
  '--mat-sys-on-primary',
];

const COLOR_SETTINGS = {
  AppTopBarHexColor: '#112233',
  AppTopBarHexTextColor: '#EEEEEE',
  AppLightModePrimaryHexColor: '#AB1234',
  AppLightModePrimaryHexTextColor: '#FFFFFF',
  AppDarkModePrimaryHexColor: '#CD5678',
  AppDarkModePrimaryHexTextColor: '#000000',
};

function bodyStyle(prop: string): string {
  return document.body.style.getPropertyValue(prop);
}

describe('AppComponent', () => {
  beforeEach(() => {
    document.body.classList.remove('darkMode');
    for (const el of [document.documentElement, document.body]) {
      for (const prop of THEME_PROPERTIES) {
        el.style.removeProperty(prop);
      }
    }
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
   * Verifies: each emitted user theme is handed to CrucibleThemeService.applyTheme.
   * Interacts with: ComnAuthQuery.userTheme$ subject, CrucibleThemeService spy.
   * Data: default setup(); emits 'dark-theme' after the initial 'light-theme'.
   */
  it('delegates theme changes to CrucibleThemeService', async () => {
    const applyTheme = vi.spyOn(CrucibleThemeService.prototype, 'applyTheme');
    const ctx = setup();
    await renderApp(ctx.providers);
    expect(applyTheme).toHaveBeenCalledWith('light-theme');
    ctx.userTheme$.next('dark-theme');
    expect(applyTheme).toHaveBeenLastCalledWith('dark-theme');
  });

  /**
   * Verifies: light mode paints the top bar from the AppTopBar* keys and primary
   *           from the AppLightModePrimary* keys, independently of each other.
   * Interacts with: real CrucibleThemeService, ComnSettingsService stub, document.body inline style.
   * Data: COLOR_SETTINGS with distinct top-bar and primary pairs.
   */
  it('writes separate top-bar and light primary colors from settings', async () => {
    const ctx = setup({ colorSettings: COLOR_SETTINGS });
    await renderApp(ctx.providers);
    expect(bodyStyle('--crucible-topbar-background')).toBe('#112233');
    expect(bodyStyle('--crucible-topbar-text')).toBe('#EEEEEE');
    expect(bodyStyle('--mat-sys-primary')).toBe('#AB1234');
    expect(bodyStyle('--mat-sys-on-primary')).toBe('#FFFFFF');
  });

  /**
   * Verifies: dark mode switches primary to the AppDarkModePrimary* keys while the
   *           top bar keeps its colors.
   * Interacts with: real CrucibleThemeService, ComnSettingsService stub, document.body inline style.
   * Data: COLOR_SETTINGS; initialTheme 'dark-theme'.
   */
  it('writes the dark primary and keeps the top bar in dark mode', async () => {
    const ctx = setup({
      initialTheme: 'dark-theme',
      colorSettings: COLOR_SETTINGS,
    });
    await renderApp(ctx.providers);
    expect(bodyStyle('--crucible-topbar-background')).toBe('#112233');
    expect(bodyStyle('--crucible-topbar-text')).toBe('#EEEEEE');
    expect(bodyStyle('--mat-sys-primary')).toBe('#CD5678');
    expect(bodyStyle('--mat-sys-on-primary')).toBe('#000000');
  });

  /**
   * Verifies: with no color settings, the top bar and primary fall back to Player's
   *           brand pair rather than an unrelated hard-coded color.
   * Interacts with: real CrucibleThemeService, ComnSettingsService stub.
   * Data: default setup() with no color keys.
   */
  it('falls back to the Player brand color when color settings are missing', async () => {
    const ctx = setup();
    await renderApp(ctx.providers);
    expect(bodyStyle('--crucible-topbar-background').toUpperCase()).toBe('#3B62A5');
    expect(bodyStyle('--crucible-topbar-text').toUpperCase()).toBe('#FFFFFF');
    expect(bodyStyle('--mat-sys-primary').toUpperCase()).toBe('#3B62A5');
    expect(bodyStyle('--mat-sys-on-primary').toUpperCase()).toBe('#FFFFFF');
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
