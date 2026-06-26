// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatTabsModule } from '@angular/material/tabs';
import {
  Permission,
  PermissionService,
  Role,
  RoleService,
} from '../../../generated/player-api';
import { DialogService } from '../../../services/dialog/dialog.service';
import { AdminRolePermissionSearchComponent } from './admin-role-permission-search.component';
import { renderComponent } from '../../../test-utils/render-component';

const permissions: Permission[] = [
  { id: 'p1', name: 'A', description: 'perm a' },
  { id: 'p2', name: 'B', description: 'perm b' },
];

const roles: Role[] = [
  { id: 'r1', name: 'Admin', permissions: [] },
  { id: 'r2', name: 'User', permissions: [] },
];

async function renderSearch(
  overrides: {
    confirmValue?: boolean;
    newPermissionKey?: string;
    newRoleName?: string;
  } = {},
) {
  const {
    confirmValue = true,
    newPermissionKey = 'new-key',
    newRoleName = 'New Role',
  } = overrides;

  const getPermissions = vi.fn(() => of(permissions));
  const createPermission = vi.fn(() => of({} as Permission));
  const updatePermission = vi.fn(() => of({} as Permission));
  const deletePermission = vi.fn(() => of(undefined));
  const getRoles = vi.fn(() => of(roles));
  const createRole = vi.fn(() => of({} as Role));
  const updateRole = vi.fn(() => of({} as Role));
  const deleteRole = vi.fn(() => of(undefined));

  const createPermissionDialog = vi.fn(() =>
    of({
      permission: {
        id: 'p1',
        key: newPermissionKey,
        name: newPermissionKey,
        description: 'd',
      },
    }),
  );
  const createRoleDialog = vi.fn(() => of({ name: newRoleName }));
  const confirmDialog = vi.fn(() => of(confirmValue));
  const selectRolePermissionsDialog = vi.fn(() => of({}));

  const rendered = await renderComponent(AdminRolePermissionSearchComponent, {
    declarations: [AdminRolePermissionSearchComponent],
    imports: [MatTableModule, MatSortModule, MatTabsModule],
    providers: [
      {
        provide: PermissionService,
        useValue: { getPermissions, createPermission, updatePermission, deletePermission },
      },
      {
        provide: RoleService,
        useValue: { getRoles, createRole, updateRole, deleteRole },
      },
      {
        provide: DialogService,
        useValue: {
          createPermission: createPermissionDialog,
          createRole: createRoleDialog,
          confirm: confirmDialog,
          selectRolePermissions: selectRolePermissionsDialog,
        },
      },
    ],
  });

  return {
    ...rendered,
    getPermissions,
    createPermission,
    updatePermission,
    deletePermission,
    getRoles,
    createRole,
    updateRole,
    deleteRole,
    createPermissionDialog,
    createRoleDialog,
    confirmDialog,
    selectRolePermissionsDialog,
  };
}

describe('AdminRolePermissionSearchComponent', () => {
  /**
   * Verifies: the component instantiates without error.
   * Interacts with: PermissionService, RoleService, DialogService stubs.
   * Data: default permissions and roles samples.
   */
  it('creates the component', async () => {
    const { fixture } = await renderSearch();
    expect(fixture.componentInstance).toBeTruthy();
  });

  /**
   * Verifies: init fetches permissions and roles and loads each into its table
   *   data source.
   * Interacts with: PermissionService.getPermissions + RoleService.getRoles spies.
   * Data: default permissions (two) and roles (two) samples.
   */
  it('loads permissions and roles on init', async () => {
    const { fixture, getPermissions, getRoles } = await renderSearch();
    expect(getPermissions).toHaveBeenCalled();
    expect(getRoles).toHaveBeenCalled();
    expect(fixture.componentInstance.permissionDataSource.data).toEqual(
      permissions,
    );
    expect(fixture.componentInstance.roleDataSource.data).toEqual(roles);
  });

  /**
   * Verifies: applyPermissionFilter lowercases the term into the data source
   *   filter while keeping the raw text in filterPermissionString.
   * Interacts with: component.applyPermissionFilter; permissionDataSource.filter.
   * Data: filter term 'FOO'.
   * Why: asserts the data source filter is 'foo' (lowercased) but the bound
   *      string stays 'FOO'.
   */
  it('filters permissions via applyPermissionFilter', async () => {
    const { fixture } = await renderSearch();
    fixture.componentInstance.applyPermissionFilter('FOO');
    expect(fixture.componentInstance.permissionDataSource.filter).toBe('foo');
    expect(fixture.componentInstance.filterPermissionString).toBe('FOO');
  });

  /**
   * Verifies: clearPermissionFilter blanks filterPermissionString after a prior
   *   filter.
   * Interacts with: component.applyPermissionFilter then clearPermissionFilter.
   * Data: initial filter 'x', then cleared.
   */
  it('clearPermissionFilter resets the filter', async () => {
    const { fixture } = await renderSearch();
    fixture.componentInstance.applyPermissionFilter('x');
    fixture.componentInstance.clearPermissionFilter();
    expect(fixture.componentInstance.filterPermissionString).toBe('');
  });

  /**
   * Verifies: applyRoleFilter lowercases the term into the role data source
   *   filter.
   * Interacts with: component.applyRoleFilter; roleDataSource.filter.
   * Data: filter term 'ADMIN' (asserted as 'admin').
   */
  it('filters roles via applyRoleFilter', async () => {
    const { fixture } = await renderSearch();
    fixture.componentInstance.applyRoleFilter('ADMIN');
    expect(fixture.componentInstance.roleDataSource.filter).toBe('admin');
  });

  /**
   * Verifies: addPermission opens the create dialog then posts the returned
   *   permission to the API.
   * Interacts with: DialogService.createPermission + PermissionService.createPermission spies.
   * Data: dialog returns a permission keyed 'new-key'.
   */
  it('addPermission opens the create dialog and posts the new permission', async () => {
    const { fixture, createPermission, createPermissionDialog } =
      await renderSearch();
    fixture.componentInstance.addPermission();
    expect(createPermissionDialog).toHaveBeenCalledWith('Add Permission', {});
    expect(createPermission).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'new-key' }),
    );
  });

  /**
   * Verifies: addPermission short-circuits without calling the API when the
   *   dialog returns a permission with a blank key.
   * Interacts with: DialogService.createPermission + PermissionService.createPermission spies.
   * Data: dialog returns empty key.
   * Why: createPermission.mockClear() drops the init-load calls so only
   *      addPermission-triggered calls are asserted.
   */
  it('addPermission exits early when the dialog returns a permission with no key', async () => {
    const { fixture, createPermission } = await renderSearch({
      newPermissionKey: '',
    });
    // Clear the initial-load calls so we only see what addPermission triggers.
    createPermission.mockClear();
    fixture.componentInstance.addPermission();
    expect(createPermission).not.toHaveBeenCalled();
  });

  /**
   * Verifies: executePermissionAction('delete') confirms first, then deletes by id.
   * Interacts with: DialogService.confirm + PermissionService.deletePermission spies.
   * Data: confirmValue = true; permissions[0] (id 'p1').
   */
  it('deletes a permission only after confirm', async () => {
    const { fixture, deletePermission, confirmDialog } = await renderSearch({
      confirmValue: true,
    });
    fixture.componentInstance.executePermissionAction('delete', permissions[0]);
    expect(confirmDialog).toHaveBeenCalled();
    expect(deletePermission).toHaveBeenCalledWith('p1');
  });

  /**
   * Verifies: declining the confirm dialog skips the permission delete.
   * Interacts with: DialogService.confirm + PermissionService.deletePermission spies.
   * Data: confirmValue = false; permissions[0].
   */
  it('does not delete a permission when confirm returns false', async () => {
    const { fixture, deletePermission } = await renderSearch({
      confirmValue: false,
    });
    fixture.componentInstance.executePermissionAction('delete', permissions[0]);
    expect(deletePermission).not.toHaveBeenCalled();
  });

  /**
   * Verifies: addRole posts the role when the create dialog returns a non-empty
   *   name.
   * Interacts with: DialogService.createRole + RoleService.createRole spies.
   * Data: dialog returns name 'Admin'.
   */
  it('addRole calls createRole when dialog returns a non-empty name', async () => {
    const { fixture, createRole } = await renderSearch({ newRoleName: 'Admin' });
    fixture.componentInstance.addRole();
    expect(createRole).toHaveBeenCalledWith({ name: 'Admin' });
  });

  /**
   * Verifies: addRole skips the API when the dialog returns an empty name.
   * Interacts with: DialogService.createRole + RoleService.createRole spies.
   * Data: dialog returns empty name.
   */
  it('addRole is a no-op when dialog returns empty name', async () => {
    const { fixture, createRole } = await renderSearch({ newRoleName: '' });
    fixture.componentInstance.addRole();
    expect(createRole).not.toHaveBeenCalled();
  });

  /**
   * Verifies: executeRoleAction('delete') deletes the role by id once confirmed.
   * Interacts with: DialogService.confirm + RoleService.deleteRole spies.
   * Data: confirmValue = true; roles[0] (id 'r1').
   */
  it('deletes a role only after confirm', async () => {
    const { fixture, deleteRole } = await renderSearch({ confirmValue: true });
    fixture.componentInstance.executeRoleAction('delete', roles[0]);
    expect(deleteRole).toHaveBeenCalledWith('r1');
  });

  /**
   * Verifies: executeRoleAction('select') opens the permission-picker dialog
   *   seeded with the role and the full permission list.
   * Interacts with: DialogService.selectRolePermissions spy.
   * Data: roles[0] passed alongside the default permissions sample.
   */
  it('executeRoleAction("select") opens the selectRolePermissions dialog', async () => {
    const { fixture, selectRolePermissionsDialog } = await renderSearch();
    fixture.componentInstance.executeRoleAction('select', roles[0]);
    expect(selectRolePermissionsDialog).toHaveBeenCalledWith(
      'Select Permissions',
      roles[0],
      permissions,
    );
  });

  /**
   * Verifies: clearRoleFilter blanks both filterRoleString and the role data
   *   source filter after a prior filter.
   * Interacts with: component.applyRoleFilter then clearRoleFilter.
   * Data: initial filter 'admin', then cleared.
   */
  it('clearRoleFilter resets the role filter', async () => {
    const { fixture } = await renderSearch();
    const c = fixture.componentInstance;
    c.applyRoleFilter('admin');
    c.clearRoleFilter();
    expect(c.filterRoleString).toBe('');
    expect(c.roleDataSource.filter).toBe('');
  });

  describe('editPermission()', () => {
    /**
     * Verifies: editPermission updates the permission by id with the name from
     *   the dialog.
     * Interacts with: DialogService.createPermission + PermissionService.updatePermission spies.
     * Data: dialog returns name 'Renamed'; permissions[0] (id 'p1').
     */
    it('updates the permission when the dialog returns a name', async () => {
      const { fixture, updatePermission } = await renderSearch({
        newPermissionKey: 'Renamed',
      });
      fixture.componentInstance.editPermission(permissions[0]);
      expect(updatePermission).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ name: 'Renamed' }),
      );
    });

    /**
     * Verifies: editPermission skips the update when the dialog returns an empty
     *   name.
     * Interacts with: PermissionService.updatePermission spy.
     * Data: dialog returns empty key/name.
     */
    it('is a no-op when the dialog returns an empty name', async () => {
      const { fixture, updatePermission } = await renderSearch({
        newPermissionKey: '',
      });
      fixture.componentInstance.editPermission(permissions[0]);
      expect(updatePermission).not.toHaveBeenCalled();
    });
  });

  /**
   * Verifies: executePermissionAction('edit') dispatches to editPermission and
   *   updates the permission.
   * Interacts with: PermissionService.updatePermission spy.
   * Data: dialog returns name 'Edited'; permissions[0].
   */
  it('executePermissionAction("edit") routes to editPermission', async () => {
    const { fixture, updatePermission } = await renderSearch({
      newPermissionKey: 'Edited',
    });
    fixture.componentInstance.executePermissionAction('edit', permissions[0]);
    expect(updatePermission).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ name: 'Edited' }),
    );
  });

  /**
   * Verifies: an unrecognized permission action triggers an "Unknown Action" alert.
   * Interacts with: window.alert spy.
   * Data: action 'bogus'.
   * Why: spies on window.alert and restores it after asserting.
   */
  it('executePermissionAction with an unknown action alerts', async () => {
    const { fixture } = await renderSearch();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    fixture.componentInstance.executePermissionAction('bogus', permissions[0]);
    expect(alertSpy).toHaveBeenCalledWith('Unknown Action');
    alertSpy.mockRestore();
  });

  describe('editRole()', () => {
    /**
     * Verifies: editRole updates the role by id with the name from the dialog.
     * Interacts with: DialogService.createRole + RoleService.updateRole spies.
     * Data: dialog returns name 'Renamed Role'; roles[0] (id 'r1').
     */
    it('updates the role when the dialog returns a name', async () => {
      const { fixture, updateRole } = await renderSearch({
        newRoleName: 'Renamed Role',
      });
      fixture.componentInstance.editRole(roles[0]);
      expect(updateRole).toHaveBeenCalledWith('r1', { name: 'Renamed Role' });
    });

    /**
     * Verifies: editRole skips the update when the dialog returns an empty name.
     * Interacts with: RoleService.updateRole spy.
     * Data: dialog returns empty name.
     */
    it('is a no-op when the dialog returns an empty name', async () => {
      const { fixture, updateRole } = await renderSearch({ newRoleName: '' });
      fixture.componentInstance.editRole(roles[0]);
      expect(updateRole).not.toHaveBeenCalled();
    });
  });

  /**
   * Verifies: executeRoleAction('edit') dispatches to editRole and updates the role.
   * Interacts with: RoleService.updateRole spy.
   * Data: dialog returns name 'Edited Role'; roles[0].
   */
  it('executeRoleAction("edit") routes to editRole', async () => {
    const { fixture, updateRole } = await renderSearch({
      newRoleName: 'Edited Role',
    });
    fixture.componentInstance.executeRoleAction('edit', roles[0]);
    expect(updateRole).toHaveBeenCalledWith('r1', { name: 'Edited Role' });
  });

  /**
   * Verifies: declining the confirm dialog skips the role delete.
   * Interacts with: DialogService.confirm + RoleService.deleteRole spies.
   * Data: confirmValue = false; roles[0].
   */
  it('does not delete a role when confirm returns false', async () => {
    const { fixture, deleteRole } = await renderSearch({ confirmValue: false });
    fixture.componentInstance.executeRoleAction('delete', roles[0]);
    expect(deleteRole).not.toHaveBeenCalled();
  });

  /**
   * Verifies: an unrecognized role action triggers an "Unknown Action" alert.
   * Interacts with: window.alert spy.
   * Data: action 'bogus'.
   * Why: spies on window.alert and restores it after asserting.
   */
  it('executeRoleAction with an unknown action alerts', async () => {
    const { fixture } = await renderSearch();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    fixture.componentInstance.executeRoleAction('bogus', roles[0]);
    expect(alertSpy).toHaveBeenCalledWith('Unknown Action');
    alertSpy.mockRestore();
  });
});
