// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, firstValueFrom } from 'rxjs';
import { TeamRolesService } from './team-roles.service';
import {
  CreateTeamRoleCommand,
  EditTeamRoleCommand,
  TeamPermissionModel,
  TeamPermissionService,
  TeamRole,
  TeamRoleService,
} from '../../generated/player-api';

function role(overrides: Partial<TeamRole> = {}): TeamRole {
  return {
    id: 'r1',
    name: 'Alpha',
    immutable: false,
    permissions: [],
    ...overrides,
  };
}

function perm(id: string): TeamPermissionModel {
  return { id, name: id };
}

function createService(
  roleApi: Partial<Record<keyof TeamRoleService, unknown>> = {},
  permApi: Partial<Record<keyof TeamPermissionService, unknown>> = {},
) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: TeamRoleService, useValue: roleApi },
      { provide: TeamPermissionService, useValue: permApi },
      TeamRolesService,
    ],
  });
  return TestBed.inject(TeamRolesService);
}

describe('TeamRolesService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('getRoles() fetches and caches team roles', async () => {
    const svc = createService({
      getTeamRoles: () => of([role({ id: 'r1' }), role({ id: 'r2' })]),
    });
    await firstValueFrom(svc.getRoles());
    expect((await firstValueFrom(svc.roles$)).map((r) => r.id)).toEqual([
      'r1',
      'r2',
    ]);
  });

  it('roles$ sorts immutable first, then by name', async () => {
    const svc = createService({
      getTeamRoles: () =>
        of([
          role({ id: 'b', name: 'beta', immutable: false }),
          role({ id: 'a', name: 'Alpha', immutable: false }),
          role({ id: 'i', name: 'zeta', immutable: true }),
        ]),
    });
    await firstValueFrom(svc.getRoles());
    expect((await firstValueFrom(svc.roles$)).map((r) => r.id)).toEqual([
      'i',
      'a',
      'b',
    ]);
  });

  it('editRole() calls updateTeamRole and upserts the result', async () => {
    const updateTeamRole = vi.fn(() => of(role({ id: 'r1', name: 'Renamed' })));
    const svc = createService({
      getTeamRoles: () => of([role({ id: 'r1', name: 'Old' })]),
      updateTeamRole,
    });
    await firstValueFrom(svc.getRoles());
    const cmd: EditTeamRoleCommand = { name: 'Renamed' };
    await firstValueFrom(svc.editRole('r1', cmd));
    expect(updateTeamRole).toHaveBeenCalledWith('r1', cmd);
    expect(
      (await firstValueFrom(svc.roles$)).find((r) => r.id === 'r1')?.name,
    ).toBe('Renamed');
  });

  it('createRole() adds the created team role to the cache', async () => {
    const createTeamRole = vi.fn(() => of(role({ id: 'new', name: 'New' })));
    const svc = createService({ getTeamRoles: () => of([]), createTeamRole });
    await firstValueFrom(svc.getRoles());
    const cmd: CreateTeamRoleCommand = { name: 'New' };
    await firstValueFrom(svc.createRole(cmd));
    expect(createTeamRole).toHaveBeenCalledWith(cmd);
    expect((await firstValueFrom(svc.roles$)).map((r) => r.id)).toContain(
      'new',
    );
  });

  it('deleteRole() removes the team role from the cache', async () => {
    const deleteTeamRole = vi.fn(() => of(undefined));
    const svc = createService({
      getTeamRoles: () => of([role({ id: 'r1' }), role({ id: 'r2' })]),
      deleteTeamRole,
    });
    await firstValueFrom(svc.getRoles());
    await firstValueFrom(svc.deleteRole('r1'));
    expect(deleteTeamRole).toHaveBeenCalledWith('r1');
    expect((await firstValueFrom(svc.roles$)).map((r) => r.id)).toEqual(['r2']);
  });

  it('addPermission() calls the API and appends the permission to the role', async () => {
    const addTeamPermissionToRole = vi.fn(() => of(undefined));
    const svc = createService(
      { getTeamRoles: () => of([role({ id: 'r1', permissions: [] })]) },
      { addTeamPermissionToRole },
    );
    await firstValueFrom(svc.getRoles());
    await firstValueFrom(svc.addPermission('r1', perm('p1')));
    expect(addTeamPermissionToRole).toHaveBeenCalledWith('r1', 'p1');
    expect((await firstValueFrom(svc.roles$))[0].permissions.map((p) => p.id)).toEqual([
      'p1',
    ]);
  });

  it('removePermission() calls the API and drops the permission from the role', async () => {
    const removeTeamPermissionFromRole = vi.fn(() => of(undefined));
    const svc = createService(
      {
        getTeamRoles: () =>
          of([role({ id: 'r1', permissions: [perm('p1'), perm('p2')] })]),
      },
      { removeTeamPermissionFromRole },
    );
    await firstValueFrom(svc.getRoles());
    await firstValueFrom(svc.removePermission('r1', 'p1'));
    expect(removeTeamPermissionFromRole).toHaveBeenCalledWith('r1', 'p1');
    expect((await firstValueFrom(svc.roles$))[0].permissions.map((p) => p.id)).toEqual([
      'p2',
    ]);
  });
});
