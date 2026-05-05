// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ComnSettingsService } from '@cmusei/crucible-common';

@Injectable({
  providedIn: 'root',
})
export class XApiService {
  private baseUrl: string;

  constructor(
    private http: HttpClient,
    private settingsService: ComnSettingsService
  ) {
    this.baseUrl = this.settingsService.settings.ApiUrl;
  }

  /**
   * Logs xAPI experienced statement when user switches to an application
   */
  applicationSwitched(
    viewId: string,
    applicationName: string,
    applicationUrl: string
  ): Observable<any> {
    const url = `${this.baseUrl}/api/xapi/experienced/view/${viewId}/application`;
    const params = {
      applicationName: applicationName,
      applicationUrl: applicationUrl,
    };

    return this.http.post(url, null, { params }).pipe(
      catchError((error) => {
        console.error('xAPI tracking error:', error);
        return of(null); // Fail silently - xAPI errors shouldn't break UI
      })
    );
  }

  /**
   * Logs xAPI terminated statement when user closes/leaves a view
   */
  viewTerminated(viewId: string, durationSeconds: number): Observable<any> {
    const url = `${this.baseUrl}/api/xapi/terminated/view/${viewId}`;
    const params = { durationSeconds: durationSeconds };

    // Use sendBeacon for reliability on page unload
    if (navigator.sendBeacon) {
      const data = new URLSearchParams(params as any);
      navigator.sendBeacon(`${url}?${data.toString()}`);
      return of(null);
    } else {
      return this.http.post(url, null, { params }).pipe(
        catchError((error) => {
          console.error('xAPI tracking error:', error);
          return of(null);
        })
      );
    }
  }
}
