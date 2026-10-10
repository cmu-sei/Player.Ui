// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach, MockInstance } from 'vitest';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  BehaviorSubject,
  firstValueFrom,
  NEVER,
  Observable,
  of,
  Subject,
  throwError,
} from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { RouterQuery } from '@datorama/akita-ng-router-store';
import { ComnAuthQuery, ComnSettingsService } from '@cmusei/crucible-common';
import { ViewService } from '../../generated/player-api/api/view.service';
import {
  Team,
  TeamMembership,
  TeamMembershipService,
  TeamPermissionService,
  TeamService,
  View,
} from '../../generated/player-api';
import { LoggedInUserService } from '../../services/logged-in-user/logged-in-user.service';
import { SystemMessageService } from '../../services/system-message/system-message.service';
import {
  permissionApiStubs,
  permissionDataProviders,
} from '../../test-utils/mock-permission-data.service';
import { PlayerComponent } from './player.component';
import { AdminViewEditComponent } from '../admin-app/admin-view-search/admin-view-edit/admin-view-edit.component';
import { renderComponent } from '../../test-utils/render-component';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import {
  ResizableDirective,
  ResizableModule,
  ResizeEvent,
} from 'angular-resizable-element';
import { TeamData } from '../../models/team-data';
import { TopbarView } from '../shared/top-bar/topbar.models';
import { ApiStub } from '../../test-utils/api-stub';
import type { User as AuthUser } from 'oidc-client-ts';
import { dialogRefStub } from '../../test-utils/dialog-refs';
import { recordEmissions } from '../../test-utils/record-emissions';

@Component({ selector: 'app-application-list', template: '' })
class ApplicationListStubComponent {
  @Input() viewId!: string;
  @Input() teams!: TeamData[];
  @Input() mini!: boolean;
}

@Component({ selector: 'app-topbar', template: '' })
class TopbarStubComponent {
  @Input() sidenav?: unknown;
  @Input() title?: string;
  @Input() teams?: Team[];
  @Input() team?: Team;
  @Input() topbarView?: TopbarView;
  @Input() viewId!: string;
  @Input() mini!: boolean;
  @Output() sidenavToggle = new EventEmitter<boolean>();
  @Output() setTeam = new EventEmitter<string>();
  @Output() editView = new EventEmitter<unknown>();
}

@Component({ selector: 'app-focused-app', template: '' })
class FocusedAppStubComponent {}

@Component({ selector: 'app-notifications', template: '' })
class NotificationsStubComponent {
  @Input() viewGuid!: string;
  @Input() teamGuid!: string;
  @Input() userGuid!: string;
  @Input() userToken!: string;
  @Input() userName!: string;
}

const teamA: TeamMembership = {
  id: 'tm-a',
  teamId: 'team-a',
  teamName: 'Team A',
  isPrimary: true,
};
const teamB: TeamMembership = {
  id: 'tm-b',
  teamId: 'team-b',
  teamName: 'Team B',
  isPrimary: false,
};
const demoView: View = { id: 'view-1', name: 'Demo' };
const alice = {
  profile: { sub: 'u1', name: 'Alice' },
  access_token: 'tok',
} as AuthUser;

async function renderPlayer(
  overrides: {
    memberships?: TeamMembership[];
    view?: Observable<View>;
    savedState?: unknown;
    queryParams?: unknown[];
  } = {},
) {
  const { memberships = [teamA, teamB], view = of(demoView) } = overrides;
  if (overrides.savedState) {
    localStorage.setItem('team-a', JSON.stringify(overrides.savedState));
  }

  const displayMessage = vi.fn();
  // The real ViewsService (a default provider) calls this endpoint.
  const setUserPrimaryTeam = vi.fn((_userId: string, teamId: string) =>
    of<Team>({ id: teamId }),
  );
  const getView = vi.fn(() => view);
  const getTeamMemberships = vi.fn(() => of(structuredClone(memberships)));
  // The real UserPermissionsService loads team claims over this stub.
  const permissionStubs = permissionApiStubs();
  // Live subjects, so a test can emit after the page is destroyed.
  const queryParams$ = new BehaviorSubject<unknown[]>(
    overrides.queryParams ?? [null],
  );
  const routerState$ = new BehaviorSubject({
    state: { params: { id: 'view-1' } },
  });
  const loggedInUser$ = new BehaviorSubject(alice);
  const routerQuery = {
    getParams: (key: string) => (key === 'id' ? 'view-1' : null),
    selectQueryParams: () => queryParams$,
    select: () => routerState$,
  };
  const dialog = { open: vi.fn() } satisfies Pick<MatDialog, 'open'>;
  // The real Router (routerLink needs it); navigation is spied on before the
  // first render, which is when a refused view redirects.
  let navigate!: MockInstance<Router['navigate']>;

  const rendered = await renderComponent(PlayerComponent, {
    configureTestBed: (testBed) => {
      navigate = vi
        .spyOn(testBed.inject(Router), 'navigate')
        .mockResolvedValue(true);
    },
    imports: [
      MatListModule,
      MatDividerModule,
      MatIconModule,
      MatSidenavModule,
      MatToolbarModule,
      MatButtonModule,
      ResizableModule,
      ApplicationListStubComponent,
      TopbarStubComponent,
      FocusedAppStubComponent,
      NotificationsStubComponent,
    ],
    declarations: [PlayerComponent],
    providers: [
      { provide: RouterQuery, useValue: routerQuery },
      {
        provide: TeamService,
        useValue: { setUserPrimaryTeam } satisfies ApiStub<TeamService>,
      },
      {
        provide: ViewService,
        useValue: { getView } satisfies ApiStub<ViewService>,
      },
      {
        provide: LoggedInUserService,
        useValue: { loggedInUser$ } satisfies Pick<
          LoggedInUserService,
          'loggedInUser$'
        >,
      },
      {
        provide: TeamMembershipService,
        useValue: {
          getTeamMemberships,
        } satisfies ApiStub<TeamMembershipService>,
      },
      {
        provide: ComnSettingsService,
        useValue: { settings: { AppTitle: 'Player' } },
      },
      { provide: MatDialog, useValue: dialog },
      {
        provide: SystemMessageService,
        useValue: { displayMessage } satisfies Pick<
          SystemMessageService,
          'displayMessage'
        >,
      },
      { provide: ComnAuthQuery, useValue: { userTheme$: of('light-theme') } },
      ...permissionDataProviders(),
      {
        provide: TeamPermissionService,
        useValue: permissionStubs.teamPermissions,
      },
    ],
  });

  return {
    ...rendered,
    displayMessage,
    navigate,
    dialog,
    setUserPrimaryTeam,
    getView,
    getTeamMemberships,
    getMyTeamPermissions: permissionStubs.teamPermissions.getMyTeamPermissions,
    queryParams$,
    routerState$,
    loggedInUser$,
  };
}

function stub<T>(
  fixture: ComponentFixture<PlayerComponent>,
  type: new () => T,
) {
  return fixture.debugElement.query(By.directive(type))?.componentInstance as
    | T
    | undefined;
}

function sidenav(fixture: ComponentFixture<PlayerComponent>): MatSidenav {
  return fixture.debugElement.query(By.directive(MatSidenav))
    .componentInstance as MatSidenav;
}

function sidenavElement(container: Element): HTMLElement {
  return container.querySelector<HTMLElement>('mat-sidenav')!;
}

describe('PlayerComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /**
   * Verifies: entering a view shows its title, member teams and primary team in the topbar, its applications for those
   *   teams, and notifications for the user on the primary team.
   * Interacts with: ViewService.getView; TeamMembershipService.getTeamMemberships; the child stubs.
   * Data: view Demo; memberships Team A (primary) and Team B; user Alice (u1).
   */
  it('shows the view with its teams, applications and notifications', async () => {
    const { fixture, getView, getTeamMemberships } = await renderPlayer();
    expect(getView).toHaveBeenCalledWith('view-1');
    expect(getTeamMemberships).toHaveBeenCalledWith('u1', 'view-1');
    expect(screen.getByText('Player')).toBeInTheDocument();
    const teams = [
      { id: 'team-a', name: 'Team A', isMember: true, isPrimary: true },
      { id: 'team-b', name: 'Team B', isMember: true, isPrimary: false },
    ];
    const topbar = stub(fixture, TopbarStubComponent)!;
    expect(topbar.title).toBe('Demo');
    expect(topbar.teams).toEqual(teams);
    expect(topbar.team).toEqual(teams[0]);
    expect(topbar.viewId).toBe('view-1');
    expect(topbar.topbarView).toBe('player-player');
    const apps = stub(fixture, ApplicationListStubComponent)!;
    expect([apps.viewId, apps.teams, apps.mini]).toEqual([
      'view-1',
      teams,
      false,
    ]);
    const notifications = stub(fixture, NotificationsStubComponent)!;
    expect([
      notifications.viewGuid,
      notifications.teamGuid,
      notifications.userGuid,
      notifications.userToken,
      notifications.userName,
    ]).toEqual(['view-1', 'team-a', 'u1', 'tok', 'Alice']);
  });

  /**
   * Verifies: entering a view requests the view and the user's memberships twice (current behavior).
   * Interacts with: ViewService.getView; TeamMembershipService.getTeamMemberships.
   * Data: Team A primary.
   */
  it('requests the view and memberships twice on entering a view', async () => {
    const { getView, getTeamMemberships } = await renderPlayer();
    // Current behavior; see agent-docs/ui-test-bugs/player.ui.md.
    expect([
      getView.mock.calls.length,
      getTeamMemberships.mock.calls.length,
    ]).toEqual([2, 2]);
  });

  /**
   * Verifies: entering a view loads the user's team claims for the primary team, across all view teams, which the
   *   topbar's Edit View and Manage Teams entries read.
   * Interacts with: the real UserPermissionsService.loadTeamPermissions over the TeamPermissionService.getMyTeamPermissions stub.
   * Data: Team A primary.
   */
  it('loads team permissions for the primary team', async () => {
    const { getMyTeamPermissions } = await renderPlayer();
    expect(getMyTeamPermissions).toHaveBeenCalledWith(null, 'team-a', true);
  });

  /**
   * Verifies: a view the user cannot enter shows a message, sends them home, and renders only LOADING.
   * Interacts with: SystemMessageService.displayMessage; Router.navigate; the rendered page.
   * Data: one row per case: no memberships, no primary team, and a view request that fails with a 404.
   */
  it.each<[string, TeamMembership[], Observable<View>, string]>([
    [
      'Not a Member',
      [],
      of(demoView),
      'You are not a member of any Teams in this View',
    ],
    [
      'No Primary Team',
      [{ ...teamA, isPrimary: false }],
      of(demoView),
      'You do not have a primary team set for this View',
    ],
    [
      'View Not Found',
      [teamA],
      throwError(() => new Error('404')),
      'The view you are trying to access no longer exists or you do not have permission to access it.',
    ],
  ])(
    'shows "%s" and redirects home',
    async (title, memberships, view, message) => {
      const { fixture, displayMessage, navigate } = await renderPlayer({
        memberships,
        view,
      });
      expect(displayMessage).toHaveBeenLastCalledWith(title, message);
      expect(navigate).toHaveBeenLastCalledWith(['/']);
      expect(screen.getByText('LOADING')).toBeInTheDocument();
      expect(stub(fixture, TopbarStubComponent)).toBeUndefined();
    },
  );

  /**
   * Verifies: Collapse to Icons Only switches the navigation to mini, drops its width bounds, and remembers it for the
   *   team; Expand Navigation Panel switches back and restores the 250px to 33vw bounds.
   * Interacts with: the rendered collapse and expand buttons; the children's mini inputs; the rendered sidenav style;
   *   localStorage.
   * Data: Team A primary; no saved state.
   */
  it('collapses the navigation to icons and expands it again', async () => {
    const user = userEvent.setup();
    const { container, fixture } = await renderPlayer();
    const bounds = () => {
      const { minWidth, maxWidth } = sidenavElement(container).style;
      return [minWidth, maxWidth];
    };
    await user.click(screen.getByTitle('Collapse to Icons Only'));
    expect(bounds()).toEqual(['', '']);
    expect(stub(fixture, ApplicationListStubComponent)!.mini).toBe(true);
    expect(stub(fixture, TopbarStubComponent)!.mini).toBe(true);
    expect(JSON.parse(localStorage.getItem('team-a')!)).toEqual({
      width: null,
      opened: true,
      mini: true,
    });
    await user.click(screen.getByTitle('Expand Navigation Panel'));
    expect(bounds()).toEqual(['250px', '33vw']);
    expect(stub(fixture, ApplicationListStubComponent)!.mini).toBe(false);
    expect(JSON.parse(localStorage.getItem('team-a')!)).toEqual({
      width: null,
      opened: true,
      mini: false,
    });
  });

  /**
   * Verifies: the topbar's sidenav toggle steps the navigation from full to mini, from mini to closed, and from closed
   *   back to full.
   * Interacts with: the topbar stub's sidenavToggle output; the real MatSidenav; the application list's mini input.
   * Data: Team A primary; three toggles.
   */
  it('steps the navigation through mini and closed from the topbar toggle', async () => {
    const { fixture } = await renderPlayer();
    const toggle = () => {
      stub(fixture, TopbarStubComponent)!.sidenavToggle.emit(true);
      fixture.detectChanges();
    };
    const state = () => [
      sidenav(fixture).opened,
      stub(fixture, ApplicationListStubComponent)!.mini,
    ];
    expect(state()).toEqual([true, false]);
    toggle();
    expect(state()).toEqual([true, true]);
    toggle();
    expect(state()).toEqual([false, false]);
    toggle();
    expect(state()).toEqual([true, false]);
  });

  /**
   * Verifies: the team's saved navigation state is restored on entering the view (width and mini), always opened; a
   *   full navigation is bounded to 250px to 33vw, and a mini one has no width or bounds.
   * Interacts with: localStorage under the primary team id; the rendered sidenav style and the children's mini input.
   * Data: one row per saved state.
   */
  it.each<[string, unknown, boolean, [string, string, string]]>([
    [
      'a saved width',
      { width: 420, opened: false, mini: false },
      false,
      ['420px', '250px', '33vw'],
    ],
    [
      'a saved mini state',
      { width: 420, opened: false, mini: true },
      true,
      ['', '', ''],
    ],
    ['no saved state', undefined, false, ['250px', '250px', '33vw']],
  ])('restores %s', async (_case, savedState, mini, size) => {
    const { container, fixture } = await renderPlayer({ savedState });
    expect(sidenav(fixture).opened).toBe(true);
    expect(stub(fixture, ApplicationListStubComponent)!.mini).toBe(mini);
    const { width, minWidth, maxWidth } = sidenavElement(container).style;
    expect([width, minWidth, maxWidth]).toEqual(size);
  });

  /**
   * Verifies: dragging the navigation's edge resizes it in push mode, and the end of the drag restores side mode and
   *   saves the width; collapsing to icons then keeps that width in the saved state; in mini mode a drag is ignored.
   * Interacts with: the mwlResizable directive's resizing and resizeEnd outputs; the real MatSidenav; localStorage.
   * Data: dragged to 480 px, first full, then in mini mode.
   */
  it('resizes the navigation by dragging and saves the width', async () => {
    const { container, fixture } = await renderPlayer();
    const resizable = fixture.debugElement
      .query(By.directive(ResizableDirective))
      .injector.get(ResizableDirective);
    const drag = { rectangle: { width: 480 } } as ResizeEvent;
    resizable.resizing.emit(drag);
    fixture.detectChanges();
    expect(sidenav(fixture).mode).toBe('push');
    expect(sidenavElement(container).style.width).toBe('480px');
    resizable.resizeEnd.emit(drag);
    fixture.detectChanges();
    expect(sidenav(fixture).mode).toBe('side');
    expect(JSON.parse(localStorage.getItem('team-a')!)).toEqual({
      width: 480,
    });

    await userEvent.setup().click(screen.getByTitle('Collapse to Icons Only'));
    // The collapse keeps the saved width and records the new mode.
    expect(JSON.parse(localStorage.getItem('team-a')!)).toEqual({
      width: 480,
      opened: true,
      mini: true,
    });
    resizable.resizing.emit({ rectangle: { width: 600 } } as ResizeEvent);
    fixture.detectChanges();
    expect(sidenav(fixture).mode).toBe('side');
    expect(sidenavElement(container).style.width).toBe('');
  });

  /**
   * Verifies: choosing another team in the topbar makes it the user's primary team, and choosing the current one does
   *   nothing.
   * Interacts with: the topbar stub's setTeam output; the real ViewsService.setPrimaryTeamId over
   *   TeamService.setUserPrimaryTeam (never answers, as the success path reloads the page).
   * Data: Team A primary; Team B, then Team A chosen.
   */
  it('sets a newly chosen primary team', async () => {
    const { fixture, setUserPrimaryTeam } = await renderPlayer();
    setUserPrimaryTeam.mockReturnValue(NEVER);
    const topbar = stub(fixture, TopbarStubComponent)!;
    topbar.setTeam.emit('team-a');
    expect(setUserPrimaryTeam).not.toHaveBeenCalled();
    topbar.setTeam.emit('team-b');
    expect(setUserPrimaryTeam).toHaveBeenCalledExactlyOnceWith('u1', 'team-b');
  });

  /**
   * Verifies: Edit View from the topbar opens the view editor in a dialog, seeded with the view; completing it closes
   *   the dialog, and a deleted view (null) sends the user home.
   * Interacts with: the topbar stub's editView output; MatDialog.open; the dialog's AdminViewEditComponent instance;
   *   Router.navigate.
   * Data: one row per completion value.
   */
  it.each<[string, string | null, number]>([
    ['the view was saved', 'view-1', 0],
    ['the view was deleted', null, 1],
  ])(
    'edits the view in a dialog and closes it when %s',
    async (_case, completedWith, homeNavigations) => {
      const { fixture, dialog, navigate } = await renderPlayer();
      const editComplete = new Subject<string | null>();
      const editor = {
        resetStepper: vi.fn(),
        updateApplicationTemplates: vi.fn(),
        updateView: vi.fn(),
        setView: vi.fn(),
        editComplete,
      };
      const { dialogRef, close } = dialogRefStub<typeof editor>();
      // dialogRefStub has no componentInstance; editViewFn drives the editor
      // through it.
      Object.assign(dialogRef, { componentInstance: editor });
      dialog.open.mockReturnValue(dialogRef);
      stub(fixture, TopbarStubComponent)!.editView.emit({});
      expect(dialog.open).toHaveBeenCalledExactlyOnceWith(
        AdminViewEditComponent,
        { maxWidth: '100vw', width: 'auto' },
      );
      expect(editor.resetStepper).toHaveBeenCalled();
      expect(editor.updateApplicationTemplates).toHaveBeenCalled();
      expect(editor.updateView).toHaveBeenCalled();
      expect(editor.setView).toHaveBeenCalledWith(demoView);
      expect(close).not.toHaveBeenCalled();
      editComplete.next(completedWith);
      expect(close).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledTimes(homeNavigations);
    },
  );

  /**
   * Verifies: Edit View in a new tab opens the view's admin page in a new browser tab instead of the dialog.
   * Interacts with: the topbar stub's editView output; the real Router's URL serializer; window.open; MatDialog.open.
   * Data: editView emits { isNewBrowserTab: true }.
   */
  it('opens the view admin page in a new tab', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { fixture, dialog } = await renderPlayer();
    stub(fixture, TopbarStubComponent)!.editView.emit({
      isNewBrowserTab: true,
    });
    expect(open).toHaveBeenCalledExactlyOnceWith(
      '/admin?section=views&view=view-1',
      '_blank',
    );
    expect(dialog.open).not.toHaveBeenCalled();
  });

  /**
   * Verifies: once the page is destroyed, a later logged-in user or route change no longer reloads the memberships,
   *   the view or the team permissions, and no longer shows a message or sends the user home.
   * Interacts with: LoggedInUserService.loggedInUser$ and RouterQuery.select (live subjects); fixture.destroy();
   *   ViewService.getView; TeamMembershipService.getTeamMemberships; TeamPermissionService.getMyTeamPermissions;
   *   SystemMessageService.displayMessage; Router.navigate (spied).
   * Data: Team A primary; after destroy the memberships answer [] (which would redirect "Not a Member"), a renewed
   *   user is emitted, and the route changes to view-2.
   */
  it('stops following the user and the route after destroy', async () => {
    const r = await renderPlayer();
    const calls = () => [
      r.getView.mock.calls.length,
      r.getTeamMemberships.mock.calls.length,
      r.getMyTeamPermissions.mock.calls.length,
    ];
    const before = calls();
    r.fixture.destroy();
    r.getTeamMemberships.mockReturnValue(of([]));
    r.loggedInUser$.next({ ...alice, access_token: 'renewed' } as AuthUser);
    r.routerState$.next({ state: { params: { id: 'view-2' } } });
    expect(calls()).toEqual(before);
    expect(r.displayMessage).not.toHaveBeenCalled();
    expect(r.navigate).not.toHaveBeenCalled();
  });

  describe('checkParam(), which no template calls', () => {
    /**
     * Verifies: checkParam emits whether every requested query parameter is present.
     * Interacts with: RouterQuery.selectQueryParams; checkParam (called directly).
     * Data: one row per parameter list.
     */
    it.each<[boolean, string, unknown[]]>([
      [true, 'every parameter is present', ['a', 'b']],
      [false, 'one parameter is missing', ['a', null]],
    ])('emits %s when %s', async (expected, _case, queryParams) => {
      const { fixture } = await renderPlayer({ queryParams });
      expect(
        await firstValueFrom(fixture.componentInstance.checkParam(['x', 'y'])),
      ).toBe(expected);
    });

    /**
     * Verifies: a checkParam stream completes when the page is destroyed and ignores later query parameters.
     * Interacts with: RouterQuery.selectQueryParams (a live subject); checkParam (called directly); fixture.destroy().
     * Data: parameters ['a', null], then ['a', 'b'] after destroy.
     */
    it('completes and stops emitting after destroy', async () => {
      const { fixture, queryParams$ } = await renderPlayer({
        queryParams: ['a', null],
      });
      const stream = fixture.componentInstance.checkParam(['x', 'y']);
      const emitted = recordEmissions(stream);
      let completed = false;
      stream.subscribe({ complete: () => (completed = true) });
      fixture.destroy();
      queryParams$.next(['a', 'b']);
      expect(emitted).toEqual([false]);
      expect(completed).toBe(true);
    });
  });
});
