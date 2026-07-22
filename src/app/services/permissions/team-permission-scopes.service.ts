/*
Copyright 2025 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { inject, Injectable } from '@angular/core';
import { TeamPermissionScopeService } from '../../generated/player-api';

@Injectable({
  providedIn: 'root',
})
export class TeamPermissionScopesService {
  private teamPermissionScopeApi = inject(TeamPermissionScopeService);

  /**
   * Scopes the granting team's permissions onto the target team.
   */
  addScope(teamId: string, targetTeamId: string) {
    return this.teamPermissionScopeApi.addTeamPermissionScope(
      teamId,
      targetTeamId
    );
  }

  /**
   * Removes the granting team's permission scope from the target team.
   */
  removeScope(teamId: string, targetTeamId: string) {
    return this.teamPermissionScopeApi.removeTeamPermissionScope(
      teamId,
      targetTeamId
    );
  }
}
