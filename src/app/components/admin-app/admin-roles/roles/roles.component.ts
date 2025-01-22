/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { map, take } from 'rxjs/operators';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { forkJoin } from 'rxjs';
import { RolesService } from '../../../../services/roles/roles.service';
import { DialogService } from '../../../../services/dialog/dialog.service';
import {
  Permission,
  Role,
  SystemPermission,
} from '../../../../generated/player-api';
import { UserPermissionsService } from '../../../../services/permissions/user-permissions.service';
import { PermissionsService } from '../../../../services/permissions/permissions.service';

@Component({
  selector: 'app-roles',
  templateUrl: './roles.component.html',
  styleUrls: ['./roles.component.scss'],
})
export class SystemRolesComponent implements OnInit, OnDestroy {
  private roleService = inject(RolesService);
  private dialogService = inject(DialogService);
  private userPermissionsService = inject(UserPermissionsService);
  private permissionService = inject(PermissionsService);
  //private signalRService = inject(SignalRService);

  public canEdit$ = this.userPermissionsService.hasPermission(
    SystemPermission.ManageRoles
  );

  public allPermission = 'All';

  public dataSource = new MatTableDataSource<string>();

  public dataSource$ = this.permissionService.permissions$.pipe(
    map((permissions) => {
      return [
        {
          name: this.allPermission,
          description: 'Gives permission to perform any action',
        },
        ...permissions,
      ];
    }),
    map((permissions) => new MatTableDataSource<Permission>(permissions))
  );

  public roles$ = this.roleService.roles$;

  public displayedColumns$ = this.roles$.pipe(
    map((x) => {
      const columnNames = x.map((y) => y.name);
      return ['permissions', ...columnNames];
    })
  );

  ngOnInit(): void {
    forkJoin([
      this.roleService.getRoles(),
      this.permissionService.load(),
    ]).subscribe();

    // this.signalRService
    //   .startConnection()
    //   .then(() => {
    //     this.signalRService.joinRolesAdmin();
    //   })
    //   .catch((err) => {
    //     console.log(err);
    //   });
  }

  ngOnDestroy() {
    // this.signalRService.leaveRolesAdmin();
  }

  trackById(index: number, item: any) {
    return item.id;
  }

  hasPermission(permission: Permission, role: Role) {
    if (permission.name == this.allPermission) {
      return role.allPermissions;
    }

    return role.permissions.some((x) => x.id == permission.id);
  }

  setPermission(permission: Permission, role: Role, event: MatCheckboxChange) {
    if (permission.name == this.allPermission) {
      role.allPermissions = event.checked;
      this.roleService.editRole(role).subscribe();
    } else {
      if (event.checked && !this.hasPermission(permission, role)) {
        this.roleService.addPermission(role.id, permission).subscribe();
      } else if (!event.checked) {
        this.roleService.removePermission(role.id, permission.id).subscribe();
      }
    }
  }

  addRole() {
    this.dialogService
      .name('Create New Role?', '', { nameValue: '' })
      .pipe(take(1))
      .subscribe((result) => {
        if (!result.wasCancelled) {
          this.roleService.createRole({ name: result.nameValue }).subscribe();
        }
      });
  }

  addPermission() {
    this.dialogService
      .name('Create New Permission?', '', { nameValue: '' })
      .pipe(take(1))
      .subscribe((result) => {
        if (!result.wasCancelled) {
          this.permissionService
            .createPermission({ name: result.nameValue })
            .subscribe();
        }
      });
  }

  renameRole(role: Role) {
    this.dialogService
      .name('Rename Role?', '', { nameValue: role.name })
      .pipe(take(1))
      .subscribe((result) => {
        if (!result.wasCancelled) {
          role.name = result.nameValue;
          this.roleService.editRole(role).subscribe();
        }
      });
  }

  deleteRole(role: Role) {
    this.dialogService
      .confirm(
        'Delete Role?',
        `Are you sure you want to delete ${role.name}?`,
        {
          buttonTrueText: 'Delete',
          buttonFalseText: 'Cancel',
        }
      )
      .subscribe((result) => {
        if (result.confirm) {
          this.roleService.deleteRole(role.id).subscribe();
        }
      });
  }
}
