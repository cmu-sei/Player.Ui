// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, firstValueFrom } from 'rxjs';
import { recordEmissions } from '../../test-utils/record-emissions';
import { RolesService } from './roles.service';
import {
  Permission,
  PermissionService,
  Role,
  RoleService,
} from '../../generated/player-api';

function role(overrides: Partial<Role> = {}): Role {
  return {
    id: 'r1',
    name: 'Alpha',
    immutable: false,
    permissions: [],
    ...overrides,
  };
}

function perm(id: string): Permission {
  return { id, name: id };
}

function createService(
  roleApi: Partial<Record<keyof RoleService, unknown>> = {},
  permApi: Partial<Record<keyof PermissionService, unknown>> = {},
) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: RoleService, useValue: roleApi },
      { provide: PermissionService, useValue: permApi },
      RolesService,
    ],
  });
  return TestBed.inject(RolesService);
}

describe('RolesService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  /**
   * Verifies: getRoles populates the cache so roles$ later emits the fetched roles in order.
   * Interacts with: RoleService.getRoles (stub returning of(...)), RolesService.getRoles, roles$.
   * Data: two-role list built via the role() factory (ids r1, r2).
   */
  it('getRoles() fetches and caches roles', async () => {
    const svc = createService({
      getRoles: () => of([role({ id: 'r1' }), role({ id: 'r2' })]),
    });
    await firstValueFrom(svc.getRoles());
    expect((await firstValueFrom(svc.roles$)).map((r) => r.id)).toEqual([
      'r1',
      'r2',
    ]);
  });

  /**
   * Verifies: roles$ ordering puts immutable roles ahead of mutable ones, then sorts by name within each group.
   * Interacts with: RoleService.getRoles (stub), RolesService.getRoles, roles$.
   * Data: mixed list where an immutable 'zeta' must precede mutable 'Alpha'/'beta'.
   */
  it('roles$ sorts immutable first, then by name', async () => {
    const svc = createService({
      getRoles: () =>
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
   * Verifies: editRole calls updateRole(id, role) and the returned role replaces the cached entry.
   * Interacts with: RoleService.updateRole (vi.fn) and getRoles stub, RolesService.editRole, roles$.
   * Data: cached role r1 'Old' updated to a 'Renamed' role object.
   */
  it('editRole() calls updateRole and upserts the result', async () => {
    const updateRole = vi.fn(() => of(role({ id: 'r1', name: 'Renamed' })));
    const svc = createService({
      getRoles: () => of([role({ id: 'r1', name: 'Old' })]),
      updateRole,
    });
    await firstValueFrom(svc.getRoles());
    const updated = role({ id: 'r1', name: 'Renamed' });
    await firstValueFrom(svc.editRole(updated));
    expect(updateRole).toHaveBeenCalledWith('r1', updated);
    expect(
      (await firstValueFrom(svc.roles$)).find((r) => r.id === 'r1')?.name,
    ).toBe('Renamed');
  });

  /**
   * Verifies: createRole appends the API-returned role (id 'new') to the cached list.
   * Interacts with: RoleService.createRole (vi.fn) and getRoles stub, RolesService.createRole, roles$.
   * Data: empty initial cache; created role named 'New' resolving to id 'new'.
   */
  it('createRole() adds the created role to the cache', async () => {
    const createRole = vi.fn(() => of(role({ id: 'new', name: 'New' })));
    const svc = createService({ getRoles: () => of([]), createRole });
    await firstValueFrom(svc.getRoles());
    await firstValueFrom(svc.createRole(role({ name: 'New' })));
    expect((await firstValueFrom(svc.roles$)).map((r) => r.id)).toContain(
      'new',
    );
  });

  /**
   * Verifies: deleteRole calls deleteRole(id) and removes that role from the cache, leaving the rest.
   * Interacts with: RoleService.deleteRole (vi.fn) and getRoles stub, RolesService.deleteRole, roles$.
   * Data: cached r1/r2; r1 deleted, expecting only r2 to remain.
   */
  it('deleteRole() removes the role from the cache', async () => {
    const deleteRole = vi.fn(() => of(undefined));
    const svc = createService({
      getRoles: () => of([role({ id: 'r1' }), role({ id: 'r2' })]),
      deleteRole,
    });
    await firstValueFrom(svc.getRoles());
    await firstValueFrom(svc.deleteRole('r1'));
    expect(deleteRole).toHaveBeenCalledWith('r1');
    expect((await firstValueFrom(svc.roles$)).map((r) => r.id)).toEqual(['r2']);
  });

  describe('addPermission()', () => {
    /**
     * Verifies: addPermission calls addPermissionToRole(roleId, permId), appends the permission to the
     *   cached role, and publishes the grown role on roles$.
     * Interacts with: PermissionService.addPermissionToRole (vi.fn) and RoleService.getRoles stub, RolesService.addPermission, roles$ via recordEmissions.
     * Data: role r1 with empty permissions; perm('p1') added.
     * Why: the permission is pushed onto the role object already held in the cached array, so a
     *   post-hoc read of roles$ sees it even if the subject never re-emits. Recording emissions is
     *   what proves subscribers were told.
     */
    it('calls the API, appends the permission to the cached role, and emits', async () => {
      const addPermissionToRole = vi.fn(() => of(undefined));
      const svc = createService(
        { getRoles: () => of([role({ id: 'r1', permissions: [] })]) },
        { addPermissionToRole },
      );
      await firstValueFrom(svc.getRoles());
      const seen = recordEmissions(svc.roles$);
      await firstValueFrom(svc.addPermission('r1', perm('p1')));
      expect(addPermissionToRole).toHaveBeenCalledWith('r1', 'p1');
      expect(seen).toHaveLength(2);
      expect(seen[1][0].permissions.map((p) => p.id)).toEqual(['p1']);
    });

    /**
     * Verifies: addPermission still calls the API but neither changes nor re-emits the cache when the
     *   target role is absent.
     * Interacts with: PermissionService.addPermissionToRole (vi.fn) and empty getRoles stub, RolesService.addPermission, roles$ via recordEmissions.
     * Data: empty role cache; addPermission targets non-existent id 'missing'.
     * Why: asserts the API call fires regardless while the cache mutation is guarded by role presence —
     *   the absent second emission is what makes "no-op" observable rather than inferred.
     */
    it('is a no-op on the cache when the role is not present', async () => {
      const addPermissionToRole = vi.fn(() => of(undefined));
      const svc = createService(
        { getRoles: () => of([]) },
        { addPermissionToRole },
      );
      await firstValueFrom(svc.getRoles());
      const seen = recordEmissions(svc.roles$);
      await firstValueFrom(svc.addPermission('missing', perm('p1')));
      expect(addPermissionToRole).toHaveBeenCalledWith('missing', 'p1');
      expect(seen).toEqual([[]]);
    });
  });

  /**
   * Verifies: removePermission calls removePermissionFromRole(roleId, permId), drops that permission
   *   from the cached role, and publishes the trimmed role on roles$.
   * Interacts with: PermissionService.removePermissionFromRole (vi.fn) and getRoles stub, RolesService.removePermission, roles$ via recordEmissions.
   * Data: role r1 holding p1 and p2; p1 removed, expecting only p2 to remain.
   * Why: the filtered array is assigned onto the role object already held in the cache, so a post-hoc
   *   read of roles$ sees the removal even if the subject never re-emits.
   */
  it('removePermission() calls the API, drops the permission, and emits', async () => {
    const removePermissionFromRole = vi.fn(() => of(undefined));
    const svc = createService(
      {
        getRoles: () =>
          of([role({ id: 'r1', permissions: [perm('p1'), perm('p2')] })]),
      },
      { removePermissionFromRole },
    );
    await firstValueFrom(svc.getRoles());
    const seen = recordEmissions(svc.roles$);
    await firstValueFrom(svc.removePermission('r1', 'p1'));
    expect(removePermissionFromRole).toHaveBeenCalledWith('r1', 'p1');
    expect(seen).toHaveLength(2);
    expect(seen[1][0].permissions.map((p) => p.id)).toEqual(['p2']);
  });

  describe('upsert()', () => {
    /**
     * Verifies: upsert with an unknown id appends a new role carrying the supplied fields, and pushes
     *   the updated cache onto roles$ as a new emission.
     * Interacts with: RoleService.getRoles stub, RolesService.upsert (synchronous), roles$ via recordEmissions.
     * Data: empty cache; upsert('r9', { name: 'Brand New' }).
     * Why: upsert mutates the cached array in place and re-emits that same reference, so a post-hoc
     *   read of roles$ passes even when the emission never happens. Recording snapshots as they
     *   arrive is what pins the notification.
     */
    it('appends a new role when the id is absent and emits the new cache', async () => {
      const svc = createService({ getRoles: () => of([]) });
      await firstValueFrom(svc.getRoles());
      const seen = recordEmissions(svc.roles$);
      svc.upsert('r9', { name: 'Brand New' });
      expect(seen).toHaveLength(2);
      expect(seen[1].find((r) => r.id === 'r9')?.name).toBe('Brand New');
    });
  });
});
