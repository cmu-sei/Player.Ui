// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnInit, ViewChild } from '@angular/core';
import { MatSort, MatSortable } from '@angular/material/sort';
import { MatLegacyTableDataSource as MatTableDataSource } from '@angular/material/legacy-table';
import { ActivatedRoute, Router } from '@angular/router';
import { View, ViewService, ViewStatus } from '../../../generated/player-api';
import { DialogService } from '../../../services/dialog/dialog.service';
import { LoggedInUserService } from '../../../services/logged-in-user/logged-in-user.service';
import { AdminViewEditComponent } from './admin-view-edit/admin-view-edit.component';
import { filter, map, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export interface Action {
  Value: string;
  Text: string;
}

@Component({
  selector: 'app-admin-view-search',
  templateUrl: './admin-view-search.component.html',
  styleUrls: ['./admin-view-search.component.scss'],
})
export class AdminViewSearchComponent implements OnInit {
  @ViewChild(AdminViewEditComponent, { static: true })
  adminViewEditComponent: AdminViewEditComponent;
  @ViewChild(MatSort, { static: true }) sort: MatSort;

  public viewActions: Action[] = [
    { Value: 'edit', Text: 'Edit View' },
    { Value: 'activate', Text: 'Activate/Deactivate View' },
  ];

  public viewDataSource: MatTableDataSource<View>;
  public displayedColumns: string[] = ['name', 'description', 'status'];
  public filterString: string;
  public showEditScreen: boolean;
  public isLoading: boolean;

  constructor(
    private viewService: ViewService,
    public loggedInUserService: LoggedInUserService,
    public dialogService: DialogService,
    public route: ActivatedRoute,
    public router: Router
  ) {}

  /**
   * Initialization
   */
  ngOnInit() {
    this.refreshViews();

    // Initial datasource
    this.viewDataSource = new MatTableDataSource<View>(new Array<View>());
    this.sort.sort(<MatSortable>{ id: 'name', start: 'asc' });
    this.viewDataSource.sort = this.sort;
    this.showEditScreen = false;
    this.filterString = '';

    // Initial datasource
    this.filterString = '';

    // Check to see if a view was specified in the URL
    const viewId = this.route.snapshot.queryParamMap.get('view');
    if (viewId) {
      this.executeViewAction('edit', viewId);
    }
  }

  /**
   * Executes an action menu item
   * @param action: action string to case from
   * @param viewGuid: The guid for view
   */
  executeViewAction(action: string, viewGuid: string) {
    switch (action) {
      case 'edit': {
        // Edit view
        this.viewService.getView(viewGuid).subscribe((view) => {
          this.adminViewEditComponent.resetStepper();

          this.adminViewEditComponent.updateView();
          this.adminViewEditComponent.updateApplicationTemplates();

          // Get teams for the view now so user does not have to expand teams section before uploading files
          if (view) {
            this.adminViewEditComponent.setView(view);
          }
          this.adminViewEditComponent.updateViewTeams();

          this.showEditScreen = true;
        });
        break;
      }
      case 'activate': {
        // Activate or Deactivate
        this.viewService.getView(viewGuid).subscribe((view) => {
          let msg = '';
          let title = '';
          let activation = ViewStatus.Inactive;
          if (
            view.status === undefined ||
            view.status === ViewStatus.Inactive
          ) {
            msg = 'Do you wish to Activate view ' + view.name + '?';
            title = 'Activate View?';
            activation = ViewStatus.Active;
          } else {
            msg = 'Do you wish to deactivate view ' + view.name + '?';
            title = 'Deactivate View?';
            activation = ViewStatus.Inactive;
          }
          this.dialogService.confirm(title, msg).subscribe((result) => {
            if (result['confirm']) {
              view.status = activation;
              this.viewService
                .updateView(viewGuid, view)
                .subscribe((updateview) => {
                  console.log('successfully updated view ' + updateview.name);
                  this.refreshViews();
                });
            }
          });
        });
        break;
      }
      default: {
        alert('Unknown Action');
        break;
      }
    }
  }

  /**
   * Adds a new view
   */
  addNewView() {
    const view = <View>{
      name: 'New View',
      description: 'Add description',
      status: ViewStatus.Active,
    };
    this.viewService.createView(view).subscribe((ex) => {
      this.refreshViews();
      this.executeViewAction('edit', ex.id);
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
   * Updated the datasource for the view search table
   */
  refreshViews() {
    this.showEditScreen = false;
    this.isLoading = true;
    this.viewService
      .getViews()
      .pipe(
        map((views) => {
          this.viewDataSource.data = views;
          this.isLoading = false;
        })
      )
      .subscribe();
  }

  onEditComplete($event) {
    this.refreshViews();

    // if (this.loggedInUserService.isSuperUser$.getValue()) {
    //   this.refreshViews();
    // } else {
    //   this.router.navigate(['view', $event]);
    // }
  }

  /**
   * Clears the search string
   */
  clearFilter() {
    this.applyFilter('');
  }
}
