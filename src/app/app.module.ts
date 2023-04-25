// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { CdkTableModule } from '@angular/cdk/table';
import { HttpClientModule } from '@angular/common/http';
import { ErrorHandler, NgModule } from '@angular/core';
import { FlexLayoutModule } from '@angular/flex-layout';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatBadgeModule } from '@angular/material/badge';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatNativeDateModule, MatRippleModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import {
  MatTooltipDefaultOptions,
  MatTooltipModule,
  MAT_TOOLTIP_DEFAULT_OPTIONS,
} from '@angular/material/tooltip';
import { MatTreeModule } from '@angular/material/tree';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {
  ComnAuthModule,
  ComnSettingsConfig,
  ComnSettingsModule,
  ComnSettingsService,
} from '@cmusei/crucible-common';
import { AkitaNgRouterStoreModule } from '@datorama/akita-ng-router-store';
import { AkitaNgDevtools } from '@datorama/akita-ngdevtools';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
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

declare var require: any;
const settings: ComnSettingsConfig = {
  url: 'assets/config/settings.json',
  envUrl: 'assets/config/settings.env.json',
};
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
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    HttpClientModule,
    AngularMaterialModule,
    MatNativeDateModule,
    ReactiveFormsModule,
    NgbModule,
    AppRoutingModule,
    FlexLayoutModule,
    SwaggerCodegenApiModule,
    ClipboardModule,
    environment.production ? [] : AkitaNgDevtools.forRoot(),
    AkitaNgRouterStoreModule,
    ComnSettingsModule.forRoot(),
    ComnAuthModule.forRoot(),
    TableVirtualScrollModule,
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
  entryComponents: [
    AppComponent,
    ConfirmDialogComponent,
    CreatePermissionDialogComponent,
    CreateRoleDialogComponent,
    SelectRolePermissionsDialogComponent,
    SystemMessageComponent,
    AdminUserEditComponent,
    AdminViewEditComponent,
    AddRemoveUsersDialogComponent,
    RolesPermissionsSelectComponent,
    TeamApplicationsSelectComponent,
    ViewApplicationsSelectComponent,
    AdminTemplateDetailsComponent,
  ],
})
export class AppModule {}

export function getBasePath(settingsSvc: ComnSettingsService) {
  return settingsSvc.settings.ApiUrl;
}
