// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogRef } from '@angular/material/dialog';
import {
  User,
  UserService,
  TeamService,
  TeamMembershipService,
  TeamMembership,
} from '../../../generated/player-api';
import { TeamRolesService } from '../../../services/roles/team-roles.service';
import {
  AddRemoveUsersDialogComponent,
  TeamUser,
} from './add-remove-users-dialog.component';
import { renderComponent } from '../../../test-utils/render-component';

const alice: User = { id: 'u1', name: 'Alice' };
const bob: User = { id: 'u2', name: 'Bob' };
const aliceMembership: TeamMembership = {
  id: 'm1',
  teamId: 't1',
  userId: 'u1',
  roleId: null,
};

async function renderDialog(
  overrides: { users?: User[]; teamUsers?: User[] } = {},
) {
  const { users = [alice, bob], teamUsers = [alice] } = overrides;

  const close = vi.fn();
  const dialogRef = { close, disableClose: false } as unknown as MatDialogRef<
    AddRemoveUsersDialogComponent
  >;

  const getUsers = vi.fn(() => of(users));
  const getTeamUsers = vi.fn(() => of(teamUsers));
  const addUserToTeam = vi.fn(() => of(undefined));
  const removeUserFromTeam = vi.fn(() => of(undefined));
  const getTeamMemberships = vi.fn(() => of([aliceMembership]));
  const updateTeamMembership = vi.fn(() => of(undefined));
  const getRoles = vi.fn(() => of([]));

  const rendered = await renderComponent(
    AddRemoveUsersDialogComponent,
    {
      declarations: [AddRemoveUsersDialogComponent],
      imports: [
        FormsModule,
        MatTableModule,
        MatSortModule,
        MatPaginatorModule,
        MatSelectModule,
      ],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        {
          provide: UserService,
          useValue: { getUsers, getTeamUsers, addUserToTeam, removeUserFromTeam },
        },
        { provide: TeamService, useValue: {} },
        {
          provide: TeamMembershipService,
          useValue: { getTeamMemberships, updateTeamMembership },
        },
        { provide: TeamRolesService, useValue: { getRoles } },
      ],
    },
  );

  return {
    ...rendered,
    close,
    dialogRef,
    getUsers,
    getTeamUsers,
    addUserToTeam,
    removeUserFromTeam,
    getTeamMemberships,
    updateTeamMembership,
    getRoles,
  };
}

// loadTeam / add / remove all read this.team.id and this.team.viewId.
const team = { id: 't1', name: 'Red', viewId: 'v1' };

// add/remove success paths focus the searchBox ViewChild; under CUSTOM_ELEMENTS_
// SCHEMA the #searchBox ref may be absent, so give the component a stub element.
function stubSearchBox(component: AddRemoveUsersDialogComponent) {
  component.searchBox = {
    nativeElement: { focus: () => undefined },
  } as never;
}

describe('AddRemoveUsersDialogComponent', () => {
  it('creates the component', async () => {
    const { fixture } = await renderDialog();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('sets disableClose on the dialog ref', async () => {
    const { dialogRef } = await renderDialog();
    expect(dialogRef.disableClose).toBe(true);
  });

  it('prepends a "None" role entry on init', async () => {
    const { fixture } = await renderDialog();
    expect(fixture.componentInstance.roles[0].name).toBe('None');
    expect(fixture.componentInstance.roles[0].id).toBe('');
  });

  it('applyFilter sets lowercase filter on userDataSource', async () => {
    const { fixture } = await renderDialog();
    fixture.componentInstance.applyFilter('ALICE');
    expect(fixture.componentInstance.filterString).toBe('ALICE');
    expect(fixture.componentInstance.userDataSource.filter).toBe('alice');
  });

  it('clearFilter resets the filter', async () => {
    const { fixture } = await renderDialog();
    fixture.componentInstance.applyFilter('x');
    fixture.componentInstance.clearFilter();
    expect(fixture.componentInstance.filterString).toBe('');
  });

  it('done() closes the dialog with the current teamUsers array', async () => {
    const { fixture, close } = await renderDialog();
    const tUser = new TeamUser('Alice', alice, aliceMembership);
    fixture.componentInstance.teamUserDataSource.data = [tUser];
    fixture.componentInstance.done();
    expect(close).toHaveBeenCalledWith({ teamUsers: [tUser] });
  });

  it('updateMembership persists the roleId (empty string coerced to null)', async () => {
    const { fixture, updateTeamMembership } = await renderDialog();
    const tUser = new TeamUser('Alice', alice, {
      ...aliceMembership,
      roleId: '',
    });
    fixture.componentInstance.updateMembership(tUser);
    expect(updateTeamMembership).toHaveBeenCalledWith('m1', { roleId: null });
  });

  it('updateMembership passes a non-empty roleId through unchanged', async () => {
    const { fixture, updateTeamMembership } = await renderDialog();
    const tUser = new TeamUser('Alice', alice, {
      ...aliceMembership,
      roleId: 'role-1',
    });
    fixture.componentInstance.updateMembership(tUser);
    expect(updateTeamMembership).toHaveBeenCalledWith('m1', {
      roleId: 'role-1',
    });
  });

  it('compare() returns 0 when either arg is null', async () => {
    const { fixture } = await renderDialog();
    expect(fixture.componentInstance.compare(null, 'x', true)).toBe(0);
    expect(fixture.componentInstance.compare('x', null, true)).toBe(0);
  });

  it('compare() orders case-insensitively ascending', async () => {
    const { fixture } = await renderDialog();
    expect(fixture.componentInstance.compare('alpha', 'BETA', true)).toBe(-1);
    expect(fixture.componentInstance.compare('BETA', 'alpha', true)).toBe(1);
  });

  it('addUserToTeam is a no-op while busy', async () => {
    const { fixture, addUserToTeam } = await renderDialog();
    fixture.componentInstance.isBusy = true;
    fixture.componentInstance.addUserToTeam(bob);
    expect(addUserToTeam).not.toHaveBeenCalled();
  });

  it('removeUserFromTeam is a no-op when user is not in team', async () => {
    const { fixture, removeUserFromTeam } = await renderDialog();
    fixture.componentInstance.teamUserDataSource.data = [];
    fixture.componentInstance.removeUserFromTeam(
      new TeamUser('Alice', alice, aliceMembership),
    );
    expect(removeUserFromTeam).not.toHaveBeenCalled();
  });

  describe('loadTeam()', () => {
    it('splits users into team members and the available pool', async () => {
      const { fixture, getTeamUsers } = await renderDialog({
        users: [alice, bob],
        teamUsers: [alice],
      });
      const c = fixture.componentInstance;
      c.loadTeam(team);
      expect(getTeamUsers).toHaveBeenCalledWith('t1');
      // Alice is a team member; the membership null roleId is coerced to ''.
      expect(c.teamUserDataSource.data.map((tu) => tu.user.id)).toEqual(['u1']);
      expect(c.teamUserDataSource.data[0].teamMembership.roleId).toBe('');
      // Bob is left in the available users pool, Alice removed from it.
      expect(c.userDataSource.data.map((u) => u.id)).toEqual(['u2']);
      expect(c.isLoading).toBe(false);
    });

    it('handles a team with no members (all users remain available)', async () => {
      const { fixture } = await renderDialog({
        users: [alice, bob],
        teamUsers: [],
      });
      const c = fixture.componentInstance;
      c.loadTeam(team);
      expect(c.teamUserDataSource.data).toEqual([]);
      expect(c.userDataSource.data.map((u) => u.id)).toEqual(['u1', 'u2']);
      expect(c.isLoading).toBe(false);
    });
  });

  describe('addUserToTeam()', () => {
    it('adds the user to the team list and removes them from the pool', async () => {
      const { fixture, addUserToTeam, getTeamMemberships } = await renderDialog();
      const c = fixture.componentInstance;
      c.team = team;
      stubSearchBox(c);
      c.teamUserDataSource.data = [];
      c.userDataSource.data = [bob];
      getTeamMemberships.mockReturnValueOnce(
        of([{ id: 'm2', teamId: 't1', userId: 'u2', roleId: null }]),
      );
      c.addUserToTeam(bob);
      expect(addUserToTeam).toHaveBeenCalledWith('t1', 'u2');
      expect(c.teamUserDataSource.data.map((tu) => tu.user.id)).toEqual(['u2']);
      expect(c.userDataSource.data.map((u) => u.id)).toEqual([]);
      expect(c.isBusy).toBe(false);
    });

    it('does nothing when the user is already on the team', async () => {
      const { fixture, addUserToTeam } = await renderDialog();
      const c = fixture.componentInstance;
      c.team = team;
      c.teamUserDataSource.data = [new TeamUser('Bob', bob, aliceMembership)];
      c.addUserToTeam(bob);
      expect(addUserToTeam).not.toHaveBeenCalled();
    });
  });

  describe('removeUserFromTeam()', () => {
    it('removes the user from the team and returns them to the pool', async () => {
      const { fixture, removeUserFromTeam } = await renderDialog();
      const c = fixture.componentInstance;
      c.team = team;
      stubSearchBox(c);
      const tUser = new TeamUser('Alice', alice, aliceMembership);
      c.teamUserDataSource.data = [tUser];
      c.userDataSource.data = [];
      c.removeUserFromTeam(tUser);
      expect(removeUserFromTeam).toHaveBeenCalledWith('t1', 'u1');
      expect(c.teamUserDataSource.data).toEqual([]);
      expect(c.userDataSource.data.map((u) => u.id)).toEqual(['u1']);
      expect(c.isBusy).toBe(false);
    });

    it('is a no-op while busy', async () => {
      const { fixture, removeUserFromTeam } = await renderDialog();
      const c = fixture.componentInstance;
      c.isBusy = true;
      c.teamUserDataSource.data = [new TeamUser('Alice', alice, aliceMembership)];
      c.removeUserFromTeam(new TeamUser('Alice', alice, aliceMembership));
      expect(removeUserFromTeam).not.toHaveBeenCalled();
    });
  });

  describe('uploadUsers()', () => {
    it('rejects a non-csv file', async () => {
      const { fixture, addUserToTeam } = await renderDialog();
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const file = new File(['data'], 'users.txt', { type: 'text/plain' });
      fixture.componentInstance.uploadUsers([file] as unknown as FileList);
      expect(alertSpy).toHaveBeenCalledWith('Please upload a csv file');
      expect(addUserToTeam).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });

    it('adds each user id parsed from the csv to the team', async () => {
      const { fixture, addUserToTeam, getTeamMemberships } = await renderDialog();
      const c = fixture.componentInstance;
      c.team = team;
      c.userDataSource.data = [alice, bob];
      c.teamUserDataSource.data = [];
      // uploadUsers() calls getTeamMemberships(viewId, userId) and matches on
      // userId, so return a membership keyed to the requested user — otherwise
      // the new row has no teamMembership and the role-cell template throws.
      getTeamMemberships.mockImplementation((_viewId: string, userId: string) =>
        of([{ id: `m-${userId}`, teamId: 't1', userId, roleId: null }]),
      );

      // FileReader is async; resolve when onload has fired.
      const file = new File(['u1\nu2\n'], 'users.csv', { type: 'text/csv' });
      c.uploadUsers([file] as unknown as FileList);
      await vi.waitFor(() => expect(addUserToTeam).toHaveBeenCalledTimes(2));
      expect(addUserToTeam).toHaveBeenCalledWith('t1', 'u1');
      expect(addUserToTeam).toHaveBeenCalledWith('t1', 'u2');
    });
  });
});
