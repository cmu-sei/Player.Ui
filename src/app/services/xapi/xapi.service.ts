// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { XApiService as GeneratedXApiService } from '../../generated/player-api';
import { ComnSettingsService } from '@cmusei/crucible-common';

@Injectable({
  providedIn: 'root',
})
export class XApiService {
  private enabled: boolean;

  constructor(
    private generatedXApiService: GeneratedXApiService,
    private settingsService: ComnSettingsService
  ) {
    this.enabled = this.settingsService.settings.XApiEnabled ?? false;
  }

  /**
   * Logs xAPI experienced statement when user switches to an application
   */
  applicationSwitched(
    viewId: string,
    applicationName: string,
    applicationUrl: string
  ): Observable<any> {
    if (!this.enabled) {
      return of(null);
    }
    return this.generatedXApiService.applicationSwitched(viewId, applicationName, applicationUrl).pipe(
      catchError((error) => {
        console.error('xAPI tracking error:', error);
        return of(null); // Fail silently - xAPI errors shouldn't break UI
      })
    );
  }

}
