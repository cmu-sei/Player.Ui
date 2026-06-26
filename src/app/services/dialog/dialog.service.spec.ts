// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, firstValueFrom } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { DialogService } from './dialog.service';
import { ConfirmDialogComponent } from '../../components/shared/confirm-dialog/confirm-dialog.component';
import { NameDialogComponent } from '../../components/shared/name-dialog/name-dialog.component';
import { CreatePermissionDialogComponent } from '../../components/admin-app/admin-role-permission-search/create-permission-dialog/create-permission-dialog.component';
import { CreateRoleDialogComponent } from '../../components/admin-app/admin-role-permission-search/create-role-dialog/create-role-dialog.component';
import { SelectRolePermissionsDialogComponent } from '../../components/admin-app/admin-role-permission-search/select-role-permissions-dialog/select-role-permissions-dialog.component';
import { AddRemoveUsersDialogComponent } from '../../components/shared/add-remove-users-dialog/add-remove-users-dialog.component';
import { EditFileDialogComponent } from '../../components/shared/edit-file-dialog/edit-file-dialog.component';
import { EditSubscriptionComponent } from '../../components/admin-app/app-admin-subscription-search/edit-subscription/edit-subscription.component';
import { CreateApplicationDialogComponent } from '../../components/shared/create-application-dialog/create-application-dialog.component';
import { Team, FileModel } from '../../generated/player-api';

// Each open() returns a fake dialog ref whose componentInstance is a plain
// object that captures whatever DialogService assigns to it, plus an
// afterClosed() we control. This lets us assert which component was opened,
// what config it got, and which inputs were set — without rendering anything.
function setup(closedWith: unknown = true) {
  const componentInstance: Record<string, unknown> & {
    loadTeam?: ReturnType<typeof vi.fn>;
  } = { loadTeam: vi.fn() };
  const afterClosed = vi.fn(() => of(closedWith));
  const dialogRef = { componentInstance, afterClosed };
  const open = vi.fn(() => dialogRef);

  TestBed.configureTestingModule({
    providers: [
      { provide: MatDialog, useValue: { open } },
      DialogService,
    ],
  });

  const service = TestBed.inject(DialogService);
  return { service, open, componentInstance, afterClosed };
}

describe('DialogService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  /**
   * Verifies: confirm() opens ConfirmDialogComponent with the given data, assigns title/message onto the instance, and resolves to the afterClosed value
   * Interacts with: MatDialog.open stub returning the fake dialogRef; service.confirm
   * Data: title/message strings plus a { foo: 1 } config data object; dialog closed with true
   */
  it('confirm() opens ConfirmDialogComponent, sets title/message, returns afterClosed', async () => {
    const { service, open, componentInstance } = setup(true);
    const result = await firstValueFrom(
      service.confirm('Title', 'Message', { foo: 1 }),
    );
    expect(open).toHaveBeenCalledWith(ConfirmDialogComponent, {
      data: { foo: 1 },
    });
    expect(componentInstance.title).toBe('Title');
    expect(componentInstance.message).toBe('Message');
    expect(result).toBe(true);
  });

  /**
   * Verifies: omitting the data argument passes { data: {} } to MatDialog.open
   * Interacts with: MatDialog.open stub; service.confirm
   * Data: title/message only, no config data
   */
  it('confirm() defaults data to an empty object when none is provided', () => {
    const { service, open } = setup();
    service.confirm('T', 'M');
    expect(open).toHaveBeenCalledWith(ConfirmDialogComponent, { data: {} });
  });

  /**
   * Verifies: name() opens NameDialogComponent with the data and assigns title/message onto the instance
   * Interacts with: MatDialog.open stub; service.name
   * Data: title/message strings plus a { nameValue: 'x' } config data object
   */
  it('name() opens NameDialogComponent and sets title/message', () => {
    const { service, open, componentInstance } = setup();
    service.name('Rename', 'Enter a name', { nameValue: 'x' });
    expect(open).toHaveBeenCalledWith(NameDialogComponent, {
      data: { nameValue: 'x' },
    });
    expect(componentInstance.title).toBe('Rename');
    expect(componentInstance.message).toBe('Enter a name');
  });

  /**
   * Verifies: createPermission() forwards the caller's configData to open() (not wrapped in { data }) and assigns title/permission
   * Interacts with: MatDialog.open stub; service.createPermission
   * Data: a permission object and an explicit configData ({ width: '500px' }) passed straight through
   */
  it('createPermission() opens the dialog with configData and sets title/permission', () => {
    const { service, open, componentInstance } = setup();
    const permission = { key: 'p1' };
    const configData = { width: '500px' };
    service.createPermission('New Permission', permission, configData);
    expect(open).toHaveBeenCalledWith(
      CreatePermissionDialogComponent,
      configData,
    );
    expect(componentInstance.title).toBe('New Permission');
    expect(componentInstance.permission).toBe(permission);
  });

  /**
   * Verifies: omitting configData passes {} (not { data: {} }) to open()
   * Interacts with: MatDialog.open stub; service.createPermission
   * Data: title and permission only, no configData
   */
  it('createPermission() defaults configData to an empty object', () => {
    const { service, open } = setup();
    service.createPermission('T', { key: 'p' });
    expect(open).toHaveBeenCalledWith(CreatePermissionDialogComponent, {});
  });

  /**
   * Verifies: createRole() forwards configData to open() and assigns title/name onto the instance
   * Interacts with: MatDialog.open stub; service.createRole
   * Data: title 'New Role', name 'Admin', configData { width: '400px' }
   */
  it('createRole() opens the dialog and sets title/name', () => {
    const { service, open, componentInstance } = setup();
    service.createRole('New Role', 'Admin', { width: '400px' });
    expect(open).toHaveBeenCalledWith(CreateRoleDialogComponent, {
      width: '400px',
    });
    expect(componentInstance.title).toBe('New Role');
    expect(componentInstance.name).toBe('Admin');
  });

  /**
   * Verifies: selectRolePermissions() opens with default {} config and assigns title, role, and permissions onto the instance
   * Interacts with: MatDialog.open stub; service.selectRolePermissions
   * Data: a role object and a two-element permissions array, no configData
   */
  it('selectRolePermissions() sets title/role/permissions', () => {
    const { service, open, componentInstance } = setup();
    const role = { id: 'r1' };
    const permissions = [{ id: 'p1' }, { id: 'p2' }];
    service.selectRolePermissions('Pick', role, permissions);
    expect(open).toHaveBeenCalledWith(
      SelectRolePermissionsDialogComponent,
      {},
    );
    expect(componentInstance.title).toBe('Pick');
    expect(componentInstance.role).toBe(role);
    expect(componentInstance.permissions).toBe(permissions);
  });

  /**
   * Verifies: addRemoveUsersToTeam() sets the title and invokes the instance's loadTeam(team) method rather than setting a plain input
   * Interacts with: MatDialog.open stub; the fake instance's loadTeam vi.fn; service.addRemoveUsersToTeam
   * Data: a Team fixture { id: 't1', name: 'Red' } and configData { width: '600px' }
   * Why: the fake componentInstance is pre-seeded with a loadTeam spy so the method call can be asserted without a real component
   */
  it('addRemoveUsersToTeam() sets the title and calls loadTeam with the team', () => {
    const { service, open, componentInstance } = setup();
    const team: Team = { id: 't1', name: 'Red' };
    service.addRemoveUsersToTeam('Members', team, { width: '600px' });
    expect(open).toHaveBeenCalledWith(AddRemoveUsersDialogComponent, {
      width: '600px',
    });
    expect(componentInstance.title).toBe('Members');
    expect(componentInstance.loadTeam).toHaveBeenCalledWith(team);
  });

  /**
   * Verifies: editFile() opens with no config object and forwards fileId, viewId, oldName, and oldTeams onto the instance
   * Interacts with: MatDialog.open stub; service.editFile
   * Data: fileId/viewId/oldName strings and an oldTeams array ['t1','t2']
   */
  it('editFile() opens EditFileDialogComponent and forwards all inputs', () => {
    const { service, open, componentInstance } = setup();
    service.editFile('f1', 'v1', 'old.txt', ['t1', 't2']);
    expect(open).toHaveBeenCalledWith(EditFileDialogComponent);
    expect(componentInstance.fileId).toBe('f1');
    expect(componentInstance.viewId).toBe('v1');
    expect(componentInstance.oldName).toBe('old.txt');
    expect(componentInstance.oldTeams).toEqual(['t1', 't2']);
  });

  /**
   * Verifies: editSubscription() opens with { width: '500px' } and assigns the passed subscription to currentSub
   * Interacts with: MatDialog.open stub; service.editSubscription
   * Data: an existing subscription fixture { id: 's1', name: 'hook' }
   */
  it('editSubscription() opens EditSubscriptionComponent with the subscription', () => {
    const { service, open, componentInstance } = setup();
    const subscription = { id: 's1', name: 'hook' };
    service.editSubscription(subscription);
    expect(open).toHaveBeenCalledWith(EditSubscriptionComponent, {
      width: '500px',
    });
    expect(componentInstance.currentSub).toBe(subscription);
  });

  /**
   * Verifies: calling editSubscription() with no argument leaves currentSub undefined (the create-new path)
   * Interacts with: MatDialog.open stub; service.editSubscription
   * Data: no subscription argument
   */
  it('editSubscription() passes undefined when creating a new subscription', () => {
    const { service, componentInstance } = setup();
    service.editSubscription();
    expect(componentInstance.currentSub).toBeUndefined();
  });

  /**
   * Verifies: createApplication() opens with no config and forwards applicationId, file, viewName, and currentTeams onto the instance
   * Interacts with: MatDialog.open stub; service.createApplication
   * Data: an applicationId string, a FileModel fixture, a view name, and a currentTeams array
   */
  it('createApplication() opens the dialog and forwards all inputs', () => {
    const { service, open, componentInstance } = setup();
    const file = { id: 'f1', name: 'icon.png' } as FileModel;
    const currentTeams = [{ id: 'tua1' }];
    service.createApplication('app1', file, 'My View', currentTeams as never);
    expect(open).toHaveBeenCalledWith(CreateApplicationDialogComponent);
    expect(componentInstance.applicationId).toBe('app1');
    expect(componentInstance.file).toBe(file);
    expect(componentInstance.viewName).toBe('My View');
    expect(componentInstance.currentTeams).toBe(currentTeams);
  });

  /**
   * Verifies: the observable a dialog method returns reflects whatever afterClosed emits (here, false)
   * Interacts with: the fake dialogRef.afterClosed stub; service.confirm
   * Data: setup configured to close the dialog with false
   */
  it('propagates the value the dialog closes with', async () => {
    const { service } = setup(false);
    expect(await firstValueFrom(service.confirm('T', 'M'))).toBe(false);
  });
});
