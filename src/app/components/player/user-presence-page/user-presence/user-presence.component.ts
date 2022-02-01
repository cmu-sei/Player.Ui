/*
 Copyright 2022 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Component, EventEmitter, Input, Output, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatAccordion } from '@angular/material/expansion';
import { BehaviorSubject, Observable } from 'rxjs';
import { debounceTime, map } from 'rxjs/operators';
import { Team, TeamService } from '../../../../generated/player-api';
import { ViewPresence } from '../../../../models/view-presence';
import { NotificationService } from '../../../../services/notification/notification.service';
import { firstBy } from 'thenby';

@Component({
  selector: 'app-user-presence',
  templateUrl: './user-presence.component.html',
  styleUrls: ['./user-presence.component.scss'],
})
export class UserPresenceComponent implements OnInit, OnDestroy {
  @Input() viewId: string;
  @Output() closeMe = new EventEmitter<any>();

  public _teams: Observable<Array<Team>>;
  public hideInactive = false;

  constructor(
    private notificationService: NotificationService,
    private teamService: TeamService
  ) {}

  ngOnInit(): void {
    this._teams = this.teamService
      .getMyViewTeams(this.viewId)
      .pipe(map((x) => x.sort(firstBy('name'))));
    this.notificationService.joinPresence(this.viewId);
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

  public getPresenceByTeamId(teamId: string): Observable<ViewPresence[]> {
    return this.notificationService.userPresence$.pipe(
      map((x) => x.filter((y) => y.teamIds.includes(teamId))),
      map((x) =>
        x.sort(
          firstBy(
            (a: ViewPresence, b: ViewPresence) => +b.online - +a.online
          ).thenBy('userName')
        )
      )
    );
  }

  ngOnDestroy() {
    this.notificationService.leavePresence(this.viewId);
  }
}
