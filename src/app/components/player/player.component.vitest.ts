// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { EMPTY, firstValueFrom, NEVER, of, throwError } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { RouterQuery } from '@datorama/akita-ng-router-store';
import {
  ComnAuthQuery,
  ComnSettingsService,
} from '@cmusei/crucible-common';
import { ViewService } from '../../generated/player-api/api/view.service';
import { TeamService } from '../../generated/player-api/api/team.service';
import { ViewsService } from '../../services/views/views.service';
import { LoggedInUserService } from '../../services/logged-in-user/logged-in-user.service';
import { SystemMessageService } from '../../services/system-message/system-message.service';
import { UserPermissionsService } from '../../services/permissions/user-permissions.service';
import { PlayerComponent, TeamUIState } from './player.component';
import { renderComponent } from '../../test-utils/render-component';

async function renderPlayer(
  overrides: {
    teamId?: string;
    routerState?: unknown;
    selectQueryParams?: unknown;
    teams?: unknown[];
    view?: unknown;
    user?: unknown;
  } = {},
) {
  const { teamId = 'team-a' } = overrides;

  const displayMessage = vi.fn();
  const navigate = vi.fn();
  const setPrimaryTeamId = vi.fn(() => of({}));
  const getView = vi.fn(() => of(overrides.view ?? { id: 'view-1' }));
  const getMyViewTeams = vi.fn(() => of(overrides.teams ?? []));
  const loadTeamPermissions = vi.fn(() => of([]));
  const user = overrides.user ?? { profile: { sub: 'u1' } };

  // EMPTY by default so loadData()'s subscription stays inert; tests that
  // exercise loadData/checkParam pass an explicit state/query observable.
  const routerQuery = {
    getParams: () => 'view-1',
    selectQueryParams: () => overrides.selectQueryParams ?? EMPTY,
    select: () => overrides.routerState ?? EMPTY,
  };

  const dialog = { open: vi.fn() };

  const rendered = await renderComponent(PlayerComponent, {
    declarations: [PlayerComponent],
    schemas: [NO_ERRORS_SCHEMA],
    providers: [
      {
        provide: Router,
        useValue: {
          serializeUrl: vi.fn(() => 'url'),
          createUrlTree: vi.fn(),
          navigate,
        },
      },
      { provide: RouterQuery, useValue: routerQuery },
      { provide: ViewsService, useValue: { setPrimaryTeamId } },
      { provide: ViewService, useValue: { getView } },
      { provide: LoggedInUserService, useValue: { loggedInUser$: of(user) } },
      { provide: TeamService, useValue: { getMyViewTeams } },
      {
        provide: ComnSettingsService,
        useValue: { settings: { AppTitle: 'Player' } },
      },
      { provide: MatDialog, useValue: dialog },
      { provide: SystemMessageService, useValue: { displayMessage } },
      { provide: ComnAuthQuery, useValue: { userTheme$: of('light-theme') } },
      {
        provide: UserPermissionsService,
        useValue: { loadTeamPermissions },
      },
    ],
  });

  rendered.fixture.componentInstance.teamId = teamId;
  rendered.fixture.componentInstance.sidenav = {
    opened: true,
    mode: 'side',
  } as never;
  return {
    ...rendered,
    displayMessage,
    navigate,
    dialog,
    setPrimaryTeamId,
    getView,
    getMyViewTeams,
    loadTeamPermissions,
  };
}

describe('PlayerComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates the component', async () => {
    const { fixture } = await renderPlayer();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('toggleMini always keeps the sidebar opened and flips the mini flag', async () => {
    const { fixture } = await renderPlayer();
    const c = fixture.componentInstance;
    expect(c.miniSubject.getValue()).toBe(false);
    c.toggleMini();
    expect(c.miniSubject.getValue()).toBe(true);
    expect(c.openedSubject.getValue()).toBe(true);
    c.toggleMini();
    expect(c.miniSubject.getValue()).toBe(false);
    expect(c.openedSubject.getValue()).toBe(true);
  });

  it('sidenavToggleFn first collapses to mini when open+full, then fully closes', async () => {
    const { fixture } = await renderPlayer();
    const c = fixture.componentInstance;
    // open + full → mini
    c.sidenavToggleFn();
    expect(c.miniSubject.getValue()).toBe(true);
    expect(c.openedSubject.getValue()).toBe(true);
    // open + mini → closed
    c.sidenavToggleFn();
    expect(c.miniSubject.getValue()).toBe(false);
    expect(c.openedSubject.getValue()).toBe(false);
  });

  it('sidenavToggleFn reopens (fully) when the sidenav is closed', async () => {
    const { fixture } = await renderPlayer();
    const c = fixture.componentInstance;
    c.sidenav = { opened: false, mode: 'side' } as never;
    c.sidenavToggleFn();
    expect(c.openedSubject.getValue()).toBe(true);
    expect(c.miniSubject.getValue()).toBe(false);
  });

  it('updateUIState persists a new state to localStorage under the team id', async () => {
    const { fixture } = await renderPlayer({ teamId: 'team-42' });
    const c = fixture.componentInstance;
    c.updateUIState(300, true, false);
    const persisted = JSON.parse(localStorage.getItem('team-42')) as TeamUIState;
    expect(persisted).toEqual({ width: 300, opened: true, mini: false });
  });

  it('updateUIState preserves existing keys it was not asked to change', async () => {
    const { fixture } = await renderPlayer({ teamId: 'team-42' });
    const c = fixture.componentInstance;
    localStorage.setItem(
      'team-42',
      JSON.stringify({ width: 500, opened: true, mini: true }),
    );
    c.updateUIState(undefined, false, undefined);
    const persisted = JSON.parse(localStorage.getItem('team-42')) as TeamUIState;
    expect(persisted.width).toBe(500);
    expect(persisted.opened).toBe(false);
    expect(persisted.mini).toBe(true);
  });

  it('restoreUIState populates width / mini from localStorage and forces opened=true', async () => {
    const { fixture } = await renderPlayer({ teamId: 'team-42' });
    const c = fixture.componentInstance;
    localStorage.setItem(
      'team-42',
      JSON.stringify({ width: 420, opened: false, mini: true }),
    );
    c.restoreUIState();
    expect(c.sidenavWidth).toBe(420);
    expect(c.miniSubject.getValue()).toBe(true);
    expect(c.openedSubject.getValue()).toBe(true);
  });

  it('restoreUIState sets default width when no saved state exists', async () => {
    const { fixture } = await renderPlayer({ teamId: 'team-42' });
    const c = fixture.componentInstance;
    c.sidenavWidth = undefined;
    c.restoreUIState();
    expect(c.sidenavWidth).toBe(250);
  });

  it('setResizeStyle sets min/max-width bounds when not mini', async () => {
    const { fixture } = await renderPlayer();
    const c = fixture.componentInstance;
    c.sidenavWidth = 300;
    c.setResizeStyle();
    expect(c.resizeStyle).toMatchObject({
      'min-width': '250px',
      'max-width': '33vw',
    });
  });

  it('setResizeStyle clears bounds when mini', async () => {
    const { fixture } = await renderPlayer();
    const c = fixture.componentInstance;
    c.miniSubject.next(true);
    c.setResizeStyle();
    expect(c.resizeStyle).toMatchObject({
      'min-width': null,
      'max-width': null,
      width: null,
    });
  });

  it('ngOnDestroy completes the unsubscribe subject', async () => {
    const { fixture } = await renderPlayer();
    const complete = vi.spyOn(fixture.componentInstance.unsubscribe$, 'complete');
    fixture.componentInstance.ngOnDestroy();
    expect(complete).toHaveBeenCalled();
  });

  describe('loadData()', () => {
    const routerState = of({
      state: { params: { id: 'view-1' } },
    });

    it('combines view + teams and derives primary team, members, and title', async () => {
      const teams = [
        { id: 'team-a', isMember: true, isPrimary: true },
        { id: 'team-b', isMember: true, isPrimary: false },
        { id: 'team-c', isMember: false, isPrimary: false },
      ];
      const { fixture, getView, getMyViewTeams } = await renderPlayer({
        routerState,
        teams,
        view: { id: 'view-1', name: 'Demo' },
      });
      const data = await firstValueFrom(fixture.componentInstance.loadData());
      expect(getView).toHaveBeenCalledWith('view-1');
      expect(getMyViewTeams).toHaveBeenCalledWith('view-1');
      expect(data.team.id).toBe('team-a');
      expect(data.teams.map((t: { id: string }) => t.id)).toEqual([
        'team-a',
        'team-b',
      ]);
      expect(data.title).toBe('Player');
      expect(fixture.componentInstance.teamId).toBe('team-a');
    });

    it('shows a "Not a Member" message and redirects home when the user is on no teams', async () => {
      const { fixture, displayMessage, navigate } = await renderPlayer({
        routerState,
        teams: [{ id: 'team-x', isMember: false, isPrimary: true }],
      });
      // This branch returns EMPTY (no emission) after messaging + redirecting,
      // so subscribe and assert the side effects rather than awaiting a value.
      fixture.componentInstance.loadData().subscribe();
      expect(displayMessage).toHaveBeenCalledWith(
        'Not a Member',
        expect.stringContaining('not a member of any Teams'),
      );
      expect(navigate).toHaveBeenCalledWith(['/']);
    });

    it('shows a "No Primary Team" message and redirects home when no primary team is set', async () => {
      const { fixture, displayMessage, navigate } = await renderPlayer({
        routerState,
        teams: [{ id: 'team-a', isMember: true, isPrimary: false }],
      });
      fixture.componentInstance.loadData().subscribe();
      expect(displayMessage).toHaveBeenCalledWith(
        'No Primary Team',
        expect.stringContaining('primary team'),
      );
      expect(navigate).toHaveBeenCalledWith(['/']);
    });

    it('shows a "View Not Found" message and redirects home when loading the view errors', async () => {
      const { fixture, displayMessage, navigate, getView } = await renderPlayer({
        routerState,
        teams: [{ id: 'team-a', isMember: true, isPrimary: true }],
      });
      getView.mockReturnValueOnce(
        throwError(() => new Error('404 not found')),
      );
      fixture.componentInstance.loadData().subscribe();
      expect(displayMessage).toHaveBeenCalledWith(
        'View Not Found',
        expect.stringContaining('no longer exists'),
      );
      expect(navigate).toHaveBeenCalledWith(['/']);
    });
  });

  describe('checkParam()', () => {
    it('emits true when every requested query param is present', async () => {
      const { fixture } = await renderPlayer({
        selectQueryParams: of(['a', 'b']),
      });
      expect(
        await firstValueFrom(fixture.componentInstance.checkParam(['x', 'y'])),
      ).toBe(true);
    });

    it('emits false when any requested query param is missing', async () => {
      const { fixture } = await renderPlayer({
        selectQueryParams: of(['a', null]),
      });
      expect(
        await firstValueFrom(fixture.componentInstance.checkParam(['x', 'y'])),
      ).toBe(false);
    });
  });

  describe('setPrimaryTeam()', () => {
    it('sets the new primary team when it differs from the current one', async () => {
      // setPrimaryTeamId returns NEVER so the success tap (window.location.reload,
      // non-configurable in jsdom) never fires — we only assert the API call.
      const { fixture, setPrimaryTeamId } = await renderPlayer({
        user: { profile: { sub: 'user-9' } },
      });
      setPrimaryTeamId.mockReturnValueOnce(NEVER);
      const c = fixture.componentInstance;
      c.data$ = of({ team: { id: 'team-a' } });
      c.setPrimaryTeam('team-b');
      expect(setPrimaryTeamId).toHaveBeenCalledWith('user-9', 'team-b');
    });

    it('does nothing when the chosen team is already primary', async () => {
      const { fixture, setPrimaryTeamId } = await renderPlayer();
      const c = fixture.componentInstance;
      c.data$ = of({ team: { id: 'team-a' } });
      c.setPrimaryTeam('team-a');
      expect(setPrimaryTeamId).not.toHaveBeenCalled();
    });
  });

  describe('editViewFn()', () => {
    it('opens the edit-view dialog and seeds it from data$ for in-app editing', async () => {
      const { fixture, dialog } = await renderPlayer();
      const c = fixture.componentInstance;
      const componentInstance = {
        resetStepper: vi.fn(),
        updateApplicationTemplates: vi.fn(),
        updateView: vi.fn(),
        setView: vi.fn(),
        editComplete: of('done'),
      };
      const close = vi.fn();
      dialog.open.mockReturnValue({ componentInstance, close });
      c.data$ = of({ view: { id: 'view-1', name: 'Demo' } });
      c.editViewFn({ isNewBrowserTab: false });
      expect(dialog.open).toHaveBeenCalled();
      expect(componentInstance.resetStepper).toHaveBeenCalled();
      expect(componentInstance.setView).toHaveBeenCalledWith({
        id: 'view-1',
        name: 'Demo',
      });
      expect(close).toHaveBeenCalled(); // editComplete fired
    });

    it('opens a new browser tab when isNewBrowserTab is true', async () => {
      const { fixture, dialog } = await renderPlayer();
      const open = vi.spyOn(window, 'open').mockImplementation(() => null);
      fixture.componentInstance.editViewFn({ isNewBrowserTab: true });
      expect(open).toHaveBeenCalledWith('url', '_blank');
      expect(dialog.open).not.toHaveBeenCalled();
      open.mockRestore();
    });
  });

  describe('resize handlers', () => {
    it('resizingFn switches to push mode and records the new width when not mini', async () => {
      const { fixture } = await renderPlayer();
      const c = fixture.componentInstance;
      c.resizingFn({ rectangle: { width: 480 } });
      expect(c.autosizeSidenav).toBe(false);
      expect(c.sidenav.mode).toBe('push');
      expect(c.sidenavWidth).toBe(480);
    });

    it('resizingFn is a no-op when mini', async () => {
      const { fixture } = await renderPlayer();
      const c = fixture.componentInstance;
      c.miniSubject.next(true);
      c.resizingFn({ rectangle: { width: 480 } });
      expect(c.sidenavWidth).toBeUndefined();
    });

    it('resizeEnd restores the sidenav mode and persists the width', async () => {
      const { fixture } = await renderPlayer({ teamId: 'team-42' });
      const c = fixture.componentInstance;
      c.sidenavWidth = 360;
      c.resizeEnd({});
      expect(c.sidenav.mode).toBe('side');
      const persisted = JSON.parse(localStorage.getItem('team-42'));
      expect(persisted.width).toBe(360);
    });
  });

  it('setSidenavMode applies the configured mode to the sidenav', async () => {
    const { fixture } = await renderPlayer();
    const c = fixture.componentInstance;
    c.sidenav = { mode: 'push' } as never;
    c.sidenavMode = 'over';
    c.setSidenavMode();
    expect(c.sidenav.mode).toBe('over');
  });
});
