/*
 Copyright 2022 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { MatAccordion } from '@angular/material/expansion';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { debounceTime, map, shareReplay, switchMap } from 'rxjs/operators';
import {
  Team,
  TeamPermission,
  TeamPermissionsClaim,
  TeamPermissionService,
  TeamService,
  ViewPermission,
} from '../../../../generated/player-api';
import { ViewPresence } from '../../../../models/view-presence';
import { NotificationService } from '../../../../services/notification/notification.service';

@Component({
  selector: 'app-user-presence',
  templateUrl: './user-presence.component.html',
  styleUrls: ['./user-presence.component.scss'],
  standalone: false,
})
export class UserPresenceComponent implements OnInit, OnDestroy {
  @Input() viewId: string;
  @Input() teamId?: string;
  @Input() showCloseButton = true;
  @Output() closeMe = new EventEmitter<any>();

  public _teams: Observable<Array<Team>>;
  public hideInactive = false;
  private presenceTeamId?: string;

  constructor(
    private notificationService: NotificationService,
    private teamService: TeamService,
    private teamPermissionService: TeamPermissionService,
  ) {}

  ngOnInit(): void {
    this._teams = this.teamService.getMyViewTeams(this.viewId).pipe(
      switchMap((teams) => {
        const activeTeam = this.getActiveTeam(teams);
        if (!activeTeam?.id) {
          return of([]);
        }

        this.presenceTeamId = activeTeam.id;
        this.notificationService.joinPresence(this.viewId, this.presenceTeamId);

        return this.teamPermissionService
          .getMyTeamPermissions(undefined, activeTeam.id, false)
          .pipe(
            map((claims) =>
              this.filterTeamsForPresence(teams, activeTeam, claims[0]),
            ),
          );
      }),
      map((x) =>
        x.sort((a: Team, b: Team) =>
          (a.name ?? '') < (b.name ?? '') ? -1 : 1,
        ),
      ),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  @ViewChild(MatAccordion) accordion: MatAccordion;

  public searchTerm = '';
  public searchTermSubject = new BehaviorSubject('');
  public searchTerm$ = this.searchTermSubject
    .asObservable()
    .pipe(debounceTime(100));

  public applyFilter(filterValue: string) {
    this.searchTerm = filterValue.toLowerCase();
    this.searchTermSubject.next(this.searchTerm);
  }

  public clearFilter() {
    this.applyFilter('');
  }

  public setHideInactive(value: boolean) {
    this.hideInactive = value;
  }

  public trackByTeamId(item: Team) {
    return item.id;
  }

  private getActiveTeam(teams: Team[]): Team | undefined {
    return teams.find((team) => team.isPrimary);
  }

  private filterTeamsForPresence(
    teams: Team[],
    activeTeam: Team,
    claim?: TeamPermissionsClaim,
  ): Team[] {
    const permissionValues = claim?.directPermissionValues ?? [];

    if (
      permissionValues.includes(ViewPermission.ViewView) ||
      permissionValues.includes(ViewPermission.ManageView)
    ) {
      return teams;
    }

    const visibleTeamIds = new Set<string>();
    if (activeTeam.id) {
      visibleTeamIds.add(activeTeam.id);
    }

    if (
      permissionValues.includes(TeamPermission.ViewTeam) ||
      permissionValues.includes(TeamPermission.ManageTeam)
    ) {
      activeTeam.scopedTeamIds?.forEach((teamId) => visibleTeamIds.add(teamId));
    }

    return teams.filter(
      (team) => team.id != null && visibleTeamIds.has(team.id),
    );
  }

  public getPresenceByTeamId(teamId: string): Observable<ViewPresence[]> {
    return this.notificationService.userPresence$.pipe(
      map((x) => x.filter((y) => y.teamIds.includes(teamId))),
      map((x) =>
        x.sort(
          // first by online, then by username
          (a: ViewPresence, b: ViewPresence) => {
            if (a.online === b.online) {
              return a.userName < b.userName ? -1 : 1;
            } else {
              return b.online < a.online ? -1 : 1;
            }
          },
        ),
      ),
    );
  }

  ngOnDestroy() {
    if (this.presenceTeamId) {
      this.notificationService.leavePresence(this.viewId, this.presenceTeamId);
    }
  }
}
