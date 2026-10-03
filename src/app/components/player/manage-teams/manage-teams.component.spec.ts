// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import {
  Team,
  TeamPermission,
  TeamPermissionService,
  TeamService,
  UserService,
  ViewService,
} from '../../../generated/player-api';
import { DialogService } from '../../../services/dialog/dialog.service';
import {
  permissionApiStubs,
  permissionDataProviders,
} from '../../../test-utils/mock-permission-data.service';
import { ApiStub } from '../../../test-utils/api-stub';
import { ManageTeamsComponent } from './manage-teams.component';
import { renderComponent } from '../../../test-utils/render-component';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import type { TeamUser } from '../../shared/add-remove-users-dialog/add-remove-users-dialog.component';

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
  } = {},
) {
  const {
    viewId = 'v1',
    view = { id: 'v1', name: 'Demo View' },
    viewError = false,
    teams = [red, blue],
    manageableIds = ['t1', 't2'],
    teamUserCounts = { t1: 3, t2: 5 },
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
  // The dialog closes with { teamUsers }, while DialogService declares
  // Observable<boolean>, so this stub is not checked against
  // Pick<DialogService, ...>.
  const addRemoveUsersToTeam = vi.fn(() =>
    of<{ teamUsers: TeamUser[] }>({ teamUsers: [] }),
  );

  // A ManageTeam claim per manageable team and a ViewTeam-only claim for every
  // other listed team, so the real getManageableTeamIds filter (not the claim
  // list) decides which teams the dialog shows.
  const grants = {
    teams: teams.map((team) => ({
      teamId: team.id,
      permissionValues: manageableIds.includes(team.id)
        ? [TeamPermission.ManageTeam]
        : [TeamPermission.ViewTeam],
    })),
  };
  const permissionStubs = permissionApiStubs(grants);

  const rendered = await renderComponent(ManageTeamsComponent, {
    imports: [
      MatListModule,
      MatCardModule,
      MatDialogModule,
      MatProgressSpinnerModule,
      MatButtonModule,
      ...CRUCIBLE_DIALOG_IMPORTS,
      ManageTeamsComponent,
    ],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: { viewId } },
      {
        provide: ViewService,
        useValue: { getView } satisfies ApiStub<ViewService>,
      },
      {
        provide: TeamService,
        useValue: { getMyViewTeams } satisfies ApiStub<TeamService>,
      },
      {
        provide: UserService,
        useValue: { getTeamUsers } satisfies ApiStub<UserService>,
      },
      ...permissionDataProviders(grants),
      // Same grants, exposed so a test can assert how the dialog loads claims.
      {
        provide: TeamPermissionService,
        useValue: permissionStubs.teamPermissions,
      },
      {
        provide: DialogService,
        useValue: { addRemoveUsersToTeam },
      },
    ],
  });

  return {
    ...rendered,
    getView,
    getMyViewTeams,
    getTeamUsers,
    addRemoveUsersToTeam,
    getMyTeamPermissions: permissionStubs.teamPermissions.getMyTeamPermissions,
  };
}

describe('ManageTeamsComponent', () => {
  /**
   * Verifies: the view signal resolves to the fetched view's name.
   * Interacts with: ViewService.getView, component's view resource/signal.
   * Data: default view { id: 'v1', name: 'Demo View' }.
   */
  it('exposes the view name via the view signal', async () => {
    const { fixture } = await renderManageTeams();
    await fixture.whenStable();
    expect(fixture.componentInstance['view']()?.name).toBe('Demo View');
  });

  /**
   * Verifies: the view signal becomes null when the view fetch errors.
   * Interacts with: ViewService.getView (errored), component view signal.
   * Data: renderManageTeams override viewError true (getView throws 404).
   */
  it('falls back to null when the view fetch errors', async () => {
    const { fixture } = await renderManageTeams({ viewError: true });
    await fixture.whenStable();
    expect(fixture.componentInstance['view']()).toBeNull();
  });

  /**
   * Verifies: teams signal lists manageable member teams alphabetically with per-team user counts.
   * Interacts with: TeamService.getMyViewTeams, UserService.getTeamUsers, the real UserPermissionsService.getManageableTeamIds over ManageTeam claims.
   * Data: default Red+Blue; asserts Blue sorts before Red and counts 3/5.
   */
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

  /**
   * Verifies: manageable scoped teams are included even when the user is not a direct member.
   * Interacts with: TeamService.getMyViewTeams, UserService.getTeamUsers spy.
   * Data: override Red(member)+Green(scoped), both manageable.
   */
  it('includes manageable scoped teams', async () => {
    const { fixture, getTeamUsers } = await renderManageTeams({
      teams: [red, green],
      manageableIds: ['t1', 't3'],
      teamUserCounts: { t1: 1, t3: 9 },
    });
    await fixture.whenStable();
    const teams = fixture.componentInstance['teams']();
    expect(teams.map((t) => t.team.id)).toEqual(['t3', 't1']);
    expect(getTeamUsers).toHaveBeenCalledWith('t3');
  });

  /**
   * Verifies: a team whose claim lacks ManageTeam is excluded, and its users are never fetched.
   * Interacts with: the real UserPermissionsService.getManageableTeamIds over the claims, UserService.getTeamUsers spy.
   * Data: Red (t1) with a ManageTeam claim, Blue (t2) with a ViewTeam-only claim; expects only t1.
   * Why: Blue still has a claim, so dropping the ManageTeam filter would list it.
   */
  it('excludes a team whose claim lacks ManageTeam', async () => {
    const { fixture, getTeamUsers } = await renderManageTeams({
      teams: [red, blue],
      manageableIds: ['t1'],
    });
    await fixture.whenStable();
    const teams = fixture.componentInstance['teams']();
    expect(teams.map((t) => t.team.id)).toEqual(['t1']);
    expect(getTeamUsers).not.toHaveBeenCalledWith('t2');
  });

  /**
   * Verifies: the dialog loads the user's claims for every team in the view, not just their own team.
   * Interacts with: the real UserPermissionsService.loadTeamPermissions, TeamPermissionService.getMyTeamPermissions stub.
   * Data: viewId 'v1'.
   * Why: scoped teams are only manageable when includeAllViewTeams is true.
   */
  it('loads team claims for all teams in the view', async () => {
    const { fixture, getMyTeamPermissions } = await renderManageTeams();
    await fixture.whenStable();
    expect(getMyTeamPermissions).toHaveBeenCalledWith('v1', undefined, true);
  });

  /**
   * Verifies: a team whose user fetch errors gets a null userCount rather than failing the whole load.
   * Interacts with: UserService.getTeamUsers (errored for one team), component teams signal.
   * Data: override teamUserCounts { t1: 3, t2: 'error' }; expects t2 userCount null.
   * Why: the 'error' sentinel makes the getTeamUsers stub throw 403 for that team to exercise the per-team error fallback.
   */
  it('degrades to a null member count when getTeamUsers 403s', async () => {
    const { fixture } = await renderManageTeams({
      teamUserCounts: { t1: 3, t2: 'error' },
    });
    await fixture.whenStable();
    const teams = fixture.componentInstance['teams']();
    expect(teams.find((t) => t.team.id === 't2')?.userCount).toBeNull();
  });

  /**
   * Verifies: an empty manageable id set yields an empty teams list with no user fetches.
   * Interacts with: the real UserPermissionsService.getManageableTeamIds over ManageTeam claims, UserService.getTeamUsers spy.
   * Data: override manageableIds []; expects [] and getTeamUsers never called.
   */
  it('produces an empty list when no teams are manageable', async () => {
    const { fixture, getTeamUsers } = await renderManageTeams({
      manageableIds: [],
    });
    await fixture.whenStable();
    expect(fixture.componentInstance['teams']()).toEqual([]);
    expect(getTeamUsers).not.toHaveBeenCalled();
  });

  describe('openUsersDialog()', () => {
    /**
     * Verifies: openUsersDialog opens the add/remove users dialog in restricted (non-role) mode and reloads teams on close.
     * Interacts with: DialogService.addRemoveUsersToTeam spy, spy on teamsResource.reload.
     * Data: default render; opens dialog for the Red team.
     * Why: asserts the final boolean arg is false to confirm canManageRoles=false drives the restricted ManageTeam mode.
     */
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
