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
  UserService,
  TeamService,
  RoleService,
  Permission,
  PermissionService,
} from '../../../generated/player-api';
import { TeamRolesService } from '../../../services/roles/team-roles.service';
import { TeamPermissionsService } from '../../../services/permissions/team-permissions.service';
import { forkJoin, tap } from 'rxjs';
import { RolesService } from '../../../services/roles/roles.service';

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

  public permissions$: any;
  public roles$: any;
  public selectedPermissions: string[] = [];
  public selectedRole = '';
  public subjectType = ObjectType.Unknown;
  public subject: any;
  public showPermissions = false;

  constructor(
    private rolesService: RolesService,
    private userService: UserService,
    private teamService: TeamService,
    private teamRolesService: TeamRolesService,
    private teamPermissionsService: TeamPermissionsService
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
      this.showPermissions = true;

      this.permissions$ = this.teamPermissionsService.teamPermissions$;
      this.roles$ = this.teamRolesService.roles$;

      this.selectedPermissions = [];
      if (!!this.subject.permissions && this.subject.permissions.length > 0) {
        this.subject.permissions.forEach((permission) => {
          this.selectedPermissions.push(permission.id);
        });
      }
    } else if (this.user) {
      this.subjectType = ObjectType.User;
      this.subject = this.user;
      this.roles$ = this.rolesService.roles$;
    }

    this.selectedRole = this.subject.roleId;
  }

  /**
   * Updates the permission through the API
   * @param permission The permission object
   */
  updatePermissions(permission: Permission, checked: boolean) {
    const index = this.subject.permissions.findIndex(
      (x) => x.id === permission.id
    );
    switch (this.subjectType) {
      case ObjectType.User:
        break;

      case ObjectType.Team:
        if (checked) {
          this.subject.permissions.push(permission);
          this.teamPermissionsService
            .addToTeam(this.team.id, permission.id)
            .subscribe();
        } else {
          this.subject.permissions.slice(index);
          this.teamPermissionsService
            .removeFromTeam(this.team.id, permission.id)
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
    this.subject.roleId = roleId == '' ? null : roleId;

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
