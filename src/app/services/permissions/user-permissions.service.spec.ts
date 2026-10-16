// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { UserPermissionsService } from './user-permissions.service';
import {
  PermissionService,
  SystemPermission,
  TeamPermission,
  TeamPermissionsClaim,
  TeamPermissionService,
  ViewPermission,
} from '../../generated/player-api';
import { getDefaultProviders } from 'src/app/test-utils/default-test-providers';
import { permissionApiStubs } from '../../test-utils/mock-permission-data.service';

function createService(
  overrides: {
    myPermissions?: SystemPermission[];
    myTeamPermissions?: TeamPermissionsClaim[];
  } = {},
) {
  const { myPermissions = [], myTeamPermissions = [] } = overrides;
  // The shared "my permissions" endpoint stubs; the service under test is
  // constructed here rather than through permissionDataProviders(), which
  // would load it before the test does.
  const stubs = permissionApiStubs({
    system: myPermissions,
    teams: myTeamPermissions,
  });

  TestBed.configureTestingModule({
    providers: [
      ...getDefaultProviders([
        { provide: PermissionService, useValue: stubs.permissions },
        { provide: TeamPermissionService, useValue: stubs.teamPermissions },
      ]),
      UserPermissionsService,
    ],
  });

  return TestBed.inject(UserPermissionsService);
}

describe('UserPermissionsService', () => {
  /**
   * Verifies: both permission streams start empty and nothing is fetched until load() / loadTeamPermissions() is called.
   * Interacts with: the PermissionService and TeamPermissionService stubs (asserted unused); permissions$ and teamPermissions$.
   * Data: CreateViews and a ManageTeam claim waiting on the endpoints.
   */
  it('starts with empty permissions and fetches nothing until loaded', async () => {
    const service = createService({
      myPermissions: [SystemPermission.CreateViews],
      myTeamPermissions: [
        { teamId: 'team-1', permissionValues: [TeamPermission.ManageTeam] },
      ],
    });
    expect(await firstValueFrom(service.permissions$)).toEqual([]);
    expect(await firstValueFrom(service.teamPermissions$)).toEqual([]);
    expect(
      vi.mocked(TestBed.inject(PermissionService).getMyPermissions),
    ).not.toHaveBeenCalled();
    expect(
      vi.mocked(TestBed.inject(TeamPermissionService).getMyTeamPermissions),
    ).not.toHaveBeenCalled();
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

  // Shared claims fixture, including a ManageTeam grant with a null teamId.
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
      expect(service.getManageableTeamIds(claims)).toEqual([
        'team-1',
        'team-3',
      ]);
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
     * Verifies: hasPermission returns true for a SystemPermission that is granted.
     * Interacts with: PermissionService.getMyPermissions (stub), UserPermissionsService.load + hasPermission.
     * Data: one row per SystemPermission value; myPermissions is [perm].
     */
    it.each(allPermissions)(
      'returns true for %s when granted',
      async (perm) => {
        const service = createService({ myPermissions: [perm] });
        await firstValueFrom(service.load());
        expect(await firstValueFrom(service.hasPermission(perm))).toBe(true);
      },
    );

    /**
     * Verifies: hasPermission returns false for a SystemPermission when every other one is granted (near miss).
     * Interacts with: PermissionService.getMyPermissions (stub), UserPermissionsService.load + hasPermission.
     * Data: one row per SystemPermission value; myPermissions is every value except perm.
     */
    it.each(allPermissions)(
      'returns false for %s when only the other permissions are granted',
      async (perm) => {
        const service = createService({
          myPermissions: allPermissions.filter((p) => p !== perm),
        });
        await firstValueFrom(service.load());
        expect(await firstValueFrom(service.hasPermission(perm))).toBe(false);
      },
    );
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
     * Interacts with: PermissionService.getMyPermissions (stub), load + canViewAdminstration.
     * Data: one row per View* permission; myPermissions is [perm].
     */
    it.each(viewPerms)('returns true when only %s is granted', async (perm) => {
      const service = createService({ myPermissions: [perm] });
      await firstValueFrom(service.load());
      expect(await firstValueFrom(service.canViewAdminstration())).toBe(true);
    });

    /**
     * Verifies: canViewAdminstration returns false when the sole granted permission is a non-View admin permission (Manage/Create/Edit).
     * Interacts with: PermissionService.getMyPermissions (stub), load + canViewAdminstration.
     * Data: one row per non-View* permission; myPermissions is [perm].
     */
    it.each(nonViewPerms)(
      'returns false when only %s is granted',
      async (perm) => {
        const service = createService({ myPermissions: [perm] });
        await firstValueFrom(service.load());
        expect(await firstValueFrom(service.canViewAdminstration())).toBe(
          false,
        );
      },
    );

    /**
     * Verifies: canViewAdminstration returns false when every non-View* permission is granted together (near miss).
     * Interacts with: PermissionService.getMyPermissions (stub), load + canViewAdminstration.
     * Data: myPermissions is all of nonViewPerms.
     */
    it('returns false when all the Manage, Create and Edit permissions are granted', async () => {
      const service = createService({ myPermissions: nonViewPerms });
      await firstValueFrom(service.load());
      expect(await firstValueFrom(service.canViewAdminstration())).toBe(false);
    });

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
     * Verifies: can() returns false when every system permission except the required one is granted and there are no team claims (near miss).
     * Interacts with: PermissionService.getMyPermissions (stub), load + can.
     * Data: myPermissions is every SystemPermission except ManageViews; checks ManageViews.
     */
    it('returns false when every system permission but ManageViews is granted', async () => {
      const service = createService({
        myPermissions: Object.values(SystemPermission).filter(
          (p) => p !== SystemPermission.ManageViews,
        ),
      });
      await firstValueFrom(service.load());
      const result = await firstValueFrom(
        service.can(SystemPermission.ManageViews),
      );
      expect(result).toBe(false);
    });

    /**
     * Verifies: can() falls back to a matching team permission to return true when the system permission is absent.
     * Interacts with: getMyPermissions + getMyTeamPermissions (stubs), load + loadTeamPermissions + can.
     * Data: empty myPermissions; team-1 claim with ManageTeam; can(ManageViews, undefined, ManageTeam).
     */
    it('should return true when system permission absent but teamPermission is present', async () => {
      const teamPerms: TeamPermissionsClaim[] = [
        { teamId: 'team-1', permissionValues: [TeamPermission.ManageTeam] },
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
          TeamPermission.ManageTeam,
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
     * Verifies: can() returns false when the system grants and the team claim hold only the View-level neighbours of the required permissions (near miss).
     * Interacts with: getMyPermissions + getMyTeamPermissions (stubs), load + loadTeamPermissions + can.
     * Data: myPermissions [ViewViews, EditViews]; a team-1 claim with ViewTeam and ViewView;
     *   can(ManageViews, undefined, ManageTeam, ManageView), the topbar's showEditView$ shape.
     */
    it('returns false when only the View-level system, team and view permissions are granted', async () => {
      const service = createService({
        myPermissions: [SystemPermission.ViewViews, SystemPermission.EditViews],
        myTeamPermissions: [
          {
            teamId: 'team-1',
            permissionValues: [
              TeamPermission.ViewTeam,
              ViewPermission.ViewView,
            ],
          },
        ],
      });
      await firstValueFrom(service.load());
      await firstValueFrom(service.loadTeamPermissions());
      const result = await firstValueFrom(
        service.can(
          SystemPermission.ManageViews,
          undefined,
          TeamPermission.ManageTeam,
          ViewPermission.ManageView,
        ),
      );
      expect(result).toBe(false);
    });

    /**
     * Verifies: when a teamId is passed, can() evaluates only that team's claim: true for the team holding ManageTeam, false for the team holding only ViewTeam.
     * Interacts with: getMyPermissions + getMyTeamPermissions (stubs), load + loadTeamPermissions + can.
     * Data: team-A has ManageTeam, team-B has ViewTeam; can(ManageViews, teamId, ManageTeam).
     */
    it.each([
      ['team-A', true],
      ['team-B', false],
    ])(
      'checks only the claim of %s when a teamId is passed',
      async (teamId, expected) => {
        const service = createService({
          myPermissions: [],
          myTeamPermissions: [
            { teamId: 'team-A', permissionValues: [TeamPermission.ManageTeam] },
            { teamId: 'team-B', permissionValues: [TeamPermission.ViewTeam] },
          ],
        });
        await firstValueFrom(service.load());
        await firstValueFrom(service.loadTeamPermissions());
        const result = await firstValueFrom(
          service.can(
            SystemPermission.ManageViews,
            teamId,
            TeamPermission.ManageTeam,
          ),
        );
        expect(result).toBe(expected);
      },
    );
  });

  describe('can() with a teamId that has no claim', () => {
    /**
     * Verifies: can() with a teamId the user holds no claim for errors with a
     *   TypeError (current behavior).
     * Interacts with: getMyPermissions + getMyTeamPermissions (stubs), load + loadTeamPermissions + can.
     * Data: no system permissions; one claim for team-A; can(ManageViews, 'team-B', ManageTeam).
     */
    it('throws a TypeError for a team without a claim', async () => {
      const service = createService({
        myPermissions: [],
        myTeamPermissions: [
          { teamId: 'team-A', permissionValues: [TeamPermission.ManageTeam] },
        ],
      });
      await firstValueFrom(service.load());
      await firstValueFrom(service.loadTeamPermissions());

      // Current behavior; see agent-docs/ui-test-bugs/player.ui.md.
      await expect(
        firstValueFrom(
          service.can(
            SystemPermission.ManageViews,
            'team-B',
            TeamPermission.ManageTeam,
          ),
        ),
      ).rejects.toThrow(TypeError);
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
