/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { inject, Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import {
  CreateRoleCommand,
  EditRoleCommand,
  Role,
  RoleService,
} from '../../generated/player-api';

@Injectable({
  providedIn: 'root',
})
export class RolesService {
  private rolesApi = inject(RoleService);

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

  load() {
    return this.rolesApi.getRoles().pipe(tap((x) => this.rolesSubject.next(x)));
  }

  editRole(id: string, command: EditRoleCommand) {
    return this.rolesApi.updateRole(id, command).pipe(
      tap((x) => {
        this.upsert(id, x);
      })
    );
  }

  createRole(command: CreateRoleCommand) {
    return this.rolesApi.createRole(command).pipe(
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

  upsert(id: string, role: Partial<Role>) {
    const roles = this.rolesSubject.getValue();
    let permissionToUpdate = roles.find((x) => x.id === id);

    if (permissionToUpdate != null) {
      Object.assign(permissionToUpdate, role);
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
