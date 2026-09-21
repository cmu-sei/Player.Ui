// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { EnvironmentProviders, Provider, ProviderToken } from '@angular/core';
import { EMPTY, of } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

// App Services
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
import { TeamPermissionScopesService } from '../services/permissions/team-permission-scopes.service';

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

// Akita Router
import { RouterQuery } from '@datorama/akita-ng-router-store';

// Common library
import {
  ComnSettingsService,
  ComnAuthService,
  ComnAuthQuery,
} from '@cmusei/crucible-common';

type AnyProvider = Provider | EnvironmentProviders;

const PLACEHOLDER_PASSTHROUGH = new Set<string>(['ngOnDestroy', 'then']);
const PLACEHOLDER_DI_PROBED = new Set<string>(['name']);

function unstubbed(token: ProviderToken<unknown>): Provider {
  const name = ('name' in token ? token.name : String(token)).replace(
    /^_+/,
    '',
  );
  const fail = (prop: string) =>
    new Error(
      `${name}.${prop} was used by the code under test, but ${name} has no stub here — ` +
        `it is only a placeholder so unrelated tests can construct their component. ` +
        `Pass an explicit stub for this test: { provide: ${name}, useValue: { ${prop}: ... } }`,
    );
  const value = new Proxy(
    {},
    {
      get(target, prop) {
        if (
          typeof prop === 'symbol' ||
          prop in target ||
          PLACEHOLDER_PASSTHROUGH.has(prop)
        ) {
          return Reflect.get(target, prop);
        }
        if (PLACEHOLDER_DI_PROBED.has(prop)) {
          return () => {
            throw fail(prop);
          };
        }
        throw fail(prop);
      },
    },
  );
  return { provide: token, useValue: value };
}

function getProvideToken(provider: AnyProvider): ProviderToken<unknown> | null {
  if (typeof provider === 'function') return provider as ProviderToken<unknown>;
  const withProvide = provider as { provide?: ProviderToken<unknown> };
  return withProvide.provide ?? null;
}

export function getDefaultProviders(
  overrides?: readonly AnyProvider[],
): AnyProvider[] {
  const defaults: Provider[] = [
    // App Services
    unstubbed(ApplicationsService),
    unstubbed(DialogService),
    { provide: ErrorService, useValue: { handleError: () => {} } },
    { provide: FocusedAppService, useValue: { focusedAppUrl: of('') } },
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
    unstubbed(ViewsService),

    // Permission Services
    { provide: PermissionsService, useValue: { load: () => of([]) } },
    unstubbed(UserPermissionsService),
    { provide: TeamPermissionsService, useValue: { load: () => of([]) } },
    unstubbed(TeamPermissionScopesService),

    // Role Services
    unstubbed(RolesService),
    unstubbed(TeamRolesService),

    // Generated API Services
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
    unstubbed(XApiService),

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
        },
      },
    },
  ];

  if (!overrides?.length) return defaults;

  const overrideTokens = new Set(overrides.map(getProvideToken));
  const filtered = defaults.filter(
    (p) => !overrideTokens.has(getProvideToken(p)),
  );
  return [...filtered, ...overrides];
}
