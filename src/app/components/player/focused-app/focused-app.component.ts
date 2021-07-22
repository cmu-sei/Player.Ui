// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnDestroy } from '@angular/core';
import { FocusedAppService } from '../../../services/focused-app/focused-app.service';
import { SafeUrl, DomSanitizer } from '@angular/platform-browser';
import { combineLatest, Observable, Subject, ReplaySubject } from 'rxjs';
import { ComnAuthQuery, Theme } from '@cmusei/crucible-common';
import { map, share, shareReplay, tap } from 'rxjs/operators';

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
    this.focusedAppUrl$ = this.focusedAppService.focusedAppUrl.pipe(
      map((url) => this.sanitizer.bypassSecurityTrustResourceUrl(url))
    );

    this.focusedAppUrl$ = combineLatest([
      this.focusedAppService.focusedAppUrl,
      this.authQuery.userTheme$,
    ]).pipe(
      map(([url, theme]) => {
        let themedUrl = url;
        const themeIndex = url.indexOf('?theme=');
        if (themeIndex >= 0) {
          // Only add the theme query param if it already exists
          themedUrl = url.substring(0, themeIndex) + '?theme=' + theme;
        }
        return this.sanitizer.bypassSecurityTrustResourceUrl(themedUrl);
      }),
      shareReplay(1)
      // share({
      //   connector: () => new ReplaySubject(1),
      // })
    );
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
