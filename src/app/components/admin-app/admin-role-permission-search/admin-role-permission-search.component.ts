// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnInit, ViewChild } from '@angular/core';
import { MatSort, MatSortable } from '@angular/material/sort';
import { MatLegacyTableDataSource as MatTableDataSource } from '@angular/material/legacy-table';
import {
  Permission,
  PermissionService,
  PermissionForm,
} from '../../../generated/player-api';
import { Role, RoleService, RoleForm } from '../../../generated/player-api';
import { DialogService } from '../../../services/dialog/dialog.service';
import { UntypedFormControl } from '@angular/forms';

export interface Action {
  Value: string;
  Text: string;
}

@Component({
  selector: 'app-admin-role-permission-search',
  templateUrl: './admin-role-permission-search.component.html',
  styleUrls: ['./admin-role-permission-search.component.scss'],
})
export class AdminRolePermissionSearchComponent implements OnInit {
  @ViewChild(MatSort, { static: true }) sortRoles: MatSort;

  public permissionDataSource: MatTableDataSource<Permission>;
  public roleDataSource: MatTableDataSource<Role>;
  public permissionColumns: string[] = ['key', 'value', 'description', 'id'];
  public roleColumns: string[] = ['name', 'permissions', 'id'];
  public isSuperUser: boolean;
  public filterRoleString: string;
  public filterPermissionString: string;
  public selected: UntypedFormControl;

  public permissionActions: Action[] = [
    { Value: 'edit', Text: 'Edit Permission' },
    { Value: 'delete', Text: 'Delete Permission' },
  ];

  public roleActions: Action[] = [
    { Value: 'select', Text: 'Select Permissions' },
    { Value: 'edit', Text: 'Edit Role' },
    { Value: 'delete', Text: 'Delete Role' },
  ];

  constructor(
    private dialogService: DialogService,
    private permissionService: PermissionService,
    private roleService: RoleService
  ) {}

  ngOnInit() {
    this.selected = new UntypedFormControl(0);

    // Initial datasource
    this.permissionDataSource = new MatTableDataSource<Permission>(
      new Array<Permission>()
    );
    this.filterPermissionString = '';
    this.permissionService.getPermissions().subscribe((permissions) => {
      this.permissionDataSource.data = permissions.sort((k1, k2) =>
        k1.key.toLowerCase() < k2.key.toLowerCase() ? -1 : 1
      );
    });

    this.roleDataSource = new MatTableDataSource<Role>(new Array<Role>());
    this.sortRoles.sort(<MatSortable>{ id: 'name', start: 'asc' });
    this.roleDataSource.sort = this.sortRoles;
    this.filterRoleString = '';
    this.roleService.getRoles().subscribe((roles) => {
      this.roleDataSource.data = roles;
    });
  }

  addPermission() {
    this.dialogService
      .createPermission('Add Permission', {})
      .subscribe((enteredInfo) => {
        const permission = enteredInfo['permission'];
        if (!permission.key) {
          return;
        }
        const newPermission: PermissionForm = {
          key: permission.key,
          value: permission.value,
          description: permission.description,
        };
        this.permissionService.createPermission(newPermission).subscribe(() => {
          this.permissionService.getPermissions().subscribe((permissions) => {
            this.permissionDataSource.data = permissions;
          });
        });
      });
  }

  editPermission(permission) {
    this.dialogService
      .createPermission('Edit Permission', permission)
      .subscribe((enteredInfo) => {
        permission = enteredInfo['permission'];
        if (!permission.key) {
          return;
        }
        const newPermission: PermissionForm = {
          key: permission.key,
          value: permission.value,
          description: permission.description,
        };
        this.permissionService
          .updatePermission(permission.id, newPermission)
          .subscribe(() => {
            this.permissionService.getPermissions().subscribe((permissions) => {
              this.permissionDataSource.data = permissions;
            });
          });
      });
  }

  executePermissionAction(action: string, permission: Permission) {
    switch (action) {
      case 'edit': {
        this.editPermission(permission);
        break;
      }
      case 'delete': {
        // Delete permission
        const permissionName = !permission.value
          ? permission.key
          : permission.key + '(' + permission.value + ')';
        this.dialogService
          .confirm(
            'Delete Permission',
            'Are you sure you want to delete ' + permissionName + '?'
          )
          .subscribe((confirmed) => {
            if (confirmed) {
              this.permissionService
                .deletePermission(permission.id)
                .subscribe(() => {
                  this.permissionService
                    .getPermissions()
                    .subscribe((permissions) => {
                      this.permissionDataSource.data = permissions;
                    });
                });
            }
          });
        break;
      }
      default: {
        alert('Unknown Action');
      }
    }
  }

  /**
   * Called by UI to add a filter to the permissionDataSource
   * @param filterValue
   */
  applyPermissionFilter(filterValue: string) {
    this.filterPermissionString = filterValue;
    filterValue = filterValue.toLowerCase(); // MatTableDataSource defaults to lowercase matches
    this.permissionDataSource.filter = filterValue;
  }

  /**
   * Clears the permission filter string
   */
  clearPermissionFilter() {
    this.applyPermissionFilter('');
  }

  /**
   * Adds a role in the API
   */
  addRole() {
    this.dialogService.createRole('Add Role', '').subscribe((enteredInfo) => {
      if (!enteredInfo['name']) {
        return;
      }
      const newRole: RoleForm = {
        name: enteredInfo['name'],
      };
      this.roleService.createRole(newRole).subscribe(() => {
        this.roleService.getRoles().subscribe((roles) => {
          this.roleDataSource.data = roles;
        });
      });
    });
  }

  /**
   * Edits an existing role
   * @param role
   */
  editRole(role: Role) {
    this.dialogService
      .createRole('Edit Role', role.name)
      .subscribe((enteredInfo) => {
        if (!enteredInfo['name']) {
          return;
        }
        const newRole: RoleForm = {
          name: enteredInfo['name'],
        };
        this.roleService.updateRole(role.id, newRole).subscribe((result) => {
          this.roleService.getRoles().subscribe((roles) => {
            this.roleDataSource.data = roles;
          });
        });
      });
  }

  /**
   * Performs the action on the specified role
   * @param action string action text
   * @param role User guid for role to perform action on
   */
  executeRoleAction(action: string, role: Role) {
    switch (action) {
      case 'select': {
        // Select Permisisons
        const permissions = this.permissionDataSource.data;
        this.dialogService
          .selectRolePermissions('Select Permissions', role, permissions)
          .subscribe(() => {
            this.roleService.getRoles().subscribe((roles) => {
              this.roleDataSource.data = roles;
            });
          });
        break;
      }
      case 'edit': {
        // Edit Role
        this.editRole(role);
        break;
      }
      case 'delete': {
        // Delete Role
        this.dialogService
          .confirm(
            'Delete Role',
            'Are you sure you want to delete ' + role.name + '?'
          )
          .subscribe((confirmed) => {
            if (confirmed) {
              this.roleService.deleteRole(role.id).subscribe(() => {
                this.roleService.getRoles().subscribe((roles) => {
                  this.roleDataSource.data = roles;
                });
              });
            }
          });
        break;
      }
      default: {
        alert('Unknown Action');
      }
    }
  }

  /**
   * Called by UI to add a filter to the roleDataSource
   * @param filterValue
   */
  applyRoleFilter(filterValue: string) {
    this.filterRoleString = filterValue;
    filterValue = filterValue.toLowerCase(); // MatTableDataSource defaults to lowercase matches
    this.roleDataSource.filter = filterValue;
  }

  /**
   * Clears the role filter string
   */
  clearRoleFilter() {
    this.applyRoleFilter('');
  }
}
