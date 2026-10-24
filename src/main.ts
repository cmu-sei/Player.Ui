// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { enableProdMode } from '@angular/core';
import { enableAkitaProdMode, persistState } from '@datorama/akita';
import { environment } from './environments/environment';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

if (environment.production) {
  enableProdMode();
  enableAkitaProdMode();
}

export const storage = persistState({
  key: 'akita-player-ui',
  include: ['auth.ui'],
});

bootstrapApplication(AppComponent, appConfig).catch((err) => console.log(err));
