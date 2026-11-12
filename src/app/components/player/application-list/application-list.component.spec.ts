// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Observable, Subject, of, throwError } from 'rxjs';
import userEvent from '@testing-library/user-event';
import { ComnAuthQuery, ComnAuthService, Theme } from '@cmusei/crucible-common';
import { ApplicationData } from '../../../models/application-data';
import { TeamData } from '../../../models/team-data';
import { ApplicationsService } from '../../../services/applications/applications.service';
import { FocusedAppService } from '../../../services/focused-app/focused-app.service';
import { NotificationService } from '../../../services/notification/notification.service';
import { XApiService } from '../../../services/xapi/xapi.service';
import { ApplicationListComponent } from './application-list.component';
import { renderComponent } from '../../../test-utils/render-component';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import {
  captureUnhandledRxErrors,
  flush,
} from '../../../test-utils/unhandled-rx-errors';

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
    /** What the first fetch answers, instead of `apps`. */
    appsResponse?: Observable<ApplicationData[]>;
  } = {},
) {
  const {
    apps = [makeApp('a1', 'https://a.test/app')],
    theme = 'light-theme' as Theme,
    teams: t = teams,
    isAuthenticated = true,
  } = overrides;

  const getApplicationsByTeam = vi.fn(
    (): Observable<ApplicationData[]> =>
      overrides.appsResponse ?? of(structuredClone(apps)),
  );
  const isAuth = vi.fn(() => Promise.resolve(isAuthenticated));
  const xapi = {
    applicationSwitched: vi.fn(() => of(null)),
  } satisfies Pick<XApiService, 'applicationSwitched'>;
  // The team hub's application list messages, pushed by the test.
  const applicationsChanged = new Subject<string>();

  const rendered = await renderComponent(ApplicationListComponent, {
    imports: [MatListModule, MatButtonModule],
    declarations: [ApplicationListComponent],
    inputs: { viewId: 'v1', teams: t, mini: false },
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
      {
        provide: NotificationService,
        useValue: { applicationsChanged } satisfies Pick<
          NotificationService,
          'applicationsChanged'
        >,
      },
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
    applicationsChanged,
  };
}

/**
 * Pushes ApplicationsChanged for a team and lets the component's debounce run
 * out, then waits for the refetched list to render.
 */
async function pushApplicationsChanged(
  rendered: Awaited<ReturnType<typeof renderList>>,
  ...teamIds: string[]
) {
  vi.useFakeTimers({
    // debounceTime reads Date.now as well as scheduling an interval.
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'Date',
    ],
  });
  try {
    teamIds.forEach((teamId) => rendered.applicationsChanged.next(teamId));
    vi.advanceTimersByTime(ApplicationListComponent.refreshDebounceMs);
  } finally {
    vi.useRealTimers();
  }
  rendered.fixture.detectChanges();
  await rendered.fixture.whenStable();
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
   * Verifies: a failed authentication check leaves the previous application focused and reports the rejection.
   * Interacts with: the rendered application link, ComnAuthService.isAuthenticated, real FocusedAppService,
   *   XApiService.applicationSwitched, and captureUnhandledRxErrors.
   * Data: a1 is focused; selecting a2 fails with a storage SecurityError.
   */
  it('keeps the previous application focused when authentication rejects', async () => {
    const errors = captureUnhandledRxErrors();
    const failure = new DOMException('Storage access denied', 'SecurityError');
    const { container, fixture, isAuth, focusedAppUrl, applicationSwitched } =
      await renderList({
        apps: [
          makeApp('a1', 'https://a.test/app'),
          makeApp('a2', 'https://b.test/app'),
        ],
      });
    await fixture.whenStable();
    isAuth.mockImplementationOnce(() => Promise.reject(failure));
    applicationSwitched.mockClear();

    expect(await clickLink(container, appLinks(container)[1])).toBe(true);
    await flush();

    expect(focusedAppUrl.value).toBe('https://a.test/app');
    expect(applicationSwitched).not.toHaveBeenCalled();
    expect(errors).toEqual([failure]);
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
      inputs: { mini: true },
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
      inputs: {
        teams: [
          { ...teams[0], isPrimary: false },
          { ...teams[1], isPrimary: true },
        ],
      },
      partialUpdate: true,
    });
    expect(getApplicationsByTeam).toHaveBeenLastCalledWith('team-b');
  });

  describe('when the team hub says the applications changed', () => {
    /**
     * Verifies: the list is fetched again and shows an added, a renamed and a reordered application, while the
     *   focused application stays open without another xAPI switch.
     * Interacts with: NotificationService.applicationsChanged; ApplicationsService.getApplicationsByTeam; the
     *   rendered links; the real FocusedAppService; XApiService.applicationSwitched.
     * Data: a1 and a2, with a1 focused; then a2 renamed and moved first, a1, and a new a3.
     */
    it('shows added, renamed and reordered applications and keeps the focused one', async () => {
      const rendered = await renderList({
        apps: [
          makeApp('a1', 'https://a.test/app'),
          makeApp('a2', 'https://b.test/app'),
        ],
      });
      const { container, fixture, getApplicationsByTeam, focusedAppUrl } =
        rendered;
      await fixture.whenStable();
      rendered.applicationSwitched.mockClear();
      getApplicationsByTeam.mockImplementation(() =>
        of([
          { ...makeApp('a2', 'https://b.test/app'), name: 'Renamed' },
          makeApp('a1', 'https://a.test/app'),
          makeApp('a3', 'https://c.test/app'),
        ]),
      );

      await pushApplicationsChanged(rendered, 'team-a');

      expect(getApplicationsByTeam).toHaveBeenCalledTimes(2);
      expect(getApplicationsByTeam).toHaveBeenLastCalledWith('team-a');
      expect(appLinks(container).map((a) => a.title)).toEqual([
        'Renamed',
        'app-a1',
        'app-a3',
      ]);
      expect(focusedAppUrl.value).toBe('https://a.test/app');
      expect(rendered.applicationSwitched).not.toHaveBeenCalled();
    });

    /**
     * Verifies: a message for a team other than the primary one is ignored.
     * Interacts with: NotificationService.applicationsChanged; ApplicationsService.getApplicationsByTeam.
     * Data: the primary team is team-a; the message names team-b.
     */
    it('ignores another team', async () => {
      const rendered = await renderList();
      await rendered.fixture.whenStable();

      await pushApplicationsChanged(rendered, 'team-b');

      expect(rendered.getApplicationsByTeam).toHaveBeenCalledTimes(1);
    });

    /**
     * Verifies: a burst of messages, as a reorder sends one per renumbered application, is fetched once.
     * Interacts with: NotificationService.applicationsChanged; ApplicationsService.getApplicationsByTeam.
     * Data: three messages for team-a inside one debounce window.
     */
    it('fetches a burst of changes once', async () => {
      const rendered = await renderList();
      await rendered.fixture.whenStable();

      await pushApplicationsChanged(rendered, 'team-a', 'team-a', 'team-a');

      expect(rendered.getApplicationsByTeam).toHaveBeenCalledTimes(2);
    });

    /**
     * Verifies: when the focused application is removed, the first remaining one is opened.
     * Interacts with: NotificationService.applicationsChanged; the real FocusedAppService;
     *   XApiService.applicationSwitched.
     * Data: a1 and a2 with a2 focused by a click; then only a1.
     */
    it('opens the first application when the focused one is removed', async () => {
      const rendered = await renderList({
        apps: [
          makeApp('a1', 'https://a.test/app'),
          makeApp('a2', 'https://b.test/app'),
        ],
      });
      const { container, fixture, focusedAppUrl } = rendered;
      await fixture.whenStable();
      await clickLink(container, appLinks(container)[1]);
      await fixture.whenStable();
      expect(focusedAppUrl.value).toBe('https://b.test/app');
      rendered.getApplicationsByTeam.mockImplementation(() =>
        of([makeApp('a1', 'https://a.test/app')]),
      );

      await pushApplicationsChanged(rendered, 'team-a');
      await fixture.whenStable();

      expect(focusedAppUrl.value).toBe('https://a.test/app');
      expect(rendered.applicationSwitched).toHaveBeenLastCalledWith(
        'v1',
        'app-a1',
        'https://a.test/app',
      );
    });

    /**
     * Verifies: when the last application is removed, the focused app goes blank.
     * Interacts with: NotificationService.applicationsChanged; the rendered links; the real FocusedAppService.
     * Data: a1 focused; then an empty list.
     */
    it('blanks the focused app when no application is left', async () => {
      const rendered = await renderList();
      const { container, fixture, focusedAppUrl } = rendered;
      await fixture.whenStable();
      rendered.getApplicationsByTeam.mockImplementation(() => of([]));

      await pushApplicationsChanged(rendered, 'team-a');

      expect(appLinks(container)).toEqual([]);
      expect(focusedAppUrl.value).toBe('about:blank');
    });

    /**
     * Verifies: when the focused application's URL changes, it is reopened on the new URL.
     * Interacts with: NotificationService.applicationsChanged; the real FocusedAppService.
     * Data: a1 focused on https://a.test/app; then a1 on https://a.test/moved.
     */
    it('reopens the focused application when its URL changes', async () => {
      const rendered = await renderList();
      const { fixture, focusedAppUrl } = rendered;
      await fixture.whenStable();
      rendered.getApplicationsByTeam.mockImplementation(() =>
        of([makeApp('a1', 'https://a.test/moved')]),
      );

      await pushApplicationsChanged(rendered, 'team-a');
      await fixture.whenStable();

      expect(focusedAppUrl.value).toBe('https://a.test/moved');
    });

    /**
     * Verifies: a failed refetch keeps the list already shown and is logged, and a later message still refreshes it.
     * Interacts with: NotificationService.applicationsChanged; ApplicationsService.getApplicationsByTeam; the
     *   rendered links.
     * Data: a1; a refetch that errors; then a refetch with a2.
     */
    it('keeps the list when a refetch fails', async () => {
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
      const rendered = await renderList();
      const { container, fixture, getApplicationsByTeam } = rendered;
      await fixture.whenStable();
      getApplicationsByTeam.mockImplementationOnce(() =>
        throwError(() => new Error('Server error')),
      );

      await pushApplicationsChanged(rendered, 'team-a');
      expect(appLinks(container).map((a) => a.title)).toEqual(['app-a1']);
      expect(logged).toHaveBeenCalledOnce();

      getApplicationsByTeam.mockImplementation(() =>
        of([makeApp('a2', 'https://b.test/app')]),
      );
      await pushApplicationsChanged(rendered, 'team-a');
      expect(appLinks(container).map((a) => a.title)).toEqual(['app-a2']);
    });

    /**
     * Verifies: a failed first load leaves the list empty without ending the live updates, so the next message
     *   loads it.
     * Interacts with: NotificationService.applicationsChanged; ApplicationsService.getApplicationsByTeam; the
     *   rendered links.
     * Data: the first fetch errors; then a message with a1 available.
     */
    it('loads the list on the next change after a failed first load', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const rendered = await renderList({
        appsResponse: throwError(() => new Error('Server error')),
      });
      const { container, fixture, getApplicationsByTeam } = rendered;
      await fixture.whenStable();
      expect(appLinks(container)).toEqual([]);

      getApplicationsByTeam.mockImplementation(() =>
        of([makeApp('a1', 'https://a.test/app')]),
      );
      await pushApplicationsChanged(rendered, 'team-a');

      expect(appLinks(container).map((a) => a.title)).toEqual(['app-a1']);
    });

    /**
     * Verifies: a background application's iframe is neither moved nor given a new source when the list is
     *   refreshed and reordered, since either would reload it.
     * Interacts with: NotificationService.applicationsChanged; the rendered background iframes.
     * Data: background apps b1 and b2; then the same apps in the opposite order.
     */
    it('leaves background iframes in place when the list is reordered', async () => {
      const first = {
        ...makeApp('b1', 'https://a.test/app'),
        loadInBackground: true,
      };
      const second = {
        ...makeApp('b2', 'https://b.test/app'),
        loadInBackground: true,
      };
      const rendered = await renderList({ apps: [first, second] });
      const { container, fixture } = rendered;
      await fixture.whenStable();
      const before = Array.from(container.querySelectorAll('iframe'));
      const reloads = before.map((iframe) => {
        const watched = { srcSets: 0 };
        const descriptor = Object.getOwnPropertyDescriptor(
          HTMLIFrameElement.prototype,
          'src',
        );
        Object.defineProperty(iframe, 'src', {
          configurable: true,
          get: () => descriptor.get.call(iframe),
          set: (value) => {
            watched.srcSets++;
            descriptor.set.call(iframe, value);
          },
        });
        return watched;
      });
      rendered.getApplicationsByTeam.mockImplementation(() =>
        of([structuredClone(second), structuredClone(first)]),
      );

      await pushApplicationsChanged(rendered, 'team-a');

      const after = Array.from(container.querySelectorAll('iframe'));
      expect(after).toHaveLength(2);
      after.forEach((iframe, i) => expect(iframe).toBe(before[i]));
      expect(reloads.map((r) => r.srcSets)).toEqual([0, 0]);
    });
  });
});
