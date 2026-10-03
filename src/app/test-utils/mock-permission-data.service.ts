// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// Provides player.ui's REAL UserPermissionsService over stubbed "my
// permissions" endpoints, so gate tests exercise the production rules
// (system permission first, then team and view permissions carried in team
// claims) instead of a re-implementation that can drift from them.

import { inject, Provider } from '@angular/core';
import { vi } from 'vitest';
import { of } from 'rxjs';
import {
  PermissionService,
  SystemPermission,
  TeamPermissionsClaim,
  TeamPermissionService,
} from '../generated/player-api';
import { UserPermissionsService } from '../services/permissions/user-permissions.service';
import { ApiStub } from './api-stub';

export interface PermissionGrants {
  /** System permissions, as `PermissionService.getMyPermissions` returns them. */
  system?: SystemPermission[];
  /**
   * Team claims, as `TeamPermissionService.getMyTeamPermissions` returns them.
   * Each claim's `permissionValues` carries both TeamPermission and
   * ViewPermission values for that team.
   */
  teams?: TeamPermissionsClaim[];
}

export function permissionApiStubs(grants: PermissionGrants = {}) {
  return {
    permissions: {
      getMyPermissions: vi.fn(() => of<string[]>([...(grants.system ?? [])])),
    } satisfies ApiStub<PermissionService>,
    teamPermissions: {
      getMyTeamPermissions: vi.fn(() =>
        of<TeamPermissionsClaim[]>(structuredClone(grants.teams ?? [])),
      ),
    } satisfies ApiStub<TeamPermissionService>,
  };
}

export function permissionDataProviders(
  grants: PermissionGrants = {},
): Provider[] {
  const stubs = permissionApiStubs(grants);
  return [
    { provide: PermissionService, useValue: stubs.permissions },
    { provide: TeamPermissionService, useValue: stubs.teamPermissions },
    {
      provide: UserPermissionsService,
      useFactory: () => {
        const service = new UserPermissionsService(
          inject(PermissionService),
          inject(TeamPermissionService),
        );
        // The app loads both on login (LoggedInUserService) and on entering a
        // view (PlayerComponent); components assume they are already loaded.
        service.load().subscribe();
        service.loadTeamPermissions().subscribe();
        return service;
      },
    },
  ];
}
