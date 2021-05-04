import { Component, OnInit, ViewChild } from '@angular/core';
import { MatSort, MatSortable } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { WebhookService, WebhookSubscription } from '../../../generated/player-api';
import { DialogService } from '../../../services/dialog/dialog.service';

@Component({
  selector: 'app-admin-subscription-search',
  templateUrl: './app-admin-subscription-search.component.html',
  styleUrls: ['./app-admin-subscription-search.component.scss']
})
export class AppAdminSubscriptionSearchComponent implements OnInit {
  @ViewChild(MatSort, { static: true }) sort: MatSort;

  public dataSource: MatTableDataSource<WebhookSubscription>;
  public displayedColumns: string[] = ['name', 'lastError', 'eventTypes'];
  public filterString: string;
  public editing: boolean = false;
  public filterStr: string;

  constructor(
    private webhookService: WebhookService,
    private dialogService: DialogService,
  ) {}
  ngOnInit(): void {
    // Initialize table
    this.dataSource = new MatTableDataSource<WebhookSubscription>(new Array<WebhookSubscription>());
    this.sort.sort(<MatSortable>{ id: 'name', start: 'asc' });
    this.dataSource.sort = this.sort;
    this.filterString = '';

    this.refreshSubs();
  }

  addNewSubscription() {
    this.dialogService.editSubscription().subscribe(resp => {
      console.log(resp);
      this.refreshSubs();
    })
  }

  refreshSubs() {
    this.webhookService.getAll().subscribe((subs) => {
      this.dataSource.data = subs;
    })
  }

  editSubscription(id: string) {
    this.dialogService.editSubscription(id).subscribe(err => {
      if (err) {
        console.log('Error editing/creating subscription');
      } else {
        this.refreshSubs();
      }
    })
  }

  applyFilter(filterStr: string) {
    filterStr = filterStr.trim().toLowerCase();
    this.dataSource.filter = filterStr;
  }

  clearFilter() {
    this.applyFilter('');
  }
}
