// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnInit, ViewChild } from '@angular/core';
import { MatSort, MatSortable } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { ViewData } from '../../../models/view-data';
import { LoggedInUserService } from '../../../services/logged-in-user/logged-in-user.service';
import { ViewsService } from '../../../services/views/views.service';

@Component({
  selector: 'app-view-list',
  templateUrl: './view-list.component.html',
  styleUrls: ['./view-list.component.scss'],
})
export class ViewListComponent implements OnInit {
  @ViewChild(MatSort, { static: true }) sort: MatSort;

  public viewDataSource: MatTableDataSource<ViewData>;
  public displayedColumns: string[] = ['name', 'teamName', 'description'];

  public filterString: string;
  public isLoading: Boolean;

  constructor(
    private viewsService: ViewsService,
    private loggedInUserService: LoggedInUserService
  ) {}

  /**
   * Initalization
   */
  ngOnInit() {
    this.filterString = '';

    // Initial datasource
    this.viewDataSource = new MatTableDataSource<ViewData>(
      new Array<ViewData>()
    );
    this.sort.sort(<MatSortable>{ id: 'name', start: 'asc' });
    this.viewDataSource.sort = this.sort;

    // Subscribe to the service
    this.isLoading = true;
    this.viewsService.viewList.subscribe((views) => {
      this.viewDataSource.data = views;
      this.isLoading = false;
    });

    // Tell the service to update once a user is officially logged in
    this.loggedInUserService.loggedInUser$.subscribe((loggedInUser) => {
      if (loggedInUser == null) {
        return;
      }
      this.viewsService.getViewList(loggedInUser.profile.id);
    });
  }

  /**
   * Called by UI to add a filter to the viewDataSource
   * @param filterValue
   */
  applyFilter(filterValue: string) {
    this.filterString = filterValue;
    filterValue = filterValue.trim(); // Remove whitespace
    filterValue = filterValue.toLowerCase(); // MatTableDataSource defaults to lowercase matches
    this.viewDataSource.filter = filterValue;
  }

  /**
   * Clears the search string
   */
  clearFilter() {
    this.applyFilter('');
  }
}
