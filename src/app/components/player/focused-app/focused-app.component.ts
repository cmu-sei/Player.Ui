// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnDestroy } from '@angular/core';
import { FocusedAppService } from '../../../services/focused-app/focused-app.service';
import { SafeUrl, DomSanitizer } from '@angular/platform-browser';
import { combineLatest, Observable, Subject } from 'rxjs';
import { ComnAuthQuery, Theme } from '@cmusei/crucible-common';
import { distinctUntilChanged, map, shareReplay } from 'rxjs/operators';

@Component({
  selector: 'app-focused-app',
  templateUrl: './focused-app.component.html',
  styleUrls: ['./focused-app.component.scss'],
})
export class FocusedAppComponent implements OnDestroy {
  public focusedAppUrl$: Observable<SafeUrl>;
  public theme$: Observable<Theme>;
  private unsubscribe$ = new Subject<null>();

  constructor(
    private focusedAppService: FocusedAppService,
    private sanitizer: DomSanitizer,
    private authQuery: ComnAuthQuery
  ) {
    this.focusedAppUrl$ = combineLatest([
      this.focusedAppService.focusedAppUrl,
      this.authQuery.userTheme$,
    ]).pipe(
      map(([url, theme]) => {
        let themedUrl = url;
        let themeText = '?theme=';
        let themeIndex = url.indexOf(themeText);
        if (themeIndex < 0) {
          themeText = '&theme=';
          themeIndex = url.indexOf(themeText);
        }
        if (themeIndex >= 0) {
          // Only add the theme query param if it already exists
          let urlEnding = url.substring(themeIndex + 7);
          const endingIndex = urlEnding.indexOf('&');
          urlEnding = endingIndex < 0 ? '' : urlEnding.substring(endingIndex);
          themedUrl =
            url.substring(0, themeIndex) + themeText + theme + urlEnding;
        }

        return themedUrl;
      }),
      shareReplay(1),
      distinctUntilChanged(),
      map((themedUrl) =>
        this.sanitizer.bypassSecurityTrustResourceUrl(themedUrl)
      )
    );
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
