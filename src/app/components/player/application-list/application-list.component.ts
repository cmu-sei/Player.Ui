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
import { allowedApplicationUrl } from '../../../utilities/application-url';

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

  public applications$: Observable<ApplicationList>;
  public viewGUID: string;
  public titleText: string;
  private unsubscribe$: Subject<null> = new Subject<null>();
  private currentApp: ApplicationData;
  // Whether a list has been shown yet: opening an app for the first one is the
  // only automatic open recorded as a switch.
  private listShown = false;
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
            this.sanitizer.bypassSecurityTrustResourceUrl(
              allowedApplicationUrl(themedUrl),
            );
          safeUrls.set(themedUrl, safeUrl);
          return { ...app, themedUrl, safeUrl };
        });
        this.safeUrls = safeUrls;
        return { apps: themed, background: backgroundApps(themed) };
      }),
      tap(({ apps }) => this.keepFocusedApp(apps)),
      takeUntil(this.unsubscribe$),
    );
  }

  /**
   * Opens the first embeddable application on the first load. On a later
   * list, keeps the focused application open, reopening it only if its URL
   * changed; a theme change needs no reopen, as the focused app applies the
   * theme itself. If it was removed or can no longer be embedded, opens the
   * first embeddable application, or a blank page when there is none. Only the
   * first load is recorded as a switch: the others aren't the user's doing.
   */
  private keepFocusedApp(apps: ApplicationData[]) {
    const current = apps.find(
      (app) => app.id === this.currentApp?.id && app.embeddable,
    );
    const first = apps.find((app) => app.embeddable);

    if (this.currentApp === undefined) {
      if (first !== undefined) {
        this.openInFocusedApp(first, !this.listShown);
      }
    } else if (current === undefined) {
      if (first !== undefined) {
        this.openInFocusedApp(first, false);
      } else {
        this.currentApp = undefined;
        this.focusedAppService.focusedAppUrl.next('about:blank');
      }
    } else if (current.url !== this.currentApp.url) {
      this.openInFocusedApp(current, false);
    } else {
      this.currentApp = current;
    }
    this.listShown = true;
  }

  /**
   * Shows `app` in the focused app. `recordSwitch` is false when the list
   * changed under the user, so that xAPI records only the user's own switches.
   */
  openInFocusedApp(app: ApplicationData, recordSwitch = true) {
    this.currentApp = app;
    this.authService.isAuthenticated().then((isAuthenticated) => {
      if (!isAuthenticated) {
        console.log(
          'User is not authenticated and must not have been redirected to login.',
        );
        window.location.reload();
      } else {
        this.focusedAppService.focusedAppUrl.next(app.themedUrl);
        if (recordSwitch) {
          this.xapiService
            .applicationSwitched(this.viewId(), app.name, app.url)
            .subscribe();
        }
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

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}

/** The list as rendered: the applications, and those that load in the background. */
export interface ApplicationList {
  apps: ApplicationData[];
  background: ApplicationData[];
}

/**
 * The applications that load in the background, in a fixed order: moving an
 * iframe in the page reloads it, so a reorder must not move theirs.
 */
function backgroundApps(apps: ApplicationData[]): ApplicationData[] {
  return apps
    .filter((app) => app.loadInBackground)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
