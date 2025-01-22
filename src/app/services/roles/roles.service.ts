/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { inject, Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import {
  Permission,
  PermissionService,
  Role,
  RoleService,
} from '../../generated/player-api';

@Injectable({
  providedIn: 'root',
})
export class RolesService {
  private rolesApi = inject(RoleService);
  private permissionsApi = inject(PermissionService);

  rolesSubject = new BehaviorSubject<Role[]>([]);
  roles$ = this.rolesSubject
    .asObservable()
    .pipe(map((x) => x.sort(this.sortFn)));

  private sortFn(a: Role, b: Role) {
    // Sort by 'immutable' property first (false comes after true)
    if (a.immutable !== b.immutable) {
      return a.immutable ? -1 : 1; // Put `true` before `false`
    }
    // If 'immutable' values are the same, sort by 'name' (case-insensitive)
    return a.name.localeCompare(b.name);
  }

  getRoles() {
    return this.rolesApi.getRoles().pipe(tap((x) => this.rolesSubject.next(x)));
  }

  editRole(role: Role) {
    return this.rolesApi.updateRole(role.id, role).pipe(
      tap((x) => {
        this.upsert(role.id, x);
      })
    );
  }

  createRole(role: Role) {
    return this.rolesApi.createRole(role).pipe(
      tap((x) => {
        this.upsert(x.id, x);
      })
    );
  }

  deleteRole(id: string) {
    return this.rolesApi.deleteRole(id).pipe(
      tap(() => {
        this.remove(id);
      })
    );
  }

  addPermission(roleId: string, permission: Permission) {
    return this.permissionsApi.addPermissionToRole(roleId, permission.id).pipe(
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
    return this.permissionsApi
      .removePermissionFromRole(roleId, permissionId)
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

  upsert(id: string, role: Partial<Role>) {
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
