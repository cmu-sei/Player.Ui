/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { map, take } from 'rxjs/operators';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { forkJoin } from 'rxjs';
import { DialogService } from '../../../../services/dialog/dialog.service';
import {
  Permission,
  Role,
  SystemPermission,
  TeamPermissionModel,
  TeamRole,
} from '../../../../generated/player-api';
import { UserPermissionsService } from '../../../../services/permissions/user-permissions.service';
import { PermissionsService } from '../../../../services/permissions/permissions.service';
import { TeamRolesService } from '../../../../services/roles/team-roles.service';
import { TeamPermissionsService } from '../../../../services/permissions/team-permissions.service';

@Component({
  selector: 'app-team-roles',
  templateUrl: './team-roles.component.html',
  styleUrls: ['./team-roles.component.scss'],
})
export class TeamRolesComponent implements OnInit, OnDestroy {
  private roleService = inject(TeamRolesService);
  private dialogService = inject(DialogService);
  private userPermissionsService = inject(UserPermissionsService);
  private permissionService = inject(TeamPermissionsService);
  //private signalRService = inject(SignalRService);

  public canEdit$ = this.userPermissionsService.hasPermission(
    SystemPermission.ManageRoles
  );

  public allPermission = 'All';

  public dataSource = new MatTableDataSource<string>();

  public dataSource$ = this.permissionService.teamPermissions$.pipe(
    map((permissions) => {
      return [
        {
          name: this.allPermission,
          description:
            'Gives permission to perform any action within the View of the Team',
        },
        ...permissions,
      ];
    }),
    map(
      (permissions) => new MatTableDataSource<TeamPermissionModel>(permissions)
    )
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
      this.roleService.getRoles().subscribe(),
      this.permissionService.load().subscribe(),
    ]);

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

  setPermission(
    permission: TeamPermissionModel,
    role: TeamRole,
    event: MatCheckboxChange
  ) {
    if (permission.name == this.allPermission) {
      role.allPermissions = event.checked;
      this.roleService.editRole(role.id, role).subscribe();
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
      .name('Create New Team Role?', '', { nameValue: '' })
      .pipe(take(1))
      .subscribe((result) => {
        if (!result.wasCancelled) {
          this.roleService.createRole({ name: result.nameValue }).subscribe();
        }
      });
  }

  addPermission() {
    this.dialogService
      .name('Create New Team Permission?', '', { nameValue: '' })
      .pipe(take(1))
      .subscribe((result) => {
        if (!result.wasCancelled) {
          this.permissionService
            .createTeamPermission({ name: result.nameValue })
            .subscribe();
        }
      });
  }

  renameRole(role: TeamRole) {
    this.dialogService
      .name('Rename Role?', '', { nameValue: role.name })
      .pipe(take(1))
      .subscribe((result) => {
        if (!result.wasCancelled) {
          role.name = result.nameValue;
          this.roleService.editRole(role.id, role).subscribe();
        }
      });
  }

  deleteRole(role: TeamRole) {
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
