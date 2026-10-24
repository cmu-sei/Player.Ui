/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatTabGroup, MatTab, MatTabContent } from '@angular/material/tabs';
import { SystemRolesComponent } from './roles/roles.component';
import { TeamRolesComponent } from './team-roles/team-roles.component';

@Component({
  selector: 'app-admin-roles',
  templateUrl: './admin-roles.component.html',
  styleUrls: ['./admin-roles.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatTabGroup,
    MatTab,
    MatTabContent,
    SystemRolesComponent,
    TeamRolesComponent,
  ],
})
export class AdminRolesComponent {}
