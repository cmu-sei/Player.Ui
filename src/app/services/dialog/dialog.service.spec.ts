// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, firstValueFrom } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { DialogService } from './dialog.service';
import { NameDialogComponent } from '../../components/shared/name-dialog/name-dialog.component';
import { AddRemoveUsersDialogComponent } from '../../components/shared/add-remove-users-dialog/add-remove-users-dialog.component';
import { EditFileDialogComponent } from '../../components/shared/edit-file-dialog/edit-file-dialog.component';
import { EditSubscriptionComponent } from '../../components/admin-app/app-admin-subscription-search/edit-subscription/edit-subscription.component';
import { CreateApplicationDialogComponent } from '../../components/shared/create-application-dialog/create-application-dialog.component';
import { TeamUserApp } from '../../components/admin-app/admin-view-search/admin-view-edit/admin-view-edit.component';
import { Team, FileModel } from '../../generated/player-api';

// Each open() returns a fake dialog ref whose componentInstance captures
// whatever DialogService assigns to it, plus an afterClosed() we control. This
// lets us assert which component was opened, what config it got, and which
// inputs were set — without rendering anything.
//
// It is typed against the real dialog components rather than a bag of unknowns,
// so renaming an input on any of them fails this spec at compile time instead of
// leaving it asserting a property the component no longer has.
type DialogComponentInstance = Partial<NameDialogComponent> &
  Partial<AddRemoveUsersDialogComponent> &
  Partial<EditFileDialogComponent> &
  Partial<EditSubscriptionComponent> &
  Partial<CreateApplicationDialogComponent>;

function setup(closedWith: unknown = true) {
  const componentInstance: DialogComponentInstance = { loadTeam: vi.fn() };
  const afterClosed = vi.fn(() => of(closedWith));
  const dialogRef = { componentInstance, afterClosed };
  const open = vi.fn(() => dialogRef);

  TestBed.configureTestingModule({
    providers: [{ provide: MatDialog, useValue: { open } }, DialogService],
  });

  const service = TestBed.inject(DialogService);
  return { service, open, componentInstance, afterClosed };
}

describe('DialogService', () => {
  beforeEach(() => TestBed.resetTestingModule());

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
      minWidth: '400px',
      maxWidth: '90vw',
    });
    expect(componentInstance.title).toBe('Rename');
    expect(componentInstance.message).toBe('Enter a name');
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
      minWidth: '400px',
      maxWidth: '90vw',
      width: '600px',
    });
    expect(componentInstance.title).toBe('Members');
    expect(componentInstance.loadTeam).toHaveBeenCalledWith(team);
  });

  /**
   * Verifies: addRemoveUsersToTeam() defaults canManageRoles to true when the caller omits it.
   * Interacts with: MatDialog.open stub; service.addRemoveUsersToTeam.
   * Data: a Team fixture, no canManageRoles argument.
   * Why: the flag gates every role-editing control in the dialog, so the default has to be pinned separately from the explicit-false path.
   */
  it('addRemoveUsersToTeam() grants role management by default', () => {
    const { service, componentInstance } = setup();
    service.addRemoveUsersToTeam('Members', { id: 't1', name: 'Red' });
    expect(componentInstance.canManageRoles).toBe(true);
  });

  /**
   * Verifies: addRemoveUsersToTeam() forwards canManageRoles: false onto the dialog instance.
   * Interacts with: MatDialog.open stub; service.addRemoveUsersToTeam.
   * Data: a Team fixture with canManageRoles passed as false.
   * Why: manage-teams passes false for scoped-team users; if this assignment is lost they silently regain role management.
   */
  it('addRemoveUsersToTeam() forwards canManageRoles: false', () => {
    const { service, componentInstance } = setup();
    service.addRemoveUsersToTeam(
      'Members',
      { id: 't1', name: 'Red' },
      undefined,
      false,
    );
    expect(componentInstance.canManageRoles).toBe(false);
  });

  /**
   * Verifies: editFile() opens with no config object and forwards fileId, viewId, oldName, and oldTeams onto the instance
   * Interacts with: MatDialog.open stub; service.editFile
   * Data: fileId/viewId/oldName strings and an oldTeams array ['t1','t2']
   */
  it('editFile() opens EditFileDialogComponent and forwards all inputs', () => {
    const { service, open, componentInstance } = setup();
    service.editFile('f1', 'v1', 'old.txt', ['t1', 't2']);
    expect(open).toHaveBeenCalledWith(EditFileDialogComponent, {
      minWidth: '400px',
      maxWidth: '90vw',
    });
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
      maxWidth: '90vw',
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
   * Verifies: createApplication() opens with its sizing config and forwards applicationId, file, and currentTeams onto the instance
   * Interacts with: MatDialog.open stub; service.createApplication
   * Data: an applicationId string, a FileModel fixture, and one real TeamUserApp
   */
  it('createApplication() opens the dialog and forwards all inputs', () => {
    const { service, open, componentInstance } = setup();
    const file: FileModel = { id: 'f1', name: 'icon.png' };
    const currentTeams = [new TeamUserApp('Red', { id: 't1' }, [])];
    service.createApplication('app1', file, currentTeams);
    expect(open).toHaveBeenCalledWith(CreateApplicationDialogComponent, {
      width: '480px',
      maxWidth: '90vw',
    });
    expect(componentInstance.applicationId).toBe('app1');
    expect(componentInstance.file).toBe(file);
    expect(componentInstance.currentTeams).toBe(currentTeams);
  });

  /**
   * Verifies: the observable a dialog method returns reflects whatever afterClosed emits (here, false)
   * Interacts with: the fake dialogRef.afterClosed stub; service.name
   * Data: setup configured to close the dialog with false
   */
  it('propagates the value the dialog closes with', async () => {
    const { service } = setup(false);
    expect(await firstValueFrom(service.name('T', 'M'))).toBe(false);
  });
});
