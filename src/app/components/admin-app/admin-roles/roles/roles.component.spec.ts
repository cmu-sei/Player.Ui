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
import { SystemRolesComponent } from './roles.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import {
  permissionApiStubs,
  permissionDataProviders,
} from 'src/app/test-utils/mock-permission-data.service';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { DialogService } from '../../../../services/dialog/dialog.service';
import {
  CreatePermissionCommand,
  CreateRoleCommand,
  EditRoleCommand,
  Permission,
  PermissionService,
  Role,
  RoleService,
  SystemPermission,
} from '../../../../generated/player-api';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltip, MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { dialogRefStub } from '../../../../test-utils/dialog-refs';

const mockPermissions: Permission[] = [
  {
    id: 'perm-1',
    name: 'ViewViews',
    description: 'Can view views',
    immutable: true,
  },
  {
    id: 'perm-2',
    name: 'ManageUsers',
    description: 'Can manage users',
    immutable: false,
  },
];

const mockRoles: Role[] = [
  {
    id: 'role-1',
    name: 'TestRole',
    immutable: false,
    allPermissions: false,
    permissions: [{ id: 'perm-1', name: 'ViewViews' }],
  },
];

// The component runs over the REAL RolesService and PermissionsService (the
// state under test); only the generated RoleService and PermissionService
// endpoints are stubbed. Each call returns a fresh object, because the
// services mutate what they store (Object.assign, push, in-place sort).
async function renderRoles(
  hasManageRoles = false,
  overrides: {
    nameResult?: { nameValue?: string } | null;
    confirmResult?: boolean;
    roles?: Role[];
  } = {},
) {
  const {
    nameResult = null,
    confirmResult = false,
    roles = mockRoles,
  } = overrides;

  const roleApi = {
    getRoles: vi.fn(() => of(structuredClone(roles))),
    updateRole: vi.fn((id: string, command?: EditRoleCommand) =>
      of<Role>({ ...structuredClone(command), id }),
    ),
    createRole: vi.fn((command?: CreateRoleCommand) =>
      of<Role>({
        id: 'role-new',
        name: command?.name,
        allPermissions: false,
        immutable: false,
        permissions: [],
      }),
    ),
    deleteRole: vi.fn((_id: string) => of(null)),
  } satisfies ApiStub<RoleService>;

  const permissionApi = {
    // getMyPermissions feeds the real UserPermissionsService (the gate).
    ...permissionApiStubs({
      // Denied is a near miss: read access to roles, not ManageRoles.
      system: hasManageRoles
        ? [SystemPermission.ManageRoles]
        : [SystemPermission.ViewRoles],
    }).permissions,
    getPermissions: vi.fn(() => of(structuredClone(mockPermissions))),
    createPermission: vi.fn((command?: CreatePermissionCommand) =>
      of<Permission>({ id: 'perm-new', name: command?.name, immutable: false }),
    ),
    addPermissionToRole: vi.fn((_roleId: string, _permissionId: string) =>
      of(null),
    ),
    removePermissionFromRole: vi.fn((_roleId: string, _permissionId: string) =>
      of(null),
    ),
  } satisfies ApiStub<PermissionService>;

  const dialogs = {
    name: vi.fn(() => of(nameResult)),
    confirm: vi.fn(
      () => dialogRefStub<unknown, boolean>(confirmResult).dialogRef,
    ),
  };

  const rendered = await renderComponent(SystemRolesComponent, {
    declarations: [SystemRolesComponent],
    imports: [
      MatIconModule,
      MatTooltipModule,
      MatButtonModule,
      MatTableModule,
      MatCheckboxModule,
    ],
    providers: [
      ...permissionDataProviders(),
      { provide: PermissionService, useValue: permissionApi },
      { provide: RoleService, useValue: roleApi },
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

  return { ...rendered, roleApi, permissionApi, dialogs };
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
  fixture: ComponentFixture<SystemRolesComponent>,
): HTMLButtonElement {
  const button = fixture.debugElement
    .queryAll(By.directive(MatTooltip))
    .find((el) => el.injector.get(MatTooltip).message === 'Add');
  if (!button) {
    throw new Error('No button with an "Add" tooltip was rendered');
  }
  return button.nativeElement as HTMLButtonElement;
}

// Matrix cell checkboxes in row order: All, then one per loaded permission.
function matrixCheckboxes(fixture: ComponentFixture<SystemRolesComponent>) {
  return TestbedHarnessEnvironment.loader(fixture).getAllHarnesses(
    MatCheckboxHarness,
  );
}

describe('SystemRolesComponent', () => {
  /**
   * Verifies: the "Permissions" matrix header is rendered.
   * Interacts with: the rendered DOM (queried via Testing Library screen).
   * Data: default renderRoles.
   */
  it('should show Permissions header', async () => {
    await renderRoles();
    expect(screen.getByText('Permissions')).toBeInTheDocument();
  });

  /**
   * Verifies: the roles and permissions loaded on init render as columns and rows.
   * Interacts with: the real RolesService.getRoles and PermissionsService.load over RoleService.getRoles and PermissionService.getPermissions stubs.
   * Data: mockRoles (single 'TestRole'); mockPermissions (ViewViews, ManageUsers).
   */
  it('should display the loaded role column and permission rows', async () => {
    const { roleApi, permissionApi } = await renderRoles();
    expect(roleApi.getRoles).toHaveBeenCalledTimes(1);
    expect(permissionApi.getPermissions).toHaveBeenCalledTimes(1);
    expect(roleHeaders()).toEqual(['TestRole']);
    expect(screen.getByRole('cell', { name: /ViewViews/ })).toBeInTheDocument();
    expect(
      screen.getByRole('cell', { name: /ManageUsers/ }),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: the Add button is enabled when the user holds ManageRoles.
   * Interacts with: the rendered header button; real UserPermissionsService over stubbed permission endpoints.
   * Data: renderRoles(true) — ManageRoles granted.
   */
  it('should enable Add button when user has ManageRoles permission', async () => {
    const { fixture } = await renderRoles(true);
    expect(getAddButton(fixture).disabled).toBe(false);
  });

  /**
   * Verifies: the Add button is disabled when the user lacks ManageRoles.
   * Interacts with: the rendered header button; real UserPermissionsService over stubbed permission endpoints.
   * Data: renderRoles(false) — ViewRoles granted, ManageRoles not (near miss).
   */
  it('should disable Add button when user lacks ManageRoles permission', async () => {
    const { fixture } = await renderRoles(false);
    expect(getAddButton(fixture).disabled).toBe(true);
  });

  /**
   * Verifies: Rename and Delete controls appear for a mutable role when ManageRoles is present.
   * Interacts with: the rendered DOM (queried by title).
   * Data: renderRoles(true); mockRoles role is non-immutable.
   */
  it('should show Rename and Delete buttons for non-immutable role when ManageRoles present', async () => {
    await renderRoles(true);
    expect(screen.getByTitle('Rename Role')).toBeInTheDocument();
    expect(screen.getByTitle('Delete Role')).toBeInTheDocument();
  });

  /**
   * Verifies: Rename and Delete controls are hidden when ManageRoles is absent.
   * Interacts with: the rendered DOM (queried by title).
   * Data: renderRoles(false).
   */
  it('should hide Rename and Delete buttons when ManageRoles absent', async () => {
    await renderRoles(false);
    expect(screen.queryByTitle('Rename Role')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete Role')).not.toBeInTheDocument();
  });

  describe('hasPermission()', () => {
    /**
     * Verifies: the synthetic "All" row reports its state from role.allPermissions rather than the list.
     * Interacts with: component.hasPermission (pure method).
     * Data: role with allPermissions=true; permission named 'All'.
     */
    it('reads allPermissions for the synthetic "All" row', async () => {
      const { fixture } = await renderRoles();
      const role: Role = { allPermissions: true, permissions: [] };
      expect(
        fixture.componentInstance.hasPermission({ name: 'All' }, role),
      ).toBe(true);
    });

    /**
     * Verifies: a normal permission is matched by id against the role's permission list (true present, false absent).
     * Interacts with: component.hasPermission (pure method).
     * Data: role with permission perm-1; queried for perm-1 (hit) and perm-x (miss).
     */
    it('checks the role permission list for a normal permission', async () => {
      const { fixture } = await renderRoles();
      const role: Role = { permissions: [{ id: 'perm-1' }] };
      expect(
        fixture.componentInstance.hasPermission(
          { id: 'perm-1', name: 'ViewViews' },
          role,
        ),
      ).toBe(true);
      expect(
        fixture.componentInstance.hasPermission(
          { id: 'perm-x', name: 'Other' },
          role,
        ),
      ).toBe(false);
    });
  });

  describe('permission matrix checkboxes', () => {
    /**
     * Verifies: each rendered checkbox reports the role's current state.
     * Interacts with: the rendered matrix through MatCheckboxHarness.
     * Data: renderRoles(true); rows are All (allPermissions false), ViewViews (held), ManageUsers (not held).
     * Why: pins the [checked]="hasPermission(permission, role)" binding — the calls-only tests below pass
     *   with that binding dropped.
     */
    it('reflects the role state in the rendered checkboxes', async () => {
      const { fixture } = await renderRoles(true);
      const [all, viewViews, manageUsers] = await matrixCheckboxes(fixture);
      expect(await all.isChecked()).toBe(false);
      expect(await viewViews.isChecked()).toBe(true);
      expect(await manageUsers.isChecked()).toBe(false);
    });

    /**
     * Verifies: checking a permission the role lacks adds it to that role, and the box stays checked.
     * Interacts with: the ManageUsers checkbox via MatCheckboxHarness; the real RolesService over PermissionService.addPermissionToRole.
     * Data: renderRoles(true); mockRoles holds perm-1 only, so perm-2 is the unheld row.
     * Why: drives the (change)="setPermission(permission, role, $event)" binding rather than calling the
     *   method directly — deleting that binding leaves every method-level test green.
     */
    it('checking a permission the role lacks adds it to the role', async () => {
      const { fixture, permissionApi } = await renderRoles(true);
      const [, , manageUsers] = await matrixCheckboxes(fixture);
      await manageUsers.check();
      expect(permissionApi.addPermissionToRole).toHaveBeenCalledWith(
        'role-1',
        'perm-2',
      );
      expect(permissionApi.removePermissionFromRole).not.toHaveBeenCalled();
      const [, viewViews, manageUsersAfter] = await matrixCheckboxes(fixture);
      expect(await viewViews.isChecked()).toBe(true);
      expect(await manageUsersAfter.isChecked()).toBe(true);
    });

    /**
     * Verifies: unchecking a permission the role holds removes it from that role, and the box stays unchecked.
     * Interacts with: the ViewViews checkbox via MatCheckboxHarness; the real RolesService over PermissionService.removePermissionFromRole.
     * Data: renderRoles(true); mockRoles holds perm-1, the checked row.
     */
    it('unchecking a permission the role holds removes it from the role', async () => {
      const { fixture, permissionApi } = await renderRoles(true);
      const [, viewViews] = await matrixCheckboxes(fixture);
      await viewViews.uncheck();
      expect(permissionApi.removePermissionFromRole).toHaveBeenCalledWith(
        'role-1',
        'perm-1',
      );
      expect(permissionApi.addPermissionToRole).not.toHaveBeenCalled();
      const [, viewViewsAfter] = await matrixCheckboxes(fixture);
      expect(await viewViewsAfter.isChecked()).toBe(false);
    });

    /**
     * Verifies: checking the synthetic All row saves the role with allPermissions set, and the
     *   per-permission boxes for that role disappear.
     * Interacts with: the All checkbox via MatCheckboxHarness; the real RolesService over RoleService.updateRole.
     * Data: renderRoles(true); the rendered role starts with allPermissions false.
     */
    it('checking the All row edits the role with allPermissions set', async () => {
      const { fixture, roleApi } = await renderRoles(true);
      const [all] = await matrixCheckboxes(fixture);
      await all.check();
      expect(roleApi.updateRole).toHaveBeenCalledWith(
        'role-1',
        expect.objectContaining({ id: 'role-1', allPermissions: true }),
      );
      // With allPermissions on, the template renders only the All box.
      const boxes = await matrixCheckboxes(fixture);
      expect(boxes).toHaveLength(1);
      expect(await boxes[0].isChecked()).toBe(true);
    });

    /**
     * Verifies: without ManageRoles every matrix checkbox renders disabled.
     * Interacts with: the rendered matrix through MatCheckboxHarness; real UserPermissionsService over stubbed permission endpoints.
     * Data: renderRoles(false) — three rows (All plus the two permissions).
     * Why: pins the [disabled] binding, the only thing keeping a read-only user from editing the matrix.
     */
    it('disables every checkbox when the user lacks ManageRoles', async () => {
      const { fixture } = await renderRoles(false);
      const boxes = await matrixCheckboxes(fixture);
      expect(boxes).toHaveLength(3);
      for (const box of boxes) {
        expect(await box.isDisabled()).toBe(true);
      }
    });
  });

  describe('addRole()', () => {
    /**
     * Verifies: clicking Add and naming the role creates it, and the new role column renders.
     * Interacts with: stubbed DialogService.name; the real RolesService.createRole over RoleService.createRole.
     * Data: nameResult override (nameValue 'New Role'); the API echoes it back as role-new.
     */
    it('creates a role when the dialog returns a name', async () => {
      const user = userEvent.setup();
      const { fixture, roleApi, dialogs } = await renderRoles(true, {
        nameResult: { nameValue: 'New Role' },
      });
      await user.click(getAddButton(fixture));
      expect(dialogs.name).toHaveBeenCalled();
      expect(roleApi.createRole).toHaveBeenCalledWith({ name: 'New Role' });
      expect(roleHeaders()).toEqual(['New Role', 'TestRole']);
    });

    /**
     * Verifies: a cancelled name dialog creates nothing and the columns stay as they were.
     * Interacts with: stubbed DialogService.name; RoleService.createRole stub (asserted not called).
     * Data: nameResult override null.
     */
    it('does nothing when the dialog is cancelled', async () => {
      const user = userEvent.setup();
      const { fixture, roleApi } = await renderRoles(true, {
        nameResult: null,
      });
      await user.click(getAddButton(fixture));
      expect(roleApi.createRole).not.toHaveBeenCalled();
      expect(roleHeaders()).toEqual(['TestRole']);
    });
  });

  /**
   * Verifies: clicking Add goes straight to the role-name dialog, so the Add Permission button never renders (current behavior).
   * Interacts with: the rendered Add button; stubbed DialogService.name.
   * Data: renderRoles(true); nameResult null (the dialog is cancelled).
   */
  it('never offers Add Permission, because the Add button skips the adding menu', async () => {
    const user = userEvent.setup();
    const { fixture, dialogs } = await renderRoles(true, { nameResult: null });
    await user.click(getAddButton(fixture));
    expect(dialogs.name).toHaveBeenCalledWith('Create New Role?', '', {
      nameValue: '',
    });
    expect(
      screen.queryByRole('button', { name: 'Add Permission' }),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: addPermission() creates a permission from the dialog's name, and its row renders.
   * Interacts with: stubbed DialogService.name; the real PermissionsService.createPermission over PermissionService.createPermission.
   * Data: nameResult override (nameValue 'New Perm').
   * Why: called directly, because the UI cannot reach it: the Add button opens the role dialog
   *   (see 'never offers Add Permission, because the Add button skips the adding menu').
   */
  it('addPermission() creates a permission from the dialog result', async () => {
    const { fixture, permissionApi } = await renderRoles(true, {
      nameResult: { nameValue: 'New Perm' },
    });
    fixture.componentInstance.addPermission();
    fixture.detectChanges();
    expect(permissionApi.createPermission).toHaveBeenCalledWith({
      name: 'New Perm',
    });
    expect(screen.getByRole('cell', { name: /New Perm/ })).toBeInTheDocument();
  });

  /**
   * Verifies: Rename Role saves the dialog's name, and the column header shows it.
   * Interacts with: stubbed DialogService.name; the real RolesService.editRole over RoleService.updateRole.
   * Data: nameResult override (nameValue 'Renamed'); role-1 starts as 'TestRole'.
   */
  it('renames the role from the dialog result', async () => {
    const user = userEvent.setup();
    const { roleApi } = await renderRoles(true, {
      nameResult: { nameValue: 'Renamed' },
    });
    await user.click(screen.getByTitle('Rename Role'));
    expect(roleApi.updateRole).toHaveBeenCalledWith(
      'role-1',
      expect.objectContaining({ id: 'role-1', name: 'Renamed' }),
    );
    expect(roleHeaders()).toEqual(['Renamed']);
  });

  describe('deleteRole()', () => {
    /**
     * Verifies: confirming Delete Role deletes it through the API and its column disappears.
     * Interacts with: stubbed CrucibleDialogService.confirm; the real RolesService.deleteRole over RoleService.deleteRole.
     * Data: confirmResult override true.
     */
    it('deletes when confirmed', async () => {
      const user = userEvent.setup();
      const { roleApi, dialogs } = await renderRoles(true, {
        confirmResult: true,
      });
      await user.click(screen.getByTitle('Delete Role'));
      expect(dialogs.confirm).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Delete Role?' }),
      );
      expect(roleApi.deleteRole).toHaveBeenCalledWith('role-1');
      expect(roleHeaders()).toEqual([]);
      expect(screen.queryByText('TestRole')).not.toBeInTheDocument();
    });

    /**
     * Verifies: a declined confirm dialog deletes nothing and the role column stays.
     * Interacts with: stubbed CrucibleDialogService.confirm; RoleService.deleteRole stub (asserted not called).
     * Data: confirmResult override false.
     */
    it('is a no-op when cancelled', async () => {
      const user = userEvent.setup();
      const { roleApi } = await renderRoles(true, {
        confirmResult: false,
      });
      await user.click(screen.getByTitle('Delete Role'));
      expect(roleApi.deleteRole).not.toHaveBeenCalled();
      expect(roleHeaders()).toEqual(['TestRole']);
    });
  });

  /**
   * Verifies: trackById returns the item's id for *ngFor identity tracking.
   * Interacts with: component.trackById (pure method).
   * Data: an object literal { id: 'abc' }.
   */
  it('trackById returns the item id', async () => {
    const { fixture } = await renderRoles();
    expect(fixture.componentInstance.trackById(0, { id: 'abc' })).toBe('abc');
  });
});
