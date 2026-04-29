// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { DomSanitizer } from '@angular/platform-browser';
import {
  ComnAuthQuery,
  ComnAuthService,
  Theme,
} from '@cmusei/crucible-common';
import { ApplicationData } from '../../../models/application-data';
import { TeamData } from '../../../models/team-data';
import { ApplicationsService } from '../../../services/applications/applications.service';
import { FocusedAppService } from '../../../services/focused-app/focused-app.service';
import { ApplicationListComponent } from './application-list.component';
import { renderComponent } from '../../../test-utils/render-component';

const teams: TeamData[] = [
  { id: 'team-a', name: 'Primary', isPrimary: true } as TeamData,
  { id: 'team-b', name: 'Secondary', isPrimary: false } as TeamData,
];

function makeApp(id: string, url: string): ApplicationData {
  return { id, name: `app-${id}`, url, embeddable: true } as ApplicationData;
}

async function renderList(
  overrides: {
    apps?: ApplicationData[];
    theme?: Theme;
    teams?: TeamData[];
    isAuthenticated?: boolean;
  } = {},
) {
  const {
    apps = [makeApp('a1', 'https://a.test/app')],
    theme = 'light-theme' as Theme,
    teams: t = teams,
    isAuthenticated = true,
  } = overrides;

  const getApplicationsByTeam = vi.fn(() => of(apps));
  const isAuth = vi.fn(() => Promise.resolve(isAuthenticated));
  const focusedAppUrl = new BehaviorSubject<string>('about:blank');

  const rendered = await renderComponent(ApplicationListComponent, {
    declarations: [ApplicationListComponent],
    schemas: [NO_ERRORS_SCHEMA],
    componentProperties: { viewId: 'v1', teams: t, mini: false },
    providers: [
      {
        provide: ApplicationsService,
        useValue: { getApplicationsByTeam },
      },
      {
        provide: FocusedAppService,
        useValue: { focusedAppUrl },
      },
      {
        provide: ComnAuthService,
        useValue: { isAuthenticated: isAuth },
      },
      {
        provide: ComnAuthQuery,
        useValue: { userTheme$: of(theme) },
      },
      {
        provide: DomSanitizer,
        useValue: {
          bypassSecurityTrustResourceUrl: (u: string) => `safe(${u})`,
        },
      },
    ],
  });

  return {
    ...rendered,
    getApplicationsByTeam,
    isAuth,
    focusedAppUrl,
  };
}

describe('ApplicationListComponent', () => {
  it('creates the component', async () => {
    const { fixture } = await renderList();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('requests applications for the primary team', async () => {
    const { getApplicationsByTeam } = await renderList();
    expect(getApplicationsByTeam).toHaveBeenCalledWith('team-a');
  });

  it('applies theme query string and safe URL to each app', async () => {
    const { fixture } = await renderList({
      apps: [makeApp('a1', 'https://a.test/app?other=1&{theme}')],
      theme: 'dark-theme' as Theme,
    });
    const apps = await firstValueFrom(fixture.componentInstance.applications$);
    expect(apps[0].themedUrl).toBe(
      'https://a.test/app?other=1&theme=dark-theme',
    );
    expect(apps[0].safeUrl as unknown as string).toBe(
      'safe(https://a.test/app?other=1&theme=dark-theme)',
    );
  });

  it('insertThemeToUrl appends ?theme when no existing query and {theme} placeholder present', async () => {
    const { fixture } = await renderList();
    const url = fixture.componentInstance.insertThemeToUrl(
      'https://a.test/app{theme}',
      'dark-theme' as Theme,
    );
    expect(url).toBe('https://a.test/app?theme=dark-theme');
  });

  it('insertThemeToUrl leaves URLs without placeholder untouched', async () => {
    const { fixture } = await renderList();
    expect(
      fixture.componentInstance.insertThemeToUrl(
        'https://a.test',
        'light-theme' as Theme,
      ),
    ).toBe('https://a.test');
  });

  it('openApplication intercepts non-ctrl clicks on embeddable apps', async () => {
    const { fixture, focusedAppUrl } = await renderList();
    // Let the stream run so currentApp gets seeded.
    await firstValueFrom(fixture.componentInstance.applications$);
    const event = {
      ctrlKey: false,
      preventDefault: vi.fn(),
    } as unknown as MouseEvent;
    const app = makeApp('a2', 'https://a2.test/app');
    app.themedUrl = 'https://a2.test/app';
    fixture.componentInstance.openApplication(app, event);
    expect(event.preventDefault).toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 0));
    expect(focusedAppUrl.value).toBe('https://a2.test/app');
  });

  it('openApplication respects ctrl-click (does not intercept)', async () => {
    const { fixture } = await renderList();
    const event = {
      ctrlKey: true,
      preventDefault: vi.fn(),
    } as unknown as MouseEvent;
    const app = makeApp('a2', 'https://a2.test/app');
    fixture.componentInstance.openApplication(app, event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('openInFocusedApp does not push to focusedAppUrl when not authenticated', async () => {
    const { fixture, focusedAppUrl, isAuth } = await renderList({
      isAuthenticated: false,
    });
    // Consume the initial stream so currentApp is seeded by the init push.
    await firstValueFrom(fixture.componentInstance.applications$);
    const before = focusedAppUrl.value;
    isAuth.mockClear();
    const app = makeApp('a2', 'https://a2.test');
    app.themedUrl = 'https://a2.test';
    fixture.componentInstance.openInFocusedApp(app);
    await new Promise((r) => setTimeout(r, 0));
    expect(isAuth).toHaveBeenCalled();
    // The auth-false branch reloads the window instead of pushing;
    // window.location.reload isn't observable in jsdom, so assert the
    // app URL wasn't published to the focused app channel.
    expect(focusedAppUrl.value).toBe(before);
  });

  it('trackByFn returns the item id', async () => {
    const { fixture } = await renderList();
    expect(
      fixture.componentInstance.trackByFn(0, { id: 'foo' }),
    ).toBe('foo');
  });

  it('ngOnChanges refreshes apps when teams input changes', async () => {
    const { fixture, getApplicationsByTeam } = await renderList();
    getApplicationsByTeam.mockClear();
    fixture.componentInstance.ngOnChanges({
      teams: { currentValue: teams, previousValue: [], firstChange: false, isFirstChange: () => false },
    });
    expect(getApplicationsByTeam).toHaveBeenCalled();
  });
});
