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
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TopbarView } from '../shared/top-bar/topbar.models';
import { LoggedInUserService } from '../../services/logged-in-user/logged-in-user.service';

@Component({
  selector: 'app-admin-app',
  templateUrl: './admin-app.component.html',
  styleUrls: ['./admin-app.component.scss'],
})
export class AdminAppComponent implements OnInit, OnDestroy {
  @ViewChild('sidenav') sidenav: MatSidenav;
  public topbarColor = '#4c7aa2';
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

  public sectionItems: Array<SectionItem> = [
    {
      name: 'Views',
      section: Section.ADMIN_VIEWS,
      icon: 'ic_crucible_player',
      svgIcon: true,
    },
    {
      name: 'Users',
      section: Section.ADMIN_USERS,
      icon: 'assets/img/SP_Icon_User.png',
      svgIcon: false,
    },
    {
      name: 'Application Templates',
      section: Section.ADMIN_APP_TEMP,
      icon: 'assets/img/SP_Icon_Intel.png',
      svgIcon: false,
    },
    {
      name: 'Roles / Permissions',
      section: Section.ADMIN_ROLE_PERM,
      icon: 'assets/img/SP_Icon_Alert.png',
      svgIcon: false,
    },
    {
      name: 'Subscriptions',
      section: Section.ADMIN_SUBS,
      icon: 'assets/img/subscription.png',
      svgIcon: false,
    },
  ];

  constructor(
    private settingsService: ComnSettingsService,
    private router: Router,
    private routerQuery: RouterQuery,
    private authQuery: ComnAuthQuery,
    public loggedInUserService: LoggedInUserService
  ) {
    this.theme$ = this.authQuery.userTheme$;
  }

  /**
   * Initialization
   */
  ngOnInit() {
    this.routerQuery
      .selectQueryParams<string>('section')
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((section) => {
        const sectionEnum: Section = section as Section;

        if (sectionEnum != null) {
          this.sectionChangedFn(sectionEnum);
        } else {
          this.sectionChangedFn(Section.ADMIN_VIEWS);
        }
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
      case Section.ADMIN_SUBS:
        this.title = 'Subscriptions';
        break;
    }
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}

export enum Section {
  ADMIN_VIEWS = 'views',
  ADMIN_USERS = 'users',
  ADMIN_APP_TEMP = 'application-templates',
  ADMIN_ROLE_PERM = 'role-perm',
  ADMIN_SUBS = 'subscriptions',
}

export interface SectionItem {
  name: string;
  icon: string;
  section: Section;
  svgIcon: boolean;
}
