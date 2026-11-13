// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  Component,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  inject,
  input,
} from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ComnAuthQuery, ComnAuthService, Theme } from '@cmusei/crucible-common';
import { EMPTY, Observable, Subject, combineLatest } from 'rxjs';
import {
  catchError,
  debounceTime,
  filter,
  map,
  startWith,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs/operators';
import { ApplicationData } from '../../../models/application-data';
import { TeamData } from '../../../models/team-data';
import { ApplicationsService } from '../../../services/applications/applications.service';
import { FocusedAppService } from '../../../services/focused-app/focused-app.service';
import { NotificationService } from '../../../services/notification/notification.service';
import { XApiService } from '../../../services/xapi/xapi.service';
import { MatList, MatListItem } from '@angular/material/list';
import { MatButton } from '@angular/material/button';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-application-list',
  templateUrl: './application-list.component.html',
  styleUrls: ['./application-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatList, MatListItem, MatButton, AsyncPipe],
})
export class ApplicationListComponent implements OnInit, OnChanges, OnDestroy {
  static readonly refreshDebounceMs = 250;

  private applicationsService = inject(ApplicationsService);
  private focusedAppService = inject(FocusedAppService);
  private authService = inject(ComnAuthService);
  private sanitizer = inject(DomSanitizer);
  private authQuery = inject(ComnAuthQuery);
  private xapiService = inject(XApiService);
  private notificationService = inject(NotificationService);

  readonly viewId = input<string>(undefined);
  readonly teams = input<TeamData[]>(undefined);
  readonly mini = input<boolean>(undefined);

  public applications$: Observable<ApplicationData[]>;
  public viewGUID: string;
  public titleText: string;
  private unsubscribe$: Subject<null> = new Subject<null>();
  private currentApp: ApplicationData;
  // The sanitized URL handed to each background iframe, kept while its URL
  // is unchanged so that a refreshed list does not reload the iframe.
  private safeUrls = new Map<string, SafeUrl>();

  ngOnInit() {
    this.refreshApps();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.teams) {
      this.refreshApps();
    }
  }

  // Local Component functions
  openApplication(app: ApplicationData, event: MouseEvent) {
    if (app.embeddable && !event.ctrlKey) {
      event.preventDefault();
      this.openInFocusedApp(app);
    }
  }

  refreshApps() {
    const teamId = this.teams().find((t) => t.isPrimary).id;
    // Fetch the list on load and again whenever the team hub says it changed.
    // A burst of changes (a reorder renumbers every app) is fetched once. A
    // failed fetch keeps the list already shown (none, on the first load) and
    // is logged; it doesn't end the stream, so the next change fetches again.
    const apps$ = this.notificationService.applicationsChanged.pipe(
      filter((changedTeamId) => changedTeamId === teamId),
      debounceTime(ApplicationListComponent.refreshDebounceMs),
      startWith(null),
      switchMap(() =>
        this.applicationsService.getApplicationsByTeam(teamId).pipe(
          catchError((error) => {
            console.error('Could not load the team applications', error);
            return EMPTY;
          }),
        ),
      ),
    );

    this.applications$ = combineLatest([this.authQuery.userTheme$, apps$]).pipe(
      map(([theme, apps]) => {
        // New objects each time, so the focused app keeps the URL it was
        // opened with to compare against.
        const safeUrls = new Map<string, SafeUrl>();
        const themed = apps.map((app) => {
          const themedUrl = this.insertThemeToUrl(app.url, theme);
          const safeUrl =
            this.safeUrls.get(themedUrl) ??
            this.sanitizer.bypassSecurityTrustResourceUrl(themedUrl);
          safeUrls.set(themedUrl, safeUrl);
          return { ...app, themedUrl, safeUrl };
        });
        this.safeUrls = safeUrls;
        return themed;
      }),
      tap((apps) => this.keepFocusedApp(apps)),
      takeUntil(this.unsubscribe$),
    );
  }

  /**
   * Opens the first application on the first load. On a later list, keeps the
   * focused application open, reopening it only if its URL changed; if it was
   * removed, opens the first application, or a blank page when none is left.
   */
  private keepFocusedApp(apps: ApplicationData[]) {
    const current =
      this.currentApp === undefined
        ? undefined
        : apps.find((app) => app.id === this.currentApp.id);

    if (current === undefined) {
      if (apps.length > 0) {
        this.openInFocusedApp(apps[0]);
      } else if (this.currentApp !== undefined) {
        this.currentApp = undefined;
        this.focusedAppService.focusedAppUrl.next('about:blank');
      }
    } else if (current.themedUrl !== this.currentApp.themedUrl) {
      this.openInFocusedApp(current);
    } else {
      this.currentApp = current;
    }
  }

  /**
   * The applications that load in the background, in a fixed order: moving an
   * iframe in the page reloads it, so a reorder must not move theirs.
   */
  backgroundApps(apps: ApplicationData[] | null): ApplicationData[] {
    return (apps ?? [])
      .filter((app) => app.loadInBackground)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  openInFocusedApp(app: ApplicationData) {
    this.currentApp = app;
    this.authService.isAuthenticated().then((isAuthenticated) => {
      if (!isAuthenticated) {
        console.log(
          'User is not authenticated and must not have been redirected to login.',
        );
        window.location.reload();
      } else {
        this.focusedAppService.focusedAppUrl.next(app.themedUrl);
        this.xapiService
          .applicationSwitched(this.viewId(), app.name, app.url)
          .subscribe();
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
