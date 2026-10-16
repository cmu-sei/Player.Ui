// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, firstValueFrom, Observable, throwError } from 'rxjs';
import { recordEmissions } from '../../test-utils/record-emissions';
import { RolesService } from './roles.service';
import {
  CreateRoleCommand,
  EditRoleCommand,
  Role,
  RoleService,
} from '../../generated/player-api';
import { ApiStub, endpointStub } from '../../test-utils/api-stub';
import { unstubbed } from '../../test-utils/unstubbed';

function role(overrides: Partial<Role> = {}): Role {
  return {
    id: 'r1',
    name: 'Alpha',
    immutable: false,
    allPermissions: false,
    permissions: [],
    ...overrides,
  };
}

function createService(api: ApiStub<RoleService>) {
  TestBed.configureTestingModule({
    providers: [{ provide: RoleService, useValue: api }, RolesService],
  });
  return TestBed.inject(RolesService);
}

async function names(svc: RolesService) {
  return (await firstValueFrom(svc.roles$)).map((r) => r.name);
}

describe('RolesService (services/permissions)', () => {
  /**
   * Verifies: roles$ emits an empty list before anything is loaded.
   * Interacts with: RolesService.roles$; RoleService as an unstubbed placeholder (any API call throws).
   * Data: no API call made.
   */
  it('roles$ starts empty', async () => {
    TestBed.configureTestingModule({
      providers: [unstubbed(RoleService), RolesService],
    });
    const svc = TestBed.inject(RolesService);
    expect(await firstValueFrom(svc.roles$)).toEqual([]);
  });

  /**
   * Verifies: load() requests the roles, passes the API result through to its subscriber, and
   *   publishes the roles on roles$.
   * Interacts with: RoleService.getRoles (vi.fn), RolesService.load, roles$.
   * Data: two mutable roles, Alpha and Bravo.
   */
  it('load() fetches the roles and publishes them on roles$', async () => {
    const fetched = [
      role({ id: 'r1', name: 'Alpha' }),
      role({ id: 'r2', name: 'Bravo' }),
    ];
    const getRoles = vi.fn(() => of(structuredClone(fetched)));
    const svc = createService({ getRoles });

    const returned = await firstValueFrom(svc.load());

    expect(getRoles).toHaveBeenCalledTimes(1);
    expect(returned.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(await names(svc)).toEqual(['Alpha', 'Bravo']);
  });

  /**
   * Verifies: roles$ lists immutable roles first, then orders each group by name using
   *   localeCompare (case-insensitive for these names).
   * Interacts with: RoleService.getRoles (stub), RolesService.load, roles$ sort.
   * Data: mutable 'charlie' and 'Bravo', immutable 'zulu' and 'Alpha', given out of order.
   */
  it('roles$ lists immutable roles first, then sorts each group by name', async () => {
    const svc = createService({
      getRoles: () =>
        of([
          role({ id: 'c', name: 'charlie', immutable: false }),
          role({ id: 'z', name: 'zulu', immutable: true }),
          role({ id: 'b', name: 'Bravo', immutable: false }),
          role({ id: 'a', name: 'Alpha', immutable: true }),
        ]),
    });

    await firstValueFrom(svc.load());

    expect(await names(svc)).toEqual(['Alpha', 'zulu', 'Bravo', 'charlie']);
  });

  /**
   * Verifies: a failed load passes the error to the subscriber and leaves roles$ as it was.
   * Interacts with: RoleService.getRoles (throws), RolesService.load, roles$.
   * Data: getRoles fails with an Error('500').
   */
  it('load() passes a failed request to the subscriber and leaves roles$ empty', async () => {
    const failure = new Error('500');
    const svc = createService({ getRoles: () => throwError(() => failure) });

    await expect(firstValueFrom(svc.load())).rejects.toBe(failure);
    expect(await firstValueFrom(svc.roles$)).toEqual([]);
  });

  /**
   * Verifies: editRole(id, command) sends the command for that id, returns the API's role, and
   *   replaces the cached role's fields with it without adding an entry.
   * Interacts with: RoleService.updateRole (vi.fn) and getRoles stub, RolesService.editRole, roles$.
   * Data: cached r1 'Old' and r2 'Other'; the API returns r1 renamed to 'Renamed'.
   */
  it('editRole() sends the command and replaces the cached role with the result', async () => {
    const updateRole = vi.fn(() =>
      of(role({ id: 'r1', name: 'Renamed', allPermissions: true })),
    );
    const svc = createService({
      getRoles: () =>
        of([
          role({ id: 'r1', name: 'Old' }),
          role({ id: 'r2', name: 'Other' }),
        ]),
      updateRole,
    });
    await firstValueFrom(svc.load());
    const command: EditRoleCommand = { name: 'Renamed', allPermissions: true };

    const returned = await firstValueFrom(svc.editRole('r1', command));

    expect(updateRole).toHaveBeenCalledWith('r1', command);
    expect(returned.name).toBe('Renamed');
    const cached = await firstValueFrom(svc.roles$);
    expect(cached.map((r) => [r.id, r.name, r.allPermissions])).toEqual([
      ['r2', 'Other', false],
      ['r1', 'Renamed', true],
    ]);
  });

  /**
   * Verifies: createRole(command) sends the command, returns the API's role, and adds it to
   *   roles$ under the id the API assigned.
   * Interacts with: RoleService.createRole (vi.fn) and getRoles stub, RolesService.createRole, roles$.
   * Data: cached r1 'Alpha'; the API returns a new role 'new' named 'Bravo'.
   */
  it('createRole() sends the command and adds the created role to roles$', async () => {
    const createRole = vi.fn(() => of(role({ id: 'new', name: 'Bravo' })));
    const svc = createService({
      getRoles: () => of([role({ id: 'r1', name: 'Alpha' })]),
      createRole,
    });
    await firstValueFrom(svc.load());
    const command: CreateRoleCommand = { name: 'Bravo' };

    const returned = await firstValueFrom(svc.createRole(command));

    expect(createRole).toHaveBeenCalledWith(command);
    expect(returned.id).toBe('new');
    const cached = await firstValueFrom(svc.roles$);
    expect(cached.map((r) => [r.id, r.name])).toEqual([
      ['r1', 'Alpha'],
      ['new', 'Bravo'],
    ]);
  });

  /**
   * Verifies: a failed edit or create passes the API's error to the subscriber and leaves roles$
   *   exactly as loaded (no entry added, none renamed).
   * Interacts with: RoleService.getRoles stub and the row's endpoint (throws), RolesService.editRole or
   *   createRole, roles$.
   * Data: one row per method; cached r1 'Alpha'; the endpoint fails with an Error('403').
   */
  it.each<
    [
      string,
      keyof Pick<RoleService, 'updateRole' | 'createRole'>,
      (svc: RolesService) => Observable<Role>,
    ]
  >([
    [
      'editRole()',
      'updateRole',
      (svc) => svc.editRole('r1', { name: 'Renamed' }),
    ],
    ['createRole()', 'createRole', (svc) => svc.createRole({ name: 'Bravo' })],
  ])(
    '%s passes a failed %s request to the subscriber and leaves roles$ unchanged',
    async (_method, endpoint, call) => {
      const failure = new Error('403');
      const svc = createService({
        getRoles: () => of([role({ id: 'r1', name: 'Alpha' })]),
        ...endpointStub(RoleService, endpoint, () => throwError(() => failure)),
      });
      await firstValueFrom(svc.load());

      await expect(firstValueFrom(call(svc))).rejects.toBe(failure);
      expect(
        (await firstValueFrom(svc.roles$)).map((r) => [r.id, r.name]),
      ).toEqual([['r1', 'Alpha']]);
    },
  );

  /**
   * Verifies: deleteRole(id) deletes that role through the API and drops only it from roles$.
   * Interacts with: RoleService.deleteRole (vi.fn) and getRoles stub, RolesService.deleteRole, roles$.
   * Data: cached r1 and r2; r1 deleted.
   */
  it('deleteRole() deletes the role and drops it from roles$', async () => {
    const deleteRole = vi.fn(() => of(undefined));
    const svc = createService({
      getRoles: () =>
        of([
          role({ id: 'r1', name: 'Alpha' }),
          role({ id: 'r2', name: 'Bravo' }),
        ]),
      deleteRole,
    });
    await firstValueFrom(svc.load());

    await firstValueFrom(svc.deleteRole('r1'));

    expect(deleteRole).toHaveBeenCalledWith('r1');
    expect((await firstValueFrom(svc.roles$)).map((r) => r.id)).toEqual(['r2']);
  });

  /**
   * Verifies: a failed delete passes the error to the subscriber and keeps the role in roles$.
   * Interacts with: RoleService.deleteRole (throws) and getRoles stub, RolesService.deleteRole, roles$.
   * Data: cached r1; deleteRole fails with an Error('403').
   */
  it('deleteRole() keeps the role in roles$ when the request fails', async () => {
    const failure = new Error('403');
    const svc = createService({
      getRoles: () => of([role({ id: 'r1' })]),
      deleteRole: () => throwError(() => failure),
    });
    await firstValueFrom(svc.load());

    await expect(firstValueFrom(svc.deleteRole('r1'))).rejects.toBe(failure);
    expect((await firstValueFrom(svc.roles$)).map((r) => r.id)).toEqual(['r1']);
  });

  describe('upsert()', () => {
    /**
     * Verifies: upsert() with a cached id merges the given fields into that role, keeps its other
     *   fields and the list length, and emits the updated list.
     * Interacts with: getRoles stub, RolesService.upsert, roles$ via recordEmissions.
     * Data: cached r1 'Old' with allPermissions true; upsert('r1', { name: 'Updated' }).
     */
    it('merges the fields into the cached role and emits', async () => {
      const svc = createService({
        getRoles: () =>
          of([role({ id: 'r1', name: 'Old', allPermissions: true })]),
      });
      await firstValueFrom(svc.load());
      const seen = recordEmissions(svc.roles$);

      svc.upsert('r1', { name: 'Updated' });

      expect(seen).toHaveLength(2);
      expect(seen[1].map((r) => [r.id, r.name, r.allPermissions])).toEqual([
        ['r1', 'Updated', true],
      ]);
    });

    /**
     * Verifies: upsert() with an unknown id appends a role holding the given fields and that id,
     *   and emits the grown list.
     * Interacts with: getRoles stub, RolesService.upsert, roles$ via recordEmissions.
     * Data: cached r1 'Alpha'; upsert('r9', { name: 'Bravo' }).
     */
    it('appends a role under the given id when it is not cached and emits', async () => {
      const svc = createService({
        getRoles: () => of([role({ id: 'r1', name: 'Alpha' })]),
      });
      await firstValueFrom(svc.load());
      const seen = recordEmissions(svc.roles$);

      svc.upsert('r9', { name: 'Bravo' });

      expect(seen).toHaveLength(2);
      expect(seen[1].map((r) => [r.id, r.name])).toEqual([
        ['r1', 'Alpha'],
        ['r9', 'Bravo'],
      ]);
    });
  });

  /**
   * Verifies: remove() with an id that is not cached leaves every role in place but still emits.
   * Interacts with: getRoles stub, RolesService.remove, roles$ via recordEmissions.
   * Data: cached r1 and r2; remove('missing').
   */
  it('remove() of an id that is not cached keeps every role and emits', async () => {
    const svc = createService({
      getRoles: () =>
        of([
          role({ id: 'r1', name: 'Alpha' }),
          role({ id: 'r2', name: 'Bravo' }),
        ]),
    });
    await firstValueFrom(svc.load());
    const seen = recordEmissions(svc.roles$);

    svc.remove('missing');

    expect(seen).toHaveLength(2);
    expect(seen[1].map((r) => r.id)).toEqual(['r1', 'r2']);
  });
});
