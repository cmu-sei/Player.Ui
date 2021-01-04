// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { ApplicationTemplate } from '../../../generated/player-api';
import { PageEvent, MatPaginator } from '@angular/material/paginator';
import { MatSort, MatSortable } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { ApplicationService } from '../../../generated/player-api/api/application.service';

export interface Action {
  Value: string;
  Text: string;
}

@Component({
  selector: 'app-admin-app-template-search',
  templateUrl: './admin-app-template-search.component.html',
  styleUrls: ['./admin-app-template-search.component.scss'],
})
export class AdminAppTemplateSearchComponent implements OnInit, AfterViewInit {
  public appTemplateDataSource: MatTableDataSource<ApplicationTemplate>;
  public appTemplateColumns: string[] = ['name', 'url'];
  public filterString: string;
  public currentAppTemplate: ApplicationTemplate;

  // MatPaginator Output
  public defaultPageSize = 10;
  public pageEvent: PageEvent;
  public uploading = false;
  public uploadProgress = 0;

  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;

  constructor(private applicationService: ApplicationService) {}

  /**
   * Initialization
   */
  ngOnInit() {
    this.pageEvent = new PageEvent();
    this.pageEvent.pageIndex = 0;
    this.pageEvent.pageSize = this.defaultPageSize;

    // Initial datasource
    this.appTemplateDataSource = new MatTableDataSource<ApplicationTemplate>(
      new Array<ApplicationTemplate>()
    );
    this.sort.sort(<MatSortable>{ id: 'name', start: 'asc' });
    this.appTemplateDataSource.sort = this.sort;
    this.filterString = '';
    this.refresh(false);
  }

  /**
   * Called after the components initialized
   */
  ngAfterViewInit() {
    this.appTemplateDataSource.paginator = this.paginator;
  }

  /**
   * Updates the current list of application templates
   */
  refresh(wasDeleted: boolean) {
    this.applicationService
      .getApplicationTemplates()
      .subscribe((appTemplates) => {
        if (wasDeleted) {
          this.currentAppTemplate = undefined;
        }
        this.appTemplateDataSource.data = appTemplates;
      });
  }

  /**
   * Add a new application template
   */
  addAppTemplate() {
    const newAppTemplate: ApplicationTemplate = {
      name: 'New Template',
      url: 'http://localhost',
      embeddable: true,
      icon: '/assets/img/player.png',
      loadInBackground: false,
    };
    this.applicationService
      .createApplicationTemplate(newAppTemplate)
      .subscribe((newApp) => {
        this.paginator.lastPage();
        this.applicationService
          .getApplicationTemplates()
          .subscribe((appTemplates) => {
            this.appTemplateDataSource.data = appTemplates;
            this.currentAppTemplate = newApp;
          });
      });
  }

  /**
   * Called by UI to add a filter to the appTemplateDataSource
   * @param filterValue
   */
  applyFilter(filterValue: string) {
    this.currentAppTemplate = undefined;
    this.filterString = filterValue;
    this.pageEvent.pageIndex = 0;
    filterValue = filterValue.toLowerCase(); // MatTableDataSource defaults to lowercase matches
    this.appTemplateDataSource.filter = filterValue;
  }

  /**
   * Clears the application template filter string
   */
  clearFilter() {
    this.applyFilter('');
  }
}
