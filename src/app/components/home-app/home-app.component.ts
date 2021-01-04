// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnInit } from '@angular/core';
import { ComnSettingsService } from '@cmusei/crucible-common';
import { TopbarView } from '../shared/top-bar/topbar.models';

@Component({
  selector: 'app-home-app',
  templateUrl: './home-app.component.html',
  styleUrls: ['./home-app.component.scss'],
})
export class HomeAppComponent implements OnInit {
  public title: string;
  public topbarColor = '#5F8DB5';
  public topbarTextColor = '#FFFFFF';
  TopbarView = TopbarView;

  constructor(private settingsService: ComnSettingsService) {}

  ngOnInit() {
    // Set the topbar color from config file
    this.topbarColor = this.settingsService.settings.AppTopBarHexColor;
    this.topbarTextColor = this.settingsService.settings.AppTopBarHexTextColor;

    // Set the page title from configuration file
    this.title = this.settingsService.settings.AppTopBarText;
  }
}
