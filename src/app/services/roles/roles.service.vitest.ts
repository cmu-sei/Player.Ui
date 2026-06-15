// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, firstValueFrom } from 'rxjs';
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

  it('createRole() adds the created role to the cache', async () => {
    const createRole = vi.fn(() => of(role({ id: 'new', name: 'New' })));
    const svc = createService({ getRoles: () => of([]), createRole });
    await firstValueFrom(svc.getRoles());
    await firstValueFrom(svc.createRole(role({ name: 'New' })));
    expect((await firstValueFrom(svc.roles$)).map((r) => r.id)).toContain(
      'new',
    );
  });

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
    it('calls the API and appends the permission to the cached role', async () => {
      const addPermissionToRole = vi.fn(() => of(undefined));
      const svc = createService(
        { getRoles: () => of([role({ id: 'r1', permissions: [] })]) },
        { addPermissionToRole },
      );
      await firstValueFrom(svc.getRoles());
      await firstValueFrom(svc.addPermission('r1', perm('p1')));
      expect(addPermissionToRole).toHaveBeenCalledWith('r1', 'p1');
      const cached = await firstValueFrom(svc.roles$);
      expect(cached[0].permissions.map((p) => p.id)).toEqual(['p1']);
    });

    it('is a no-op on the cache when the role is not present', async () => {
      const addPermissionToRole = vi.fn(() => of(undefined));
      const svc = createService(
        { getRoles: () => of([]) },
        { addPermissionToRole },
      );
      await firstValueFrom(svc.getRoles());
      await firstValueFrom(svc.addPermission('missing', perm('p1')));
      expect(addPermissionToRole).toHaveBeenCalledWith('missing', 'p1');
      expect(await firstValueFrom(svc.roles$)).toEqual([]);
    });
  });

  it('removePermission() calls the API and drops the permission from the role', async () => {
    const removePermissionFromRole = vi.fn(() => of(undefined));
    const svc = createService(
      {
        getRoles: () =>
          of([role({ id: 'r1', permissions: [perm('p1'), perm('p2')] })]),
      },
      { removePermissionFromRole },
    );
    await firstValueFrom(svc.getRoles());
    await firstValueFrom(svc.removePermission('r1', 'p1'));
    expect(removePermissionFromRole).toHaveBeenCalledWith('r1', 'p1');
    const cached = await firstValueFrom(svc.roles$);
    expect(cached[0].permissions.map((p) => p.id)).toEqual(['p2']);
  });

  describe('upsert()', () => {
    it('appends a new role when the id is absent', async () => {
      const svc = createService({ getRoles: () => of([]) });
      await firstValueFrom(svc.getRoles());
      svc.upsert('r9', { name: 'Brand New' });
      expect(
        (await firstValueFrom(svc.roles$)).find((r) => r.id === 'r9')?.name,
      ).toBe('Brand New');
    });
  });
});
