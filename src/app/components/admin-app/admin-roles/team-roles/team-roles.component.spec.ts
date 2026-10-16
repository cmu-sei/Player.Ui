// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatCheckboxHarness } from '@angular/material/checkbox/testing';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { TeamRolesComponent } from './team-roles.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import {
  permissionApiStubs,
  permissionDataProviders,
} from 'src/app/test-utils/mock-permission-data.service';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { DialogService } from '../../../../services/dialog/dialog.service';
import {
  CreateTeamPermissionCommand,
  CreateTeamRoleCommand,
  EditTeamRoleCommand,
  SystemPermission,
  TeamPermissionModel,
  TeamPermissionService,
  TeamRole,
  TeamRoleService,
} from '../../../../generated/player-api';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltip, MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { dialogRefStub } from '../../../../test-utils/dialog-refs';

const mockTeamPermissions: TeamPermissionModel[] = [
  {
    id: 'tp-1',
    name: 'ViewTeam',
    description: 'Can view team',
    immutable: true,
  },
  {
    id: 'tp-2',
    name: 'ManageTeam',
    description: 'Can manage team',
    immutable: false,
  },
];

const mockTeamRoles: TeamRole[] = [
  {
    id: 'trole-1',
    name: 'TeamTestRole',
    immutable: false,
    allPermissions: false,
    permissions: [{ id: 'tp-1', name: 'ViewTeam' }],
  },
];

// The component runs over the REAL TeamRolesService and TeamPermissionsService
// (the state under test); only the generated TeamRoleService and
// TeamPermissionService endpoints are stubbed. Each call returns a fresh
// object, as the services mutate what they store.
async function renderTeamRoles(
  hasManageRoles = false,
  overrides: {
    nameResult?: { nameValue?: string } | null;
    confirmResult?: boolean;
    roles?: TeamRole[];
  } = {},
) {
  const {
    nameResult = null,
    confirmResult = false,
    roles = mockTeamRoles,
  } = overrides;

  const teamRoleApi = {
    getTeamRoles: vi.fn(() => of(structuredClone(roles))),
    updateTeamRole: vi.fn((id: string, command?: EditTeamRoleCommand) =>
      of<TeamRole>({ ...structuredClone(command), id }),
    ),
    createTeamRole: vi.fn((command?: CreateTeamRoleCommand) =>
      of<TeamRole>({
        id: 'trole-new',
        name: command?.name,
        allPermissions: false,
        immutable: false,
        permissions: [],
      }),
    ),
    deleteTeamRole: vi.fn((_id: string) => of(null)),
  } satisfies ApiStub<TeamRoleService>;

  const teamPermissionApi = {
    // getMyTeamPermissions feeds the real UserPermissionsService.
    ...permissionApiStubs().teamPermissions,
    getTeamPermissions: vi.fn(() => of(structuredClone(mockTeamPermissions))),
    createTeamPermission: vi.fn((command?: CreateTeamPermissionCommand) =>
      of<TeamPermissionModel>({
        id: 'tp-new',
        name: command?.name,
        immutable: false,
      }),
    ),
    addTeamPermissionToRole: vi.fn((_roleId: string, _permissionId: string) =>
      of(null),
    ),
    removeTeamPermissionFromRole: vi.fn(
      (_roleId: string, _permissionId: string) => of(null),
    ),
  } satisfies ApiStub<TeamPermissionService>;

  const dialogs = {
    name: vi.fn(() => of(nameResult)),
    confirm: vi.fn(
      () => dialogRefStub<unknown, boolean>(confirmResult).dialogRef,
    ),
  };

  const rendered = await renderComponent(TeamRolesComponent, {
    declarations: [TeamRolesComponent],
    imports: [
      MatIconModule,
      MatTooltipModule,
      MatButtonModule,
      MatTableModule,
      MatCheckboxModule,
    ],
    providers: [
      ...permissionDataProviders({
        // Denied is a near miss: read access to roles, not ManageRoles.
        system: hasManageRoles
          ? [SystemPermission.ManageRoles]
          : [SystemPermission.ViewRoles],
      }),
      { provide: TeamPermissionService, useValue: teamPermissionApi },
      { provide: TeamRoleService, useValue: teamRoleApi },
      {
        provide: DialogService,
        useValue: { name: dialogs.name } satisfies Pick<DialogService, 'name'>,
      },
      {
        provide: CrucibleDialogService,
        useValue: { confirm: dialogs.confirm } satisfies Pick<
          CrucibleDialogService,
          'confirm'
        >,
      },
    ],
  });

  return { ...rendered, teamRoleApi, teamPermissionApi, dialogs };
}

/** Column header names, in render order, excluding the Permissions column. */
function roleHeaders(): string[] {
  return screen
    .getAllByRole('columnheader')
    .map((th) => th.querySelector('p')?.textContent?.trim())
    .filter((name): name is string => !!name);
}

// The Add button carries [matTooltip]="adding ? 'Cancel' : 'Add'", so it is
// found by asking each MatTooltip directive for its message rather than by
// picking a position out of the header row's buttons.
function getAddButton(
  fixture: ComponentFixture<TeamRolesComponent>,
): HTMLButtonElement {
  const button = fixture.debugElement
    .queryAll(By.directive(MatTooltip))
    .find((el) => el.injector.get(MatTooltip).message === 'Add');
  if (!button) {
    throw new Error('No button with an "Add" tooltip was rendered');
  }
  return button.nativeElement as HTMLButtonElement;
}

// Matrix cell checkboxes in row order: All, then one per loaded team permission.
function matrixCheckboxes(fixture: ComponentFixture<TeamRolesComponent>) {
  return TestbedHarnessEnvironment.loader(fixture).getAllHarnesses(
    MatCheckboxHarness,
  );
}

describe('TeamRolesComponent', () => {
  /**
   * Verifies: the "Permissions" matrix header is rendered.
   * Interacts with: the rendered DOM (queried via Testing Library screen).
   * Data: default renderTeamRoles.
   */
  it('should show Permissions header', async () => {
    await renderTeamRoles();
    expect(screen.getByText('Permissions')).toBeInTheDocument();
  });

  /**
   * Verifies: the team roles and team permissions loaded on init render as columns and rows.
   * Interacts with: the real TeamRolesService.getRoles and TeamPermissionsService.load over the TeamRoleService.getTeamRoles and TeamPermissionService.getTeamPermissions stubs.
   * Data: mockTeamRoles (single 'TeamTestRole'); mockTeamPermissions (ViewTeam, ManageTeam).
   */
  it('should display the loaded team role column and permission rows', async () => {
    const { teamRoleApi, teamPermissionApi } = await renderTeamRoles();
    expect(teamRoleApi.getTeamRoles).toHaveBeenCalledTimes(1);
    expect(teamPermissionApi.getTeamPermissions).toHaveBeenCalledTimes(1);
    expect(roleHeaders()).toEqual(['TeamTestRole']);
    expect(
      screen.getByText('ViewTeam', { selector: 'td' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('ManageTeam', { selector: 'td' }),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: the Add button is enabled when the user holds ManageRoles.
   * Interacts with: the rendered header button; real UserPermissionsService over stubbed permission endpoints.
   * Data: renderTeamRoles(true) — ManageRoles granted.
   */
  it('should enable Add button when user has ManageRoles permission', async () => {
    const { fixture } = await renderTeamRoles(true);
    expect(getAddButton(fixture).disabled).toBe(false);
  });

  /**
   * Verifies: the Add button is disabled when the user lacks ManageRoles.
   * Interacts with: the rendered header button; real UserPermissionsService over stubbed permission endpoints.
   * Data: renderTeamRoles(false) — ViewRoles granted, ManageRoles not (near miss).
   */
  it('should disable Add button when user lacks ManageRoles permission', async () => {
    const { fixture } = await renderTeamRoles(false);
    expect(getAddButton(fixture).disabled).toBe(true);
  });

  /**
   * Verifies: Rename and Delete controls appear for a mutable team role when ManageRoles is present.
   * Interacts with: the rendered DOM (queried by title).
   * Data: renderTeamRoles(true); mockTeamRoles role is non-immutable.
   */
  it('should show Rename and Delete buttons for non-immutable role when ManageRoles present', async () => {
    await renderTeamRoles(true);
    expect(screen.getByTitle('Rename Role')).toBeInTheDocument();
    expect(screen.getByTitle('Delete Role')).toBeInTheDocument();
  });

  /**
   * Verifies: Rename and Delete controls are hidden when ManageRoles is absent.
   * Interacts with: the rendered DOM (queried by title).
   * Data: renderTeamRoles(false).
   */
  it('should hide Rename and Delete buttons when ManageRoles absent', async () => {
    await renderTeamRoles(false);
    expect(screen.queryByTitle('Rename Role')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete Role')).not.toBeInTheDocument();
  });

  describe('permission matrix checkboxes', () => {
    /**
     * Verifies: a role holding all permissions shows only its All box, checked.
     * Interacts with: the rendered matrix through MatCheckboxHarness.
     * Data: renderTeamRoles(true) with the role's allPermissions set.
     */
    it('shows only a checked All box for a role with all permissions', async () => {
      const { fixture } = await renderTeamRoles(true, {
        roles: [{ ...mockTeamRoles[0], allPermissions: true }],
      });
      const boxes = await matrixCheckboxes(fixture);
      expect(boxes).toHaveLength(1);
      expect(await boxes[0].isChecked()).toBe(true);
    });

    /**
     * Verifies: each rendered checkbox reports the team role's current state.
     * Interacts with: the rendered matrix through MatCheckboxHarness.
     * Data: renderTeamRoles(true); rows are All (allPermissions false), ViewTeam (held), ManageTeam (not held).
     */
    it('reflects the team role state in the rendered checkboxes', async () => {
      const { fixture } = await renderTeamRoles(true);
      const [all, viewTeam, manageTeam] = await matrixCheckboxes(fixture);
      expect(await all.isChecked()).toBe(false);
      expect(await viewTeam.isChecked()).toBe(true);
      expect(await manageTeam.isChecked()).toBe(false);
    });

    /**
     * Verifies: checking a permission the team role lacks adds it to that role, and the box stays checked.
     * Interacts with: the ManageTeam checkbox via MatCheckboxHarness; the real TeamRolesService over TeamPermissionService.addTeamPermissionToRole.
     * Data: renderTeamRoles(true); mockTeamRoles holds tp-1 only, so tp-2 is the unheld row.
     */
    it('checking a permission the role lacks adds it to the role', async () => {
      const { fixture, teamPermissionApi } = await renderTeamRoles(true);
      const [, , manageTeam] = await matrixCheckboxes(fixture);
      await manageTeam.check();
      expect(teamPermissionApi.addTeamPermissionToRole).toHaveBeenCalledWith(
        'trole-1',
        'tp-2',
      );
      expect(
        teamPermissionApi.removeTeamPermissionFromRole,
      ).not.toHaveBeenCalled();
      const [, viewTeam, manageTeamAfter] = await matrixCheckboxes(fixture);
      expect(await viewTeam.isChecked()).toBe(true);
      expect(await manageTeamAfter.isChecked()).toBe(true);
    });

    /**
     * Verifies: unchecking a permission the team role holds removes it from that role, and the box stays unchecked.
     * Interacts with: the ViewTeam checkbox via MatCheckboxHarness; the real TeamRolesService over TeamPermissionService.removeTeamPermissionFromRole.
     * Data: renderTeamRoles(true); mockTeamRoles holds tp-1, the checked row.
     */
    it('unchecking a permission the role holds removes it from the role', async () => {
      const { fixture, teamPermissionApi } = await renderTeamRoles(true);
      const [, viewTeam] = await matrixCheckboxes(fixture);
      await viewTeam.uncheck();
      expect(
        teamPermissionApi.removeTeamPermissionFromRole,
      ).toHaveBeenCalledWith('trole-1', 'tp-1');
      expect(teamPermissionApi.addTeamPermissionToRole).not.toHaveBeenCalled();
      const [, viewTeamAfter] = await matrixCheckboxes(fixture);
      expect(await viewTeamAfter.isChecked()).toBe(false);
    });

    /**
     * Verifies: checking the synthetic All row saves the team role by id with allPermissions set, and
     *   the per-permission boxes for that role disappear.
     * Interacts with: the All checkbox via MatCheckboxHarness; the real TeamRolesService over TeamRoleService.updateTeamRole.
     * Data: renderTeamRoles(true); the rendered role starts with allPermissions false.
     */
    it('checking the All row edits the role with allPermissions set', async () => {
      const { fixture, teamRoleApi } = await renderTeamRoles(true);
      const [all] = await matrixCheckboxes(fixture);
      await all.check();
      expect(teamRoleApi.updateTeamRole).toHaveBeenCalledWith(
        'trole-1',
        expect.objectContaining({ id: 'trole-1', allPermissions: true }),
      );
      // With allPermissions on, the template renders only the All box.
      const boxes = await matrixCheckboxes(fixture);
      expect(boxes).toHaveLength(1);
      expect(await boxes[0].isChecked()).toBe(true);
    });

    /**
     * Verifies: with ManageRoles every matrix checkbox of a mutable role renders enabled.
     * Interacts with: the rendered matrix through MatCheckboxHarness; real UserPermissionsService over stubbed permission endpoints.
     * Data: renderTeamRoles(true) — three rows (All plus the two team permissions).
     */
    it('enables every checkbox when the user has ManageRoles', async () => {
      const { fixture } = await renderTeamRoles(true);
      const boxes = await matrixCheckboxes(fixture);
      expect(boxes).toHaveLength(3);
      for (const box of boxes) {
        expect(await box.isDisabled()).toBe(false);
      }
    });

    /**
     * Verifies: without ManageRoles every matrix checkbox renders disabled.
     * Interacts with: the rendered matrix through MatCheckboxHarness; real UserPermissionsService over stubbed permission endpoints.
     * Data: renderTeamRoles(false) — three rows (All plus the two team permissions).
     */
    it('disables every checkbox when the user lacks ManageRoles', async () => {
      const { fixture } = await renderTeamRoles(false);
      const boxes = await matrixCheckboxes(fixture);
      expect(boxes).toHaveLength(3);
      for (const box of boxes) {
        expect(await box.isDisabled()).toBe(true);
      }
    });
  });

  describe('addRole()', () => {
    /**
     * Verifies: clicking Add and naming the team role creates it, and the new role column renders.
     * Interacts with: stubbed DialogService.name; the real TeamRolesService.createRole over TeamRoleService.createTeamRole.
     * Data: nameResult override (nameValue 'New Team Role'); the API echoes it back as trole-new.
     */
    it('creates a team role when the dialog returns a name', async () => {
      const user = userEvent.setup();
      const { fixture, teamRoleApi, dialogs } = await renderTeamRoles(true, {
        nameResult: { nameValue: 'New Team Role' },
      });
      await user.click(getAddButton(fixture));
      expect(dialogs.name).toHaveBeenCalled();
      expect(teamRoleApi.createTeamRole).toHaveBeenCalledWith({
        name: 'New Team Role',
      });
      expect(roleHeaders()).toEqual(['New Team Role', 'TeamTestRole']);
    });

    /**
     * Verifies: a cancelled name dialog creates nothing and the columns stay as they were.
     * Interacts with: stubbed DialogService.name; TeamRoleService.createTeamRole stub (asserted not called).
     * Data: nameResult override null.
     */
    it('does nothing when the dialog is cancelled', async () => {
      const user = userEvent.setup();
      const { fixture, teamRoleApi } = await renderTeamRoles(true, {
        nameResult: null,
      });
      await user.click(getAddButton(fixture));
      expect(teamRoleApi.createTeamRole).not.toHaveBeenCalled();
      expect(roleHeaders()).toEqual(['TeamTestRole']);
    });
  });

  /**
   * Verifies: clicking Add goes straight to the role-name dialog, so the Add Permission button never renders (current behavior).
   * Interacts with: the rendered Add button; stubbed DialogService.name.
   * Data: renderTeamRoles(true); nameResult null (the dialog is cancelled).
   */
  it('opens the role dialog straight from the Add button', async () => {
    const user = userEvent.setup();
    const { fixture, dialogs } = await renderTeamRoles(true, {
      nameResult: null,
    });
    await user.click(getAddButton(fixture));
    expect(dialogs.name).toHaveBeenCalledWith('Create New Team Role?', '', {
      nameValue: '',
    });
    // Current behavior; see agent-docs/ui-test-bugs/player.ui.md.
    expect(screen.queryByText('Add Permission')).not.toBeInTheDocument();
  });

  /**
   * Verifies: addPermission() creates a team permission from the dialog's name, and its row renders.
   * Interacts with: stubbed DialogService.name; the real TeamPermissionsService.createTeamPermission over TeamPermissionService.createTeamPermission.
   * Data: nameResult override (nameValue 'New Team Perm').
   *   Called directly, as no rendered control reaches it (see 'opens the role dialog straight from the Add button').
   */
  it('addPermission() creates a team permission from the dialog result', async () => {
    const { fixture, teamPermissionApi } = await renderTeamRoles(true, {
      nameResult: { nameValue: 'New Team Perm' },
    });
    fixture.componentInstance.addPermission();
    fixture.detectChanges();
    expect(teamPermissionApi.createTeamPermission).toHaveBeenCalledWith({
      name: 'New Team Perm',
    });
    expect(
      screen.getByText('New Team Perm', { selector: 'td' }),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: Rename Role saves the dialog's name by role id, and the column header shows it.
   * Interacts with: stubbed DialogService.name; the real TeamRolesService.editRole over TeamRoleService.updateTeamRole.
   * Data: nameResult override (nameValue 'Renamed'); trole-1 starts as 'TeamTestRole'.
   */
  it('renames the team role from the dialog result', async () => {
    const user = userEvent.setup();
    const { teamRoleApi } = await renderTeamRoles(true, {
      nameResult: { nameValue: 'Renamed' },
    });
    await user.click(screen.getByTitle('Rename Role'));
    expect(teamRoleApi.updateTeamRole).toHaveBeenCalledWith(
      'trole-1',
      expect.objectContaining({ id: 'trole-1', name: 'Renamed' }),
    );
    expect(roleHeaders()).toEqual(['Renamed']);
  });

  describe('deleteRole()', () => {
    /**
     * Verifies: confirming Delete Role deletes the team role through the API and its column disappears.
     * Interacts with: stubbed CrucibleDialogService.confirm; the real TeamRolesService.deleteRole over TeamRoleService.deleteTeamRole.
     * Data: confirmResult override true.
     */
    it('deletes when confirmed', async () => {
      const user = userEvent.setup();
      const { teamRoleApi, dialogs } = await renderTeamRoles(true, {
        confirmResult: true,
      });
      await user.click(screen.getByTitle('Delete Role'));
      expect(dialogs.confirm).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Delete Role?' }),
      );
      expect(teamRoleApi.deleteTeamRole).toHaveBeenCalledWith('trole-1');
      expect(roleHeaders()).toEqual([]);
      expect(screen.queryByText('TeamTestRole')).not.toBeInTheDocument();
    });

    /**
     * Verifies: a declined confirm dialog deletes nothing and the role column stays.
     * Interacts with: stubbed CrucibleDialogService.confirm; TeamRoleService.deleteTeamRole stub (asserted not called).
     * Data: confirmResult override false.
     */
    it('is a no-op when cancelled', async () => {
      const user = userEvent.setup();
      const { teamRoleApi } = await renderTeamRoles(true, {
        confirmResult: false,
      });
      await user.click(screen.getByTitle('Delete Role'));
      expect(teamRoleApi.deleteTeamRole).not.toHaveBeenCalled();
      expect(roleHeaders()).toEqual(['TeamTestRole']);
    });
  });
});
