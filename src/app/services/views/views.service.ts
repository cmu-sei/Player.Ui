// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ComnSettingsService } from '@cmusei/crucible-common';
import {
  BehaviorSubject,
  Observable,
  throwError as observableThrowError,
} from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { TeamData } from '../../models/team-data';
import { ViewData } from '../../models/view-data';
import { ViewStatus } from '../../generated/player-api';

const httpOptions = {
  headers: new HttpHeaders({
    'Content-Type': 'application/json',
  }),
};

@Injectable()
export class ViewsService {
  public readonly currentViewGuid: BehaviorSubject<string>;
  public viewList: BehaviorSubject<Array<ViewData>>;

  constructor(private http: HttpClient, private settings: ComnSettingsService) {
    this.currentViewGuid = new BehaviorSubject<string>('');
    this.viewList = new BehaviorSubject<Array<ViewData>>(new Array<ViewData>());
  }

  /**
   * Makes a call to the API and updates the viewList
   * @param userGuid
   */
  public getViewList(userGuid: string): void {
    this.http
      .get<Array<ViewData>>(
        `${this.settings.settings.ApiUrl}/api/users/${userGuid}/views`
      )
      .subscribe((views) => {
        const viewArray = new Array<ViewData>();
        views.forEach((view) => {
          this.http
            .get<Array<TeamData>>(
              `${this.settings.settings.ApiUrl}/api/users/${userGuid}/views/${view.id}/teams`
            )
            .pipe(map((teams) => teams.filter((t) => t.isMember)))
            .subscribe((teams) => {
              teams.forEach((team) => {
                if (team.isPrimary && view.status === ViewStatus.Active) {
                  const ex = <ViewData>{
                    id: view.id,
                    name: view.name,
                    description: view.description,
                    status: view.status,
                    teamId: team.id,
                    teamName: team.name,
                  };
                  viewArray.push(ex);
                }
              });
              this.viewList.next(viewArray);
            });
        });
      }),
      (err) => {
        console.log(err);
        return observableThrowError(err || 'Server error');
      };
  }

  public setPrimaryTeamId(userGuid: string, teamGuid: string): Observable<any> {
    return this.http
      .post<any>(
        `${this.settings.settings.ApiUrl}/api/users/${userGuid}/teams/${teamGuid}/primary`,
        null,
        httpOptions
      )
      .pipe(
        catchError((err) => {
          return observableThrowError(err || 'Server error');
        })
      );
  }

  /**
   * Returns a single instance of the specified view
   * @param viewGuid
   */
  public getViewById(viewGuid: string): Observable<ViewData> {
    return this.http
      .get<ViewData>(`${this.settings.settings.ApiUrl}/api/views/${viewGuid}`)
      .pipe(
        catchError((err) => {
          return observableThrowError(err || 'Server error');
        })
      );
  }
}
