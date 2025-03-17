/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { inject, Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import {
  CreateTeamPermissionCommand,
  EditTeamPermissionCommand,
  TeamPermissionModel,
  TeamPermissionService,
} from '../../generated/player-api';

@Injectable({
  providedIn: 'root',
})
export class TeamPermissionsService {
  private teamPermissionsApi = inject(TeamPermissionService);

  teamPermissionsSubject = new BehaviorSubject<TeamPermissionModel[]>([]);
  teamPermissions$ = this.teamPermissionsSubject.asObservable().pipe(
    map((x) => x.filter((y) => y.name)),
    map((x) => x.sort(this.sortFn))
  );

  private sortFn(a: TeamPermissionModel, b: TeamPermissionModel) {
    // Sort by 'immutable' property first (false comes after true)
    if (a.immutable !== b.immutable) {
      return a.immutable ? -1 : 1; // Put `true` before `false`
    }
    // If 'immutable' values are the same, sort by 'name' (case-insensitive)
    return a.name.localeCompare(b.name);
  }

  load() {
    return this.teamPermissionsApi
      .getTeamPermissions()
      .pipe(tap((x) => this.teamPermissionsSubject.next(x)));
  }

  editTeamPermission(id: string, command: EditTeamPermissionCommand) {
    return this.teamPermissionsApi.updateTeamPermission(id, command).pipe(
      tap((x) => {
        this.upsert(id, x);
      })
    );
  }

  createTeamPermission(command: CreateTeamPermissionCommand) {
    return this.teamPermissionsApi.createTeamPermission(command).pipe(
      tap((x) => {
        this.upsert(x.id, x);
      })
    );
  }

  deleteTeamPermission(id: string) {
    return this.teamPermissionsApi.deleteTeamPermission(id).pipe(
      tap(() => {
        this.remove(id);
      })
    );
  }

  addToTeam(teamId: string, permissionId: string) {
    return this.teamPermissionsApi.addTeamPermissionToTeam(
      teamId,
      permissionId
    );
  }

  removeFromTeam(teamId: string, permissionId: string) {
    return this.teamPermissionsApi.removeTeamPermissionFromTeam(
      teamId,
      permissionId
    );
  }

  upsert(id: string, teamPermission: Partial<TeamPermissionModel>) {
    const teamPermissions = this.teamPermissionsSubject.getValue();
    let teamPermissionToUpdate = teamPermissions.find((x) => x.id === id);

    if (teamPermissionToUpdate != null) {
      Object.assign(teamPermissionToUpdate, teamPermission);
    } else {
      teamPermissions.push({ ...teamPermission, id } as TeamPermissionModel);
    }

    this.teamPermissionsSubject.next(teamPermissions);
  }

  remove(id: string) {
    let teamPermissions = this.teamPermissionsSubject.getValue();
    teamPermissions = teamPermissions.filter((x) => x.id != id);
    this.teamPermissionsSubject.next(teamPermissions);
  }
}
