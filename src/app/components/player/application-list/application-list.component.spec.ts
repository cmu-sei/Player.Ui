// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import userEvent from '@testing-library/user-event';
import { ComnAuthQuery, ComnAuthService, Theme } from '@cmusei/crucible-common';
import { ApplicationData } from '../../../models/application-data';
import { TeamData } from '../../../models/team-data';
import { ApplicationsService } from '../../../services/applications/applications.service';
import { FocusedAppService } from '../../../services/focused-app/focused-app.service';
import { XApiService } from '../../../services/xapi/xapi.service';
import { ApplicationListComponent } from './application-list.component';
import { renderComponent } from '../../../test-utils/render-component';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';

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

  const getApplicationsByTeam = vi.fn(() => of(structuredClone(apps)));
  const isAuth = vi.fn(() => Promise.resolve(isAuthenticated));
  const xapi = {
    applicationSwitched: vi.fn(() => of(null)),
  } satisfies Pick<XApiService, 'applicationSwitched'>;

  const rendered = await renderComponent(ApplicationListComponent, {
    imports: [MatListModule, MatButtonModule],
    declarations: [ApplicationListComponent],
    componentProperties: { viewId: 'v1', teams: t, mini: false },
    providers: [
      {
        provide: ApplicationsService,
        // ApplicationsService holds no state and builds its own HttpClient
        // request, so it is stubbed at its own boundary.
        useValue: { getApplicationsByTeam } satisfies Pick<
          ApplicationsService,
          'getApplicationsByTeam'
        >,
      },
      {
        provide: ComnAuthService,
        useValue: { isAuthenticated: isAuth } satisfies Pick<
          ComnAuthService,
          'isAuthenticated'
        >,
      },
      {
        provide: ComnAuthQuery,
        useValue: { userTheme$: of(theme) },
      },
      { provide: XApiService, useValue: xapi },
    ],
  });

  return {
    ...rendered,
    getApplicationsByTeam,
    isAuth,
    // The real FocusedAppService from the default providers.
    focusedAppUrl:
      rendered.fixture.debugElement.injector.get(FocusedAppService)
        .focusedAppUrl,
    applicationSwitched: xapi.applicationSwitched,
  };
}

/** The rendered application links, in render order. */
function appLinks(container: Element): HTMLAnchorElement[] {
  return Array.from(container.querySelectorAll<HTMLAnchorElement>('a[title]'));
}

/**
 * Clicks a link with user-event and reports whether the component prevented
 * the browser's navigation; a bubbling listener prevents it afterwards, as
 * jsdom cannot navigate.
 */
async function clickLink(
  container: Element,
  link: HTMLElement,
  keys: { ctrl?: boolean } = {},
): Promise<boolean> {
  let prevented = false;
  const record = (event: Event) => {
    prevented = event.defaultPrevented;
    event.preventDefault();
  };
  container.addEventListener('click', record);
  const user = userEvent.setup();
  if (keys.ctrl) {
    await user.keyboard('{Control>}');
  }
  await user.click(link);
  if (keys.ctrl) {
    await user.keyboard('{/Control}');
  }
  container.removeEventListener('click', record);
  return prevented;
}

describe('ApplicationListComponent', () => {
  /**
   * Verifies: the primary team's applications are listed by name, linked to their URLs, and the first is opened in
   *   the focused app.
   * Interacts with: ApplicationsService.getApplicationsByTeam; the rendered links; the real FocusedAppService;
   *   XApiService.applicationSwitched.
   * Data: teams Primary (team-a) and Secondary; apps a1 and a2.
   */
  it('lists the primary team applications and opens the first', async () => {
    const {
      container,
      fixture,
      getApplicationsByTeam,
      focusedAppUrl,
      applicationSwitched,
    } = await renderList({
      apps: [
        makeApp('a1', 'https://a.test/app'),
        makeApp('a2', 'https://b.test/app'),
      ],
    });
    await fixture.whenStable();
    expect(getApplicationsByTeam).toHaveBeenLastCalledWith('team-a');
    expect(
      appLinks(container).map((a) => [a.title, a.getAttribute('href')]),
    ).toEqual([
      ['app-a1', 'https://a.test/app'],
      ['app-a2', 'https://b.test/app'],
    ]);
    expect(focusedAppUrl.value).toBe('https://a.test/app');
    expect(applicationSwitched).toHaveBeenCalledExactlyOnceWith(
      'v1',
      'app-a1',
      'https://a.test/app',
    );
  });

  /**
   * Verifies: the {theme} placeholder in an application URL becomes a theme query parameter in its link.
   * Interacts with: ComnAuthQuery.userTheme$; the rendered link.
   * Data: one row per URL shape, with the dark theme.
   */
  it.each<[string, string]>([
    ['https://a.test/app{theme}', 'https://a.test/app?theme=dark-theme'],
    ['https://a.test/app?{theme}', 'https://a.test/app?theme=dark-theme'],
    [
      'https://a.test/app?x=1&{theme}',
      'https://a.test/app?x=1&theme=dark-theme',
    ],
    [
      'https://a.test/app?x=1{theme}',
      'https://a.test/app?x=1&theme=dark-theme',
    ],
    ['https://a.test/app', 'https://a.test/app'],
  ])('links %s as %s', async (url, href) => {
    const { container } = await renderList({
      apps: [makeApp('a1', url)],
      theme: 'dark-theme' as Theme,
    });
    expect(appLinks(container)[0].getAttribute('href')).toBe(href);
  });

  /**
   * Verifies: an application set to load in the background gets a hidden iframe on its themed URL.
   * Interacts with: the rendered background iframe and the real DomSanitizer.
   * Data: one app with loadInBackground true.
   */
  it('loads a background application in a hidden iframe', async () => {
    const { container } = await renderList({
      apps: [
        {
          ...makeApp('a1', 'https://a.test/app{theme}'),
          loadInBackground: true,
        },
      ],
    });
    const iframe = container.querySelector('iframe.hidden-app-iframe');
    expect(iframe).toHaveAttribute(
      'src',
      'https://a.test/app?theme=light-theme',
    );
    expect(iframe).toHaveAttribute('aria-hidden', 'true');
  });

  /**
   * Verifies: clicking an embeddable application opens it in the focused app instead of navigating, after checking
   *   the login.
   * Interacts with: the rendered link; ComnAuthService.isAuthenticated; the real FocusedAppService;
   *   XApiService.applicationSwitched.
   * Data: apps a1 and a2 (both embeddable); a2 clicked.
   */
  it('opens an embeddable application in the focused app on click', async () => {
    const { container, fixture, isAuth, focusedAppUrl, applicationSwitched } =
      await renderList({
        apps: [
          makeApp('a1', 'https://a.test/app'),
          makeApp('a2', 'https://b.test/app'),
        ],
      });
    await fixture.whenStable();
    isAuth.mockClear();
    const prevented = await clickLink(container, appLinks(container)[1]);
    await fixture.whenStable();
    expect(prevented).toBe(true);
    expect(isAuth).toHaveBeenCalledTimes(1);
    expect(focusedAppUrl.value).toBe('https://b.test/app');
    expect(applicationSwitched).toHaveBeenLastCalledWith(
      'v1',
      'app-a2',
      'https://b.test/app',
    );
  });

  /**
   * Verifies: a ctrl-click, or a click on an application that cannot be embedded, is left to the browser.
   * Interacts with: the rendered link; the real FocusedAppService.
   * Data: one row per case; apps a1 and a2, with a2 clicked.
   */
  it.each<[string, boolean, boolean]>([
    ['a ctrl-click on an embeddable application', true, true],
    ['a click on an application that cannot be embedded', false, false],
  ])('leaves %s to the browser', async (_case, ctrl, embeddable) => {
    const { container, fixture, focusedAppUrl } = await renderList({
      apps: [
        makeApp('a1', 'https://a.test/app'),
        { ...makeApp('a2', 'https://b.test/app'), embeddable },
      ],
    });
    await fixture.whenStable();
    const prevented = await clickLink(container, appLinks(container)[1], {
      ctrl,
    });
    await fixture.whenStable();
    expect(prevented).toBe(false);
    expect(focusedAppUrl.value).toBe('https://a.test/app');
  });

  /**
   * Verifies: in mini mode each application is an icon link titled with its name.
   * Interacts with: the mini input; the rendered links and icons.
   * Data: mini true; app a1.
   */
  it('shows icon links in mini mode', async () => {
    const { container, rerender } = await renderList();
    await rerender({
      componentProperties: { mini: true },
      partialUpdate: true,
    });
    const [link] = appLinks(container);
    expect(link).toHaveClass('app-link-mini');
    expect(link.querySelector('img')).toHaveAttribute('alt', 'app-a1');
    expect(link).not.toHaveTextContent('app-a1');
  });

  /**
   * Verifies: a new teams input reloads the applications for the new primary team.
   * Interacts with: ngOnChanges through rerender; ApplicationsService.getApplicationsByTeam.
   * Data: the teams change so Secondary (team-b) becomes primary.
   */
  it('reloads the applications when the teams change', async () => {
    const { rerender, getApplicationsByTeam } = await renderList();
    await rerender({
      componentProperties: {
        teams: [
          { ...teams[0], isPrimary: false },
          { ...teams[1], isPrimary: true },
        ],
      },
      partialUpdate: true,
    });
    expect(getApplicationsByTeam).toHaveBeenLastCalledWith('team-b');
  });
});
