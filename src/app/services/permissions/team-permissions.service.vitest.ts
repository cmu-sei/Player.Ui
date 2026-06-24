// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, firstValueFrom } from 'rxjs';
import { TeamPermissionsService } from './team-permissions.service';
import {
  CreateTeamPermissionCommand,
  EditTeamPermissionCommand,
  TeamPermissionModel,
  TeamPermissionService,
} from '../../generated/player-api';

function tp(overrides: Partial<TeamPermissionModel> = {}): TeamPermissionModel {
  return { id: 'tp1', name: 'Alpha', immutable: false, ...overrides };
}

function createService(
  api: Partial<Record<keyof TeamPermissionService, unknown>> = {},
) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: TeamPermissionService, useValue: api },
      TeamPermissionsService,
    ],
  });
  return TestBed.inject(TeamPermissionsService);
}

describe('TeamPermissionsService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  /**
   * Verifies: load() fetches from the API and the entries become available (in order) on teamPermissions$
   * Interacts with: TeamPermissionService.getTeamPermissions stub; service.load; service.teamPermissions$
   * Data: two tp() fixtures (ids tp1, tp2)
   */
  it('load() fetches and caches team permissions', async () => {
    const svc = createService({
      getTeamPermissions: () => of([tp({ id: 'tp1' }), tp({ id: 'tp2' })]),
    });
    await firstValueFrom(svc.load());
    expect(
      (await firstValueFrom(svc.teamPermissions$)).map((p) => p.id),
    ).toEqual(['tp1', 'tp2']);
  });

  /**
   * Verifies: teamPermissions$ drops entries lacking a name, then orders immutable first and the rest by case-insensitive name
   * Interacts with: TeamPermissionService.getTeamPermissions stub; service.teamPermissions$ filter+sort logic
   * Data: four tp() fixtures including one with name undefined (filtered) and mixed casing/immutability
   */
  it('teamPermissions$ filters out entries without a name and sorts', async () => {
    const svc = createService({
      getTeamPermissions: () =>
        of([
          tp({ id: 'noname', name: undefined }),
          tp({ id: 'b', name: 'beta', immutable: false }),
          tp({ id: 'i', name: 'zeta', immutable: true }),
          tp({ id: 'a', name: 'Alpha', immutable: false }),
        ]),
    });
    await firstValueFrom(svc.load());
    expect(
      (await firstValueFrom(svc.teamPermissions$)).map((p) => p.id),
    ).toEqual(['i', 'a', 'b']); // 'noname' filtered out
  });

  /**
   * Verifies: editTeamPermission() calls updateTeamPermission(id, cmd) and replaces the cached entry with the API result
   * Interacts with: TeamPermissionService.updateTeamPermission spy and getTeamPermissions stub; service.teamPermissions$
   * Data: an existing tp 'tp1' named 'Old' and an EditTeamPermissionCommand { name: 'New' }
   */
  it('editTeamPermission() calls the API and upserts', async () => {
    const updateTeamPermission = vi.fn(() => of(tp({ id: 'tp1', name: 'New' })));
    const svc = createService({
      getTeamPermissions: () => of([tp({ id: 'tp1', name: 'Old' })]),
      updateTeamPermission,
    });
    await firstValueFrom(svc.load());
    const cmd: EditTeamPermissionCommand = { name: 'New' };
    await firstValueFrom(svc.editTeamPermission('tp1', cmd));
    expect(updateTeamPermission).toHaveBeenCalledWith('tp1', cmd);
    const cached = await firstValueFrom(svc.teamPermissions$);
    expect(cached.find((p) => p.id === 'tp1')?.name).toBe('New');
  });

  /**
   * Verifies: createTeamPermission() calls the API with the command and appends the returned entry to the cache
   * Interacts with: TeamPermissionService.createTeamPermission spy and getTeamPermissions stub; service.teamPermissions$
   * Data: an empty initial cache and a CreateTeamPermissionCommand { name: 'New' }; API returns id 'new'
   */
  it('createTeamPermission() adds the new permission to the cache', async () => {
    const createTeamPermission = vi.fn(() => of(tp({ id: 'new', name: 'New' })));
    const svc = createService({
      getTeamPermissions: () => of([]),
      createTeamPermission,
    });
    await firstValueFrom(svc.load());
    const cmd: CreateTeamPermissionCommand = { name: 'New' };
    await firstValueFrom(svc.createTeamPermission(cmd));
    expect(createTeamPermission).toHaveBeenCalledWith(cmd);
    expect(
      (await firstValueFrom(svc.teamPermissions$)).map((p) => p.id),
    ).toContain('new');
  });

  /**
   * Verifies: deleteTeamPermission() calls the API by id and removes that entry from the cache
   * Interacts with: TeamPermissionService.deleteTeamPermission spy and getTeamPermissions stub; service.teamPermissions$
   * Data: a two-entry cache (tp1, tp2); tp1 deleted, leaving tp2
   */
  it('deleteTeamPermission() removes from the cache', async () => {
    const deleteTeamPermission = vi.fn(() => of(undefined));
    const svc = createService({
      getTeamPermissions: () => of([tp({ id: 'tp1' }), tp({ id: 'tp2' })]),
      deleteTeamPermission,
    });
    await firstValueFrom(svc.load());
    await firstValueFrom(svc.deleteTeamPermission('tp1'));
    expect(deleteTeamPermission).toHaveBeenCalledWith('tp1');
    expect(
      (await firstValueFrom(svc.teamPermissions$)).map((p) => p.id),
    ).toEqual(['tp2']);
  });

  /**
   * Verifies: addToTeam() forwards directly to addTeamPermissionToTeam(teamId, permissionId) with no cache side effect
   * Interacts with: TeamPermissionService.addTeamPermissionToTeam spy; service.addToTeam
   * Data: team id 'team-1' and permission id 'tp1'
   */
  it('addToTeam() delegates to the API', async () => {
    const addTeamPermissionToTeam = vi.fn(() => of(undefined));
    const svc = createService({ addTeamPermissionToTeam });
    await firstValueFrom(svc.addToTeam('team-1', 'tp1'));
    expect(addTeamPermissionToTeam).toHaveBeenCalledWith('team-1', 'tp1');
  });

  /**
   * Verifies: removeFromTeam() forwards directly to removeTeamPermissionFromTeam(teamId, permissionId)
   * Interacts with: TeamPermissionService.removeTeamPermissionFromTeam spy; service.removeFromTeam
   * Data: team id 'team-1' and permission id 'tp1'
   */
  it('removeFromTeam() delegates to the API', async () => {
    const removeTeamPermissionFromTeam = vi.fn(() => of(undefined));
    const svc = createService({ removeTeamPermissionFromTeam });
    await firstValueFrom(svc.removeFromTeam('team-1', 'tp1'));
    expect(removeTeamPermissionFromTeam).toHaveBeenCalledWith('team-1', 'tp1');
  });

  describe('upsert()', () => {
    /**
     * Verifies: upsert() with an existing id updates that entry's fields without growing the list
     * Interacts with: getTeamPermissions stub; service.upsert; service.teamPermissions$
     * Data: a single cached tp 'tp1' named 'Old', upserted to name 'Updated'
     */
    it('mutates an existing entry in place', async () => {
      const svc = createService({
        getTeamPermissions: () => of([tp({ id: 'tp1', name: 'Old' })]),
      });
      await firstValueFrom(svc.load());
      svc.upsert('tp1', { name: 'Updated' });
      const cached = await firstValueFrom(svc.teamPermissions$);
      expect(cached).toHaveLength(1);
      expect(cached[0].name).toBe('Updated');
    });

    /**
     * Verifies: upsert() with an unknown id appends a new cache entry rather than mutating an existing one
     * Interacts with: getTeamPermissions stub; service.upsert; service.teamPermissions$
     * Data: an empty cache, upserting id 'tp9' name 'Brand New'
     */
    it('appends a new entry when the id is absent', async () => {
      const svc = createService({ getTeamPermissions: () => of([]) });
      await firstValueFrom(svc.load());
      svc.upsert('tp9', { name: 'Brand New' });
      const cached = await firstValueFrom(svc.teamPermissions$);
      expect(cached.find((p) => p.id === 'tp9')?.name).toBe('Brand New');
    });
  });
});
