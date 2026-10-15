// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, Observable, of, firstValueFrom } from 'rxjs';
import { ComnAuthQuery } from '@cmusei/crucible-common';
import { User as AuthUser } from 'oidc-client-ts';
import { LoggedInUserService } from './logged-in-user.service';
import {
  PermissionService,
  SystemPermission,
  TeamPermissionService,
  User,
  UserService,
} from '../../generated/player-api';
import { UserPermissionsService } from '../permissions/user-permissions.service';
import { ApiStub } from '../../test-utils/api-stub';
import { permissionApiStubs } from '../../test-utils/mock-permission-data.service';

function authUser(
  sub: string,
  profile: Record<string, unknown> = {},
): AuthUser {
  return { profile: { sub, ...profile } } as unknown as AuthUser;
}

function createService(
  overrides: {
    user$?: BehaviorSubject<AuthUser>;
    getUser?: () => Observable<User>;
    system?: SystemPermission[];
  } = {},
) {
  const {
    user$ = new BehaviorSubject<AuthUser>(null),
    getUser = () => of({ id: 'p1', name: 'Player Name' }),
    system = [],
  } = overrides;

  const getUserSpy = vi.fn(getUser);
  // The real UserPermissionsService over the stubbed "my permissions"
  // endpoints, constructed (not loaded) here: logging in is what loads it.
  const permissionStubs = permissionApiStubs({ system });

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: ComnAuthQuery, useValue: { user$ } },
      {
        provide: UserService,
        useValue: { getUser: getUserSpy } satisfies ApiStub<UserService>,
      },
      { provide: PermissionService, useValue: permissionStubs.permissions },
      {
        provide: TeamPermissionService,
        useValue: permissionStubs.teamPermissions,
      },
      UserPermissionsService,
      LoggedInUserService,
    ],
  });

  return {
    service: TestBed.inject(LoggedInUserService),
    permissions: TestBed.inject(UserPermissionsService),
    user$,
    getMyPermissions: permissionStubs.permissions.getMyPermissions,
    getUserSpy,
  };
}

describe('LoggedInUserService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  /**
   * Verifies: with no logged-in auth user, neither the permissions load nor the player-user fetch is triggered
   * Interacts with: PermissionService.getMyPermissions and UserService.getUser stubs; ComnAuthQuery.user$ seam
   * Data: default user$ BehaviorSubject seeded with null
   */
  it('does nothing while the auth user is null', () => {
    const { getMyPermissions, getUserSpy } = createService();
    expect(getMyPermissions).not.toHaveBeenCalled();
    expect(getUserSpy).not.toHaveBeenCalled();
  });

  /**
   * Verifies: emitting an auth user loads the user's system permissions into the real UserPermissionsService and fetches the player user keyed by the auth sub
   * Interacts with: the real UserPermissionsService over PermissionService.getMyPermissions; UserService.getUser stub; ComnAuthQuery.user$
   * Data: a user$ that emits authUser('sub-1') after subscription; granted ViewViews and ManageUsers
   */
  it('loads permissions and the player user when a user logs in', async () => {
    const user$ = new BehaviorSubject<AuthUser>(null);
    const { permissions, getUserSpy } = createService({
      user$,
      system: [SystemPermission.ViewViews, SystemPermission.ManageUsers],
    });
    expect(await firstValueFrom(permissions.permissions$)).toEqual([]);
    user$.next(authUser('sub-1'));
    expect(await firstValueFrom(permissions.permissions$)).toEqual([
      SystemPermission.ViewViews,
      SystemPermission.ManageUsers,
    ]);
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
    expect((logged.profile as Record<string, unknown>).name).toBe(
      'Player Name',
    );
    expect((logged.profile as Record<string, unknown>).isSystemAdmin).toBe(
      true,
    );
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
