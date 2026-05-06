// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { XApiService as GeneratedXApiService } from '../../generated/player-api';

@Injectable({
  providedIn: 'root',
})
export class XApiService {
  constructor(private generatedXApiService: GeneratedXApiService) {}

  /**
   * Logs xAPI viewed statement when user enters a view
   */
  viewViewed(viewId: string): Observable<any> {
    return this.generatedXApiService.viewViewed(viewId).pipe(
      catchError((error) => {
        console.error('xAPI tracking error:', error);
        return of(null);
      })
    );
  }

  /**
   * Logs xAPI experienced statement when user switches to an application
   */
  applicationSwitched(
    viewId: string,
    applicationName: string,
    applicationUrl: string
  ): Observable<any> {
    return this.generatedXApiService.applicationSwitched(viewId, applicationName, applicationUrl).pipe(
      catchError((error) => {
        console.error('xAPI tracking error:', error);
        return of(null); // Fail silently - xAPI errors shouldn't break UI
      })
    );
  }

  /**
   * Logs xAPI switched statement when user switches their active team
   */
  teamSwitched(viewId: string, teamId: string): Observable<any> {
    return this.generatedXApiService.teamSwitched(viewId, teamId).pipe(
      catchError((error) => {
        console.error('xAPI tracking error:', error);
        return of(null);
      })
    );
  }

  /**
   * Logs xAPI terminated statement when user closes/leaves a view
   */
  viewTerminated(viewId: string, durationSeconds: number): Observable<any> {
    // Note: sendBeacon approach removed - using generated client for consistency
    // If sendBeacon is needed for reliability on page unload, consider implementing
    // at the component level before calling this service
    return this.generatedXApiService.viewTerminated(viewId, durationSeconds).pipe(
      catchError((error) => {
        console.error('xAPI tracking error:', error);
        return of(null);
      })
    );
  }
}
