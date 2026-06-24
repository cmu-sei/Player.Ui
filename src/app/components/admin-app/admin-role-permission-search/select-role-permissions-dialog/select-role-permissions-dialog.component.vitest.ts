// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { PermissionService } from '../../../../generated/player-api';
import { SelectRolePermissionsDialogComponent } from './select-role-permissions-dialog.component';
import { renderComponent } from '../../../../test-utils/render-component';

type Role = { id: string; name: string; permissions: { id: string }[] };

async function renderDialog(
  overrides: {
    role?: Role;
    permissions?: { id: string; name: string }[];
  } = {},
) {
  const {
    role = { id: 'r1', name: 'Admin', permissions: [{ id: 'p1' }] },
    permissions = [
      { id: 'p1', name: 'A' },
      { id: 'p2', name: 'B' },
    ],
  } = overrides;

  const close = vi.fn();
  const dialogRef = { close, disableClose: false } as unknown as MatDialogRef<
    SelectRolePermissionsDialogComponent
  >;

  const addPermissionToRole = vi.fn(() => of(undefined));
  const removePermissionFromRole = vi.fn(() => of(undefined));

  const rendered = await renderComponent(
    SelectRolePermissionsDialogComponent,
    {
      declarations: [SelectRolePermissionsDialogComponent],
      componentProperties: { role, permissions, title: 'Select Permissions' },
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: {} },
        {
          provide: PermissionService,
          useValue: { addPermissionToRole, removePermissionFromRole },
        },
      ],
    },
  );

  return {
    ...rendered,
    close,
    dialogRef,
    addPermissionToRole,
    removePermissionFromRole,
  };
}

describe('SelectRolePermissionsDialogComponent', () => {
  /**
   * Verifies: the dialog component instantiates successfully.
   * Interacts with: renderComponent with stubbed MatDialogRef, MAT_DIALOG_DATA, and PermissionService.
   * Data: default renderDialog overrides (role with one permission, two available permissions).
   */
  it('creates the component', async () => {
    const { fixture } = await renderDialog();
    expect(fixture.componentInstance).toBeTruthy();
  });

  /**
   * Verifies: the component forces disableClose=true on its injected MatDialogRef.
   * Interacts with: the stubbed MatDialogRef (initialized disableClose=false).
   * Data: default renderDialog overrides.
   */
  it('sets disableClose on the dialog ref', async () => {
    const { dialogRef } = await renderDialog();
    expect(dialogRef.disableClose).toBe(true);
  });

  /**
   * Verifies: on init selectedPermissions is populated with the ids of the role's existing permissions.
   * Interacts with: component init logic reading the role input.
   * Data: role override carrying permissions [p1, p3].
   */
  it('seeds selectedPermissions from role.permissions ids on init', async () => {
    const { fixture } = await renderDialog({
      role: {
        id: 'r1',
        name: 'Admin',
        permissions: [{ id: 'p1' }, { id: 'p3' }],
      },
    });
    expect(fixture.componentInstance.selectedPermissions).toEqual(['p1', 'p3']);
  });

  /**
   * Verifies: updateSelection calls addPermissionToRole and not the remove path when the id is new.
   * Interacts with: stubbed PermissionService.addPermissionToRole / removePermissionFromRole.
   * Data: role with only p1; selecting p2.
   */
  it('updateSelection adds a permission when the role does not already have it', async () => {
    const { fixture, addPermissionToRole, removePermissionFromRole } =
      await renderDialog({
        role: { id: 'r1', name: 'Admin', permissions: [{ id: 'p1' }] },
      });
    fixture.componentInstance.updateSelection('p2');
    expect(addPermissionToRole).toHaveBeenCalledWith('r1', 'p2');
    expect(removePermissionFromRole).not.toHaveBeenCalled();
  });

  /**
   * Verifies: updateSelection calls removePermissionFromRole and not the add path when the role has the id.
   * Interacts with: stubbed PermissionService.addPermissionToRole / removePermissionFromRole.
   * Data: role with p1; selecting p1.
   */
  it('updateSelection removes a permission when the role already has it', async () => {
    const { fixture, addPermissionToRole, removePermissionFromRole } =
      await renderDialog({
        role: { id: 'r1', name: 'Admin', permissions: [{ id: 'p1' }] },
      });
    fixture.componentInstance.updateSelection('p1');
    expect(removePermissionFromRole).toHaveBeenCalledWith('r1', 'p1');
    expect(addPermissionToRole).not.toHaveBeenCalled();
  });

  /**
   * Verifies: close() dismisses the dialog with an empty object (no result).
   * Interacts with: the stubbed MatDialogRef.close spy.
   * Data: default renderDialog overrides.
   */
  it('close() closes the dialog with an empty result', async () => {
    const { fixture, close } = await renderDialog();
    fixture.componentInstance.close();
    expect(close).toHaveBeenCalledWith({});
  });

  /**
   * Verifies: done() closes returning the current role wrapped as { role }.
   * Interacts with: the stubbed MatDialogRef.close spy.
   * Data: a Role fixture (id 'r1', one permission).
   */
  it('done() closes the dialog with the current role', async () => {
    const role: Role = {
      id: 'r1',
      name: 'Admin',
      permissions: [{ id: 'p1' }],
    };
    const { fixture, close } = await renderDialog({ role });
    fixture.componentInstance.done();
    expect(close).toHaveBeenCalledWith({ role });
  });
});
