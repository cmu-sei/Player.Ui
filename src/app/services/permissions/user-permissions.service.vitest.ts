// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, firstValueFrom } from 'rxjs';
import { UserPermissionsService } from './user-permissions.service';
import {
  PermissionService,
  SystemPermission,
  TeamPermissionService,
} from '../../generated/player-api';
import { getDefaultProviders } from 'src/app/test-utils/vitest-default-providers';

function createService(overrides: {
  myPermissions?: string[];
  myTeamPermissions?: any[];
} = {}) {
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
      myPermissions: [
        SystemPermission.ViewViews,
        SystemPermission.ViewUsers,
      ],
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
    const result = await firstValueFrom(service.hasPermission(SystemPermission.ViewViews));
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
    const result = await firstValueFrom(service.can(SystemPermission.ManageViews));
    expect(result).toBe(true);
  });

  it('should have loadTeamPermissions method', async () => {
    const mockTeamPerms = [
      { teamId: 'team-1', permissionValues: ['ManageTeam'] },
    ];
    const service = createService({ myTeamPermissions: mockTeamPerms });

    const result = await firstValueFrom(
      service.loadTeamPermissions('view-1', 'team-1', false)
    );
    expect(result).toEqual(mockTeamPerms);
  });
});
