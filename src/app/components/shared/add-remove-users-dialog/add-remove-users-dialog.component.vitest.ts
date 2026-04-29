// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatDialogRef } from '@angular/material/dialog';
import {
  User,
  UserService,
  Team,
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

const team: Team = { id: 't1', name: 'Red', viewId: 'v1' };
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
      imports: [MatTableModule, MatSortModule, MatPaginatorModule],
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
    addUserToTeam,
    removeUserFromTeam,
    updateTeamMembership,
    getRoles,
  };
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
});
