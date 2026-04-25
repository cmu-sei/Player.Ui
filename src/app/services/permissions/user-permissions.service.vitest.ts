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
  it('should be created', () => {
    const service = createService();
    expect(service).toBeTruthy();
  });

  it('should have permissions$ observable', async () => {
    const service = createService();
    const permissions = await firstValueFrom(service.permissions$);
    expect(Array.isArray(permissions)).toBe(true);
  });

  it('should have teamPermissions$ observable', async () => {
    const service = createService();
    const teamPermissions = await firstValueFrom(service.teamPermissions$);
    expect(Array.isArray(teamPermissions)).toBe(true);
  });

  it('should have load method that fetches and updates permissions', async () => {
    const service = createService({
      myPermissions: [SystemPermission.ViewViews, SystemPermission.ViewUsers],
    });

    await firstValueFrom(service.load());
    const permissions = await firstValueFrom(service.permissions$);
    expect(permissions).toContain(SystemPermission.ViewViews);
    expect(permissions).toContain(SystemPermission.ViewUsers);
  });

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

  it('should have canViewAdminstration method that returns true when View permissions exist', async () => {
    const service = createService({
      myPermissions: [SystemPermission.ViewUsers],
    });

    await firstValueFrom(service.load());
    const result = await firstValueFrom(service.canViewAdminstration());
    expect(result).toBe(true);
  });

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

  describe('hasPermission — all 12 SystemPermission values', () => {
    const allPermissions = Object.values(SystemPermission);

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

    for (const perm of viewPerms) {
      it(`should return true when only ${perm} is granted`, async () => {
        const service = createService({ myPermissions: [perm] });
        await firstValueFrom(service.load());
        const result = await firstValueFrom(service.canViewAdminstration());
        expect(result).toBe(true);
      });
    }

    for (const perm of nonViewPerms) {
      it(`should return false when only ${perm} is granted`, async () => {
        const service = createService({ myPermissions: [perm] });
        await firstValueFrom(service.load());
        const result = await firstValueFrom(service.canViewAdminstration());
        expect(result).toBe(false);
      });
    }

    it('should return false when no permissions are granted', async () => {
      const service = createService({ myPermissions: [] });
      await firstValueFrom(service.load());
      const result = await firstValueFrom(service.canViewAdminstration());
      expect(result).toBe(false);
    });

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

    it('should return false when the system permission is absent and no team perms', async () => {
      const service = createService({ myPermissions: [] });
      await firstValueFrom(service.load());
      const result = await firstValueFrom(
        service.can(SystemPermission.ManageViews),
      );
      expect(result).toBe(false);
    });

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
    it('should return false for all hasPermission checks when permissions are empty', async () => {
      const service = createService({ myPermissions: [] });
      await firstValueFrom(service.load());
      for (const perm of Object.values(SystemPermission)) {
        const result = await firstValueFrom(service.hasPermission(perm));
        expect(result).toBe(false);
      }
    });

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
