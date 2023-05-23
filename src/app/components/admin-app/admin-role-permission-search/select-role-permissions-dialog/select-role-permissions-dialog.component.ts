// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogRef as MatDialogRef,
} from '@angular/material/legacy-dialog';
import { Component, Inject, OnInit } from '@angular/core';
import { PermissionService } from '../../../../generated/player-api';

@Component({
  selector: 'app-select-role-permissions-dialog',
  templateUrl: './select-role-permissions-dialog.component.html',
})
export class SelectRolePermissionsDialogComponent implements OnInit {
  public title: string;
  public role: any;
  public permissions: any[];
  public selectedPermissions: any[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) data,
    private permissionService: PermissionService,
    private dialogRef: MatDialogRef<SelectRolePermissionsDialogComponent>
  ) {
    this.dialogRef.disableClose = true;
  }

  /**
   * Initialization
   */
  ngOnInit() {
    this.permissions.sort(function (a, b) {
      return a.key.toLowerCase().localeCompare(b.key.toLowerCase());
    });
    this.role.permissions.forEach((permission) => {
      this.selectedPermissions.push(permission.id);
    });
  }

  /**
   * Updates the selected permission
   * @param permissionGuid
   */
  updateSelection(permissionGuid) {
    const match = this.role.permissions.find((x) => x.id === permissionGuid);
    if (!match) {
      this.permissionService
        .addPermissionToRole(this.role.id, permissionGuid)
        .subscribe();
    } else {
      this.permissionService
        .removePermissionFromRole(this.role.id, permissionGuid)
        .subscribe();
    }
  }

  close() {
    this.dialogRef.close({});
  }

  done() {
    this.dialogRef.close({ role: this.role });
  }
}
