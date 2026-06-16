// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import {
  PermissionService,
  SystemPermission,
  TeamPermission,
  TeamPermissionsClaim,
  TeamPermissionService,
  ViewPermission,
} from '../../generated/player-api';

@Injectable({
  providedIn: 'root',
})
export class UserPermissionsService {
  private permissionsSubject = new BehaviorSubject<string[]>([]);
  public permissions$ = this.permissionsSubject.asObservable();

  private teamPermissionsSubject = new BehaviorSubject<TeamPermissionsClaim[]>(
    []
  );
  public teamPermissions$ = this.teamPermissionsSubject.asObservable();

  constructor(
    private permissionsApi: PermissionService,
    private teamPermissionsApi: TeamPermissionService
  ) {}

  load(): Observable<string[]> {
    return this.permissionsApi
      .getMyPermissions()
      .pipe(tap((x) => this.permissionsSubject.next(x)));
  }

  canViewAdminstration() {
    return this.permissions$.pipe(
      map((x) => x.filter((y) => y.startsWith('View'))),
      map((x) => x.length > 0)
    );
  }

  hasPermission(permission: string) {
    return this.permissions$.pipe(map((x) => x.includes(permission)));
  }

  loadTeamPermissions(
    viewId?: string,
    teamId?: string,
    includeAllViewTeams?: boolean
  ) {
    return this.teamPermissionsApi
      .getMyTeamPermissions(viewId, teamId, includeAllViewTeams)
      .pipe(tap((x) => this.teamPermissionsSubject.next(x)));
  }

  // Team ids the user can manage (claim includes the ManageTeam permission). A
  // ManageTeam grant requires team membership, so these claims reliably enumerate
  // the teams a non-ManageView user is allowed to manage.
  public manageableTeamIds$ = this.teamPermissions$.pipe(
    map((claims) => this.getManageableTeamIds(claims))
  );

  // Pure helper: team ids from the given claims that include the ManageTeam
  // permission. Shared with consumers that read freshly-loaded claims directly
  // (e.g. the Manage Teams dialog) so the filter logic is not duplicated.
  public getManageableTeamIds(claims: TeamPermissionsClaim[]): string[] {
    return claims
      .filter((claim) =>
        this.toTeamPermissions(claim.permissionValues ?? []).includes(
          TeamPermission.ManageTeam
        )
      )
      .map((claim) => claim.teamId)
      .filter((teamId): teamId is string => teamId != null);
  }

  // True when the user can manage at least one team.
  public canManageAnyTeam$ = this.manageableTeamIds$.pipe(
    map((ids) => ids.length > 0)
  );

  can(
    permission: SystemPermission,
    teamId?: string,
    teamPermission?: TeamPermission,
    viewPermission?: ViewPermission
  ) {
    return combineLatest([this.permissions$, this.teamPermissions$]).pipe(
      map(([permissions, teamPermissionClaims]) => {
        if (permissions.includes(permission)) {
          return true;
        } else {
          let teamPermissions: TeamPermission[];
          let viewPermissions: ViewPermission[];

          if (teamId != null) {
            const teamPermissionClaim = teamPermissionClaims.find(
              (x) => x.teamId == teamId
            );

            teamPermissions = this.toTeamPermissions(
              teamPermissionClaim.permissionValues
            );
            viewPermissions = this.toViewPermissions(
              teamPermissionClaim.permissionValues
            );
          } else {
            const permissions = teamPermissionClaims.flatMap(
              (x) => x.permissionValues
            );

            teamPermissions = this.toTeamPermissions(permissions);
            viewPermissions = this.toViewPermissions(permissions);
          }

          if (
            (teamPermission != null &&
              teamPermissions.includes(teamPermission)) ||
            (viewPermission != null && viewPermissions.includes(viewPermission))
          ) {
            return true;
          }
        }

        return false;
      })
    );
  }

  private toTeamPermissions(permissions: string[]): TeamPermission[] {
    return permissions.filter((permission): permission is TeamPermission =>
      Object.values(TeamPermission).includes(permission as TeamPermission)
    );
  }

  private toViewPermissions(permissions: string[]): ViewPermission[] {
    return permissions.filter((permission): permission is ViewPermission =>
      Object.values(ViewPermission).includes(permission as ViewPermission)
    );
  }
}
