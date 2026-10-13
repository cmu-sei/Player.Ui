// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Observable, of, throwError } from 'rxjs';
import { TeamPermissionScopesService } from './team-permission-scopes.service';
import { TeamPermissionScopeService } from '../../generated/player-api';
import { ApiStub } from '../../test-utils/api-stub';

function createService(api: ApiStub<TeamPermissionScopeService>) {
  TestBed.configureTestingModule({
    providers: [
      { provide: TeamPermissionScopeService, useValue: api },
      TeamPermissionScopesService,
    ],
  });
  return TestBed.inject(TeamPermissionScopesService);
}

describe('TeamPermissionScopesService', () => {
  /**
   * Verifies: addScope(teamId, targetTeamId) asks the API to scope the granting team onto the
   *   target team, in that argument order, and makes one request per call.
   * Interacts with: TeamPermissionScopeService.addTeamPermissionScope (vi.fn), TeamPermissionScopesService.addScope.
   * Data: granting team 'granting', target team 'target'; the API answers with a scope record.
   */
  it('addScope() scopes the granting team onto the target team and returns the result', async () => {
    const scope = { teamId: 'granting', targetTeamId: 'target' };
    const addTeamPermissionScope = vi.fn(
      (_teamId: string, _targetTeamId: string) => of(scope),
    );
    const svc = createService({ addTeamPermissionScope });

    const result = await firstValueFrom(svc.addScope('granting', 'target'));

    expect(addTeamPermissionScope.mock.calls).toEqual([['granting', 'target']]);
    expect(result).toEqual(scope);
  });

  /**
   * Verifies: removeScope(teamId, targetTeamId) asks the API to remove the granting team's scope
   *   from the target team, in that argument order, and makes one request per call.
   * Interacts with: TeamPermissionScopeService.removeTeamPermissionScope (vi.fn), TeamPermissionScopesService.removeScope.
   * Data: granting team 'granting', target team 'target'; the API answers with no body.
   */
  it('removeScope() removes the granting team scope from the target team', async () => {
    const removeTeamPermissionScope = vi.fn(
      (_teamId: string, _targetTeamId: string) => of(undefined),
    );
    const svc = createService({ removeTeamPermissionScope });

    const result = await firstValueFrom(svc.removeScope('granting', 'target'));

    expect(removeTeamPermissionScope.mock.calls).toEqual([
      ['granting', 'target'],
    ]);
    expect(result).toBeUndefined();
  });

  /**
   * Verifies: the service sends nothing until the caller subscribes (it returns the API's cold
   *   observable rather than subscribing itself).
   * Interacts with: TeamPermissionScopeService.addTeamPermissionScope (subscription counter).
   * Data: addScope called without subscribing, then subscribed once.
   */
  it('addScope() sends the request only when the caller subscribes', async () => {
    let subscriptions = 0;
    const svc = createService({
      addTeamPermissionScope: () =>
        new Observable<undefined>((sub) => {
          subscriptions++;
          sub.next(undefined);
          sub.complete();
        }),
    });

    const pending = svc.addScope('granting', 'target');
    expect(subscriptions).toBe(0);

    await firstValueFrom(pending);
    expect(subscriptions).toBe(1);
  });

  /**
   * Verifies: a failed request reaches the caller's error path unchanged, for both methods.
   * Interacts with: both TeamPermissionScopeService endpoints (throwing), TeamPermissionScopesService.
   * Data: each endpoint fails with an Error('403').
   */
  it('passes a failed request to the caller', async () => {
    const failure = new Error('403');
    const svc = createService({
      addTeamPermissionScope: () => throwError(() => failure),
      removeTeamPermissionScope: () => throwError(() => failure),
    });

    await expect(
      firstValueFrom(svc.addScope('granting', 'target')),
    ).rejects.toBe(failure);
    await expect(
      firstValueFrom(svc.removeScope('granting', 'target')),
    ).rejects.toBe(failure);
  });
});
