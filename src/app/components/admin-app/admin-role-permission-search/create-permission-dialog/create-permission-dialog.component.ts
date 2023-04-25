// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { Component } from '@angular/core';
import { Permission } from '../../../../generated/player-api';

@Component({
  selector: 'app-create-permission-dialog',
  templateUrl: './create-permission-dialog.component.html',
})
export class CreatePermissionDialogComponent {
  public title: string;
  public permission: Permission;

  constructor(
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
