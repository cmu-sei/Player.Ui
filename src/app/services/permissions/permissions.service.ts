/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { inject, Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import {
  CreatePermissionCommand,
  EditPermissionCommand,
  Permission,
  PermissionService,
} from '../../generated/player-api';

@Injectable({
  providedIn: 'root',
})
export class PermissionsService {
  private permissionsApi = inject(PermissionService);

  permissionsSubject = new BehaviorSubject<Permission[]>([]);
  permissions$ = this.permissionsSubject
    .asObservable()
    .pipe(map((x) => x.sort(this.sortFn)));

  private sortFn(a: Permission, b: Permission) {
    // Sort by 'immutable' property first (false comes after true)
    if (a.immutable !== b.immutable) {
      return a.immutable ? -1 : 1; // Put `true` before `false`
    }
    // If 'immutable' values are the same, sort by 'name' (case-insensitive)
    return a?.name?.localeCompare(b?.name);
  }

  load() {
    return this.permissionsApi
      .getPermissions()
      .pipe(tap((x) => this.permissionsSubject.next(x)));
  }

  editPermission(id: string, command: EditPermissionCommand) {
    return this.permissionsApi.updatePermission(id, command).pipe(
      tap((x) => {
        this.upsert(id, x);
      })
    );
  }

  createPermission(command: CreatePermissionCommand) {
    return this.permissionsApi.createPermission(command).pipe(
      tap((x) => {
        this.upsert(x.id, x);
      })
    );
  }

  deletePermission(id: string) {
    return this.permissionsApi.deletePermission(id).pipe(
      tap(() => {
        this.remove(id);
      })
    );
  }

  upsert(id: string, permission: Partial<Permission>) {
    const permissions = this.permissionsSubject.getValue();
    let permissionToUpdate = permissions.find((x) => x.id === id);

    if (permissionToUpdate != null) {
      Object.assign(permissionToUpdate, permission);
    } else {
      permissions.push({ ...permission, id } as Permission);
    }

    this.permissionsSubject.next(permissions);
  }

  remove(id: string) {
    let permissions = this.permissionsSubject.getValue();
    permissions = permissions.filter((x) => x.id != id);
    this.permissionsSubject.next(permissions);
  }
}
