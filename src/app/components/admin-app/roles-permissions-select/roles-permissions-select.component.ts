// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// this component will work with a User or a Team
// it allows a role and a list of permissions to be selected
// to use this component, add one of the following lines to the html of your edit page
// <app-roles-permissions-select [user]="userObject"></app-roles-permissions-select>
// <app-roles-permissions-select [team]="teamObject"></app-roles-permissions-select>

import { Component, OnInit, Input } from '@angular/core';
import {
  User,
  Team,
  Role,
  UserService,
  TeamService,
  RoleService,
  Permission,
  PermissionService,
} from '../../../generated/player-api';

export enum ObjectType {
  Unknown,
  User,
  Team,
}

@Component({
  selector: 'app-roles-permissions-select',
  templateUrl: './roles-permissions-select.component.html',
  styleUrls: ['./roles-permissions-select.component.scss'],
})
export class RolesPermissionsSelectComponent implements OnInit {
  @Input() user: User;
  @Input() team: Team;

  public permissions: Permission[] = [];
  public selectedPermissions: string[] = [];
  public roles: Role[] = [];
  public selectedRole = '';
  public subjectType = ObjectType.Unknown;
  public subject: any;

  constructor(
    private permissionService: PermissionService,
    private roleService: RoleService,
    private userService: UserService,
    private teamService: TeamService
  ) {}

  /**
   * Initialization
   */
  ngOnInit() {
    if ((!!this.team && !!this.user) || (!this.team && !this.user)) {
      // either a team or a user must be provided, so roles and permissions will not be functional
      console.log(
        'The roles and permissions component requires either a user or a team, therefore the dropdowns will be non-functional.'
      );
      return;
    } else if (this.team) {
      this.subjectType = ObjectType.Team;
      this.subject = this.team;
    } else if (this.user) {
      this.subjectType = ObjectType.User;
      this.subject = this.user;
    }
    this.permissionService.getPermissions().subscribe((permissions) => {
      this.permissions = permissions;
    });
    this.selectedPermissions = [];
    if (!!this.subject.permissions && this.subject.permissions.length > 0) {
      this.subject.permissions.forEach((permission) => {
        this.selectedPermissions.push(permission.id);
      });
    }
    this.roleService.getRoles().subscribe((roles) => {
      this.roles = roles;
    });
    this.selectedRole = this.subject.roleId;
  }

  /**
   * Updates the permission through the API
   * @param permission The permission object
   */
  updatePermissions(permission: Permission) {
    const index = this.subject.permissions.findIndex(
      (x) => x.id === permission.id
    );
    switch (this.subjectType) {
      case ObjectType.User:
        if (index === -1) {
          this.subject.permissions.push(permission);
          this.permissionService
            .addPermissionToUser(this.user.id, permission.id)
            .subscribe();
        } else {
          this.subject.permissions.splice(index, 1);
          this.permissionService
            .removePermissionFromUser(this.user.id, permission.id)
            .subscribe(() => {
              console.log('Permision removed');
            });
        }
        break;

      case ObjectType.Team:
        if (index === -1) {
          this.subject.permissions.push(permission);
          this.permissionService
            .addPermissionToTeam(this.team.id, permission.id)
            .subscribe();
        } else {
          this.subject.permissions.slice(index);
          this.permissionService
            .removePermissionFromTeam(this.team.id, permission.id)
            .subscribe();
        }
        break;

      default:
        break;
    }
  }

  /**
   * Updates the role through the API
   * @param roleId role guid
   */
  updateRole(roleId: string) {
    let roleName = null;
    if (!roleId) {
      roleId = null;
    } else {
      const role = this.roles.find((x) => x.id === roleId);
      roleName = role.name;
    }
    this.subject.roleId = roleId;
    this.subject.roleName = roleName;
    switch (this.subjectType) {
      case ObjectType.User:
        this.userService.updateUser(this.subject.id, this.subject).subscribe();
        break;

      case ObjectType.Team:
        this.teamService.updateTeam(this.subject.id, this.subject).subscribe();
        break;

      default:
        break;
    }
  }
}
