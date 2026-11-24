// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnDestroy,
  OnInit,
  TemplateRef,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { MatDialog, MatDialogClose } from '@angular/material/dialog';
import {
  ComnAuthQuery,
  ComnAuthService,
  ComnSettingsService,
  CrucibleDialogService,
  Theme,
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
  CrucibleDialogActionsDirective,
} from '@cmusei/crucible-common';
import { User as AuthUser } from 'oidc-client-ts';
import { combineLatest, Observable, Subject } from 'rxjs';
import { filter, map, takeUntil } from 'rxjs/operators';
import { LoggedInUserService } from '../../../services/logged-in-user/logged-in-user.service';
import { ManageTeamsComponent } from '../../player/manage-teams/manage-teams.component';
import { UserPresenceComponent } from '../../player/user-presence-page/user-presence/user-presence.component';
import { TopbarView } from './topbar.models';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserPermissionsService } from '../../../services/permissions/user-permissions.service';
import {
  SystemPermission,
  ViewPermission,
} from '../../../generated/player-api';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatToolbar } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { ClipboardModule } from 'ngx-clipboard';
import { MatTooltip } from '@angular/material/tooltip';
import { MatMenuTrigger, MatMenu, MatMenuItem } from '@angular/material/menu';
import { AsyncPipe } from '@angular/common';
import {
  AppSwitcherComponent,
  SwitcherApp,
} from '../app-switcher/app-switcher.component';

@Component({
  selector: 'app-topbar',
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppSwitcherComponent,
    MatToolbar,
    // The Users dialog's Close button, in this component's template.
    MatButton,
    MatIconButton,
    RouterLink,
    MatIcon,
    ClipboardModule,
    MatTooltip,
    MatMenuTrigger,
    MatMenu,
    MatMenuItem,
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    UserPresenceComponent,
    CrucibleDialogActionsDirective,
    MatDialogClose,
    AsyncPipe,
  ],
})
export class TopbarComponent implements OnInit, OnDestroy {
  private authService = inject(ComnAuthService);
  private loggedInUserService = inject(LoggedInUserService);
  private authQuery = inject(ComnAuthQuery);
  private dialog = inject(MatDialog);
  private confirmDialogService = inject(CrucibleDialogService);
  private snackbar = inject(MatSnackBar);
  private permissionsService = inject(UserPermissionsService);
  private settingsService = inject(ComnSettingsService);

  private readonly settings = this.settingsService.settings as {
    AppTopBarText?: string;
    Apps?: SwitcherApp[];
  };

  /** The product's name, beside the mark. */
  readonly productName: string = this.settings.AppTopBarText || 'Player';
  /**
   * The other Crucible apps, for the app switcher: the optional `Apps` setting,
   * a list of `{ id, name, url }`. Without it the switcher isn't shown.
   */
  readonly apps: SwitcherApp[] = this.settings.Apps ?? [];

  readonly title = input<string>(undefined);
  @Input() sidenav?;
  @Input() teams?;
  @Input() team?;
  readonly topbarView = input<TopbarView>(undefined);
  readonly viewId = input<string>(undefined);
  readonly mini = input<boolean>(undefined);
  readonly sidenavToggle = output<boolean>();
  readonly setTeam = output<string>();
  readonly editView = output<any>();
  currentUser$: Observable<AuthUser>;
  theme$: Observable<Theme>;
  private currentTheme: Theme = Theme.LIGHT;
  unsubscribe$: Subject<null> = new Subject<null>();
  TopbarView = TopbarView;

  /** Where you are: the page's title, unless it only repeats the product. */
  readonly crumb = computed(() => {
    const title = this.title();
    return title && title !== this.productName ? title : null;
  });

  showAdministration$ = this.permissionsService.canViewAdminstration();
  showEditView$ = this.permissionsService.can(
    SystemPermission.ManageViews,
    null,
    null,
    ViewPermission.ManageView,
  );

  // Show "Manage Teams" to users who can manage at least one Team but do not have
  // full Edit View access (those users use "Edit View" instead).
  showManageTeams$ = combineLatest([
    this.permissionsService.canManageAnyTeam$,
    this.showEditView$,
  ]).pipe(map(([canManageTeam, canEditView]) => canManageTeam && !canEditView));

  readonly userPresenceDialog =
    viewChild<TemplateRef<UserPresenceComponent>>('userPresenceDialog');

  ngOnInit() {
    this.currentUser$ = this.loggedInUserService.loggedInUser$.pipe(
      filter((user) => user !== null),
      takeUntil(this.unsubscribe$),
    );
    this.theme$ = this.authQuery.userTheme$;
    this.theme$
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((theme) => (this.currentTheme = theme));
  }

  /** The avatar's letter. */
  initial(name: string | undefined): string {
    return name?.trim()[0] ?? '';
  }

  setTeamFn(id: string) {
    if (this.setTeam && id) {
      this.setTeam.emit(id);
    }
  }

  /** Light to dark, or back. The person's choice is kept with their sign-in. */
  toggleTheme() {
    this.authService.setUserTheme(
      this.currentTheme === Theme.DARK ? Theme.LIGHT : Theme.DARK,
    );
  }

  editFn(event) {
    event.preventDefault();
    this.editView.emit(event);
  }

  openManageTeams() {
    this.dialog.open(ManageTeamsComponent, {
      data: { viewId: this.viewId() },
      maxWidth: '100vw',
      width: 'auto',
      autoFocus: 'dialog',
    });
  }

  editFnNewTab(event) {
    const newTabEvent = {
      ...event,
      isNewBrowserTab: true,
    };
    this.editView.emit(newTabEvent);
  }

  sidenavToggleFn() {
    this.sidenavToggle.emit(!this.sidenav.opened);
  }

  logout(): void {
    this.authService.logout();
  }

  openUserPresence(): void {
    this.dialog.open(this.userPresenceDialog(), {
      height: '75%',
      width: 'auto',
      maxWidth: '100vw',
    });
  }

  closeUserPresence() {
    this.dialog.closeAll();
  }

  getEditViewUrl() {
    return `${document.baseURI}/admin?section=views&view=${this.viewId()}`;
  }

  resetUI() {
    this.confirmDialogService
      .confirm({
        title: 'Reset UI?',
        message: `Are you sure that you want to reset your UI preferences for the ${this.team.name} Team?`,
        confirmText: 'Reset',
        cancelText: 'Cancel',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          localStorage.removeItem(this.team.id);
          window.location.reload();
        }
      });
  }

  openSnackBar(message: string) {
    this.snackbar.open(message, '', {
      verticalPosition: 'top',
      duration: 2000,
    });
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
