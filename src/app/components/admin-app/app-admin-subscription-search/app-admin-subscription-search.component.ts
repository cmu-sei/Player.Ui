/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatSort, MatSortable } from '@angular/material/sort';
import { MatLegacyTableDataSource as MatTableDataSource } from '@angular/material/legacy-table';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  WebhookService,
  WebhookSubscription,
} from '../../../generated/player-api';
import { DialogService } from '../../../services/dialog/dialog.service';

@Component({
  selector: 'app-admin-subscription-search',
  templateUrl: './app-admin-subscription-search.component.html',
  styleUrls: ['./app-admin-subscription-search.component.scss'],
})
export class AppAdminSubscriptionSearchComponent implements OnInit, OnDestroy {
  @ViewChild(MatSort, { static: true }) sort: MatSort;

  public dataSource: MatTableDataSource<WebhookSubscription>;
  public displayedColumns: string[] = ['name', 'lastError', 'eventTypes'];
  public editing: boolean = false;
  public filterStr = '';
  public unsubscribe$: Subject<null> = new Subject<null>();

  constructor(
    private webhookService: WebhookService,
    private dialogService: DialogService
  ) {}
  ngOnInit(): void {
    // Initialize table
    this.dataSource = new MatTableDataSource<WebhookSubscription>(
      new Array<WebhookSubscription>()
    );
    this.sort.sort(<MatSortable>{ id: 'name', start: 'asc' });
    this.dataSource.sort = this.sort;

    this.refreshSubs();
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

  addNewSubscription() {
    this.dialogService.editSubscription().subscribe(() => {
      this.refreshSubs();
    });
  }

  refreshSubs() {
    this.webhookService
      .getAllWebhooks()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((subs) => {
        this.dataSource.data = subs;
      });
  }

  editSubscription(subscription: WebhookSubscription) {
    this.dialogService.editSubscription(subscription).subscribe((err) => {
      if (err) {
        console.log('Error editing/creating subscription');
      } else {
        this.refreshSubs();
      }
    });
  }

  applyFilter(filterStr: string) {
    filterStr = filterStr.trim().toLowerCase();
    this.filterStr = filterStr;
    this.dataSource.filter = filterStr;
  }

  clearFilter() {
    this.applyFilter('');
  }
}
