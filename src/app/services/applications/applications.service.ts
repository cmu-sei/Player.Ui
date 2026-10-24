// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ComnSettingsService } from '@cmusei/crucible-common';
import { Observable, throwError as observableThrowError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApplicationData } from '../../models/application-data';

@Injectable()
export class ApplicationsService {
  private http = inject(HttpClient);
  private settings = inject(ComnSettingsService);

  public getApplicationsByTeam(
    teamId: string,
  ): Observable<Array<ApplicationData>> {
    return this.http
      .get<
        Array<ApplicationData>
      >(`${this.settings.settings.ApiUrl}/api/teams/${teamId}/application-instances`)
      .pipe(
        catchError((err) => {
          console.log(err);
          return observableThrowError(err || 'Server error');
        }),
      );
  }
}
