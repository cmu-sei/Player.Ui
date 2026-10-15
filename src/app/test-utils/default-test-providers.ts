// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { EMPTY, of } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import {
  ComnAuthQuery,
  ComnAuthService,
  ComnSettingsService,
  CrucibleDialogService,
} from '@cmusei/crucible-common';
import { AnyProvider, mergeProviders, unstubbed } from './unstubbed';

// 1. App services that components inject. player.ui keeps its state in
//    BehaviorSubject services rather than Akita stores, and those stay REAL,
//    like Akita data services: PermissionsService, TeamPermissionsService,
//    RolesService, TeamRolesService and UserPermissionsService are
//    `providedIn: 'root'` and are not listed, so specs get the real service
//    over the generated API placeholders below (gate tests prime
//    UserPermissionsService with permissionDataProviders()). ViewsService is
//    provided by AppModule rather than root, so it is listed as its real
//    class. ApplicationsService and TeamsService hold no state and call
//    HttpClient directly, so they stay placeholders.
import { ApplicationsService } from '../services/applications/applications.service';
import { DialogService } from '../services/dialog/dialog.service';
import { ErrorService } from '../services/error/error.service';
import { FocusedAppService } from '../services/focused-app/focused-app.service';
import { LoggedInUserService } from '../services/logged-in-user/logged-in-user.service';
import { NotificationService } from '../services/notification/notification.service';
import { SystemMessageService } from '../services/system-message/system-message.service';
import { TeamsService } from '../services/teams/teams.service';
import { ViewsService } from '../services/views/views.service';
import { XApiService as AppXApiService } from '../services/xapi/xapi.service';
import { TeamPermissionScopesService } from '../services/permissions/team-permission-scopes.service';

// 2. Every generated API service under src/app/generated/player-api.
import {
  ApplicationService,
  FileService,
  HealthService,
  PermissionService,
  RoleService,
  TeamMembershipService,
  TeamPermissionScopeService,
  TeamPermissionService,
  TeamRoleService,
  TeamService,
  UserService,
  ViewMembershipService,
  ViewService,
  WebhookService,
  XApiService,
} from '../generated/player-api';

// 3. RouterQuery: player.ui uses @datorama/akita-ng-router-store.
import { RouterQuery } from '@datorama/akita-ng-router-store';

export function getDefaultProviders(
  overrides?: readonly AnyProvider[],
): AnyProvider[] {
  const defaults: AnyProvider[] = [
    // App services
    unstubbed(ApplicationsService),
    unstubbed(DialogService),
    { provide: ErrorService, useValue: { handleError: () => {} } },
    // Real, as in AppModule: a BehaviorSubject state service with no dependencies.
    FocusedAppService,
    {
      provide: LoggedInUserService,
      useValue: {
        loggedInUser$: of({ name: '', id: '' }),
        setLoggedInUser: () => {},
      },
    },
    unstubbed(NotificationService),
    unstubbed(SystemMessageService),
    unstubbed(TeamsService),
    // Real, as in AppModule: it reads the ViewService/TeamService stubs.
    ViewsService,
    unstubbed(AppXApiService, 'XApiService (services/xapi)'),
    unstubbed(TeamPermissionScopesService),

    // Generated API services: one `unstubbed(...)` per service. A test that
    // needs an endpoint passes `{ provide: XService, useValue: xApi }` built
    // with `satisfies ApiStub<XService>`.
    unstubbed(ApplicationService),
    unstubbed(FileService),
    { provide: HealthService, useValue: { healthCheck: () => of({}) } },
    unstubbed(PermissionService),
    unstubbed(RoleService),
    unstubbed(TeamMembershipService),
    unstubbed(TeamPermissionScopeService),
    unstubbed(TeamPermissionService),
    unstubbed(TeamRoleService),
    unstubbed(TeamService),
    unstubbed(UserService),
    unstubbed(ViewMembershipService),
    unstubbed(ViewService),
    unstubbed(WebhookService),
    unstubbed(XApiService, 'XApiService (generated)'),

    // Akita router
    {
      provide: RouterQuery,
      useValue: {
        selectQueryParams: () => of(null),
        select: () => of(null),
      },
    },

    // Common library. CrucibleDialogService is root-provided: without this
    // placeholder the real confirm dialog would open in every spec.
    unstubbed(CrucibleDialogService),
    {
      provide: ComnSettingsService,
      useValue: {
        settings: {
          ApiUrl: '',
          AppTopBarText: 'Player',
          AppTopBarHexColor: '#0F1D47',
          AppTopBarHexTextColor: '#FFFFFF',
        },
      },
    },
    {
      provide: ComnAuthService,
      useValue: {
        isAuthenticated$: of(true),
        user$: of({}),
        logout: () => {},
      },
    },
    {
      provide: ComnAuthQuery,
      useValue: {
        userTheme$: of('light-theme'),
        isLoggedIn$: of(true),
      },
    },

    // Dialog tokens
    { provide: MAT_DIALOG_DATA, useValue: {} },
    {
      provide: MatDialogRef,
      useValue: {
        close: () => {},
        beforeClosed: () => EMPTY,
        afterClosed: () => EMPTY,
        keydownEvents: () => EMPTY,
      },
    },

    // Router
    {
      provide: ActivatedRoute,
      useValue: {
        params: of({}),
        paramMap: of(convertToParamMap({})),
        queryParams: of({}),
        queryParamMap: of(convertToParamMap({})),
        snapshot: {
          params: {},
          paramMap: convertToParamMap({}),
          queryParams: {},
          queryParamMap: convertToParamMap({}),
        },
      },
    },
  ];

  return mergeProviders(defaults, overrides);
}
