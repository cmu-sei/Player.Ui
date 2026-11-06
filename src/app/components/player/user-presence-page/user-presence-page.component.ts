/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UserPresenceComponent } from './user-presence/user-presence.component';

@Component({
  templateUrl: './user-presence-page.component.html',
  styleUrls: ['./user-presence-page.component.scss'],
  imports: [UserPresenceComponent],
})
export class UserPresencePageComponent implements OnInit {
  private route = inject(ActivatedRoute);

  viewId: string;

  ngOnInit(): void {
    this.viewId = this.route.snapshot.paramMap.get('id');
  }
}
