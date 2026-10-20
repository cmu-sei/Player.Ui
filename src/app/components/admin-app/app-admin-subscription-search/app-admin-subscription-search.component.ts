/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { MatSort, MatSortable, MatSortHeader } from '@angular/material/sort';
import {
  MatTableDataSource,
  MatTable,
  MatColumnDef,
  MatHeaderCellDef,
  MatHeaderCell,
  MatCellDef,
  MatCell,
  MatHeaderRowDef,
  MatHeaderRow,
  MatRowDef,
  MatRow,
} from '@angular/material/table';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  WebhookService,
  WebhookSubscription,
} from '../../../generated/player-api';
import { DialogService } from '../../../services/dialog/dialog.service';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { MatFormField, MatInput, MatSuffix } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';

@Component({
  selector: 'app-admin-subscription-search',
  templateUrl: './app-admin-subscription-search.component.html',
  styleUrls: ['./app-admin-subscription-search.component.scss'],
  imports: [
    MatFormField,
    MatInput,
    FormsModule,
    MatIconButton,
    MatSuffix,
    MatIcon,
    MatTooltip,
    MatTable,
    MatSort,
    MatColumnDef,
    MatHeaderCellDef,
    MatHeaderCell,
    MatCellDef,
    MatCell,
    MatSortHeader,
    MatHeaderRowDef,
    MatHeaderRow,
    MatRowDef,
    MatRow,
  ],
})
export class AppAdminSubscriptionSearchComponent implements OnInit, OnDestroy {
  private webhookService = inject(WebhookService);
  private dialogService = inject(DialogService);
  private confirmDialogService = inject(CrucibleDialogService);

  @ViewChild(MatSort, { static: true }) sort: MatSort;

  public dataSource: MatTableDataSource<WebhookSubscription>;
  public displayedColumns: string[] = [
    'actions',
    'name',
    'eventTypes',
    'lastError',
  ];
  public editing = false;
  public filterStr = '';
  public unsubscribe$: Subject<null> = new Subject<null>();
  ngOnInit(): void {
    // Initialize table
    this.dataSource = new MatTableDataSource<WebhookSubscription>(
      new Array<WebhookSubscription>(),
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

  deleteSubscription(subscription: WebhookSubscription) {
    this.confirmDialogService
      .confirm({
        title: 'Confirm Delete',
        message: 'Are you sure you want to delete ' + subscription.name + '?',
        confirmText: 'Delete',
        cancelText: 'Cancel',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.webhookService
            .deleteWebhookSubscription(subscription.id)
            .pipe(takeUntil(this.unsubscribe$))
            .subscribe(() => this.refreshSubs());
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
