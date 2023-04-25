// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ComnAuthQuery, ComnAuthService, Theme } from '@cmusei/crucible-common';
import { User } from 'oidc-client';
import { Observable, Subject } from 'rxjs';
import { map, takeUntil, tap } from 'rxjs/operators';
import { ApplicationData } from '../../../models/application-data';
import { TeamData } from '../../../models/team-data';
import { ApplicationsService } from '../../../services/applications/applications.service';
import { FocusedAppService } from '../../../services/focused-app/focused-app.service';

@Component({
  selector: 'app-application-list',
  templateUrl: './application-list.component.html',
  styleUrls: ['./application-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationListComponent implements OnInit, OnChanges, OnDestroy {
  @Input() viewId: string;
  @Input() user: User;
  @Input() teams: TeamData[];

  public applications$: Observable<ApplicationData[]>;
  public viewGUID: string;
  public titleText: string;
  private unsubscribe$: Subject<null> = new Subject<null>();
  private currentTheme = Theme.LIGHT;
  private currentApp: ApplicationData;

  constructor(
    private applicationsService: ApplicationsService,
    private focusedAppService: FocusedAppService,
    private authService: ComnAuthService,
    private sanitizer: DomSanitizer,
    private authQuery: ComnAuthQuery
  ) {
    authQuery.userTheme$
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((t) => (this.currentTheme = t));
  }

  ngOnInit() {
    this.refreshApps();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.teams) {
      this.refreshApps();
    }
  }

  // Local Component functions
  openInTab(app: ApplicationData) {
    const url = this.insertThemeToUrl(app.url);
    window.open(url, '_blank');
  }

  refreshApps() {
    this.applications$ = this.applicationsService
      .getApplicationsByTeam(this.teams.find((t) => t.isPrimary).id)
      .pipe(
        map((apps) => ({ apps })),
        map(({ apps }) => {
          apps.forEach(
            (app) =>
              (app.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
                app.url
              ))
          );
          return apps;
        }),
        tap((apps) => {
          if (apps.length > 0) {
            this.currentApp === undefined
              ? this.openInFocusedApp(apps[0])
              : this.openInFocusedApp(this.currentApp);
          }
        }),
        takeUntil(this.unsubscribe$)
      );
  }

  openInFocusedApp(app: ApplicationData) {
    this.currentApp = app;
    this.authService.isAuthenticated().then((isAuthenticated) => {
      if (!isAuthenticated) {
        console.log(
          'User is not authenticated and must not have been redirected to login.'
        );
        window.location.reload();
      } else {
        const url = this.insertThemeToUrl(app.url);
        this.focusedAppService.focusedAppUrl.next(url);
      }
    });
  }

  insertThemeToUrl(url: string) {
    if (url.includes('{theme}')) {
      if (url.includes('?')) {
        url = url.replace('?{theme}', '?theme=' + this.currentTheme);
        url = url.replace('&{theme}', '&theme=' + this.currentTheme);
        url = url.replace('{theme}', '&theme=' + this.currentTheme);
      } else {
        url = url.replace('{theme}', '?theme=' + this.currentTheme);
      }
    }
    return url;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
