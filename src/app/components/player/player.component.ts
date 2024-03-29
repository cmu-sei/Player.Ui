// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// TODO: Set sidnav status in query string.
// TODO: Set notification status in query string.
// TODO: Set active application in query string.

import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { MatDrawerMode, MatSidenav } from '@angular/material/sidenav';
import { Router } from '@angular/router';
import {
  ComnAuthQuery,
  ComnSettingsService,
  Theme,
} from '@cmusei/crucible-common';
import { RouterQuery } from '@datorama/akita-ng-router-store';
import {
  BehaviorSubject,
  combineLatest,
  EMPTY,
  Observable,
  of,
  Subject,
} from 'rxjs';
import { map, switchMap, take, takeUntil, tap } from 'rxjs/operators';
import { View } from '../../generated/player-api';
import { TeamService } from '../../generated/player-api/api/team.service';
import { ViewService } from '../../generated/player-api/api/view.service';
import { LoggedInUserService } from '../../services/logged-in-user/logged-in-user.service';
import { SystemMessageService } from '../../services/system-message/system-message.service';
import { ViewsService } from '../../services/views/views.service';
import { AdminViewEditComponent } from '../admin-app/admin-view-search/admin-view-edit/admin-view-edit.component';

@Component({
  selector: 'app-player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerComponent implements OnInit, OnDestroy {
  @ViewChild('sidenav') sidenav: MatSidenav;

  public loaded = false;
  public data$: Observable<any>;

  public openedSubject = new BehaviorSubject<boolean>(true);
  public opened$: Observable<boolean> = this.openedSubject.asObservable();

  public miniSubject = new BehaviorSubject<boolean>(false);
  public mini$: Observable<boolean> = this.miniSubject.asObservable();

  public user$ = this.loggedInUserService.loggedInUser$;

  public view: View;
  public viewId: string;
  public opened: boolean;
  public topbarColor = '#4c7aa2';
  public topbarTextColor = '#ffffff';
  queryParams: any = {};
  unsubscribe$: Subject<null> = new Subject<null>();
  theme$: Observable<Theme>;
  public resizeStyle = {};
  public sidenavWidth: number;
  public sidenavMode: MatDrawerMode = 'side';
  public autosizeSidenav = true;

  constructor(
    private router: Router,
    private routerQuery: RouterQuery,
    private viewsService: ViewsService,
    private viewService: ViewService,
    private loggedInUserService: LoggedInUserService,
    private teamService: TeamService,
    private settingsService: ComnSettingsService,
    private dialog: MatDialog,
    private messageService: SystemMessageService,
    private authQuery: ComnAuthQuery
  ) {
    this.theme$ = this.authQuery.userTheme$;
  }

  ngOnInit() {
    this.data$ = this.checkParam(['teamId', 'opened']).pipe(
      tap((paramsExist) =>
        paramsExist ? (this.loaded = true) : (this.loaded = false)
      ),
      switchMap(() => this.loadData())
    );

    // Set the topbar color from config file.
    this.topbarColor = this.settingsService.settings.AppTopBarHexColor;
    this.viewId = this.routerQuery.getParams('id');
  }

  checkParam(params: string[]): Observable<boolean> {
    return this.routerQuery.selectQueryParams([...params]).pipe(
      takeUntil(this.unsubscribe$),
      switchMap((p) => {
        return p.every((x) => x != null) ? of(true) : of(false);
      })
    );
  }

  loadData() {
    return this.routerQuery.select().pipe(
      // translate the state
      map((state) => state.state),

      // switchMap in case router state changes.
      switchMap((state) =>
        combineLatest([
          state.params['id']
            ? this.viewService.getView(state.params['id'])
            : new Observable<View>(),
          state.params['id']
            ? this.teamService.getMyViewTeams(state.params['id'])
            : new Observable<any>(),
        ]).pipe(
          // this pipe allows us to return all previous observable values.
          map(([view, teams]) => ({
            state,
            view,
            teams: teams.filter((t) => t.isMember),
            team: teams.find((t) => t.isPrimary),
            title: this.settingsService.settings.AppTitle,
          }))
        )
      ),
      tap(({ state, teams }) => {
        if (teams.length === 0) {
          this.messageService.displayMessage(
            'Not a Member',
            'You are not a member of any Teams in this View'
          );
        } else if (!this.loaded) {
          const params = {
            teamId: teams.find((t) => t.isPrimary).id,
          };
          this.addParam(params);
          this.loaded = true;
        }

        this.restoreUIState();
      }),
      takeUntil(this.unsubscribe$)
    );
  }

  addParam(params) {
    this.queryParams = { ...this.queryParams, ...params };
    this.router.navigate([], {
      queryParams: { ...this.queryParams },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * Set the primary team instance by the team Guid.  This is only valid when a user belongs to multiple
   * teams.  If a new primary team is set in the database, the page must be reloaded
   * @param teamId
   */
  setPrimaryTeam(newTeamId) {
    combineLatest([of(newTeamId), this.data$, this.user$])
      .pipe(
        switchMap(([newTeamId, data, user]) => {
          if (newTeamId !== data.team.id) {
            this.addParam({ teamId: newTeamId });
            return this.viewsService
              .setPrimaryTeamId(user.profile.sub, newTeamId)
              .pipe(tap(() => window.location.reload()));
          } else {
            return of(EMPTY);
          }
        }),
        take(1)
      )
      .subscribe();
  }

  /**
   * Called to open the edit view dialog window
   */
  editViewFn(event) {
    if (event.isNewBrowserTab === true) {
      const url = this.router.serializeUrl(
        this.router.createUrlTree(['/admin'], {
          queryParams: {
            section: 'views',
            view: this.routerQuery.getParams('id'),
          },
        })
      );
      console.log('url', url);
      window.open(url, '_blank');
    } else {
      const dialogRef = this.dialog.open(AdminViewEditComponent);
      this.data$.subscribe((data) => {
        dialogRef.componentInstance.resetStepper();
        dialogRef.componentInstance.updateApplicationTemplates();
        dialogRef.componentInstance.updateView();
        if (data.view) {
          dialogRef.componentInstance.setView(data.view);
        }
      });
      dialogRef.componentInstance.editComplete.subscribe(() => {
        dialogRef.close();
      });
    }
  }

  sidenavToggleFn() {
    if (this.sidenav.opened) {
      if (this.miniSubject.getValue()) {
        this.miniSubject.next(false);
        this.openedSubject.next(false);
      } else {
        this.miniSubject.next(true);
        this.resizeStyle = {};
      }
    } else {
      this.miniSubject.next(false);
      this.openedSubject.next(true);
      this.setResizeStyle();
    }

    this.autosizeSidenav = true;
    this.updateUIState(
      null,
      this.openedSubject.getValue(),
      this.miniSubject.getValue()
    );
  }

  resizingFn(event) {
    if (!this.miniSubject.getValue()) {
      this.autosizeSidenav = false;
      this.sidenav.mode = 'push';
      this.sidenavWidth = event.rectangle.width;
      this.setResizeStyle();
    }
  }

  resizeEnd(event) {
    if (!this.miniSubject.getValue()) {
      this.setSidenavMode();

      this.updateUIState(this.sidenavWidth);
    }
  }

  setResizeStyle() {
    if (!this.miniSubject.getValue()) {
      this.resizeStyle = {
        'min-width': '10vw',
        'max-width': '33vw',
        width: `${this.sidenavWidth}px`,
      };
    }
  }

  setSidenavMode() {
    this.sidenav.mode = this.sidenavMode;
  }

  updateUIState(width?: number, opened?: boolean, mini?: boolean) {
    const teamId = this.routerQuery.getQueryParams('teamId');
    let newState: TeamUIState = {
      width: width,
      opened: opened,
      mini: mini,
    };

    if (teamId) {
      let existingState: TeamUIState = JSON.parse(localStorage.getItem(teamId));

      if (existingState) {
        existingState.width = width ?? existingState.width;
        existingState.opened = opened ?? existingState.opened;
        existingState.mini = mini ?? existingState.mini;
        newState = existingState;
      }

      localStorage.setItem(teamId, JSON.stringify(newState));
    }
  }

  restoreUIState() {
    const teamState: TeamUIState = JSON.parse(
      localStorage.getItem(this.routerQuery.getQueryParams('teamId'))
    );

    if (teamState) {
      this.sidenavWidth = teamState.width;

      if (teamState.mini) {
        this.miniSubject.next(teamState.mini);
      }

      if (teamState.opened) {
        this.openedSubject.next(teamState.opened);
      }

      this.setResizeStyle();
    }
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}

export class TeamUIState {
  width: number;
  opened: boolean;
  mini: boolean;
}
