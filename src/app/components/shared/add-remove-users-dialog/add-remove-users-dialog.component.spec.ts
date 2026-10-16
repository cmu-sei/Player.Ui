// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { BehaviorSubject, firstValueFrom, NEVER, of, throwError } from 'rxjs';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSelectHarness } from '@angular/material/select/testing';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogRef } from '@angular/material/dialog';
import {
  CrucibleDialogService,
  CRUCIBLE_DIALOG_IMPORTS,
} from '@cmusei/crucible-common';
import type { User as AuthUser } from 'oidc-client-ts';
import {
  User,
  UserService,
  TeamMembershipService,
  TeamMembership,
  TeamRole,
  TeamRoleService,
} from '../../../generated/player-api';
import { TeamRolesService } from '../../../services/roles/team-roles.service';
import { LoggedInUserService } from '../../../services/logged-in-user/logged-in-user.service';
import { AddRemoveUsersDialogComponent } from './add-remove-users-dialog.component';
import { renderComponent } from '../../../test-utils/render-component';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { dialogRefStub } from '../../../test-utils/dialog-refs';
import { ApiStub } from '../../../test-utils/api-stub';
import {
  captureUnhandledRxErrors,
  flush,
} from '../../../test-utils/unhandled-rx-errors';

const alice: User = { id: 'u1', name: 'Alice' };
const bob: User = { id: 'u2', name: 'Bob' };
const carol: User = { id: 'u3', name: 'Carol' };

/** The membership the API returns for a user on team t1 with no role. */
function membership(userId: string, roleId: string | null = null) {
  return [{ id: `m-${userId}`, teamId: 't1', userId, roleId }];
}

// loadTeam reads team.id and team.viewId, as DialogService passes them.
const team = { id: 't1', name: 'Red', viewId: 'v1' };

const ALL_USERS = '.mat-table-all-users';
const TEAM_USERS = '.mat-table-team-users';

async function renderDialog(
  overrides: {
    users?: User[];
    teamUsers?: User[];
    canManageRoles?: boolean;
    currentUserId?: string;
    confirmSelfRemoval?: boolean;
    loadTeam?: boolean;
  } = {},
) {
  const {
    users = [alice, bob, carol],
    teamUsers = [alice],
    canManageRoles = true,
    currentUserId = 'someone-else',
    confirmSelfRemoval = true,
    loadTeam = true,
  } = overrides;

  const { dialogRef, close } = dialogRefStub<AddRemoveUsersDialogComponent>();

  const getUsers = vi.fn(() => of(structuredClone(users)));
  const getTeamUsers = vi.fn((_teamId: string) =>
    of(structuredClone(teamUsers)),
  );
  const addUserToTeam = vi.fn((_teamId: string, _userId: string) =>
    of(undefined),
  );
  const removeUserFromTeam = vi.fn((_teamId: string, _userId: string) =>
    of(undefined),
  );
  const getTeamMemberships = vi.fn((userId: string, _viewId: string) =>
    of<TeamMembership[]>(membership(userId)),
  );
  const updateTeamMembership = vi.fn(() => of(undefined));
  // The real TeamRolesService loads over this endpoint.
  const getTeamRoles = vi.fn(() =>
    of<TeamRole[]>([{ id: 'tr-1', name: 'Member', permissions: [] }]),
  );
  const confirm = vi.fn(
    () => dialogRefStub<unknown, boolean>(confirmSelfRemoval).dialogRef,
  );

  const rendered = await renderComponent(AddRemoveUsersDialogComponent, {
    declarations: [AddRemoveUsersDialogComponent],
    imports: [
      MatCardModule,
      MatChipsModule,
      MatFormFieldModule,
      MatIconModule,
      MatProgressSpinnerModule,
      MatToolbarModule,
      MatInputModule,
      MatTooltipModule,
      MatButtonModule,
      ...CRUCIBLE_DIALOG_IMPORTS,
      FormsModule,
      MatTableModule,
      MatSortModule,
      MatPaginatorModule,
      MatSelectModule,
    ],
    // DialogService.addRemoveUsersToTeam sets these before loadTeam.
    componentProperties: { title: 'Add or Remove Users', canManageRoles },
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      {
        provide: UserService,
        useValue: {
          getUsers,
          getTeamUsers,
          addUserToTeam,
          removeUserFromTeam,
        } satisfies ApiStub<UserService>,
      },
      {
        provide: TeamMembershipService,
        useValue: {
          getTeamMemberships,
          updateTeamMembership,
        } satisfies ApiStub<TeamMembershipService>,
      },
      {
        provide: TeamRoleService,
        useValue: { getTeamRoles } satisfies ApiStub<TeamRoleService>,
      },
      {
        provide: CrucibleDialogService,
        useValue: { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>,
      },
      {
        provide: LoggedInUserService,
        useValue: {
          loggedInUser$: new BehaviorSubject({
            profile: { sub: currentUserId },
          } as AuthUser),
        } satisfies Pick<LoggedInUserService, 'loggedInUser$'>,
      },
    ],
  });

  if (loadTeam) {
    // As DialogService.addRemoveUsersToTeam does after opening the dialog.
    rendered.fixture.componentInstance.loadTeam(team);
    rendered.fixture.detectChanges();
  }

  return {
    ...rendered,
    close,
    confirm,
    getUsers,
    getTeamUsers,
    addUserToTeam,
    removeUserFromTeam,
    getTeamMemberships,
    updateTeamMembership,
    getTeamRoles,
  };
}

/** User names listed in one of the two tables, in render order. */
function rowNames(container: Element, table: string): string[] {
  return Array.from(
    container.querySelectorAll(`${table} mat-row .mat-column-name > div`),
  ).map((cell) => cell.textContent?.trim() ?? '');
}

/** The add (All Users) or remove (Team Users) button on a user's row. */
function rowButton(
  container: Element,
  table: string,
  name: string,
): HTMLButtonElement {
  const row = Array.from(container.querySelectorAll(`${table} mat-row`)).find(
    (r) =>
      r.querySelector('.mat-column-name > div')?.textContent?.trim() === name,
  );
  const button = row?.querySelector<HTMLButtonElement>('button');
  if (!button) {
    throw new Error(`No ${name} row with a button in ${table}`);
  }
  return button;
}

/** Header cells of the Team Users table. */
function teamHeaders(container: Element): string[] {
  return Array.from(
    container.querySelectorAll(`${TEAM_USERS} mat-header-cell`),
  ).map((cell) => cell.textContent?.trim() ?? '');
}

describe('AddRemoveUsersDialogComponent', () => {
  /**
   * Verifies: loading the team lists its members, sorted by name, in Team Users and everyone else in All Users,
   *   with the spinners cleared.
   * Interacts with: UserService.getUsers and getTeamUsers; TeamMembershipService.getTeamMemberships; both tables.
   * Data: users Alice, Bob, Carol; team members Bob and Alice (unsorted).
   */
  it('lists the team members and the remaining users after loadTeam', async () => {
    const { container, getTeamUsers } = await renderDialog({
      teamUsers: [bob, alice],
    });
    expect(getTeamUsers).toHaveBeenCalledWith('t1');
    expect(rowNames(container, TEAM_USERS)).toEqual(['Alice', 'Bob']);
    expect(rowNames(container, ALL_USERS)).toEqual(['Carol']);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  /**
   * Verifies: Team Users is sorted by name ignoring case.
   * Interacts with: UserService.getTeamUsers; TeamMembershipService.getTeamMemberships; the Team Users table.
   * Data: one row per pair of members in mixed case, given in reverse order; a case-sensitive sort would list Bob
   *   before alice.
   */
  it.each<[string, User[], string[]]>([
    [
      'bob, Alice',
      [
        { id: 'u2', name: 'bob' },
        { id: 'u1', name: 'Alice' },
      ],
      ['Alice', 'bob'],
    ],
    [
      'Bob, alice',
      [
        { id: 'u2', name: 'Bob' },
        { id: 'u1', name: 'alice' },
      ],
      ['alice', 'Bob'],
    ],
  ])(
    'sorts the team members %s by name ignoring case',
    async (_case, members, expected) => {
      const { container } = await renderDialog({
        users: [...members, carol],
        teamUsers: members,
      });
      expect(rowNames(container, TEAM_USERS)).toEqual(expected);
      expect(rowNames(container, ALL_USERS)).toEqual(['Carol']);
    },
  );

  /**
   * Verifies: a team member without a name is listed by id, next to the named members, and the dialog finishes
   *   loading.
   * Interacts with: UserService.getUsers and getTeamUsers; TeamMembershipService.getTeamMemberships; both tables.
   * Data: users Alice, Bob, Carol and u4 (name null, as POST /api/users accepts); team members Bob and u4.
   */
  it('lists a team member without a name by id', async () => {
    const nameless: User = { id: 'u4', name: null };
    const { container } = await renderDialog({
      users: [alice, bob, carol, nameless],
      teamUsers: [bob, nameless],
    });
    expect(rowNames(container, TEAM_USERS)).toEqual(['Bob', 'u4']);
    expect(rowNames(container, ALL_USERS)).toEqual(['Alice', 'Carol']);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  /**
   * Verifies: an empty team shows "No results found" under Team Users and keeps every user in All Users.
   * Interacts with: UserService.getTeamUsers (returns []); both tables.
   * Data: users Alice, Bob, Carol; no team members.
   */
  it('shows an empty team with every user available', async () => {
    const { container } = await renderDialog({ teamUsers: [] });
    expect(rowNames(container, TEAM_USERS)).toEqual([]);
    expect(rowNames(container, ALL_USERS)).toEqual(['Alice', 'Bob', 'Carol']);
    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  /**
   * Verifies: with canManageRoles true (AdminViewEditComponent's default) the team table has a Role column with a
   *   role select per member, the CSV import is offered, and memberships are fetched to fill the selects.
   * Interacts with: the template's displayedTeamColumns and @if (canManageRoles); TeamMembershipService.getTeamMemberships;
   *   MatSelectHarness on the Team Users table.
   * Data: canManageRoles true; Alice on the team with no role.
   */
  it('offers the Role column and CSV import when canManageRoles is true', async () => {
    const { container, fixture, getTeamMemberships } = await renderDialog({
      canManageRoles: true,
    });
    expect(teamHeaders(container)).toContain('Role');
    expect(screen.getByText('Import Users')).toBeInTheDocument();
    expect(getTeamMemberships).toHaveBeenCalledWith('u1', 'v1');
    const select = await TestbedHarnessEnvironment.loader(fixture).getHarness(
      MatSelectHarness.with({ ancestor: TEAM_USERS }),
    );
    expect(await select.isDisabled()).toBe(false);
  });

  /**
   * Verifies: with canManageRoles false (ManageTeamsComponent's restricted mode) the team table has no Role column
   *   and no role select, the CSV import is hidden, memberships are never fetched, and the members still list.
   * Interacts with: the template's displayedTeamColumns and @if (canManageRoles); TeamMembershipService.getTeamMemberships.
   * Data: canManageRoles false, as DialogService sets it for ManageTeamsComponent; Alice on the team.
   */
  it('hides the Role column and CSV import when canManageRoles is false', async () => {
    const { container, getTeamMemberships } = await renderDialog({
      canManageRoles: false,
    });
    expect(rowNames(container, TEAM_USERS)).toEqual(['Alice']);
    expect(teamHeaders(container)).not.toContain('Role');
    expect(container.querySelector(`${TEAM_USERS} mat-select`)).toBeNull();
    expect(screen.queryByText('Import Users')).not.toBeInTheDocument();
    expect(getTeamMemberships).not.toHaveBeenCalled();
  });

  /**
   * Verifies: adding a user with canManageRoles false moves them into Team Users without a membership lookup or a
   *   role select.
   * Interacts with: the rendered add button; UserService.addUserToTeam; TeamMembershipService.getTeamMemberships.
   * Data: canManageRoles false; Bob added from All Users.
   */
  it('adds a user without a role select when canManageRoles is false', async () => {
    const user = userEvent.setup();
    const { container, addUserToTeam, getTeamMemberships } = await renderDialog(
      { canManageRoles: false },
    );
    await user.click(rowButton(container, ALL_USERS, 'Bob'));
    expect(addUserToTeam).toHaveBeenCalledWith('t1', 'u2');
    expect(rowNames(container, TEAM_USERS)).toEqual(['Alice', 'Bob']);
    expect(rowNames(container, ALL_USERS)).toEqual(['Carol']);
    expect(container.querySelector(`${TEAM_USERS} mat-select`)).toBeNull();
    expect(getTeamMemberships).not.toHaveBeenCalled();
  });

  /**
   * Verifies: adding a user with canManageRoles true fetches their membership and gives the new row a role select.
   * Interacts with: the rendered add button; UserService.addUserToTeam; TeamMembershipService.getTeamMemberships;
   *   MatSelectHarness on the Team Users table.
   * Data: canManageRoles true; Bob added from All Users.
   */
  it('adds a user with a role select when canManageRoles is true', async () => {
    const user = userEvent.setup();
    const { container, fixture, addUserToTeam, getTeamMemberships } =
      await renderDialog();
    await user.click(rowButton(container, ALL_USERS, 'Bob'));
    expect(addUserToTeam).toHaveBeenCalledWith('t1', 'u2');
    expect(getTeamMemberships).toHaveBeenCalledWith('u2', 'v1');
    expect(rowNames(container, TEAM_USERS)).toEqual(['Alice', 'Bob']);
    const selects = await TestbedHarnessEnvironment.loader(
      fixture,
    ).getAllHarnesses(MatSelectHarness.with({ ancestor: TEAM_USERS }));
    expect(selects).toHaveLength(2);
  });

  /**
   * Verifies: a second add while the first is still in flight is ignored.
   * Interacts with: the rendered add buttons; UserService.addUserToTeam (never completes).
   * Data: Bob clicked, then Carol, while Bob's request is pending.
   */
  it('ignores another add while one is in flight', async () => {
    const user = userEvent.setup();
    const { container, addUserToTeam } = await renderDialog();
    addUserToTeam.mockReturnValue(NEVER);
    await user.click(rowButton(container, ALL_USERS, 'Bob'));
    await user.click(rowButton(container, ALL_USERS, 'Carol'));
    expect(addUserToTeam).toHaveBeenCalledExactlyOnceWith('t1', 'u2');
  });

  /**
   * Verifies: removing a member moves them back to All Users.
   * Interacts with: the rendered remove button; UserService.removeUserFromTeam.
   * Data: Alice on the team, removed by another user.
   */
  it('removes a member and returns them to All Users', async () => {
    const user = userEvent.setup();
    const { container, removeUserFromTeam, confirm } = await renderDialog();
    await user.click(rowButton(container, TEAM_USERS, 'Alice'));
    expect(confirm).not.toHaveBeenCalled();
    expect(removeUserFromTeam).toHaveBeenCalledWith('t1', 'u1');
    expect(rowNames(container, TEAM_USERS)).toEqual([]);
    expect(rowNames(container, ALL_USERS)).toEqual(['Alice', 'Bob', 'Carol']);
  });

  /**
   * Verifies: a second remove while the first is still in flight is ignored, and both members stay listed.
   * Interacts with: the rendered remove buttons; UserService.removeUserFromTeam (never completes).
   * Data: Alice and Bob on the team; Alice's Remove clicked, then Bob's, while Alice's request is pending.
   */
  it('ignores another remove while one is in flight', async () => {
    const user = userEvent.setup();
    const { container, removeUserFromTeam } = await renderDialog({
      teamUsers: [alice, bob],
    });
    removeUserFromTeam.mockReturnValue(NEVER);
    await user.click(rowButton(container, TEAM_USERS, 'Alice'));
    await user.click(rowButton(container, TEAM_USERS, 'Bob'));
    expect(removeUserFromTeam).toHaveBeenCalledExactlyOnceWith('t1', 'u1');
    expect(rowNames(container, TEAM_USERS)).toEqual(['Alice', 'Bob']);
  });

  /**
   * Verifies: a failed removal logs the error, keeps the member on the team, and lets the next click try again.
   * Interacts with: the rendered remove button; UserService.removeUserFromTeam (fails once); console.error.
   * Data: Alice on the team; the first removal fails with a 500.
   */
  it('keeps the member and allows a retry when the removal fails', async () => {
    const user = userEvent.setup();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('500');
    const { container, removeUserFromTeam } = await renderDialog();
    removeUserFromTeam.mockReturnValueOnce(throwError(() => failure));
    await user.click(rowButton(container, TEAM_USERS, 'Alice'));
    expect(rowNames(container, TEAM_USERS)).toEqual(['Alice']);
    expect(logged.mock.calls).toEqual([
      ['Error removing user from team: ', failure],
    ]);
    await user.click(rowButton(container, TEAM_USERS, 'Alice'));
    expect(removeUserFromTeam).toHaveBeenCalledTimes(2);
    expect(rowNames(container, TEAM_USERS)).toEqual([]);
  });

  /**
   * Verifies: the logged-in user's own rows carry a "You" chip, and removing themselves asks first; accepting removes,
   *   declining keeps them.
   * Interacts with: LoggedInUserService.loggedInUser$; the rendered remove button; CrucibleDialogService.confirm;
   *   UserService.removeUserFromTeam.
   * Data: one row per answer; Alice (u1) is the logged-in user and on the team.
   */
  it.each<[string, boolean, string[]]>([
    ['removes after the user accepts', true, []],
    ['keeps the member after the user declines', false, ['Alice']],
  ])(
    'confirms before self-removal and %s',
    async (_outcome, accept, remaining) => {
      const user = userEvent.setup();
      const { container, confirm, removeUserFromTeam } = await renderDialog({
        currentUserId: 'u1',
        confirmSelfRemoval: accept,
      });
      expect(screen.getByText('You')).toBeInTheDocument();
      await user.click(rowButton(container, TEAM_USERS, 'Alice'));
      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Remove yourself from team?' }),
      );
      expect(removeUserFromTeam).toHaveBeenCalledTimes(accept ? 1 : 0);
      expect(rowNames(container, TEAM_USERS)).toEqual(remaining);
    },
  );

  /**
   * Verifies: choosing a role in a member's select saves it, and choosing None saves a null role.
   * Interacts with: MatSelectHarness on the Team Users table; TeamMembershipService.updateTeamMembership.
   * Data: Alice (membership m-u1, no role); Member chosen, then None.
   */
  it('saves the chosen role, and None as a null role', async () => {
    const { fixture, updateTeamMembership } = await renderDialog();
    const select = await TestbedHarnessEnvironment.loader(fixture).getHarness(
      MatSelectHarness.with({ ancestor: TEAM_USERS }),
    );
    await select.open();
    expect(
      await Promise.all((await select.getOptions()).map((o) => o.getText())),
    ).toEqual(['None', 'Member']);
    await select.clickOptions({ text: 'Member' });
    expect(updateTeamMembership).toHaveBeenLastCalledWith('m-u1', {
      roleId: 'tr-1',
    });
    await select.open();
    await select.clickOptions({ text: 'None' });
    expect(updateTeamMembership).toHaveBeenLastCalledWith('m-u1', {
      roleId: null,
    });
  });

  /**
   * Verifies: the "None" sentinel the dialog prepends lands in the shared TeamRolesService.roles$ stream (current behavior).
   * Interacts with: the real TeamRolesService over the TeamRoleService.getTeamRoles stub.
   * Data: one team role, Member.
   */
  it('leaks the "None" sentinel into TeamRolesService.roles$', async () => {
    await renderDialog();
    const roles = await firstValueFrom(TestBed.inject(TeamRolesService).roles$);
    // Current behavior; see agent-docs/ui-test-bugs/player.ui.md.
    expect(roles.map((r) => r.name)).toEqual(['Member', 'None']);
  });

  /**
   * Verifies: typing in the All Users search lists only matching users, case-insensitively, and the clear button
   *   lists everyone again.
   * Interacts with: the All Users Search field and its Clear Search button; the All Users table.
   * Data: available users Bob and Carol; 'BO' typed.
   */
  it('filters All Users by the typed text and clears the filter', async () => {
    const user = userEvent.setup();
    const { container } = await renderDialog();
    const [search] = screen.getAllByLabelText('Search');
    search.focus();
    await user.type(search, 'BO', { skipClick: true });
    expect(rowNames(container, ALL_USERS)).toEqual(['Bob']);
    await user.click(screen.getByTitle('Clear Search'));
    expect(rowNames(container, ALL_USERS)).toEqual(['Bob', 'Carol']);
    expect(screen.queryByTitle('Clear Search')).not.toBeInTheDocument();
  });

  /**
   * Verifies: typing in the Team Users search filters the members by name and sends the paginator back to the first
   *   page; the clear button lists everyone again.
   * Interacts with: the Team Users Search field, its Clear Search button, and the team paginator's Next page button.
   * Data: seven members Member 1..7 (page size 5); on page 2, 'member' typed (all seven still match).
   */
  it('filters Team Users and returns to the first page', async () => {
    const user = userEvent.setup();
    const members = Array.from({ length: 7 }, (_, i) => ({
      id: `m${i + 1}`,
      name: `Member ${i + 1}`,
    }));
    const { container } = await renderDialog({
      users: members,
      teamUsers: members,
      canManageRoles: false,
    });
    const [, nextTeamPage] = screen.getAllByLabelText('Next page');
    await user.click(nextTeamPage);
    expect(rowNames(container, TEAM_USERS)).toEqual(['Member 6', 'Member 7']);

    const [, search] = screen.getAllByLabelText('Search');
    search.focus();
    await user.type(search, 'MEMBER', { skipClick: true });
    expect(rowNames(container, TEAM_USERS)).toEqual([
      'Member 1',
      'Member 2',
      'Member 3',
      'Member 4',
      'Member 5',
    ]);
    await user.type(search, ' 7', { skipClick: true });
    expect(rowNames(container, TEAM_USERS)).toEqual(['Member 7']);
    await user.click(screen.getByTitle('Clear Search'));
    expect(rowNames(container, TEAM_USERS)).toHaveLength(5);
  });

  /**
   * Verifies: Done closes the dialog with the current team members.
   * Interacts with: the rendered Done button; MatDialogRef.close.
   * Data: Alice on the team; Bob added first.
   */
  it('closes with the team members from Done', async () => {
    const user = userEvent.setup();
    const { container, close } = await renderDialog({
      canManageRoles: false,
    });
    await user.click(rowButton(container, ALL_USERS, 'Bob'));
    await user.click(screen.getByText('Done'));
    expect(close).toHaveBeenCalledExactlyOnceWith({
      teamUsers: [
        expect.objectContaining({ user: alice }),
        expect.objectContaining({ user: bob }),
      ],
    });
  });

  describe('Import Users', () => {
    /**
     * Verifies: uploading a file that is not a csv alerts and adds nobody.
     * Interacts with: the hidden file input behind Import Users; window.alert; UserService.addUserToTeam.
     * Data: users.txt.
     */
    it('rejects a file that is not a csv', async () => {
      const user = userEvent.setup();
      const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const { container, addUserToTeam } = await renderDialog();
      await user.upload(
        container.querySelector<HTMLInputElement>('input[type="file"]')!,
        new File(['u2'], 'users.txt', { type: 'text/plain' }),
      );
      expect(alert).toHaveBeenCalledWith('Please upload a csv file');
      expect(addUserToTeam).not.toHaveBeenCalled();
    });

    /**
     * Verifies: every user id in an uploaded csv is added to the team and moves from All Users to Team Users.
     * Interacts with: the hidden file input behind Import Users; FileReader; UserService.addUserToTeam;
     *   TeamMembershipService.getTeamMemberships.
     * Data: users.csv with the lines u2 and u3 (Bob and Carol).
     */
    it('adds each user id in an uploaded csv', async () => {
      const user = userEvent.setup();
      const { container, fixture, addUserToTeam } = await renderDialog();
      await user.upload(
        container.querySelector<HTMLInputElement>('input[type="file"]')!,
        new File(['u2\nu3\n'], 'users.csv', { type: 'text/csv' }),
      );
      await vi.waitFor(() => expect(addUserToTeam).toHaveBeenCalledTimes(2));
      fixture.detectChanges();
      expect(addUserToTeam).toHaveBeenCalledWith('t1', 'u2');
      expect(addUserToTeam).toHaveBeenCalledWith('t1', 'u3');
      expect(rowNames(container, TEAM_USERS)).toEqual([
        'Alice',
        'Bob',
        'Carol',
      ]);
      expect(rowNames(container, ALL_USERS)).toEqual([]);
    });
  });

  describe('loadTeam() failures', () => {
    type Stubs = Awaited<ReturnType<typeof renderDialog>>;
    type Fail = (stubs: Stubs, failure: Error) => void;

    /**
     * Verifies: a failed request while loading the team leaves both loading spinners up and lets the error escape (current behavior).
     * Interacts with: the failing endpoint (UserService.getUsers, UserService.getTeamUsers or
     *   TeamMembershipService.getTeamMemberships); the rendered spinners; captureUnhandledRxErrors.
     * Data: Alice on the team; the row's endpoint fails with a 500 on its next call; loadTeam(team) as
     *   DialogService.addRemoveUsersToTeam calls it.
     */
    it.each<[string, Fail]>([
      [
        'getUsers',
        (stubs, failure) =>
          stubs.getUsers.mockReturnValueOnce(throwError(() => failure)),
      ],
      [
        'getTeamUsers',
        (stubs, failure) =>
          stubs.getTeamUsers.mockReturnValueOnce(throwError(() => failure)),
      ],
      [
        'getTeamMemberships',
        (stubs, failure) =>
          stubs.getTeamMemberships.mockReturnValueOnce(
            throwError(() => failure),
          ),
      ],
    ])('leaves the spinners up when %s fails', async (_endpoint, fail) => {
      const errors = captureUnhandledRxErrors();
      const failure = new Error('500');
      const stubs = await renderDialog({ loadTeam: false });
      fail(stubs, failure);
      stubs.fixture.componentInstance.loadTeam(team);
      stubs.fixture.detectChanges();
      await flush();
      // Current behavior; see agent-docs/ui-test-bugs/player.ui.md.
      expect(screen.getAllByRole('progressbar')).toHaveLength(2);
      expect(errors).toEqual([failure]);
    });
  });
});
