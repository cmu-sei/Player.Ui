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

  /**
   * Verifies: getRoles populates the cache so roles$ later emits the fetched team roles in order.
   * Interacts with: TeamRoleService.getTeamRoles (stub returning of(...)), TeamRolesService.getRoles, roles$.
   * Data: two-role list built via the role() factory (ids r1, r2).
   */
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

  /**
   * Verifies: roles$ ordering puts immutable team roles ahead of mutable ones, then sorts by name within each group.
   * Interacts with: TeamRoleService.getTeamRoles (stub), TeamRolesService.getRoles, roles$.
   * Data: mixed list where an immutable 'zeta' must precede mutable 'Alpha'/'beta'.
   */
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

  /**
   * Verifies: editRole calls updateTeamRole(id, cmd) and the returned role replaces the cached entry.
   * Interacts with: TeamRoleService.updateTeamRole (vi.fn) and getTeamRoles stub, TeamRolesService.editRole, roles$.
   * Data: cached role r1 'Old' plus an EditTeamRoleCommand { name: 'Renamed' }.
   */
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

  /**
   * Verifies: createRole calls createTeamRole(cmd) and appends the returned role (id 'new') to the cache.
   * Interacts with: TeamRoleService.createTeamRole (vi.fn) and getTeamRoles stub, TeamRolesService.createRole, roles$.
   * Data: empty initial cache; CreateTeamRoleCommand { name: 'New' } resolving to id 'new'.
   */
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

  /**
   * Verifies: deleteRole calls deleteTeamRole(id) and removes that role from the cache, leaving the rest.
   * Interacts with: TeamRoleService.deleteTeamRole (vi.fn) and getTeamRoles stub, TeamRolesService.deleteRole, roles$.
   * Data: cached r1/r2; r1 deleted, expecting only r2 to remain.
   */
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

  /**
   * Verifies: addPermission calls addTeamPermissionToRole(roleId, permId) and appends the permission to the cached role.
   * Interacts with: TeamPermissionService.addTeamPermissionToRole (vi.fn) and TeamRoleService.getTeamRoles stub, TeamRolesService.addPermission, roles$.
   * Data: role r1 with empty permissions; perm('p1') added.
   */
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

  /**
   * Verifies: removePermission calls removeTeamPermissionFromRole(roleId, permId) and drops that permission from the cached role.
   * Interacts with: TeamPermissionService.removeTeamPermissionFromRole (vi.fn) and getTeamRoles stub, TeamRolesService.removePermission, roles$.
   * Data: role r1 holding p1 and p2; p1 removed, expecting only p2 to remain.
   */
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
