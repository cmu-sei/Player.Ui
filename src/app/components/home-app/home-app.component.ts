// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnInit } from '@angular/core';
import { ComnSettingsService } from '@cmusei/crucible-common';
import { TopbarView } from '../shared/top-bar/topbar.models';
import { TopbarComponent } from '../shared/top-bar/topbar.component';
import { ViewListComponent } from './view-list/view-list.component';

@Component({
  selector: 'app-home-app',
  templateUrl: './home-app.component.html',
  styleUrls: ['./home-app.component.scss'],
  imports: [TopbarComponent, ViewListComponent],
})
export class HomeAppComponent implements OnInit {
  public title: string;
  TopbarView = TopbarView;

  constructor(private settingsService: ComnSettingsService) {}

  ngOnInit() {
    // Set the page title from configuration file
    this.title = this.settingsService.settings.AppTopBarText;
  }
}
