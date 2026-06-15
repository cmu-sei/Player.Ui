// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, firstValueFrom } from 'rxjs';
import { PermissionsService } from './permissions.service';
import {
  CreatePermissionCommand,
  EditPermissionCommand,
  Permission,
  PermissionService,
} from '../../generated/player-api';

function perm(overrides: Partial<Permission> = {}): Permission {
  return { id: 'p1', name: 'Alpha', immutable: false, ...overrides };
}

function createService(
  api: Partial<Record<keyof PermissionService, unknown>> = {},
) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: PermissionService, useValue: api },
      PermissionsService,
    ],
  });
  return TestBed.inject(PermissionsService);
}

describe('PermissionsService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('load() fetches permissions and pushes them into the cache', async () => {
    const svc = createService({
      getPermissions: () => of([perm({ id: 'p1' }), perm({ id: 'p2' })]),
    });
    await firstValueFrom(svc.load());
    expect((await firstValueFrom(svc.permissions$)).map((p) => p.id)).toEqual([
      'p1',
      'p2',
    ]);
  });

  it('permissions$ sorts immutable first, then by name case-insensitively', async () => {
    const svc = createService({
      getPermissions: () =>
        of([
          perm({ id: 'b', name: 'beta', immutable: false }),
          perm({ id: 'a', name: 'Alpha', immutable: false }),
          perm({ id: 'i', name: 'zeta', immutable: true }),
        ]),
    });
    await firstValueFrom(svc.load());
    expect((await firstValueFrom(svc.permissions$)).map((p) => p.id)).toEqual([
      'i', // immutable wins
      'a', // Alpha before beta
      'b',
    ]);
  });

  it('editPermission() calls the API and upserts the returned permission', async () => {
    const updatePermission = vi.fn(() =>
      of(perm({ id: 'p1', name: 'Renamed' })),
    );
    const svc = createService({
      getPermissions: () => of([perm({ id: 'p1', name: 'Old' })]),
      updatePermission,
    });
    await firstValueFrom(svc.load());
    const cmd: EditPermissionCommand = { name: 'Renamed' };
    await firstValueFrom(svc.editPermission('p1', cmd));
    expect(updatePermission).toHaveBeenCalledWith('p1', cmd);
    const cached = await firstValueFrom(svc.permissions$);
    expect(cached.find((p) => p.id === 'p1')?.name).toBe('Renamed');
  });

  it('createPermission() adds the new permission to the cache', async () => {
    const createPermission = vi.fn(() => of(perm({ id: 'new', name: 'New' })));
    const svc = createService({
      getPermissions: () => of([]),
      createPermission,
    });
    await firstValueFrom(svc.load());
    const cmd: CreatePermissionCommand = { name: 'New' };
    await firstValueFrom(svc.createPermission(cmd));
    expect(createPermission).toHaveBeenCalledWith(cmd);
    expect((await firstValueFrom(svc.permissions$)).map((p) => p.id)).toContain(
      'new',
    );
  });

  it('deletePermission() removes the permission from the cache', async () => {
    const deletePermission = vi.fn(() => of(undefined));
    const svc = createService({
      getPermissions: () => of([perm({ id: 'p1' }), perm({ id: 'p2' })]),
      deletePermission,
    });
    await firstValueFrom(svc.load());
    await firstValueFrom(svc.deletePermission('p1'));
    expect(deletePermission).toHaveBeenCalledWith('p1');
    expect((await firstValueFrom(svc.permissions$)).map((p) => p.id)).toEqual([
      'p2',
    ]);
  });

  describe('upsert()', () => {
    it('mutates an existing entry in place', async () => {
      const svc = createService({ getPermissions: () => of([perm({ id: 'p1', name: 'Old' })]) });
      await firstValueFrom(svc.load());
      svc.upsert('p1', { name: 'Updated' });
      const cached = await firstValueFrom(svc.permissions$);
      expect(cached).toHaveLength(1);
      expect(cached[0].name).toBe('Updated');
    });

    it('appends a new entry when the id is not present', async () => {
      const svc = createService({ getPermissions: () => of([]) });
      await firstValueFrom(svc.load());
      svc.upsert('p9', { name: 'Brand New' });
      const cached = await firstValueFrom(svc.permissions$);
      expect(cached.find((p) => p.id === 'p9')?.name).toBe('Brand New');
    });
  });
});
