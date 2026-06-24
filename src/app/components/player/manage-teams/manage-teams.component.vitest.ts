// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import {
  Team,
  TeamService,
  UserService,
  ViewService,
} from '../../../generated/player-api';
import { DialogService } from '../../../services/dialog/dialog.service';
import { UserPermissionsService } from '../../../services/permissions/user-permissions.service';
import { ManageTeamsComponent } from './manage-teams.component';
import { renderComponent } from '../../../test-utils/render-component';

const red: Team = { id: 't1', name: 'Red', isMember: true } as Team;
const blue: Team = { id: 't2', name: 'Blue', isMember: true } as Team;
const green: Team = { id: 't3', name: 'Green', isMember: false } as Team;

async function renderManageTeams(
  overrides: {
    viewId?: string;
    view?: unknown;
    viewError?: boolean;
    teams?: Team[];
    manageableIds?: string[];
    teamUserCounts?: Record<string, number | 'error'>;
    addRemoveResult?: unknown;
  } = {},
) {
  const {
    viewId = 'v1',
    view = { id: 'v1', name: 'Demo View' },
    viewError = false,
    teams = [red, blue],
    manageableIds = ['t1', 't2'],
    teamUserCounts = { t1: 3, t2: 5 },
    addRemoveResult = true,
  } = overrides;

  const getView = vi.fn(() =>
    viewError ? throwError(() => new Error('404')) : of(view),
  );
  const getMyViewTeams = vi.fn(() => of(teams));
  const getTeamUsers = vi.fn((teamId: string) => {
    const count = teamUserCounts[teamId];
    if (count === 'error') {
      return throwError(() => new Error('403'));
    }
    return of(new Array(count ?? 0).fill({ id: 'u' }));
  });
  const loadTeamPermissions = vi.fn(() => of([{ teamId: 't1' }]));
  const getManageableTeamIds = vi.fn(() => manageableIds);
  const addRemoveUsersToTeam = vi.fn(() => of(addRemoveResult));

  const rendered = await renderComponent(ManageTeamsComponent, {
    imports: [ManageTeamsComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: { viewId } },
      { provide: ViewService, useValue: { getView } },
      { provide: TeamService, useValue: { getMyViewTeams } },
      { provide: UserService, useValue: { getTeamUsers } },
      {
        provide: UserPermissionsService,
        useValue: { loadTeamPermissions, getManageableTeamIds },
      },
      { provide: DialogService, useValue: { addRemoveUsersToTeam } },
    ],
  });

  return {
    ...rendered,
    getView,
    getMyViewTeams,
    getTeamUsers,
    loadTeamPermissions,
    getManageableTeamIds,
    addRemoveUsersToTeam,
  };
}

describe('ManageTeamsComponent', () => {
  it('creates the component', async () => {
    const { fixture } = await renderManageTeams();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('exposes the view name via the view signal', async () => {
    const { fixture } = await renderManageTeams();
    await fixture.whenStable();
    expect(fixture.componentInstance['view']()?.name).toBe('Demo View');
  });

  it('falls back to null when the view fetch errors', async () => {
    const { fixture } = await renderManageTeams({ viewError: true });
    await fixture.whenStable();
    expect(fixture.componentInstance['view']()).toBeNull();
  });

  it('loads manageable teams with member counts, sorted by name', async () => {
    const { fixture, getTeamUsers } = await renderManageTeams();
    await fixture.whenStable();
    const teams = fixture.componentInstance['teams']();
    // Blue sorts before Red despite Red being first in the source list.
    expect(teams.map((t) => t.team.name)).toEqual(['Blue', 'Red']);
    expect(teams.find((t) => t.team.id === 't1')?.userCount).toBe(3);
    expect(teams.find((t) => t.team.id === 't2')?.userCount).toBe(5);
    expect(getTeamUsers).toHaveBeenCalledWith('t1');
    expect(getTeamUsers).toHaveBeenCalledWith('t2');
  });

  it('excludes teams the user is not a member of', async () => {
    const { fixture, getTeamUsers } = await renderManageTeams({
      teams: [red, green],
      manageableIds: ['t1', 't3'],
      teamUserCounts: { t1: 1, t3: 9 },
    });
    await fixture.whenStable();
    const teams = fixture.componentInstance['teams']();
    expect(teams.map((t) => t.team.id)).toEqual(['t1']);
    // green (t3) is not a member, so its users are never fetched.
    expect(getTeamUsers).not.toHaveBeenCalledWith('t3');
  });

  it('excludes teams not present in the manageable id set', async () => {
    const { fixture } = await renderManageTeams({
      teams: [red, blue],
      manageableIds: ['t1'],
    });
    await fixture.whenStable();
    const teams = fixture.componentInstance['teams']();
    expect(teams.map((t) => t.team.id)).toEqual(['t1']);
  });

  it('degrades to a null member count when getTeamUsers 403s', async () => {
    const { fixture } = await renderManageTeams({
      teamUserCounts: { t1: 3, t2: 'error' },
    });
    await fixture.whenStable();
    const teams = fixture.componentInstance['teams']();
    expect(teams.find((t) => t.team.id === 't2')?.userCount).toBeNull();
  });

  it('produces an empty list when no teams are manageable', async () => {
    const { fixture, getTeamUsers } = await renderManageTeams({
      manageableIds: [],
    });
    await fixture.whenStable();
    expect(fixture.componentInstance['teams']()).toEqual([]);
    expect(getTeamUsers).not.toHaveBeenCalled();
  });

  describe('openUsersDialog()', () => {
    it('opens the add/remove dialog in restricted mode and reloads on close', async () => {
      const { fixture, addRemoveUsersToTeam } = await renderManageTeams();
      await fixture.whenStable();
      const c = fixture.componentInstance;
      const reload = vi.spyOn(c['teamsResource'], 'reload');
      c.openUsersDialog(red);
      expect(addRemoveUsersToTeam).toHaveBeenCalledWith(
        'Add or Remove Users for team Red',
        red,
        expect.objectContaining({ width: 'auto' }),
        false, // canManageRoles=false → restricted (ManageTeam) mode
      );
      expect(reload).toHaveBeenCalled();
    });
  });
});
