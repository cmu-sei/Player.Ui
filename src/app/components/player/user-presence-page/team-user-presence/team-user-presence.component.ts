/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Component, Input, OnInit } from '@angular/core';
import { TableVirtualScrollDataSource } from 'ng-table-virtual-scroll';
import { Team } from '../../../../generated/player-api';
import { ViewPresence } from '../../../../models/view-presence';

@Component({
  selector: 'app-team-user-presence',
  templateUrl: './team-user-presence.component.html',
  styleUrls: ['./team-user-presence.component.scss'],
})
export class TeamUserPresenceComponent implements OnInit {
  @Input() team: Team = null;

  @Input() set hideInactive(val: boolean) {
    this.hideInactiveInternal = val;
    this.updateDataSource();
  }

  @Input() set users(val: Array<ViewPresence>) {
    this.userList = val;
    this.updateDataSource();
  }

  @Input() set searchTerm(val: string) {
    this.userDatasource.filter = val;
    this.calculateTableHeight();
  }

  private userList: Array<ViewPresence>;
  private hideInactiveInternal = false;

  public userDatasource = new TableVirtualScrollDataSource<ViewPresence>(
    new Array<ViewPresence>()
  );
  public displayedColumns: string[] = ['user-name', 'online'];
  public itemSize = 48;
  public headerSize = 56;
  public maxSize = this.itemSize * 7;
  public tableHeight = '0px';

  constructor() {
    this.userDatasource.filterPredicate = (
      data: ViewPresence,
      filter: string
    ) => {
      return data.userName.toLowerCase().indexOf(filter.toLowerCase()) !== -1;
    };
  }

  ngOnInit(): void {}

  private updateDataSource() {
    if (this.hideInactiveInternal) {
      this.userDatasource.data = this.userList.filter((x) => x.online);
    } else {
      this.userDatasource.data = this.userList;
    }

    this.calculateTableHeight();
  }

  calculateTableHeight() {
    const count = this.userDatasource.filteredData.length;
    let height: number;
    height = this.headerSize * 1.2 + count * this.itemSize;

    if (height > this.maxSize) {
      height = this.maxSize;
    }

    this.tableHeight = `${height}px`;
  }
}
