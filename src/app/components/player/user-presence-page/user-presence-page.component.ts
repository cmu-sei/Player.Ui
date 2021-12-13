import { Component, OnInit } from '@angular/core';
import { RouterQuery } from '@datorama/akita-ng-router-store';

@Component({
  templateUrl: './user-presence-page.component.html',
  styleUrls: ['./user-presence-page.component.scss']
})
export class UserPresencePageComponent implements OnInit {

  viewId: string;

  constructor(private routerQuery: RouterQuery) { }

  ngOnInit(): void {
    this.viewId = this.routerQuery.getParams('id');
  }
}
