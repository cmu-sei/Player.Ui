// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Routes } from '@angular/router';
import { ComnAuthGuardService } from '@cmusei/crucible-common';

export const ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/home-app/home-app.component').then(
        (m) => m.HomeAppComponent,
      ),
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'exercise-player/:id',
    loadComponent: () =>
      import('./components/player/player.component').then(
        (m) => m.PlayerComponent,
      ),
    canActivate: [ComnAuthGuardService],
  }, // TODO: deprecated, remove when safe to do so
  {
    path: 'view/:id',
    loadComponent: () =>
      import('./components/player/player.component').then(
        (m) => m.PlayerComponent,
      ),
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'home-app',
    loadComponent: () =>
      import('./components/home-app/home-app.component').then(
        (m) => m.HomeAppComponent,
      ),
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./components/admin-app/admin-app.component').then(
        (m) => m.AdminAppComponent,
      ),
    canActivate: [ComnAuthGuardService],
  },
  // These are needed for embedding a file brower application and for downloading files respectively
  {
    path: 'view/:id/files',
    loadComponent: () =>
      import('./components/player/file-browse/file-browse.component').then(
        (m) => m.FileBrowseComponent,
      ),
    canActivate: [ComnAuthGuardService],
  },
  {
    // deprecated: viewId is not used in this component, use /file instead
    // leaving route for backwards compatibility for now.
    path: 'view/:id/file',
    loadComponent: () =>
      import('./components/player/open-file/open-file.component').then(
        (m) => m.OpenFileComponent,
      ),
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'file',
    loadComponent: () =>
      import('./components/player/open-file/open-file.component').then(
        (m) => m.OpenFileComponent,
      ),
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'view/:id/presence',
    loadComponent: () =>
      import('./components/player/user-presence-page/user-presence-page.component').then(
        (m) => m.UserPresencePageComponent,
      ),
    canActivate: [ComnAuthGuardService],
  },
];
