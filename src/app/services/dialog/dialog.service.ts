// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Observable } from 'rxjs';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { Injectable } from '@angular/core';
import { ConfirmDialogComponent } from '../../components/shared/confirm-dialog/confirm-dialog.component';
import { AddRemoveUsersDialogComponent } from '../../components/shared/add-remove-users-dialog/add-remove-users-dialog.component';
import {
  FileModel,
  Team,
  WebhookSubscription,
} from '../../generated/player-api';
import { CreatePermissionDialogComponent } from '../../components/admin-app/admin-role-permission-search/create-permission-dialog/create-permission-dialog.component';
import { CreateRoleDialogComponent } from '../../components/admin-app/admin-role-permission-search/create-role-dialog/create-role-dialog.component';
import { SelectRolePermissionsDialogComponent } from '../../components/admin-app/admin-role-permission-search/select-role-permissions-dialog/select-role-permissions-dialog.component';
import { EditFileDialogComponent } from '../../components/shared/edit-file-dialog/edit-file-dialog.component';
import { EditSubscriptionComponent } from '../../components/admin-app/app-admin-subscription-search/edit-subscription/edit-subscription.component';
import { CreateApplicationDialogComponent } from '../../components/shared/create-application-dialog/create-application-dialog.component';
import { TeamUserApp } from '../../components/admin-app/admin-view-search/admin-view-edit/admin-view-edit.component';
import { NameDialogComponent } from '../../components/shared/name-dialog/name-dialog.component';

@Injectable()
export class DialogService {
  public WAS_CANCELLED = 'wasCancelled';

  constructor(private dialog: MatDialog) {}

  public confirm(title: string, message: string, data?: any): Observable<any> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: data || {},
    });
    dialogRef.componentInstance.title = title;
    dialogRef.componentInstance.message = message;

    return dialogRef.afterClosed();
  }

  public name(title: string, message: string, data?: any): Observable<any> {
    const dialogRef = this.dialog.open(NameDialogComponent, {
      data: data || {},
    });
    dialogRef.componentInstance.title = title;
    dialogRef.componentInstance.message = message;

    return dialogRef.afterClosed();
  }

  public createPermission(
    title: string,
    permission: any,
    configData?: any
  ): Observable<boolean> {
    const dialogRef = this.dialog.open(
      CreatePermissionDialogComponent,
      configData || {}
    );
    dialogRef.componentInstance.title = title;
    dialogRef.componentInstance.permission = permission;

    return dialogRef.afterClosed();
  }

  public createRole(
    title: string,
    name: string,
    configData?: any
  ): Observable<boolean> {
    const dialogRef = this.dialog.open(
      CreateRoleDialogComponent,
      configData || {}
    );
    dialogRef.componentInstance.title = title;
    dialogRef.componentInstance.name = name;

    return dialogRef.afterClosed();
  }

  public selectRolePermissions(
    title: string,
    role: any,
    permissions: any[],
    configData?: any
  ): Observable<boolean> {
    const dialogRef = this.dialog.open(
      SelectRolePermissionsDialogComponent,
      configData || {}
    );
    dialogRef.componentInstance.title = title;
    dialogRef.componentInstance.role = role;
    dialogRef.componentInstance.permissions = permissions;

    return dialogRef.afterClosed();
  }

  public addRemoveUsersToTeam(
    title: string,
    team: Team,
    configData?: any
  ): Observable<boolean> {
    const dialogRef = this.dialog.open(
      AddRemoveUsersDialogComponent,
      configData || {}
    );
    dialogRef.componentInstance.title = title;
    dialogRef.componentInstance.loadTeam(team);
    return dialogRef.afterClosed();
  }

  public editFile(
    fileId: string,
    viewId: string,
    oldName: string,
    oldTeams: string[]
  ): Observable<boolean> {
    const dialogRef = this.dialog.open(EditFileDialogComponent);
    dialogRef.componentInstance.fileId = fileId;
    dialogRef.componentInstance.viewId = viewId;
    dialogRef.componentInstance.oldName = oldName;
    dialogRef.componentInstance.oldTeams = oldTeams;
    return dialogRef.afterClosed();
  }

  public editSubscription(
    subscription?: WebhookSubscription
  ): Observable<boolean> {
    const dialogRef = this.dialog.open(EditSubscriptionComponent);
    dialogRef.componentInstance.currentSub = subscription;
    return dialogRef.afterClosed();
  }

  public createApplication(
    applicationId: string,
    file: FileModel,
    viewName: string,
    currentTeams: TeamUserApp[]
  ): Observable<boolean> {
    const dialogRef = this.dialog.open(CreateApplicationDialogComponent);
    dialogRef.componentInstance.applicationId = applicationId;
    dialogRef.componentInstance.file = file;
    dialogRef.componentInstance.viewName = viewName;
    dialogRef.componentInstance.currentTeams = currentTeams;
    return dialogRef.afterClosed();
  }
}
