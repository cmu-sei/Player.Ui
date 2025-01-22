/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { inject, Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import {
  CreateTeamRoleCommand,
  EditTeamRoleCommand,
  Role,
  TeamPermissionModel,
  TeamPermissionService,
  TeamRole,
  TeamRoleService,
} from '../../generated/player-api';

@Injectable({
  providedIn: 'root',
})
export class TeamRolesService {
  private teamRolesApi = inject(TeamRoleService);
  private teamPermissionsApi = inject(TeamPermissionService);

  rolesSubject = new BehaviorSubject<TeamRole[]>([]);
  roles$ = this.rolesSubject
    .asObservable()
    .pipe(map((x) => x.sort(this.sortFn)));

  private sortFn(a: TeamRole, b: TeamRole) {
    // Sort by 'immutable' property first (false comes after true)
    if (a.immutable !== b.immutable) {
      return a.immutable ? -1 : 1; // Put `true` before `false`
    }
    // If 'immutable' values are the same, sort by 'name' (case-insensitive)
    return a.name.localeCompare(b.name);
  }

  getRoles() {
    return this.teamRolesApi
      .getTeamRoles()
      .pipe(tap((x) => this.rolesSubject.next(x)));
  }

  editRole(id: string, command: EditTeamRoleCommand) {
    return this.teamRolesApi.updateTeamRole(id, command).pipe(
      tap((x) => {
        this.upsert(id, x);
      })
    );
  }

  createRole(command: CreateTeamRoleCommand) {
    return this.teamRolesApi.createTeamRole(command).pipe(
      tap((x) => {
        this.upsert(x.id, x);
      })
    );
  }

  deleteRole(id: string) {
    return this.teamRolesApi.deleteTeamRole(id).pipe(
      tap(() => {
        this.remove(id);
      })
    );
  }

  addPermission(roleId: string, permission: TeamPermissionModel) {
    return this.teamPermissionsApi
      .addTeamPermissionToRole(roleId, permission.id)
      .pipe(
        tap(() => {
          const role = this.rolesSubject.getValue().find((x) => x.id == roleId);

          if (role != null) {
            role.permissions.push(permission);
            this.upsert(role.id, role);
          }
        })
      );
  }

  removePermission(roleId: string, permissionId: string) {
    return this.teamPermissionsApi
      .removeTeamPermissionFromRole(roleId, permissionId)
      .pipe(
        tap(() => {
          const role = this.rolesSubject.getValue().find((x) => x.id == roleId);

          if (role != null) {
            role.permissions = role.permissions.filter(
              (x) => x.id != permissionId
            );
            this.upsert(role.id, role);
          }
        })
      );
  }

  upsert(id: string, role: Partial<TeamRole>) {
    const roles = this.rolesSubject.getValue();
    let roleToUpdate = roles.find((x) => x.id === id);

    if (roleToUpdate != null) {
      Object.assign(roleToUpdate, role);
    } else {
      roles.push({ ...role, id } as Role);
    }

    this.rolesSubject.next(roles);
  }

  remove(id: string) {
    let roles = this.rolesSubject.getValue();
    roles = roles.filter((x) => x.id != id);
    this.rolesSubject.next(roles);
  }
}
