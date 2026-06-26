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

  /**
   * Verifies: load() fetches from the API and the result becomes available (in order) on the permissions$ cache stream
   * Interacts with: PermissionService.getPermissions stub; service.load; service.permissions$
   * Data: two permissions built by the perm() helper (ids p1, p2)
   */
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

  /**
   * Verifies: permissions$ orders immutable entries first, then remaining entries by case-insensitive name
   * Interacts with: PermissionService.getPermissions stub; service.permissions$ sort logic
   * Data: three perm() fixtures with mixed casing/immutability (zeta immutable, Alpha/beta mutable)
   */
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

  /**
   * Verifies: editPermission() calls updatePermission(id, cmd) and replaces the cached entry with the API's returned permission
   * Interacts with: PermissionService.updatePermission spy and getPermissions stub; service.permissions$
   * Data: an existing perm 'p1' named 'Old' and an EditPermissionCommand { name: 'Renamed' }; API returns it renamed
   */
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

  /**
   * Verifies: createPermission() calls the API with the command and appends the returned permission to the cache
   * Interacts with: PermissionService.createPermission spy and getPermissions stub; service.permissions$
   * Data: an empty initial cache and a CreatePermissionCommand { name: 'New' }; API returns perm id 'new'
   */
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

  /**
   * Verifies: deletePermission() calls the API by id and drops that entry from the cached list
   * Interacts with: PermissionService.deletePermission spy and getPermissions stub; service.permissions$
   * Data: a two-entry cache (p1, p2); p1 is deleted, leaving only p2
   */
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
    /**
     * Verifies: upsert() with an existing id updates that entry's fields without growing the list
     * Interacts with: getPermissions stub; service.upsert; service.permissions$
     * Data: a single cached perm 'p1' named 'Old', upserted to name 'Updated'
     */
    it('mutates an existing entry in place', async () => {
      const svc = createService({ getPermissions: () => of([perm({ id: 'p1', name: 'Old' })]) });
      await firstValueFrom(svc.load());
      svc.upsert('p1', { name: 'Updated' });
      const cached = await firstValueFrom(svc.permissions$);
      expect(cached).toHaveLength(1);
      expect(cached[0].name).toBe('Updated');
    });

    /**
     * Verifies: upsert() with an unknown id appends a new cache entry rather than mutating an existing one
     * Interacts with: getPermissions stub; service.upsert; service.permissions$
     * Data: an empty cache, upserting id 'p9' name 'Brand New'
     */
    it('appends a new entry when the id is not present', async () => {
      const svc = createService({ getPermissions: () => of([]) });
      await firstValueFrom(svc.load());
      svc.upsert('p9', { name: 'Brand New' });
      const cached = await firstValueFrom(svc.permissions$);
      expect(cached.find((p) => p.id === 'p9')?.name).toBe('Brand New');
    });
  });
});
