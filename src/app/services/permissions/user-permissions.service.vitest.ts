// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, firstValueFrom } from 'rxjs';
import { UserPermissionsService } from './user-permissions.service';
import {
  PermissionService,
  SystemPermission,
  TeamPermission,
  TeamPermissionsClaim,
  TeamPermissionService,
  ViewPermission,
} from '../../generated/player-api';
import { getDefaultProviders } from 'src/app/test-utils/vitest-default-providers';

function createService(
  overrides: {
    myPermissions?: string[];
    myTeamPermissions?: TeamPermissionsClaim[];
  } = {},
) {
  const { myPermissions = [], myTeamPermissions = [] } = overrides;

  TestBed.configureTestingModule({
    providers: [
      ...getDefaultProviders([
        {
          provide: PermissionService,
          useValue: { getMyPermissions: () => of(myPermissions) },
        },
        {
          provide: TeamPermissionService,
          useValue: {
            getMyTeamPermissions: () => of(myTeamPermissions),
          },
        },
      ]),
      UserPermissionsService,
    ],
  });

  return TestBed.inject(UserPermissionsService);
}

describe('UserPermissionsService', () => {
  /**
   * Verifies: the service instantiates under DI with empty permission stubs.
   * Interacts with: PermissionService/TeamPermissionService stubs, UserPermissionsService construction.
   * Data: createService() with default empty overrides.
   */
  it('should be created', () => {
    const service = createService();
    expect(service).toBeTruthy();
  });

  /**
   * Verifies: permissions$ exposes an array even before any explicit load.
   * Interacts with: UserPermissionsService.permissions$ (BehaviorSubject seed).
   * Data: default empty myPermissions.
   */
  it('should have permissions$ observable', async () => {
    const service = createService();
    const permissions = await firstValueFrom(service.permissions$);
    expect(Array.isArray(permissions)).toBe(true);
  });

  /**
   * Verifies: teamPermissions$ exposes an array even before any team permissions are loaded.
   * Interacts with: UserPermissionsService.teamPermissions$ (BehaviorSubject seed).
   * Data: default empty myTeamPermissions.
   */
  it('should have teamPermissions$ observable', async () => {
    const service = createService();
    const teamPermissions = await firstValueFrom(service.teamPermissions$);
    expect(Array.isArray(teamPermissions)).toBe(true);
  });

  /**
   * Verifies: load() fetches the caller's system permissions and publishes them on permissions$.
   * Interacts with: PermissionService.getMyPermissions (stub), UserPermissionsService.load, permissions$.
   * Data: myPermissions seeded with ViewViews and ViewUsers.
   */
  it('should have load method that fetches and updates permissions', async () => {
    const service = createService({
      myPermissions: [SystemPermission.ViewViews, SystemPermission.ViewUsers],
    });

    await firstValueFrom(service.load());
    const permissions = await firstValueFrom(service.permissions$);
    expect(permissions).toContain(SystemPermission.ViewViews);
    expect(permissions).toContain(SystemPermission.ViewUsers);
  });

  /**
   * Verifies: after load, hasPermission returns true for a granted system permission.
   * Interacts with: PermissionService.getMyPermissions (stub), UserPermissionsService.load + hasPermission.
   * Data: myPermissions seeded with ViewViews; checks ViewViews.
   */
  it('should have hasPermission method that checks for a specific permission', async () => {
    const service = createService({
      myPermissions: [SystemPermission.ViewViews],
    });

    await firstValueFrom(service.load());
    const result = await firstValueFrom(
      service.hasPermission(SystemPermission.ViewViews),
    );
    expect(result).toBe(true);
  });

  /**
   * Verifies: canViewAdminstration returns true when any View* permission is held (here ViewUsers).
   * Interacts with: PermissionService.getMyPermissions (stub), UserPermissionsService.load + canViewAdminstration.
   * Data: myPermissions seeded with ViewUsers only.
   */
  it('should have canViewAdminstration method that returns true when View permissions exist', async () => {
    const service = createService({
      myPermissions: [SystemPermission.ViewUsers],
    });

    await firstValueFrom(service.load());
    const result = await firstValueFrom(service.canViewAdminstration());
    expect(result).toBe(true);
  });

  /**
   * Verifies: can() returns true for a granted system permission when no team/view permission is supplied.
   * Interacts with: PermissionService.getMyPermissions (stub), UserPermissionsService.load + can.
   * Data: myPermissions seeded with ManageViews; checks ManageViews.
   */
  it('should have can method that checks system permission', async () => {
    const service = createService({
      myPermissions: [SystemPermission.ManageViews],
    });

    await firstValueFrom(service.load());
    const result = await firstValueFrom(
      service.can(SystemPermission.ManageViews),
    );
    expect(result).toBe(true);
  });

  /**
   * Verifies: loadTeamPermissions fetches and returns the caller's team permission claims.
   * Interacts with: TeamPermissionService.getMyTeamPermissions (stub), UserPermissionsService.loadTeamPermissions.
   * Data: single ManageTeam claim for team-1; called with (view-1, team-1, false).
   */
  it('should have loadTeamPermissions method', async () => {
    const mockTeamPerms: TeamPermissionsClaim[] = [
      { teamId: 'team-1', permissionValues: [TeamPermission.ManageTeam] },
    ];
    const service = createService({ myTeamPermissions: mockTeamPerms });

    const result = await firstValueFrom(
      service.loadTeamPermissions('view-1', 'team-1', false),
    );
    expect(result).toEqual(mockTeamPerms);
  });

  // Shared claims fixture includes a null-teamId ManageTeam grant that must be filtered out.
  describe('manageable teams', () => {
    const claims: TeamPermissionsClaim[] = [
      { teamId: 'team-1', permissionValues: [TeamPermission.ManageTeam] },
      { teamId: 'team-2', permissionValues: [TeamPermission.ViewTeam] },
      { teamId: 'team-3', permissionValues: [TeamPermission.ManageTeam] },
      // ManageTeam grant with a null teamId is filtered out.
      { teamId: null, permissionValues: [TeamPermission.ManageTeam] },
    ];

    /**
     * Verifies: getManageableTeamIds returns only the team ids whose claim grants ManageTeam, dropping ViewTeam-only and null-teamId entries.
     * Interacts with: UserPermissionsService.getManageableTeamIds (pure, no async load).
     * Data: shared claims fixture (team-1/team-3 ManageTeam, team-2 ViewTeam, null-id ManageTeam).
     */
    it('getManageableTeamIds keeps only ManageTeam claims with a team id', () => {
      const service = createService();
      expect(service.getManageableTeamIds(claims)).toEqual(['team-1', 'team-3']);
    });

    /**
     * Verifies: getManageableTeamIds returns an empty list when no claim grants ManageTeam.
     * Interacts with: UserPermissionsService.getManageableTeamIds (pure).
     * Data: single ViewTeam-only claim for team-1.
     */
    it('getManageableTeamIds returns empty when no claim grants ManageTeam', () => {
      const service = createService();
      expect(
        service.getManageableTeamIds([
          { teamId: 'team-1', permissionValues: [TeamPermission.ViewTeam] },
        ]),
      ).toEqual([]);
    });

    /**
     * Verifies: manageableTeamIds$ derives its ids from the loaded team permissions, matching getManageableTeamIds.
     * Interacts with: TeamPermissionService.getMyTeamPermissions (stub), loadTeamPermissions, manageableTeamIds$.
     * Data: shared claims fixture loaded via loadTeamPermissions().
     */
    it('manageableTeamIds$ derives ids from the loaded team permissions', async () => {
      const service = createService({ myTeamPermissions: claims });
      await firstValueFrom(service.loadTeamPermissions());
      expect(await firstValueFrom(service.manageableTeamIds$)).toEqual([
        'team-1',
        'team-3',
      ]);
    });

    /**
     * Verifies: canManageAnyTeam$ emits true when the loaded claims yield at least one manageable team.
     * Interacts with: TeamPermissionService.getMyTeamPermissions (stub), loadTeamPermissions, canManageAnyTeam$.
     * Data: shared claims fixture (has ManageTeam grants).
     */
    it('canManageAnyTeam$ is true when at least one team is manageable', async () => {
      const service = createService({ myTeamPermissions: claims });
      await firstValueFrom(service.loadTeamPermissions());
      expect(await firstValueFrom(service.canManageAnyTeam$)).toBe(true);
    });

    /**
     * Verifies: canManageAnyTeam$ emits false when no loaded claim grants ManageTeam.
     * Interacts with: TeamPermissionService.getMyTeamPermissions (stub), loadTeamPermissions, canManageAnyTeam$.
     * Data: single ViewTeam-only claim for team-1.
     */
    it('canManageAnyTeam$ is false when no team is manageable', async () => {
      const service = createService({
        myTeamPermissions: [
          { teamId: 'team-1', permissionValues: [TeamPermission.ViewTeam] },
        ],
      });
      await firstValueFrom(service.loadTeamPermissions());
      expect(await firstValueFrom(service.canManageAnyTeam$)).toBe(false);
    });
  });

  describe('hasPermission — all 12 SystemPermission values', () => {
    const allPermissions = Object.values(SystemPermission);

    /**
     * Verifies: per SystemPermission value, hasPermission returns true when that exact permission is granted and false when only a different one is (the false case is skipped when no distinct alternative exists).
     * Interacts with: PermissionService.getMyPermissions (stub), UserPermissionsService.load + hasPermission, looped over every SystemPermission.
     * Data: per iteration, myPermissions seeded with either [perm] or [some other perm].
     * Why: one header for the whole loop; the not-granted assertion is guarded so a single-value enum wouldn't false-fail.
     */
    for (const perm of allPermissions) {
      it(`should return true for ${perm} when granted`, async () => {
        const service = createService({ myPermissions: [perm] });
        await firstValueFrom(service.load());
        const result = await firstValueFrom(service.hasPermission(perm));
        expect(result).toBe(true);
      });

      it(`should return false for ${perm} when not granted`, async () => {
        const other = allPermissions.find((p) => p !== perm) ?? perm;
        const service = createService({ myPermissions: [other] });
        await firstValueFrom(service.load());
        const result = await firstValueFrom(service.hasPermission(perm));
        if (other !== perm) {
          expect(result).toBe(false);
        }
      });
    }
  });

  describe('canViewAdminstration()', () => {
    const viewPerms: SystemPermission[] = [
      SystemPermission.ViewViews,
      SystemPermission.ViewUsers,
      SystemPermission.ViewApplications,
      SystemPermission.ViewRoles,
      SystemPermission.ViewWebhookSubscriptions,
    ];

    const nonViewPerms: SystemPermission[] = [
      SystemPermission.ManageViews,
      SystemPermission.ManageUsers,
      SystemPermission.ManageApplications,
      SystemPermission.ManageRoles,
      SystemPermission.ManageWebhookSubscriptions,
      SystemPermission.CreateViews,
      SystemPermission.EditViews,
    ];

    /**
     * Verifies: canViewAdminstration returns true when the sole granted permission is any one of the View* admin permissions.
     * Interacts with: PermissionService.getMyPermissions (stub), load + canViewAdminstration, looped over viewPerms.
     * Data: per iteration, myPermissions seeded with a single View* permission.
     */
    for (const perm of viewPerms) {
      it(`should return true when only ${perm} is granted`, async () => {
        const service = createService({ myPermissions: [perm] });
        await firstValueFrom(service.load());
        const result = await firstValueFrom(service.canViewAdminstration());
        expect(result).toBe(true);
      });
    }

    /**
     * Verifies: canViewAdminstration returns false when the sole granted permission is a non-View admin permission (Manage/Create/Edit).
     * Interacts with: PermissionService.getMyPermissions (stub), load + canViewAdminstration, looped over nonViewPerms.
     * Data: per iteration, myPermissions seeded with a single non-View* permission.
     */
    for (const perm of nonViewPerms) {
      it(`should return false when only ${perm} is granted`, async () => {
        const service = createService({ myPermissions: [perm] });
        await firstValueFrom(service.load());
        const result = await firstValueFrom(service.canViewAdminstration());
        expect(result).toBe(false);
      });
    }

    /**
     * Verifies: canViewAdminstration returns false when no permissions are granted at all.
     * Interacts with: PermissionService.getMyPermissions (stub), load + canViewAdminstration.
     * Data: empty myPermissions.
     */
    it('should return false when no permissions are granted', async () => {
      const service = createService({ myPermissions: [] });
      await firstValueFrom(service.load());
      const result = await firstValueFrom(service.canViewAdminstration());
      expect(result).toBe(false);
    });

    /**
     * Verifies: canViewAdminstration returns true when a View* permission is present alongside non-View* ones.
     * Interacts with: PermissionService.getMyPermissions (stub), load + canViewAdminstration.
     * Data: myPermissions seeded with ViewViews and ManageUsers.
     */
    it('should return true when a mix of View* and Manage* permissions are granted', async () => {
      const service = createService({
        myPermissions: [
          SystemPermission.ViewViews,
          SystemPermission.ManageUsers,
        ],
      });
      await firstValueFrom(service.load());
      const result = await firstValueFrom(service.canViewAdminstration());
      expect(result).toBe(true);
    });
  });

  describe('can()', () => {
    /**
     * Verifies: can() returns true purely on a granted system permission (no team/view args).
     * Interacts with: PermissionService.getMyPermissions (stub), load + can.
     * Data: myPermissions seeded with CreateViews; checks CreateViews.
     */
    it('should return true when the system permission is granted', async () => {
      const service = createService({
        myPermissions: [SystemPermission.CreateViews],
      });
      await firstValueFrom(service.load());
      const result = await firstValueFrom(
        service.can(SystemPermission.CreateViews),
      );
      expect(result).toBe(true);
    });

    /**
     * Verifies: can() returns false when the system permission is absent and no team permissions exist.
     * Interacts with: PermissionService.getMyPermissions (stub), load + can.
     * Data: empty myPermissions; checks ManageViews.
     */
    it('should return false when the system permission is absent and no team perms', async () => {
      const service = createService({ myPermissions: [] });
      await firstValueFrom(service.load());
      const result = await firstValueFrom(
        service.can(SystemPermission.ManageViews),
      );
      expect(result).toBe(false);
    });

    /**
     * Verifies: can() falls back to a matching team permission to return true when the system permission is absent.
     * Interacts with: getMyPermissions + getMyTeamPermissions (stubs), load + loadTeamPermissions + can.
     * Data: empty myPermissions; team-1 claim with EditTeam; can(ManageViews, undefined, EditTeam).
     */
    it('should return true when system permission absent but teamPermission is present', async () => {
      const teamPerms: TeamPermissionsClaim[] = [
        { teamId: 'team-1', permissionValues: [TeamPermission.EditTeam] },
      ];
      const service = createService({
        myPermissions: [],
        myTeamPermissions: teamPerms,
      });
      await firstValueFrom(service.load());
      await firstValueFrom(service.loadTeamPermissions());
      const result = await firstValueFrom(
        service.can(
          SystemPermission.ManageViews,
          undefined,
          TeamPermission.EditTeam,
        ),
      );
      expect(result).toBe(true);
    });

    /**
     * Verifies: can() falls back to a matching view permission (carried in a team claim) to return true.
     * Interacts with: getMyPermissions + getMyTeamPermissions (stubs), load + loadTeamPermissions + can.
     * Data: empty myPermissions; team-1 claim with ViewPermission.ManageView; can(ManageViews, undefined, undefined, ManageView).
     */
    it('should return true when system permission absent but viewPermission is present', async () => {
      const teamPerms: TeamPermissionsClaim[] = [
        { teamId: 'team-1', permissionValues: [ViewPermission.ManageView] },
      ];
      const service = createService({
        myPermissions: [],
        myTeamPermissions: teamPerms,
      });
      await firstValueFrom(service.load());
      await firstValueFrom(service.loadTeamPermissions());
      const result = await firstValueFrom(
        service.can(
          SystemPermission.ManageViews,
          undefined,
          undefined,
          ViewPermission.ManageView,
        ),
      );
      expect(result).toBe(true);
    });

    /**
     * Verifies: can() returns false when none of the system, team, or view permissions are present.
     * Interacts with: getMyPermissions + getMyTeamPermissions (empty stubs), load + loadTeamPermissions + can.
     * Data: empty permissions and claims; can(ManageViews, undefined, ManageTeam, EditView).
     */
    it('should return false when nothing is present', async () => {
      const service = createService({
        myPermissions: [],
        myTeamPermissions: [],
      });
      await firstValueFrom(service.load());
      await firstValueFrom(service.loadTeamPermissions());
      const result = await firstValueFrom(
        service.can(
          SystemPermission.ManageViews,
          undefined,
          TeamPermission.ManageTeam,
          ViewPermission.EditView,
        ),
      );
      expect(result).toBe(false);
    });

    /**
     * Verifies: when a teamId is passed, can() evaluates only that team's claim — true for the team holding ManageTeam, false for the team lacking it.
     * Interacts with: getMyPermissions + getMyTeamPermissions (stubs), load + loadTeamPermissions + can.
     * Data: team-A has ManageTeam, team-B has none; can(ManageViews, 'team-A'|'team-B', ManageTeam).
     */
    it('should only check the specified teamId when teamId is provided', async () => {
      const teamPerms: TeamPermissionsClaim[] = [
        { teamId: 'team-A', permissionValues: [TeamPermission.ManageTeam] },
        { teamId: 'team-B', permissionValues: [] },
      ];
      const service = createService({
        myPermissions: [],
        myTeamPermissions: teamPerms,
      });
      await firstValueFrom(service.load());
      await firstValueFrom(service.loadTeamPermissions());

      const resultA = await firstValueFrom(
        service.can(
          SystemPermission.ManageViews,
          'team-A',
          TeamPermission.ManageTeam,
        ),
      );
      expect(resultA).toBe(true);

      const resultB = await firstValueFrom(
        service.can(
          SystemPermission.ManageViews,
          'team-B',
          TeamPermission.ManageTeam,
        ),
      );
      expect(resultB).toBe(false);
    });
  });

  describe('edge cases', () => {
    /**
     * Verifies: with no permissions loaded, hasPermission returns false for every SystemPermission value.
     * Interacts with: PermissionService.getMyPermissions (empty stub), load + hasPermission looped over all values.
     * Data: empty myPermissions.
     */
    it('should return false for all hasPermission checks when permissions are empty', async () => {
      const service = createService({ myPermissions: [] });
      await firstValueFrom(service.load());
      for (const perm of Object.values(SystemPermission)) {
        const result = await firstValueFrom(service.hasPermission(perm));
        expect(result).toBe(false);
      }
    });

    /**
     * Verifies: hasPermission resolves true for each of several granted permissions and false for an ungranted one.
     * Interacts with: PermissionService.getMyPermissions (stub), load + hasPermission.
     * Data: myPermissions seeded with CreateViews/ViewViews/ManageUsers; ManageRoles checked as absent.
     */
    it('should handle multiple system permissions simultaneously', async () => {
      const perms: SystemPermission[] = [
        SystemPermission.CreateViews,
        SystemPermission.ViewViews,
        SystemPermission.ManageUsers,
      ];
      const service = createService({ myPermissions: perms });
      await firstValueFrom(service.load());
      for (const perm of perms) {
        const result = await firstValueFrom(service.hasPermission(perm));
        expect(result).toBe(true);
      }
      const absent = await firstValueFrom(
        service.hasPermission(SystemPermission.ManageRoles),
      );
      expect(absent).toBe(false);
    });
  });
});
