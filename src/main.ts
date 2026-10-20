// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  enableProdMode,
  provideZoneChangeDetection,
  ErrorHandler,
  importProvidersFrom,
} from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { enableAkitaProdMode, persistState } from '@datorama/akita';
import { environment } from './environments/environment';
import { FocusedAppService } from './app/services/focused-app/focused-app.service';
import { NotificationService } from './app/services/notification/notification.service';
import { TeamsService } from './app/services/teams/teams.service';
import { LoggedInUserService } from './app/services/logged-in-user/logged-in-user.service';
import { ViewsService } from './app/services/views/views.service';
import { DialogService } from './app/services/dialog/dialog.service';
import { ApplicationsService } from './app/services/applications/applications.service';
import { SystemMessageService } from './app/services/system-message/system-message.service';
import { BASE_PATH } from './app/generated/player-api';
import {
  ComnSettingsService,
  provideCrucibleTheme,
  ComnSettingsModule,
  ComnAuthModule,
  ComnHeaderBarModule,
  CRUCIBLE_DIALOG_IMPORTS,
} from '@cmusei/crucible-common';
import { ErrorService } from './app/services/error/error.service';
import {
  MAT_TOOLTIP_DEFAULT_OPTIONS,
  MatTooltipDefaultOptions,
} from '@angular/material/tooltip';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatNativeDateModule } from '@angular/material/core';
import { provideRouter } from '@angular/router';
import { ROUTES } from './app/app.routes';
import { ApiModule as SwaggerCodegenApiModule } from './app/generated/player-api/api.module';
import { ClipboardModule } from 'ngx-clipboard';
import { AkitaNgDevtools } from '@datorama/akita-ngdevtools';
import { AkitaNgRouterStoreModule } from '@datorama/akita-ng-router-store';
import { A11yModule } from '@angular/cdk/a11y';
import { TableVirtualScrollModule } from 'ng-table-virtual-scroll';
import { ResizableModule } from 'angular-resizable-element';
import { AppComponent } from './app/app.component';

if (environment.production) {
  enableProdMode();
  enableAkitaProdMode();
}

/** Custom options to configure the tooltip's default show/hide delays. */
export const myCustomTooltipDefaults: MatTooltipDefaultOptions = {
  showDelay: 1000,
  hideDelay: 0,
  touchendHideDelay: 1000,
};

export function getBasePath(settingsSvc: ComnSettingsService) {
  return settingsSvc.settings.ApiUrl;
}

export const storage = persistState({
  key: 'akita-player-ui',
  include: ['auth.ui'],
});

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(
      BrowserModule,
      BrowserAnimationsModule,
      FormsModule,
      MatNativeDateModule,
      ReactiveFormsModule,
      SwaggerCodegenApiModule,
      ClipboardModule,
      environment.production ? [] : AkitaNgDevtools.forRoot(),
      AkitaNgRouterStoreModule,
      ComnSettingsModule.forRoot(),
      ComnAuthModule.forRoot(),
      ComnHeaderBarModule,
      A11yModule,
      ...CRUCIBLE_DIALOG_IMPORTS,
      TableVirtualScrollModule,
      ResizableModule,
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
    provideRouter(ROUTES),
    provideHttpClient(withInterceptorsFromDi()),
    provideCrucibleTheme({ brand: { color: '#3B62A5', text: '#FFFFFF' } }),
  ],
}).catch((err) => console.log(err));
