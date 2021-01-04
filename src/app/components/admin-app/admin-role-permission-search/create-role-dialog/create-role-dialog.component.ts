// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Component, Inject } from '@angular/core';

@Component({
  selector: 'create-role-dialog',
  templateUrl: './create-role-dialog.component.html',
})
export class CreateRoleDialogComponent {
  public title: string;
  public name = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) data,
    private dialogRef: MatDialogRef<CreateRoleDialogComponent>
  ) {
    this.dialogRef.disableClose = true;
  }

  close() {
    this.dialogRef.close({});
  }

  done() {
    this.dialogRef.close({ name: this.name, value: '' });
  }
}
