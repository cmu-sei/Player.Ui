// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Provider } from '@angular/core';
import { of } from 'rxjs';
import {
  SystemPermission,
  TeamPermission,
  TeamPermissionsClaim,
  ViewPermission,
} from '../generated/player-api';
import { UserPermissionsService } from '../services/permissions/user-permissions.service';

export function userPermissionsProvider(
  systemPerms: SystemPermission[] = [],
  teamPermClaims: TeamPermissionsClaim[] = []
): Provider {
  return {
    provide: UserPermissionsService,
    useValue: {
      permissions$: of(systemPerms),
      teamPermissions$: of(teamPermClaims),
      load: () => of(systemPerms),
      loadTeamPermissions: () => of(teamPermClaims),
      canViewAdminstration: () =>
        of(systemPerms.filter((y) => y.startsWith('View')).length > 0),
      hasPermission: (p: string) =>
        of(systemPerms.includes(p as SystemPermission)),
      can: (
        permission: SystemPermission,
        teamId?: string,
        teamPermission?: TeamPermission,
        viewPermission?: ViewPermission
      ) => {
        if (systemPerms.includes(permission)) return of(true);

        let claimsToCheck: TeamPermissionsClaim[];
        if (teamId != null) {
          claimsToCheck = teamPermClaims.filter((c) => c.teamId === teamId);
        } else {
          claimsToCheck = teamPermClaims;
        }

        const teamValues = claimsToCheck.flatMap((c) => c.permissionValues ?? []);

        if (teamPermission != null && teamValues.includes(teamPermission as string))
          return of(true);
        if (viewPermission != null && teamValues.includes(viewPermission as string))
          return of(true);

        return of(false);
      },
    },
  };
}
