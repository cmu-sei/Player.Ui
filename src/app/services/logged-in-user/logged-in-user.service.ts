// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable, OnDestroy } from '@angular/core';
import { ComnAuthQuery } from '@cmusei/crucible-common';
import { User as AuthUser } from 'oidc-client-ts';
import { BehaviorSubject, Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import {
  RoleService,
  User as PlayerUser,
  UserService,
} from '../../generated/player-api';
// Used to display Super User text
export const SUPER_USER = 'Super User';

@Injectable({ providedIn: 'root' })
export class LoggedInUserService implements OnDestroy {
  public loggedInUser$: BehaviorSubject<AuthUser> = new BehaviorSubject(null);
  public isSuperUser$: BehaviorSubject<boolean> = new BehaviorSubject(false);
  unsubscribe$: Subject<null> = new Subject<null>();

  constructor(
    private userService: UserService,
    private authQuery: ComnAuthQuery,
    private roleService: RoleService
  ) {
    this.authQuery.user$
      .pipe(
        filter((user: AuthUser) => user != null),
        takeUntil(this.unsubscribe$)
      )
      .subscribe((user) => {
        this.setLoggedInUser(user);
      });
  }

  /**
   * Once a user is logged in, this obtains Player Api specific User data.
   * @param guid
   */
  public setLoggedInUser(authUser: AuthUser) {
    this.userService
      .getUser(authUser.profile.sub)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((playerUser: PlayerUser) => {
        // combine player properties into the AuthUser profile.
        authUser.profile = { ...authUser.profile, ...playerUser };
        this.isSuperUser$.next(authUser.profile.isSystemAdmin as boolean);
        this.loggedInUser$.next(authUser);
      });
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
