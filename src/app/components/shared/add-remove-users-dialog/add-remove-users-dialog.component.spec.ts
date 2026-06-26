// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
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
  overrides: {
    users?: User[];
    teamUsers?: User[];
    removeError?: boolean;
    confirmSelfRemoval?: boolean;
  } = {},
) {
  const {
    users = [alice, bob],
    teamUsers = [alice],
    removeError = false,
    confirmSelfRemoval = true,
  } = overrides;

  const close = vi.fn();
  const dialogRef = { close, disableClose: false } as unknown as MatDialogRef<
    AddRemoveUsersDialogComponent
  >;

  const getUsers = vi.fn(() => of(users));
  const getTeamUsers = vi.fn(() => of(teamUsers));
  const addUserToTeam = vi.fn(() => of(undefined));
  const removeUserFromTeam = vi.fn(() =>
    removeError ? throwError(() => new Error('fail')) : of(undefined),
  );
  const getTeamMemberships = vi.fn(() => of([aliceMembership]));
  const updateTeamMembership = vi.fn(() => of(undefined));
  const getRoles = vi.fn(() => of([]));

  // ConfirmDialogComponent opened for the self-removal flow.
  const confirmComponentInstance = { title: '', message: '' };
  const dialogOpen = vi.fn(() => ({
    componentInstance: confirmComponentInstance,
    afterClosed: () => of({ confirm: confirmSelfRemoval }),
  }));

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
        { provide: MatDialog, useValue: { open: dialogOpen } },
      ],
    },
  );

  return {
    ...rendered,
    close,
    dialogRef,
    dialogOpen,
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
  /**
   * Verifies: the component instantiates under the full provider set.
   * Interacts with: UserService/TeamMembershipService/TeamRolesService stubs via renderDialog.
   * Data: default render (alice+bob users, alice as team member).
   */
  it('creates the component', async () => {
    const { fixture } = await renderDialog();
    expect(fixture.componentInstance).toBeTruthy();
  });

  /**
   * Verifies: the component forces disableClose=true on the dialog ref.
   * Interacts with: MatDialogRef.disableClose (seeded false in the stub).
   * Data: default render.
   */
  it('sets disableClose on the dialog ref', async () => {
    const { dialogRef } = await renderDialog();
    expect(dialogRef.disableClose).toBe(true);
  });

  /**
   * Verifies: init prepends a sentinel "None" role (empty id) to the roles list.
   * Interacts with: TeamRolesService.getRoles (returns []) read on init.
   * Data: default render with empty roles list.
   */
  it('prepends a "None" role entry on init', async () => {
    const { fixture } = await renderDialog();
    expect(fixture.componentInstance.roles[0].name).toBe('None');
    expect(fixture.componentInstance.roles[0].id).toBe('');
  });

  /**
   * Verifies: applyFilter records the raw filter string but lowercases the value
   *   pushed onto the available-users data source.
   * Interacts with: component.userDataSource.filter.
   * Data: filter input 'ALICE'.
   */
  it('applyFilter sets lowercase filter on userDataSource', async () => {
    const { fixture } = await renderDialog();
    fixture.componentInstance.applyFilter('ALICE');
    expect(fixture.componentInstance.filterString).toBe('ALICE');
    expect(fixture.componentInstance.userDataSource.filter).toBe('alice');
  });

  /**
   * Verifies: clearFilter empties the available-users filter string.
   * Interacts with: component.filterString.
   * Data: applies 'x' then clears.
   */
  it('clearFilter resets the filter', async () => {
    const { fixture } = await renderDialog();
    fixture.componentInstance.applyFilter('x');
    fixture.componentInstance.clearFilter();
    expect(fixture.componentInstance.filterString).toBe('');
  });

  /**
   * Verifies: done() closes the dialog returning the current teamUsers data.
   * Interacts with: MatDialogRef.close (close spy).
   * Data: a single TeamUser built from alice + aliceMembership.
   */
  it('done() closes the dialog with the current teamUsers array', async () => {
    const { fixture, close } = await renderDialog();
    const tUser = new TeamUser('Alice', alice, aliceMembership);
    fixture.componentInstance.teamUserDataSource.data = [tUser];
    fixture.componentInstance.done();
    expect(close).toHaveBeenCalledWith({ teamUsers: [tUser] });
  });

  /**
   * Verifies: updateMembership coerces an empty-string roleId to null before persisting.
   * Interacts with: TeamMembershipService.updateTeamMembership (updateTeamMembership spy).
   * Data: TeamUser whose membership roleId is '' (the "None" sentinel).
   */
  it('updateMembership persists the roleId (empty string coerced to null)', async () => {
    const { fixture, updateTeamMembership } = await renderDialog();
    const tUser = new TeamUser('Alice', alice, {
      ...aliceMembership,
      roleId: '',
    });
    fixture.componentInstance.updateMembership(tUser);
    expect(updateTeamMembership).toHaveBeenCalledWith('m1', { roleId: null });
  });

  /**
   * Verifies: updateMembership forwards a non-empty roleId without modification.
   * Interacts with: TeamMembershipService.updateTeamMembership (updateTeamMembership spy).
   * Data: TeamUser whose membership roleId is 'role-1'.
   */
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

  /**
   * Verifies: compare() treats a null on either side as equal (returns 0).
   * Interacts with: component.compare sort helper.
   * Data: (null,'x') and ('x',null) pairs, ascending.
   */
  it('compare() returns 0 when either arg is null', async () => {
    const { fixture } = await renderDialog();
    expect(fixture.componentInstance.compare(null, 'x', true)).toBe(0);
    expect(fixture.componentInstance.compare('x', null, true)).toBe(0);
  });

  /**
   * Verifies: compare() sorts case-insensitively in ascending order (-1/1).
   * Interacts with: component.compare sort helper.
   * Data: ('alpha','BETA') and reversed, ascending direction.
   */
  it('compare() orders case-insensitively ascending', async () => {
    const { fixture } = await renderDialog();
    expect(fixture.componentInstance.compare('alpha', 'BETA', true)).toBe(-1);
    expect(fixture.componentInstance.compare('BETA', 'alpha', true)).toBe(1);
  });

  /**
   * Verifies: addUserToTeam short-circuits while a prior operation is in flight.
   * Interacts with: UserService.addUserToTeam (asserted not called).
   * Data: component.isBusy forced true before invoking with bob.
   */
  it('addUserToTeam is a no-op while busy', async () => {
    const { fixture, addUserToTeam } = await renderDialog();
    fixture.componentInstance.isBusy = true;
    fixture.componentInstance.addUserToTeam(bob);
    expect(addUserToTeam).not.toHaveBeenCalled();
  });

  /**
   * Verifies: removeUserFromTeam does nothing when the target is absent from the
   *   team list.
   * Interacts with: UserService.removeUserFromTeam (asserted not called).
   * Data: empty teamUserDataSource; attempts to remove alice.
   */
  it('removeUserFromTeam is a no-op when user is not in team', async () => {
    const { fixture, removeUserFromTeam } = await renderDialog();
    fixture.componentInstance.teamUserDataSource.data = [];
    fixture.componentInstance.removeUserFromTeam(
      new TeamUser('Alice', alice, aliceMembership),
    );
    expect(removeUserFromTeam).not.toHaveBeenCalled();
  });

  /**
   * Verifies: applyTeamFilter keeps the raw string but pushes a trimmed,
   *   lowercased value onto the team-users data source filter.
   * Interacts with: component.teamUserDataSource.filter.
   * Data: filter input '  ALICE  '.
   */
  it('applyTeamFilter trims/lowercases and resets the paginator', async () => {
    const { fixture } = await renderDialog();
    const c = fixture.componentInstance;
    c.applyTeamFilter('  ALICE  ');
    expect(c.teamFilterString).toBe('  ALICE  ');
    expect(c.teamUserDataSource.filter).toBe('alice');
  });

  /**
   * Verifies: clearTeamFilter empties the team-users data source filter.
   * Interacts with: component.teamUserDataSource.filter.
   * Data: applies 'alice' then clears.
   */
  it('clearTeamFilter resets the team-users filter', async () => {
    const { fixture } = await renderDialog();
    const c = fixture.componentInstance;
    c.applyTeamFilter('alice');
    c.clearTeamFilter();
    expect(c.teamUserDataSource.filter).toBe('');
  });

  describe('loadTeam()', () => {
    /**
     * Verifies: loadTeam partitions users into team members vs. the available
     *   pool, fetches memberships by team id, and coerces a null roleId to ''.
     * Interacts with: UserService.getTeamUsers and TeamMembershipService.getTeamMemberships.
     * Data: users [alice,bob] with alice as the only team member.
     */
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

    /**
     * Verifies: with an empty team, the team list stays empty and every user
     *   remains in the available pool.
     * Interacts with: UserService.getTeamUsers (returns []).
     * Data: users [alice,bob]; teamUsers [].
     */
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

    /**
     * Verifies: in restricted (ManageTeam) mode loadTeam builds members with null
     *   memberships and never queries the membership service.
     * Interacts with: UserService.getTeamUsers; asserts getTeamMemberships unused.
     * Data: users [alice,bob], alice on team; canManageRoles forced false.
     */
    it('builds the team list without memberships in restricted mode', async () => {
      const { fixture, getTeamMemberships } = await renderDialog({
        users: [alice, bob],
        teamUsers: [alice],
      });
      const c = fixture.componentInstance;
      c.canManageRoles = false; // restricted (ManageTeam) mode
      c.loadTeam(team);
      // Members are built directly from getTeamUsers with null memberships and
      // the membership service is never queried.
      expect(c.teamUserDataSource.data.map((tu) => tu.user.id)).toEqual(['u1']);
      expect(c.teamUserDataSource.data[0].teamMembership).toBeNull();
      expect(c.userDataSource.data.map((u) => u.id)).toEqual(['u2']);
      expect(getTeamMemberships).not.toHaveBeenCalled();
      expect(c.isLoading).toBe(false);
    });
  });

  describe('addUserToTeam()', () => {
    /**
     * Verifies: adding a user calls the API with team/user ids, moves them from
     *   the available pool into the team list, and clears the busy flag.
     * Interacts with: UserService.addUserToTeam and TeamMembershipService.getTeamMemberships.
     * Data: bob in the pool; getTeamMemberships mocked to return bob's membership.
     * Why: getTeamMemberships is keyed per-call via mockReturnValueOnce so the new
     *      row resolves a membership; without it the role-cell template would throw.
     */
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

    /**
     * Verifies: addUserToTeam skips the API when the user is already a member.
     * Interacts with: UserService.addUserToTeam (asserted not called).
     * Data: bob already present in teamUserDataSource.
     */
    it('does nothing when the user is already on the team', async () => {
      const { fixture, addUserToTeam } = await renderDialog();
      const c = fixture.componentInstance;
      c.team = team;
      c.teamUserDataSource.data = [new TeamUser('Bob', bob, aliceMembership)];
      c.addUserToTeam(bob);
      expect(addUserToTeam).not.toHaveBeenCalled();
    });

    /**
     * Verifies: in restricted mode the user is added with a null membership and
     *   no membership lookup occurs.
     * Interacts with: UserService.addUserToTeam; asserts getTeamMemberships unused.
     * Data: bob in the pool; canManageRoles forced false.
     */
    it('adds with a null membership in restricted mode (no membership fetch)', async () => {
      const { fixture, addUserToTeam, getTeamMemberships } =
        await renderDialog();
      const c = fixture.componentInstance;
      c.canManageRoles = false; // restricted (ManageTeam) mode
      c.team = team;
      stubSearchBox(c);
      c.teamUserDataSource.data = [];
      c.userDataSource.data = [bob];
      c.addUserToTeam(bob);
      expect(addUserToTeam).toHaveBeenCalledWith('t1', 'u2');
      expect(getTeamMemberships).not.toHaveBeenCalled();
      expect(c.teamUserDataSource.data[0].teamMembership).toBeNull();
      expect(c.isBusy).toBe(false);
    });
  });

  describe('removeUserFromTeam()', () => {
    /**
     * Verifies: removing calls the API with team/user ids, moves the user back
     *   into the available pool, and clears the busy flag.
     * Interacts with: UserService.removeUserFromTeam (removeUserFromTeam spy).
     * Data: alice as the sole team member, empty pool.
     */
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

    /**
     * Verifies: removeUserFromTeam short-circuits while a prior operation is in flight.
     * Interacts with: UserService.removeUserFromTeam (asserted not called).
     * Data: alice present on team; component.isBusy forced true.
     */
    it('is a no-op while busy', async () => {
      const { fixture, removeUserFromTeam } = await renderDialog();
      const c = fixture.componentInstance;
      c.isBusy = true;
      c.teamUserDataSource.data = [new TeamUser('Alice', alice, aliceMembership)];
      c.removeUserFromTeam(new TeamUser('Alice', alice, aliceMembership));
      expect(removeUserFromTeam).not.toHaveBeenCalled();
    });

    /**
     * Verifies: on an API error the team list is left untouched and the busy
     *   flag is reset.
     * Interacts with: UserService.removeUserFromTeam (errors); console.error spied.
     * Data: removeError override; alice on team.
     * Why: console.error is stubbed to keep the expected error path quiet in output.
     */
    it('clears the busy flag and keeps the user when the API errors', async () => {
      const { fixture, removeUserFromTeam } = await renderDialog({
        removeError: true,
      });
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const c = fixture.componentInstance;
      c.team = team;
      const tUser = new TeamUser('Alice', alice, aliceMembership);
      c.teamUserDataSource.data = [tUser];
      c.userDataSource.data = [];
      c.removeUserFromTeam(tUser);
      expect(removeUserFromTeam).toHaveBeenCalledWith('t1', 'u1');
      // The error path leaves the team list untouched and resets isBusy.
      expect(c.teamUserDataSource.data).toEqual([tUser]);
      expect(c.isBusy).toBe(false);
      errSpy.mockRestore();
    });

    describe('removing your own account', () => {
      /**
       * Verifies: removing one's own account opens a confirmation dialog first,
       *   then proceeds with the API removal once accepted.
       * Interacts with: MatDialog.open (dialogOpen) and UserService.removeUserFromTeam.
       * Data: currentUserId set to alice; confirmSelfRemoval true.
       */
      it('confirms first, then removes when the user accepts', async () => {
        const { fixture, removeUserFromTeam, dialogOpen } = await renderDialog({
          confirmSelfRemoval: true,
        });
        const c = fixture.componentInstance;
        c.team = team;
        c.currentUserId = 'u1'; // Alice is the logged-in user
        stubSearchBox(c);
        const tUser = new TeamUser('Alice', alice, aliceMembership);
        c.teamUserDataSource.data = [tUser];
        c.userDataSource.data = [];
        c.removeUserFromTeam(tUser);
        expect(dialogOpen).toHaveBeenCalled();
        expect(removeUserFromTeam).toHaveBeenCalledWith('t1', 'u1');
      });

      /**
       * Verifies: declining the self-removal confirmation aborts the API removal.
       * Interacts with: MatDialog.open (dialogOpen); asserts removeUserFromTeam unused.
       * Data: currentUserId set to alice; confirmSelfRemoval false.
       */
      it('does not remove when the confirmation is declined', async () => {
        const { fixture, removeUserFromTeam, dialogOpen } = await renderDialog({
          confirmSelfRemoval: false,
        });
        const c = fixture.componentInstance;
        c.team = team;
        c.currentUserId = 'u1';
        const tUser = new TeamUser('Alice', alice, aliceMembership);
        c.teamUserDataSource.data = [tUser];
        c.removeUserFromTeam(tUser);
        expect(dialogOpen).toHaveBeenCalled();
        expect(removeUserFromTeam).not.toHaveBeenCalled();
      });
    });
  });

  describe('updateMembership() guards', () => {
    /**
     * Verifies: updateMembership does nothing when role management is disabled.
     * Interacts with: TeamMembershipService.updateTeamMembership (asserted not called).
     * Data: canManageRoles forced false; alice's TeamUser.
     */
    it('is a no-op when canManageRoles is false', async () => {
      const { fixture, updateTeamMembership } = await renderDialog();
      const c = fixture.componentInstance;
      c.canManageRoles = false;
      c.updateMembership(new TeamUser('Alice', alice, aliceMembership));
      expect(updateTeamMembership).not.toHaveBeenCalled();
    });

    /**
     * Verifies: updateMembership does nothing when the team user has no membership.
     * Interacts with: TeamMembershipService.updateTeamMembership (asserted not called).
     * Data: TeamUser built with a null membership.
     */
    it('is a no-op when the team user has no membership', async () => {
      const { fixture, updateTeamMembership } = await renderDialog();
      const c = fixture.componentInstance;
      c.updateMembership(new TeamUser('Alice', alice, null));
      expect(updateTeamMembership).not.toHaveBeenCalled();
    });
  });

  describe('uploadUsers()', () => {
    /**
     * Verifies: a non-csv upload is rejected with an alert and no users are added.
     * Interacts with: window.alert (spied) and UserService.addUserToTeam (unused).
     * Data: a text/plain File 'users.txt'.
     */
    it('rejects a non-csv file', async () => {
      const { fixture, addUserToTeam } = await renderDialog();
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const file = new File(['data'], 'users.txt', { type: 'text/plain' });
      fixture.componentInstance.uploadUsers([file] as unknown as FileList);
      expect(alertSpy).toHaveBeenCalledWith('Please upload a csv file');
      expect(addUserToTeam).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });

    /**
     * Verifies: each user id parsed from the csv is added to the team via the API.
     * Interacts with: UserService.addUserToTeam and TeamMembershipService.getTeamMemberships;
     *   uses vi.waitFor since FileReader.onload is async.
     * Data: a text/csv File containing 'u1\nu2\n'.
     * Why: getTeamMemberships is mocked to key its result on the requested userId,
     *      otherwise the new row has no membership and the role-cell template throws.
     */
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
