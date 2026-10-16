// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import {
  Team,
  TeamPermission,
  TeamPermissionsClaim,
  TeamPermissionService,
  TeamService,
  UserService,
  ViewPermission,
  ViewService,
} from '../../../generated/player-api';
import { DialogService } from '../../../services/dialog/dialog.service';
import { permissionDataProviders } from '../../../test-utils/mock-permission-data.service';
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

/** A claim for one team in view v1 carrying the given permission values. */
function claim(
  teamId: string,
  permissionValues: string[],
): TeamPermissionsClaim {
  return { viewId: 'v1', teamId, permissionValues };
}

async function renderManageTeams(
  overrides: {
    view?: unknown;
    viewError?: boolean;
    teams?: Team[];
    claims?: TeamPermissionsClaim[];
    teamUserCounts?: Record<string, number | 'error'>;
  } = {},
) {
  const {
    view = { id: 'v1', name: 'Demo View' },
    viewError = false,
    teams = [red, blue],
    claims = [
      claim('t1', [TeamPermission.ManageTeam]),
      claim('t2', [TeamPermission.ManageTeam]),
    ],
    teamUserCounts = { t1: 3, t2: 5 },
  } = overrides;

  const getView = vi.fn(() =>
    viewError ? throwError(() => new Error('404')) : of(view),
  );
  const getMyViewTeams = vi.fn(() => of(structuredClone(teams)));
  const getTeamUsers = vi.fn((teamId: string) => {
    const count = teamUserCounts[teamId];
    if (count === 'error') {
      return throwError(() => new Error('403'));
    }
    return of(new Array(count ?? 0).fill({ id: 'u' }));
  });
  // Typed to what the dialog closes with; see the typing note on the
  // DialogService stub in admin-view-edit.component.spec.ts.
  const addRemoveUsersToTeam = vi.fn(() =>
    of<{ teamUsers: TeamUser[] }>({ teamUsers: [] }),
  );

  // The real UserPermissionsService loads the claims and its
  // getManageableTeamIds decides which teams are listed.
  const permissions = permissionDataProviders({ teams: claims });

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
      { provide: MAT_DIALOG_DATA, useValue: { viewId: 'v1' } },
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
      ...permissions,
      {
        provide: DialogService,
        useValue: { addRemoveUsersToTeam },
      },
    ],
  });
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();

  return {
    ...rendered,
    getView,
    getMyViewTeams,
    getTeamUsers,
    addRemoveUsersToTeam,
  };
}

/** Team names of the rendered list items, in render order. */
function listedTeams(container: Element): string[] {
  return Array.from(container.querySelectorAll('[matlistitemtitle]')).map(
    (title) => title.textContent?.trim() ?? '',
  );
}

/** The member count shown on each listed team ('' when none is shown). */
function listedCounts(container: Element): string[] {
  return Array.from(container.querySelectorAll('button[mat-list-item]')).map(
    (item) =>
      item.querySelector('[matlistitemmeta]')?.textContent?.trim() ?? '',
  );
}

describe('ManageTeamsComponent', () => {
  /**
   * Verifies: the dialog title names the view.
   * Interacts with: ViewService.getView; the crucible-dialog title.
   * Data: view 'Demo View'.
   */
  it('shows the view name in the title', async () => {
    await renderManageTeams();
    expect(screen.getByRole('heading')).toHaveTextContent(
      'Manage Teams: Demo View',
    );
  });

  /**
   * Verifies: a failed view request leaves the title without a view name and the team list intact.
   * Interacts with: ViewService.getView (fails with a 404); the crucible-dialog title.
   * Data: viewError true.
   */
  it('keeps the title and the list when the view request fails', async () => {
    const { container } = await renderManageTeams({ viewError: true });
    expect(screen.getByRole('heading').textContent?.trim()).toBe(
      'Manage Teams:',
    );
    expect(listedTeams(container)).toEqual(['Blue', 'Red']);
  });

  /**
   * Verifies: teams the user holds ManageTeam on are listed by name with their member counts.
   * Interacts with: the real UserPermissionsService over TeamPermissionService.getMyTeamPermissions; TeamService.getMyViewTeams;
   *   UserService.getTeamUsers; the rendered list.
   * Data: Red (3 members) and Blue (5 members), both with ManageTeam claims.
   */
  it('lists the manageable teams by name with member counts', async () => {
    const { container } = await renderManageTeams();
    expect(listedTeams(container)).toEqual(['Blue', 'Red']);
    expect(listedCounts(container)).toEqual(['5', '3']);
  });

  /**
   * Verifies: a team the user reaches only through a scope is listed when its claim carries ManageTeam.
   * Interacts with: the real UserPermissionsService; TeamService.getMyViewTeams; UserService.getTeamUsers.
   * Data: Red (member) and Green (not a member), both with ManageTeam claims.
   */
  it('lists a manageable team the user is not a member of', async () => {
    const { container, getTeamUsers } = await renderManageTeams({
      teams: [red, green],
      claims: [
        claim('t1', [TeamPermission.ManageTeam]),
        claim('t3', [TeamPermission.ManageTeam]),
      ],
      teamUserCounts: { t1: 1, t3: 9 },
    });
    expect(listedTeams(container)).toEqual(['Green', 'Red']);
    expect(getTeamUsers).toHaveBeenCalledWith('t3');
  });

  /**
   * Verifies: a team whose claim lacks ManageTeam (near miss) is not listed and its members are never fetched.
   * Interacts with: the real UserPermissionsService.getManageableTeamIds over the claims; UserService.getTeamUsers; the rendered list.
   * Data: Red with ManageTeam; Blue with the row's near-miss permission instead.
   */
  it.each<[string, string[]]>([
    ['ViewTeam', [TeamPermission.ViewTeam]],
    ['ManageView', [ViewPermission.ManageView]],
    [
      'ViewView and ViewTeam',
      [ViewPermission.ViewView, TeamPermission.ViewTeam],
    ],
  ])(
    'hides a team whose claim holds only %s',
    async (_nearMiss, blueValues) => {
      const { container, getTeamUsers } = await renderManageTeams({
        claims: [
          claim('t1', [TeamPermission.ManageTeam]),
          claim('t2', blueValues),
        ],
      });
      expect(listedTeams(container)).toEqual(['Red']);
      expect(getTeamUsers).not.toHaveBeenCalledWith('t2');
    },
  );

  /**
   * Verifies: without a ManageTeam claim on any team the dialog says so, lists nothing and fetches no members.
   * Interacts with: the real UserPermissionsService; the empty-state card; UserService.getTeamUsers.
   * Data: Red and Blue with ViewTeam-only claims (near miss).
   */
  it('shows the no-permission message when no team is manageable', async () => {
    const { container, getTeamUsers } = await renderManageTeams({
      claims: [
        claim('t1', [TeamPermission.ViewTeam]),
        claim('t2', [TeamPermission.ViewTeam]),
      ],
    });
    expect(listedTeams(container)).toEqual([]);
    expect(
      screen.getByText(
        'You do not have permission to manage any Teams in this View.',
      ),
    ).toBeInTheDocument();
    expect(getTeamUsers).not.toHaveBeenCalled();
  });

  /**
   * Verifies: the dialog loads the user's claims for every team in the view, not just their own team.
   * Interacts with: the real UserPermissionsService.loadTeamPermissions over TeamPermissionService.getMyTeamPermissions.
   * Data: viewId 'v1'.
   */
  it('loads team claims for all teams in the view', async () => {
    await renderManageTeams();
    const teamPermissionsApi = TestBed.inject(TeamPermissionService);
    expect(teamPermissionsApi.getMyTeamPermissions).toHaveBeenCalledWith(
      'v1',
      undefined,
      true,
    );
  });

  /**
   * Verifies: a team whose member request is refused is still listed, without a count.
   * Interacts with: UserService.getTeamUsers (403 for Blue); the rendered list.
   * Data: Red 3 members; Blue's request fails with a 403.
   */
  it('lists a team without a count when its members cannot be read', async () => {
    const { container } = await renderManageTeams({
      teamUserCounts: { t1: 3, t2: 'error' },
    });
    expect(listedTeams(container)).toEqual(['Blue', 'Red']);
    expect(listedCounts(container)).toEqual(['', '3']);
  });

  /**
   * Verifies: clicking a team opens the add/remove users dialog with canManageRoles false (restricted mode), and the
   *   counts reload after it closes.
   * Interacts with: the rendered team button; DialogService.addRemoveUsersToTeam; UserService.getTeamUsers.
   * Data: Red clicked; Red has 4 members by the time the dialog closes.
   */
  it('opens the users dialog without role management and reloads the counts', async () => {
    const user = userEvent.setup();
    const { container, fixture, addRemoveUsersToTeam, getTeamUsers } =
      await renderManageTeams();
    getTeamUsers.mockImplementation((teamId: string) =>
      of(new Array(teamId === 't1' ? 4 : 5).fill({ id: 'u' })),
    );
    await user.click(screen.getByTitle('Add or remove users for Red'));
    expect(addRemoveUsersToTeam).toHaveBeenCalledExactlyOnceWith(
      'Add or Remove Users for team Red',
      expect.objectContaining({ id: 't1' }),
      { maxWidth: '100vw', width: 'auto', restoreFocus: false },
      false,
    );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(listedCounts(container)).toEqual(['5', '4']);
  });
});
