// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ApplicationConfig,
  provideZoneChangeDetection,
  ErrorHandler,
  importProvidersFrom,
} from '@angular/core';
import { environment } from '../environments/environment';
import { FocusedAppService } from './services/focused-app/focused-app.service';
import { NotificationService } from './services/notification/notification.service';
import { TeamsService } from './services/teams/teams.service';
import { LoggedInUserService } from './services/logged-in-user/logged-in-user.service';
import { ViewsService } from './services/views/views.service';
import { DialogService } from './services/dialog/dialog.service';
import { ApplicationsService } from './services/applications/applications.service';
import { SystemMessageService } from './services/system-message/system-message.service';
import { BASE_PATH } from './generated/player-api';
import {
  ComnSettingsService,
  provideCrucibleTheme,
  ComnSettingsModule,
  ComnAuthModule,
} from '@cmusei/crucible-common';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import {
  MAT_DIALOG_DEFAULT_OPTIONS,
  MatDialogConfig,
} from '@angular/material/dialog';
import { MAT_CARD_CONFIG } from '@angular/material/card';
import { ErrorService } from './services/error/error.service';
import {
  MAT_TOOLTIP_DEFAULT_OPTIONS,
  MatTooltipDefaultOptions,
} from '@angular/material/tooltip';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideRouter } from '@angular/router';
import { ROUTES } from './app.routes';
import { AkitaNgDevtools } from '@datorama/akita-ngdevtools';
import { AkitaNgRouterStoreModule } from '@datorama/akita-ng-router-store';
import { A11yModule } from '@angular/cdk/a11y';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

/** Custom options to configure the tooltip's default show/hide delays. */
export const myCustomTooltipDefaults: MatTooltipDefaultOptions = {
  showDelay: 1000,
  hideDelay: 0,
  touchendHideDelay: 1000,
};

export function getBasePath(settingsSvc: ComnSettingsService) {
  return settingsSvc.settings.ApiUrl;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection(),
    importProvidersFrom(
      environment.production ? [] : AkitaNgDevtools.forRoot(),
      AkitaNgRouterStoreModule,
      ComnSettingsModule.forRoot(),
      ComnAuthModule.forRoot(),
      A11yModule,
    ),
    FocusedAppService,
    NotificationService,
    TeamsService,
    LoggedInUserService,
    ViewsService,
    DialogService,
    ApplicationsService,
    SystemMessageService,
    {
      provide: BASE_PATH,
      useFactory: getBasePath,
      deps: [ComnSettingsService],
    },
    {
      provide: ErrorHandler,
      useClass: ErrorService,
    },
    { provide: MAT_TOOLTIP_DEFAULT_OPTIONS, useValue: myCustomTooltipDefaults },
    // Outlined fields: a bordered box with its label on the border, as the
    // other inputs are drawn.
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: { appearance: 'outline' },
    },
    // A dialog keeps a margin on a narrow screen. A wide dialog passes its own maxWidth.
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: { ...new MatDialogConfig(), maxWidth: '90vw' },
    },
    // Cards are flat boxes with a hairline, as the panels are drawn.
    { provide: MAT_CARD_CONFIG, useValue: { appearance: 'outlined' } },
    provideRouter(ROUTES),
    provideNativeDateAdapter(),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptorsFromDi()),
    provideCrucibleTheme({ brand: { color: '#3B62A5', text: '#FFFFFF' } }),
  ],
};
