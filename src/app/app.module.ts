// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { CdkTableModule } from '@angular/cdk/table';
import { HttpClientModule } from '@angular/common/http';
import { ErrorHandler, NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatLegacyAutocompleteModule as MatAutocompleteModule } from '@angular/material/legacy-autocomplete';
import { MatBadgeModule } from '@angular/material/badge';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatLegacyCardModule as MatCardModule } from '@angular/material/legacy-card';
import { MatLegacyCheckboxModule as MatCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatLegacyChipsModule as MatChipsModule } from '@angular/material/legacy-chips';
import { MatNativeDateModule, MatRippleModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatLegacyDialogModule as MatDialogModule } from '@angular/material/legacy-dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { MatLegacyListModule as MatListModule } from '@angular/material/legacy-list';
import { MatLegacyMenuModule as MatMenuModule } from '@angular/material/legacy-menu';
import { MatLegacyPaginatorModule as MatPaginatorModule } from '@angular/material/legacy-paginator';
import { MatLegacyProgressBarModule as MatProgressBarModule } from '@angular/material/legacy-progress-bar';
import { MatLegacyProgressSpinnerModule as MatProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { MatLegacyRadioModule as MatRadioModule } from '@angular/material/legacy-radio';
import { MatLegacySelectModule as MatSelectModule } from '@angular/material/legacy-select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatLegacySlideToggleModule as MatSlideToggleModule } from '@angular/material/legacy-slide-toggle';
import { MatLegacySliderModule as MatSliderModule } from '@angular/material/legacy-slider';
import { MatLegacySnackBarModule as MatSnackBarModule } from '@angular/material/legacy-snack-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatStepperModule } from '@angular/material/stepper';
import { MatLegacyTableModule as MatTableModule } from '@angular/material/legacy-table';
import { MatLegacyTabsModule as MatTabsModule } from '@angular/material/legacy-tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import {
  MatLegacyTooltipDefaultOptions as MatTooltipDefaultOptions,
  MatLegacyTooltipModule as MatTooltipModule,
  MAT_LEGACY_TOOLTIP_DEFAULT_OPTIONS as MAT_TOOLTIP_DEFAULT_OPTIONS,
} from '@angular/material/legacy-tooltip';
import { MatTreeModule } from '@angular/material/tree';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {
  ComnAuthModule,
  ComnSettingsModule,
  ComnSettingsService,
} from '@cmusei/crucible-common';
import { AkitaNgRouterStoreModule } from '@datorama/akita-ng-router-store';
import { AkitaNgDevtools } from '@datorama/akita-ngdevtools';
import { ClipboardModule } from 'ngx-clipboard';
import { environment } from '../environments/environment';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AppService } from './app.service';
import { AdminAppTemplateSearchComponent } from './components/admin-app/admin-app-template-search/admin-app-template-search.component';
import { AdminTemplateDetailsComponent } from './components/admin-app/admin-app-template-search/admin-template-details/admin-template-details.component';
import { AdminAppComponent } from './components/admin-app/admin-app.component';
import { AdminRolePermissionSearchComponent } from './components/admin-app/admin-role-permission-search/admin-role-permission-search.component';
import { CreatePermissionDialogComponent } from './components/admin-app/admin-role-permission-search/create-permission-dialog/create-permission-dialog.component';
import { CreateRoleDialogComponent } from './components/admin-app/admin-role-permission-search/create-role-dialog/create-role-dialog.component';
import { SelectRolePermissionsDialogComponent } from './components/admin-app/admin-role-permission-search/select-role-permissions-dialog/select-role-permissions-dialog.component';
import { AdminUserEditComponent } from './components/admin-app/admin-user-search/admin-user-edit/admin-user-edit.component';
import { AdminUserSearchComponent } from './components/admin-app/admin-user-search/admin-user-search.component';
import { AdminViewEditComponent } from './components/admin-app/admin-view-search/admin-view-edit/admin-view-edit.component';
import { AdminViewSearchComponent } from './components/admin-app/admin-view-search/admin-view-search.component';
import { RolesPermissionsSelectComponent } from './components/admin-app/roles-permissions-select/roles-permissions-select.component';
import { TeamApplicationsSelectComponent } from './components/admin-app/team-applications-select/team-applications-select.component';
import { ViewApplicationsSelectComponent } from './components/admin-app/view-applications-select/view-applications-select.component';
import { HomeAppComponent } from './components/home-app/home-app.component';
import { ViewListComponent } from './components/home-app/view-list/view-list.component';
import { ApplicationListComponent } from './components/player/application-list/application-list.component';
import { FocusedAppComponent } from './components/player/focused-app/focused-app.component';
import { NotificationsComponent } from './components/player/notifications/notifications.component';
import { PlayerComponent } from './components/player/player.component';
import { AddRemoveUsersDialogComponent } from './components/shared/add-remove-users-dialog/add-remove-users-dialog.component';
import { ConfirmDialogComponent } from './components/shared/confirm-dialog/confirm-dialog.component';
import { SystemMessageComponent } from './components/shared/system-message/system-message.component';
import { TopbarComponent } from './components/shared/top-bar/topbar.component';
import { BASE_PATH } from './generated/player-api';
import { ApiModule as SwaggerCodegenApiModule } from './generated/player-api/api.module';
import { ApplicationsService } from './services/applications/applications.service';
import { DialogService } from './services/dialog/dialog.service';
import { ErrorService } from './services/error/error.service';
import { FocusedAppService } from './services/focused-app/focused-app.service';
import { LoggedInUserService } from './services/logged-in-user/logged-in-user.service';
import { NotificationService } from './services/notification/notification.service';
import { SystemMessageService } from './services/system-message/system-message.service';
import { TeamsService } from './services/teams/teams.service';
import { ViewsService } from './services/views/views.service';
import { FileBrowseComponent } from './components/player/file-browse/file-browse.component';
import { OpenFileComponent } from './components/player/open-file/open-file.component';
import { EditFileDialogComponent } from './components/shared/edit-file-dialog/edit-file-dialog.component';
import { UserPresencePageComponent } from './components/player/user-presence-page/user-presence-page.component';
import { UserPresenceComponent } from './components/player/user-presence-page/user-presence/user-presence.component';
import { TeamUserPresenceComponent } from './components/player/user-presence-page/team-user-presence/team-user-presence.component';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { TableVirtualScrollModule } from 'ng-table-virtual-scroll';
import { AppAdminSubscriptionSearchComponent } from './components/admin-app/app-admin-subscription-search/app-admin-subscription-search.component';
import { EditSubscriptionComponent } from './components/admin-app/app-admin-subscription-search/edit-subscription/edit-subscription.component';
import { CreateApplicationDialogComponent } from './components/shared/create-application-dialog/create-application-dialog.component';
import { ResizableModule } from 'angular-resizable-element';
import { SystemRolesComponent } from './components/admin-app/admin-roles/roles/roles.component';
import { AdminRolesComponent } from './components/admin-app/admin-roles/admin-roles.component';
import { NameDialogComponent } from './components/shared/name-dialog/name-dialog.component';
import { TeamRolesComponent } from './components/admin-app/admin-roles/team-roles/team-roles.component';

@NgModule({
  exports: [
    CdkTableModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
    MatStepperModule,
    MatDatepickerModule,
    MatDialogModule,
    MatExpansionModule,
    MatGridListModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatMenuModule,
    MatNativeDateModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatRippleModule,
    MatSelectModule,
    MatSidenavModule,
    MatSliderModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatSortModule,
    MatTableModule,
    MatTabsModule,
    MatToolbarModule,
    MatTooltipModule,
    MatBottomSheetModule,
    MatTreeModule,
    MatBadgeModule,
    ScrollingModule,
  ],
  imports: [],
})
export class AngularMaterialModule {}

/** Custom options to configure the tooltip's default show/hide delays. */
export const myCustomTooltipDefaults: MatTooltipDefaultOptions = {
  showDelay: 1000,
  hideDelay: 0,
  touchendHideDelay: 1000,
};

@NgModule({
  declarations: [
    AppComponent,
    ApplicationListComponent,
    NotificationsComponent,
    FocusedAppComponent,
    PlayerComponent,
    HomeAppComponent,
    ViewListComponent,
    ConfirmDialogComponent,
    CreatePermissionDialogComponent,
    CreateRoleDialogComponent,
    SelectRolePermissionsDialogComponent,
    SystemMessageComponent,
    AdminAppComponent,
    AdminViewSearchComponent,
    AdminUserSearchComponent,
    AdminAppTemplateSearchComponent,
    AdminRolePermissionSearchComponent,
    AdminUserEditComponent,
    AdminViewEditComponent,
    AddRemoveUsersDialogComponent,
    RolesPermissionsSelectComponent,
    TeamApplicationsSelectComponent,
    ViewApplicationsSelectComponent,
    AdminTemplateDetailsComponent,
    TopbarComponent,
    FileBrowseComponent,
    OpenFileComponent,
    EditFileDialogComponent,
    UserPresencePageComponent,
    UserPresenceComponent,
    TeamUserPresenceComponent,
    AppAdminSubscriptionSearchComponent,
    EditSubscriptionComponent,
    CreateApplicationDialogComponent,
    NameDialogComponent,
    SystemRolesComponent,
    AdminRolesComponent,
    TeamRolesComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    HttpClientModule,
    AngularMaterialModule,
    MatNativeDateModule,
    ReactiveFormsModule,
    AppRoutingModule,
    SwaggerCodegenApiModule,
    ClipboardModule,
    environment.production ? [] : AkitaNgDevtools.forRoot(),
    AkitaNgRouterStoreModule,
    ComnSettingsModule.forRoot(),
    ComnAuthModule.forRoot(),
    TableVirtualScrollModule,
    ResizableModule,
  ],
  providers: [
    AppService,
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
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}

export function getBasePath(settingsSvc: ComnSettingsService) {
  return settingsSvc.settings.ApiUrl;
}
