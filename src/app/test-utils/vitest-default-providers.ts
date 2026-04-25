// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { EnvironmentProviders, Provider, ProviderToken } from '@angular/core';
import { of } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';

// App Services
import { AppService } from '../app.service';
import { ApplicationsService } from '../services/applications/applications.service';
import { DialogService } from '../services/dialog/dialog.service';
import { ErrorService } from '../services/error/error.service';
import { FocusedAppService } from '../services/focused-app/focused-app.service';
import { LoggedInUserService } from '../services/logged-in-user/logged-in-user.service';
import { NotificationService } from '../services/notification/notification.service';
import { SystemMessageService } from '../services/system-message/system-message.service';
import { TeamsService } from '../services/teams/teams.service';
import { ViewsService } from '../services/views/views.service';

// Permission Services
import { PermissionsService } from '../services/permissions/permissions.service';
import { UserPermissionsService } from '../services/permissions/user-permissions.service';
import { TeamPermissionsService } from '../services/permissions/team-permissions.service';

// Role Services
import { RolesService } from '../services/roles/roles.service';
import { TeamRolesService } from '../services/roles/team-roles.service';

// Generated API Services
import {
  ApplicationService,
  FileService,
  HealthService,
  PermissionService,
  RoleService,
  TeamMembershipService,
  TeamPermissionService,
  TeamRoleService,
  TeamService,
  UserService,
  ViewMembershipService,
  ViewService,
  WebhookService,
} from '../generated/player-api';

// Akita Router
import { RouterQuery } from '@datorama/akita-ng-router-store';

// Common library
import {
  ComnSettingsService,
  ComnAuthService,
  ComnAuthQuery,
} from '@cmusei/crucible-common';

type AnyProvider = Provider | EnvironmentProviders;

function getProvideToken(provider: AnyProvider): ProviderToken<unknown> | null {
  if (typeof provider === 'function') return provider as ProviderToken<unknown>;
  const withProvide = provider as { provide?: ProviderToken<unknown> };
  return withProvide.provide ?? null;
}

export function getDefaultProviders(
  overrides?: readonly AnyProvider[]
): AnyProvider[] {
  const defaults: Provider[] = [
    // App Services
    { provide: AppService, useValue: {} },
    { provide: ApplicationsService, useValue: { load: () => of([]) } },
    { provide: DialogService, useValue: { confirm: () => of(true) } },
    { provide: ErrorService, useValue: { handleError: () => {} } },
    { provide: FocusedAppService, useValue: { focusedApp$: of(null) } },
    {
      provide: LoggedInUserService,
      useValue: {
        loggedInUser$: of({ name: '', id: '' }),
        setLoggedInUser: () => {},
      },
    },
    { provide: NotificationService, useValue: {} },
    { provide: SystemMessageService, useValue: {} },
    { provide: TeamsService, useValue: { load: () => of([]) } },
    { provide: ViewsService, useValue: { load: () => of([]) } },

    // Permission Services
    { provide: PermissionsService, useValue: { load: () => of([]) } },
    {
      provide: UserPermissionsService,
      useValue: {
        permissions$: of([]),
        teamPermissions$: of([]),
        loadPermissions: () => of([]),
      },
    },
    { provide: TeamPermissionsService, useValue: { load: () => of([]) } },

    // Role Services
    { provide: RolesService, useValue: { load: () => of([]) } },
    { provide: TeamRolesService, useValue: { load: () => of([]) } },

    // Generated API Services
    { provide: ApplicationService, useValue: {} },
    { provide: FileService, useValue: {} },
    { provide: HealthService, useValue: { healthCheck: () => of({}) } },
    { provide: PermissionService, useValue: {} },
    { provide: RoleService, useValue: {} },
    { provide: TeamMembershipService, useValue: {} },
    { provide: TeamPermissionService, useValue: {} },
    { provide: TeamRoleService, useValue: {} },
    { provide: TeamService, useValue: {} },
    { provide: UserService, useValue: {} },
    { provide: ViewMembershipService, useValue: {} },
    { provide: ViewService, useValue: {} },
    { provide: WebhookService, useValue: {} },

    // Akita Router
    {
      provide: RouterQuery,
      useValue: {
        selectQueryParams: () => of(null),
        select: () => of(null),
      },
    },

    // Common library services
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
    { provide: MatDialogRef, useValue: { close: () => {} } },

    // Router
    {
      provide: ActivatedRoute,
      useValue: {
        params: of({}),
        paramMap: of({ get: () => null, has: () => false }),
        queryParams: of({}),
        queryParamMap: of({ get: () => null, has: () => false }),
        snapshot: {
          params: {},
          paramMap: { get: () => null, has: () => false },
        },
      },
    },
  ];

  if (!overrides?.length) return defaults;

  const overrideTokens = new Set(overrides.map(getProvideToken));
  const filtered = defaults.filter(
    (p) => !overrideTokens.has(getProvideToken(p))
  );
  return [...filtered, ...overrides];
}
