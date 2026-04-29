// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { BehaviorSubject, EMPTY, of } from 'rxjs';
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
  } = {},
) {
  const { teamId = 'team-a' } = overrides;

  const displayMessage = vi.fn();
  const routerQuery = {
    getParams: () => 'view-1',
    selectQueryParams: () => EMPTY,
    select: () => EMPTY, // don't trigger loadData during these tests
  };

  const dialog = { open: vi.fn() };

  const rendered = await renderComponent(PlayerComponent, {
    declarations: [PlayerComponent],
    schemas: [NO_ERRORS_SCHEMA],
    providers: [
      { provide: Router, useValue: { serializeUrl: vi.fn(() => 'url'), createUrlTree: vi.fn() } },
      { provide: RouterQuery, useValue: routerQuery },
      { provide: ViewsService, useValue: { setPrimaryTeamId: vi.fn(() => of({})) } },
      { provide: ViewService, useValue: { getView: vi.fn(() => of({})) } },
      { provide: LoggedInUserService, useValue: { loggedInUser$: of({ profile: { sub: 'u1' } }) } },
      { provide: TeamService, useValue: { getMyViewTeams: vi.fn(() => of([])) } },
      {
        provide: ComnSettingsService,
        useValue: { settings: { AppTitle: 'Player' } },
      },
      { provide: MatDialog, useValue: dialog },
      { provide: SystemMessageService, useValue: { displayMessage } },
      { provide: ComnAuthQuery, useValue: { userTheme$: of('light-theme') } },
      {
        provide: UserPermissionsService,
        useValue: { loadTeamPermissions: () => of([]) },
      },
    ],
  });

  rendered.fixture.componentInstance.teamId = teamId;
  rendered.fixture.componentInstance.sidenav = {
    opened: true,
    mode: 'side',
  } as never;
  return { ...rendered, displayMessage, dialog };
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
});
