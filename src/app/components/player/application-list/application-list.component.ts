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
import { Observable, Subject, combineLatest } from 'rxjs';
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
  @Input() teams: TeamData[];
  @Input() mini: boolean;

  public applications$: Observable<ApplicationData[]>;
  public viewGUID: string;
  public titleText: string;
  private unsubscribe$: Subject<null> = new Subject<null>();
  private currentApp: ApplicationData;

  constructor(
    private applicationsService: ApplicationsService,
    private focusedAppService: FocusedAppService,
    private authService: ComnAuthService,
    private sanitizer: DomSanitizer,
    private authQuery: ComnAuthQuery
  ) {}

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
    window.open(app.themedUrl, '_blank');
  }

  refreshApps() {
    this.applications$ = combineLatest([
      this.authQuery.userTheme$,
      this.applicationsService.getApplicationsByTeam(
        this.teams.find((t) => t.isPrimary).id
      ),
    ]).pipe(
      map(([theme, apps]) => {
        apps.forEach((app) => {
          app.themedUrl = this.insertThemeToUrl(app.url, theme);
          app.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
            app.themedUrl
          );
        });
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
        this.focusedAppService.focusedAppUrl.next(app.themedUrl);
      }
    });
  }

  insertThemeToUrl(url: string, theme: Theme) {
    if (url.includes('{theme}')) {
      if (url.includes('?')) {
        url = url.replace('?{theme}', '?theme=' + theme);
        url = url.replace('&{theme}', '&theme=' + theme);
        url = url.replace('{theme}', '&theme=' + theme);
      } else {
        url = url.replace('{theme}', '?theme=' + theme);
      }
    }
    return url;
  }

  trackByFn(index, item) {
    return item.id;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
