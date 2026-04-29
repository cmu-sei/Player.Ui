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
  it('creates the component', async () => {
    const { fixture } = await renderDialog();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('sets disableClose on the dialog ref', async () => {
    const { dialogRef } = await renderDialog();
    expect(dialogRef.disableClose).toBe(true);
  });

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

  it('updateSelection adds a permission when the role does not already have it', async () => {
    const { fixture, addPermissionToRole, removePermissionFromRole } =
      await renderDialog({
        role: { id: 'r1', name: 'Admin', permissions: [{ id: 'p1' }] },
      });
    fixture.componentInstance.updateSelection('p2');
    expect(addPermissionToRole).toHaveBeenCalledWith('r1', 'p2');
    expect(removePermissionFromRole).not.toHaveBeenCalled();
  });

  it('updateSelection removes a permission when the role already has it', async () => {
    const { fixture, addPermissionToRole, removePermissionFromRole } =
      await renderDialog({
        role: { id: 'r1', name: 'Admin', permissions: [{ id: 'p1' }] },
      });
    fixture.componentInstance.updateSelection('p1');
    expect(removePermissionFromRole).toHaveBeenCalledWith('r1', 'p1');
    expect(addPermissionToRole).not.toHaveBeenCalled();
  });

  it('close() closes the dialog with an empty result', async () => {
    const { fixture, close } = await renderDialog();
    fixture.componentInstance.close();
    expect(close).toHaveBeenCalledWith({});
  });

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
