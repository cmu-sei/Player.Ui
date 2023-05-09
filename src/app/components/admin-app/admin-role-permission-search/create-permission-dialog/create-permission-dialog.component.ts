// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { Component, Inject } from '@angular/core';
import { Permission } from '../../../../generated/player-api';

@Component({
  selector: 'create-permission-dialog',
  templateUrl: './create-permission-dialog.component.html',
})
export class CreatePermissionDialogComponent {
  public title: string;
  public permission: Permission;

  constructor(
    @Inject(MAT_DIALOG_DATA) data,
    private dialogRef: MatDialogRef<CreatePermissionDialogComponent>
  ) {
    this.dialogRef.disableClose = true;
  }

  close() {
    this.dialogRef.close({});
  }

  done() {
    this.dialogRef.close({ permission: this.permission });
  }
}
