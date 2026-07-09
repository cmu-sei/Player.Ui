// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Observable } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { Injectable } from '@angular/core';
import { AddRemoveUsersDialogComponent } from '../../components/shared/add-remove-users-dialog/add-remove-users-dialog.component';
import {
  FileModel,
  Team,
  WebhookSubscription,
} from '../../generated/player-api';
import { EditFileDialogComponent } from '../../components/shared/edit-file-dialog/edit-file-dialog.component';
import { EditSubscriptionComponent } from '../../components/admin-app/app-admin-subscription-search/edit-subscription/edit-subscription.component';
import { CreateApplicationDialogComponent } from '../../components/shared/create-application-dialog/create-application-dialog.component';
import { TeamUserApp } from '../../components/admin-app/admin-view-search/admin-view-edit/admin-view-edit.component';
import { NameDialogComponent } from '../../components/shared/name-dialog/name-dialog.component';

@Injectable()
export class DialogService {
  constructor(private dialog: MatDialog) {}

  public name(title: string, message: string, data?: any): Observable<any> {
    const dialogRef = this.dialog.open(NameDialogComponent, {
      data: data || {},
      minWidth: '400px',
      maxWidth: '90vw',
    });
    dialogRef.componentInstance.title = title;
    dialogRef.componentInstance.message = message;

    return dialogRef.afterClosed();
  }

  public addRemoveUsersToTeam(
    title: string,
    team: Team,
    configData?: any,
    canManageRoles = true,
  ): Observable<boolean> {
    const dialogRef = this.dialog.open(
      AddRemoveUsersDialogComponent,
      this.withDialogDefaults(configData),
    );
    dialogRef.componentInstance.title = title;
    dialogRef.componentInstance.canManageRoles = canManageRoles;
    dialogRef.componentInstance.loadTeam(team);
    return dialogRef.afterClosed();
  }

  public editFile(
    fileId: string,
    viewId: string,
    oldName: string,
    oldTeams: string[],
  ): Observable<boolean> {
    const dialogRef = this.dialog.open(
      EditFileDialogComponent,
      this.withDialogDefaults(),
    );
    dialogRef.componentInstance.fileId = fileId;
    dialogRef.componentInstance.viewId = viewId;
    dialogRef.componentInstance.oldName = oldName;
    dialogRef.componentInstance.oldTeams = oldTeams;
    return dialogRef.afterClosed();
  }

  public editSubscription(
    subscription?: WebhookSubscription,
  ): Observable<boolean> {
    const dialogRef = this.dialog.open(EditSubscriptionComponent, {
      width: '500px',
      maxWidth: '90vw',
    });
    dialogRef.componentInstance.currentSub = subscription;
    return dialogRef.afterClosed();
  }

  public createApplication(
    applicationId: string,
    file: FileModel,
    currentTeams: TeamUserApp[],
  ): Observable<boolean> {
    const dialogRef = this.dialog.open(CreateApplicationDialogComponent, {
      width: '480px',
      maxWidth: '90vw',
    });
    dialogRef.componentInstance.applicationId = applicationId;
    dialogRef.componentInstance.file = file;
    dialogRef.componentInstance.currentTeams = currentTeams;
    return dialogRef.afterClosed();
  }

  private withDialogDefaults(configData?: any): any {
    return {
      minWidth: '400px',
      maxWidth: '90vw',
      ...(configData || {}),
    };
  }
}
