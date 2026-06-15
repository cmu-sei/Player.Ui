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
  it('creates the component', async () => {
    const { fixture } = await renderSearch();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads permissions and roles on init', async () => {
    const { fixture, getPermissions, getRoles } = await renderSearch();
    expect(getPermissions).toHaveBeenCalled();
    expect(getRoles).toHaveBeenCalled();
    expect(fixture.componentInstance.permissionDataSource.data).toEqual(
      permissions,
    );
    expect(fixture.componentInstance.roleDataSource.data).toEqual(roles);
  });

  it('filters permissions via applyPermissionFilter', async () => {
    const { fixture } = await renderSearch();
    fixture.componentInstance.applyPermissionFilter('FOO');
    expect(fixture.componentInstance.permissionDataSource.filter).toBe('foo');
    expect(fixture.componentInstance.filterPermissionString).toBe('FOO');
  });

  it('clearPermissionFilter resets the filter', async () => {
    const { fixture } = await renderSearch();
    fixture.componentInstance.applyPermissionFilter('x');
    fixture.componentInstance.clearPermissionFilter();
    expect(fixture.componentInstance.filterPermissionString).toBe('');
  });

  it('filters roles via applyRoleFilter', async () => {
    const { fixture } = await renderSearch();
    fixture.componentInstance.applyRoleFilter('ADMIN');
    expect(fixture.componentInstance.roleDataSource.filter).toBe('admin');
  });

  it('addPermission opens the create dialog and posts the new permission', async () => {
    const { fixture, createPermission, createPermissionDialog } =
      await renderSearch();
    fixture.componentInstance.addPermission();
    expect(createPermissionDialog).toHaveBeenCalledWith('Add Permission', {});
    expect(createPermission).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'new-key' }),
    );
  });

  it('addPermission exits early when the dialog returns a permission with no key', async () => {
    const { fixture, createPermission } = await renderSearch({
      newPermissionKey: '',
    });
    // Clear the initial-load calls so we only see what addPermission triggers.
    createPermission.mockClear();
    fixture.componentInstance.addPermission();
    expect(createPermission).not.toHaveBeenCalled();
  });

  it('deletes a permission only after confirm', async () => {
    const { fixture, deletePermission, confirmDialog } = await renderSearch({
      confirmValue: true,
    });
    fixture.componentInstance.executePermissionAction('delete', permissions[0]);
    expect(confirmDialog).toHaveBeenCalled();
    expect(deletePermission).toHaveBeenCalledWith('p1');
  });

  it('does not delete a permission when confirm returns false', async () => {
    const { fixture, deletePermission } = await renderSearch({
      confirmValue: false,
    });
    fixture.componentInstance.executePermissionAction('delete', permissions[0]);
    expect(deletePermission).not.toHaveBeenCalled();
  });

  it('addRole calls createRole when dialog returns a non-empty name', async () => {
    const { fixture, createRole } = await renderSearch({ newRoleName: 'Admin' });
    fixture.componentInstance.addRole();
    expect(createRole).toHaveBeenCalledWith({ name: 'Admin' });
  });

  it('addRole is a no-op when dialog returns empty name', async () => {
    const { fixture, createRole } = await renderSearch({ newRoleName: '' });
    fixture.componentInstance.addRole();
    expect(createRole).not.toHaveBeenCalled();
  });

  it('deletes a role only after confirm', async () => {
    const { fixture, deleteRole } = await renderSearch({ confirmValue: true });
    fixture.componentInstance.executeRoleAction('delete', roles[0]);
    expect(deleteRole).toHaveBeenCalledWith('r1');
  });

  it('executeRoleAction("select") opens the selectRolePermissions dialog', async () => {
    const { fixture, selectRolePermissionsDialog } = await renderSearch();
    fixture.componentInstance.executeRoleAction('select', roles[0]);
    expect(selectRolePermissionsDialog).toHaveBeenCalledWith(
      'Select Permissions',
      roles[0],
      permissions,
    );
  });

  it('clearRoleFilter resets the role filter', async () => {
    const { fixture } = await renderSearch();
    const c = fixture.componentInstance;
    c.applyRoleFilter('admin');
    c.clearRoleFilter();
    expect(c.filterRoleString).toBe('');
    expect(c.roleDataSource.filter).toBe('');
  });

  describe('editPermission()', () => {
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

    it('is a no-op when the dialog returns an empty name', async () => {
      const { fixture, updatePermission } = await renderSearch({
        newPermissionKey: '',
      });
      fixture.componentInstance.editPermission(permissions[0]);
      expect(updatePermission).not.toHaveBeenCalled();
    });
  });

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

  it('executePermissionAction with an unknown action alerts', async () => {
    const { fixture } = await renderSearch();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    fixture.componentInstance.executePermissionAction('bogus', permissions[0]);
    expect(alertSpy).toHaveBeenCalledWith('Unknown Action');
    alertSpy.mockRestore();
  });

  describe('editRole()', () => {
    it('updates the role when the dialog returns a name', async () => {
      const { fixture, updateRole } = await renderSearch({
        newRoleName: 'Renamed Role',
      });
      fixture.componentInstance.editRole(roles[0]);
      expect(updateRole).toHaveBeenCalledWith('r1', { name: 'Renamed Role' });
    });

    it('is a no-op when the dialog returns an empty name', async () => {
      const { fixture, updateRole } = await renderSearch({ newRoleName: '' });
      fixture.componentInstance.editRole(roles[0]);
      expect(updateRole).not.toHaveBeenCalled();
    });
  });

  it('executeRoleAction("edit") routes to editRole', async () => {
    const { fixture, updateRole } = await renderSearch({
      newRoleName: 'Edited Role',
    });
    fixture.componentInstance.executeRoleAction('edit', roles[0]);
    expect(updateRole).toHaveBeenCalledWith('r1', { name: 'Edited Role' });
  });

  it('does not delete a role when confirm returns false', async () => {
    const { fixture, deleteRole } = await renderSearch({ confirmValue: false });
    fixture.componentInstance.executeRoleAction('delete', roles[0]);
    expect(deleteRole).not.toHaveBeenCalled();
  });

  it('executeRoleAction with an unknown action alerts', async () => {
    const { fixture } = await renderSearch();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    fixture.componentInstance.executeRoleAction('bogus', roles[0]);
    expect(alertSpy).toHaveBeenCalledWith('Unknown Action');
    alertSpy.mockRestore();
  });
});
