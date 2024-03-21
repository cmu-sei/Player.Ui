// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { ComnAuthQuery, ComnAuthService, Theme } from '@cmusei/crucible-common';
import { User as AuthUser } from 'oidc-client-ts';
import { Observable, Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { LoggedInUserService } from '../../../services/logged-in-user/logged-in-user.service';
import { UserPresenceComponent } from '../../player/user-presence-page/user-presence/user-presence.component';
import { TopbarView } from './topbar.models';
import { Router } from '@angular/router';
@Component({
  selector: 'app-topbar',
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopbarComponent implements OnInit, OnDestroy {
  @Input() title?: string;
  @Input() sidenav?;
  @Input() teams?;
  @Input() team?;
  @Input() topbarColor?;
  @Input() topbarTextColor?;
  @Input() topbarView?: TopbarView;
  @Input() viewId: string;
  @Output() sidenavToggle?: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() setTeam?: EventEmitter<string> = new EventEmitter<string>();
  @Output() editView?: EventEmitter<any> = new EventEmitter<any>();
  currentUser$: Observable<AuthUser>;
  theme$: Observable<Theme>;
  unsubscribe$: Subject<null> = new Subject<null>();
  TopbarView = TopbarView;

  @ViewChild('userPresenceDialog')
  userPresenceDialog: TemplateRef<UserPresenceComponent>;

  constructor(
    private authService: ComnAuthService,
    private loggedInUserService: LoggedInUserService,
    private authQuery: ComnAuthQuery,
    private router: Router,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    this.currentUser$ = this.loggedInUserService.loggedInUser$.pipe(
      filter((user) => user !== null),
      takeUntil(this.unsubscribe$)
    );
    this.theme$ = this.authQuery.userTheme$;
  }

  setTeamFn(id: string) {
    if (this.setTeam && id) {
      this.setTeam.emit(id);
    }
  }

  themeFn(event) {
    const theme = event.checked ? Theme.DARK : Theme.LIGHT;
    this.authService.setUserTheme(theme);
  }

  editFn(event) {
    event.preventDefault();
    this.editView.emit(event);
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
    this.dialog.open(this.userPresenceDialog, {
      height: '75%',
      width: '75%',
    });
  }

  closeUserPresence() {
    this.dialog.closeAll();
  }

  getEditViewUrl() {
    return this.router.serializeUrl(
      this.router.createUrlTree(['/admin'], {
        queryParams: {
          section: 'views',
          view: this.viewId,
        },
      })
    );
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
