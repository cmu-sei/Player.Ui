// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ComnSettingsService } from '@cmusei/crucible-common';
import { Observable, throwError as observableThrowError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { TeamData } from '../../models/team-data';

@Injectable()
export class TeamsService {
  constructor(
    private http: HttpClient,
    private settings: ComnSettingsService
  ) {}

  /**
   * Gets the list of teams for the user by the view.  Note that Admin/SuperUsers will receive all teams
   * @param userGuid
   * @param viewGuid
   */
  public getUserTeamsByView(
    userGuid: string,
    viewGuid: string
  ): Observable<Array<TeamData>> {
    return this.http
      .get<Array<TeamData>>(
        `${this.settings.settings.ApiUrl}/api/users/${userGuid}/views/${viewGuid}/teams`
      )
      .pipe(
        map((teams) => {
          return teams;
        }),
        catchError((err) => {
          return observableThrowError(err || 'Server error');
        })
      );
  }
}
