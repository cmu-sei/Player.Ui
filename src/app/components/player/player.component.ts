// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// TODO: Set sidnav status in query string.
// TODO: Set notification status in query string.
// TODO: Set active application in query string.

import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSidenav } from '@angular/material/sidenav';
import { Router } from '@angular/router';
import {
  ComnAuthQuery,
  ComnSettingsService,
  Theme,
} from '@cmusei/crucible-common';
import { RouterQuery } from '@datorama/akita-ng-router-store';
import { combineLatest, EMPTY, Observable, of, Subject } from 'rxjs';
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
})
export class PlayerComponent implements OnInit, OnDestroy {
  @ViewChild('sidenav') sidenav: MatSidenav;

  public loaded = false;
  public data$: Observable<any>;
  public opened$: Observable<boolean> =
    this.routerQuery.selectQueryParams('opened');

  public view: View;
  public viewId: string;
  public opened: boolean;
  public topbarColor = '#5F8DB5';
  public topbarTextColor = '#ffffff';
  queryParams: any = {};
  unsubscribe$: Subject<null> = new Subject<null>();
  theme$: Observable<Theme>;

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
          this.loggedInUserService.loggedInUser$,
          this.viewService.getView(state.params['id']),
          this.teamService.getMyViewTeams(state.params['id']),
        ]).pipe(
          // this pipe allows us to return all previous observable values.
          map(([user, view, teams]) => ({
            state,
            user,
            view,
            teams: teams.filter((t) => t.isMember),
            team: teams.find((t) => t.isPrimary),
            title: this.settingsService.settings.AppTitle,
          }))
        )
      ),
      tap(({ state, view, user, teams }) => {
        if (teams.length === 0) {
          this.messageService.displayMessage(
            'Not a Member',
            'You are not a member of any Teams in this View'
          );
        } else if (!this.loaded) {
          const params = {
            teamId: teams.find((t) => t.isPrimary).id,
            opened:
              state.queryParams['opened'] != null
                ? state.queryParams['opened']
                : true,
          };
          this.addParam(params);
          this.loaded = true;
        }
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
   * teams.  If a new primary team is set int he database, the page must be reloaded
   * @param teamId
   */
  setPrimaryTeam(newTeamId) {
    combineLatest([of(newTeamId), this.data$])
      .pipe(
        switchMap(([newTeamId, data]) => {
          if (newTeamId !== data.team.id) {
            this.addParam({ teamId: newTeamId });
            return this.viewsService.setPrimaryTeamId(
              data.user.profile.id,
              newTeamId
            );
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
    const dialogRef = this.dialog.open(AdminViewEditComponent);
    this.data$.subscribe((data) => {
      dialogRef.componentInstance.resetStepper();
      dialogRef.componentInstance.updateApplicationTemplates();
      dialogRef.componentInstance.updateView();
      dialogRef.componentInstance.view = data.view;
    });

    dialogRef.componentInstance.editComplete.subscribe(() => {
      dialogRef.close();
    });
  }

  sidenavToggleFn() {
    this.addParam({ opened: !this.sidenav.opened });
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
