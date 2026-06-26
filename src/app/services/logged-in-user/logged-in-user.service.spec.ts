// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, firstValueFrom } from 'rxjs';
import { ComnAuthQuery } from '@cmusei/crucible-common';
import { User as AuthUser } from 'oidc-client-ts';
import { LoggedInUserService } from './logged-in-user.service';
import { UserService } from '../../generated/player-api';
import { UserPermissionsService } from '../permissions/user-permissions.service';

function authUser(sub: string, profile: Record<string, unknown> = {}): AuthUser {
  return { profile: { sub, ...profile } } as unknown as AuthUser;
}

function createService(
  overrides: {
    user$?: BehaviorSubject<AuthUser>;
    getUser?: () => unknown;
    load?: () => unknown;
  } = {},
) {
  const {
    user$ = new BehaviorSubject<AuthUser>(null),
    getUser = () => of({ id: 'p1', name: 'Player Name' }),
    load = () => of([]),
  } = overrides;

  const loadSpy = vi.fn(load);
  const getUserSpy = vi.fn(getUser);

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: ComnAuthQuery, useValue: { user$ } },
      { provide: UserService, useValue: { getUser: getUserSpy } },
      { provide: UserPermissionsService, useValue: { load: loadSpy } },
      LoggedInUserService,
    ],
  });

  return {
    service: TestBed.inject(LoggedInUserService),
    user$,
    loadSpy,
    getUserSpy,
  };
}

describe('LoggedInUserService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  /**
   * Verifies: with no logged-in auth user, neither permissions load nor player-user fetch is triggered
   * Interacts with: UserPermissionsService.load and UserService.getUser spies; ComnAuthQuery.user$ seam
   * Data: default user$ BehaviorSubject seeded with null
   */
  it('does nothing while the auth user is null', () => {
    const { loadSpy, getUserSpy } = createService();
    expect(loadSpy).not.toHaveBeenCalled();
    expect(getUserSpy).not.toHaveBeenCalled();
  });

  /**
   * Verifies: emitting an auth user triggers permissions load and fetches the player user keyed by the auth sub
   * Interacts with: UserPermissionsService.load and UserService.getUser spies; ComnAuthQuery.user$
   * Data: a user$ that emits authUser('sub-1') after subscription
   */
  it('loads permissions and the player user when a user logs in', async () => {
    const user$ = new BehaviorSubject<AuthUser>(null);
    const { loadSpy, getUserSpy } = createService({ user$ });
    user$.next(authUser('sub-1'));
    expect(loadSpy).toHaveBeenCalled();
    expect(getUserSpy).toHaveBeenCalledWith('sub-1');
  });

  /**
   * Verifies: the fetched player user's fields are merged into the auth profile and exposed via loggedInUser$ alongside the original sub/email
   * Interacts with: UserService.getUser (overridden to return a user with isSystemAdmin); ComnAuthQuery.user$; service.loggedInUser$
   * Data: authUser('sub-1', { email }) plus a player user { id, name, isSystemAdmin: true }
   */
  it('merges the player user into the auth profile and emits loggedInUser$', async () => {
    const user$ = new BehaviorSubject<AuthUser>(null);
    const { service } = createService({
      user$,
      getUser: () => of({ id: 'p1', name: 'Player Name', isSystemAdmin: true }),
    });
    user$.next(authUser('sub-1', { email: 'a@test' }));

    const logged = await firstValueFrom(service.loggedInUser$);
    expect(logged.profile.sub).toBe('sub-1');
    expect(logged.profile.email).toBe('a@test');
    expect((logged.profile as Record<string, unknown>).name).toBe('Player Name');
    expect((logged.profile as Record<string, unknown>).isSystemAdmin).toBe(true);
  });

  /**
   * Verifies: after ngOnDestroy the subscription is torn down, so later auth user emissions no longer fetch the player user
   * Interacts with: UserService.getUser spy; ComnAuthQuery.user$; service.ngOnDestroy
   * Data: a user$ that emits a fresh authUser only after destroy; getUser spy cleared before that emission
   */
  it('stops reacting to user changes after ngOnDestroy', () => {
    const user$ = new BehaviorSubject<AuthUser>(null);
    const { service, getUserSpy } = createService({ user$ });
    service.ngOnDestroy();
    getUserSpy.mockClear();
    user$.next(authUser('sub-after-destroy'));
    expect(getUserSpy).not.toHaveBeenCalled();
  });
});
