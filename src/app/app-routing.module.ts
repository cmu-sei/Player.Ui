// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ComnAuthGuardService } from '@cmusei/crucible-common';
import { AdminAppComponent } from './components/admin-app/admin-app.component';
import { HomeAppComponent } from './components/home-app/home-app.component';
import { FileBrowseComponent } from './components/player/file-browse/file-browse.component';
import { OpenFileComponent } from './components/player/open-file/open-file.component';
import { PlayerComponent } from './components/player/player.component';

export const ROUTES: Routes = [
  {
    path: '',
    component: HomeAppComponent,
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'exercise-player/:id',
    component: PlayerComponent,
    canActivate: [ComnAuthGuardService],
  }, // TODO: deprecated, remove when safe to do so
  {
    path: 'view/:id',
    component: PlayerComponent,
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'home-app',
    component: HomeAppComponent,
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'admin',
    component: AdminAppComponent,
    canActivate: [ComnAuthGuardService],
  },
  // These are needed for embedding a file brower application and for downloading files respectively
  {
    path: 'view/:id/files',
    component: FileBrowseComponent,
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'view/:id/file',
    component: OpenFileComponent,
    canActivate: [ComnAuthGuardService],
  },
];

@NgModule({
  exports: [RouterModule],
  imports: [CommonModule, RouterModule.forRoot(ROUTES)],
})
export class AppRoutingModule {}
