// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatSidenav } from '@angular/material/sidenav';
import { Router } from '@angular/router';
import {
  ComnSettingsService,
  Theme,
  ComnAuthQuery,
} from '@cmusei/crucible-common';
import { RouterQuery } from '@datorama/akita-ng-router-store';
import { Observable, of, Subject } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { Section } from '../../models/section.model';
import { TopbarView } from '../shared/top-bar/topbar.models';

@Component({
  selector: 'app-admin-app',
  templateUrl: './admin-app.component.html',
  styleUrls: ['./admin-app.component.scss'],
})
export class AdminAppComponent implements OnInit, OnDestroy {
  @ViewChild('sidenav') sidenav: MatSidenav;
  public topbarColor = '#5F8DB5';
  public topbarTextColor = '#FFFFFF';
  public TopbarView = TopbarView;
  public queryParams: any = {
    section: Section.ADMIN_VIEWS,
  };
  Section = Section;
  unsubscribe$: Subject<null> = new Subject<null>();
  theme$: Observable<Theme>;
  public section$: Observable<Section> =
    this.routerQuery.selectQueryParams('section');
  public title = '';

  constructor(
    private settingsService: ComnSettingsService,
    private router: Router,
    private routerQuery: RouterQuery,
    private authQuery: ComnAuthQuery
  ) {
    this.theme$ = this.authQuery.userTheme$;
  }

  /**
   * Initialization
   */
  ngOnInit() {
    this.routerQuery
      .selectQueryParams()
      .pipe(
        switchMap((params: any) => of(params)),
        takeUntil(this.unsubscribe$)
      )
      .subscribe((params: any) => {
        // Redirect if no query params
        const { section } = params;
        this.sectionChangedFn(this.queryParams['section']);
      });

    // Set the topbar color from config file
    this.topbarColor = this.settingsService.settings.AppTopBarHexColor;
    this.topbarTextColor = this.settingsService.settings.AppTopBarHexTextColor;
  }

  addParam(params: any): void {
    this.queryParams = { ...this.queryParams, ...params };
    this.router.navigate([], {
      queryParams: { ...this.queryParams },
      queryParamsHandling: 'merge',
    });
  }

  sectionChangedFn(section: Section) {
    this.addParam({ section });
    switch (section) {
      case Section.ADMIN_VIEWS:
        this.title = 'Views';
        break;
      case Section.ADMIN_USERS:
        this.title = 'Users';
        break;
      case Section.ADMIN_APP_TEMP:
        this.title = 'Application Templates';
        break;
      case Section.ADMIN_ROLE_PERM:
        this.title = 'Roles / Permissions';
        break;
    }
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
