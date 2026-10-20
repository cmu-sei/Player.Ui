// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  AfterViewInit,
  Component,
  inject,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
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
import { ViewData } from '../../../models/view-data';
import { ViewsService } from '../../../services/views/views.service';
import { forkJoin, Observable, Subject } from 'rxjs';
import { filter, flatMap, map, mergeMap, take, tap } from 'rxjs/operators';
import { DialogService } from '../../../services/dialog/dialog.service';
import { SystemPermission, View } from '../../../generated/player-api';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UserPermissionsService } from '../../../services/permissions/user-permissions.service';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { MatFormField, MatInput, MatSuffix } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCard } from '@angular/material/card';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { AsyncPipe, DatePipe } from '@angular/common';

@Component({
  selector: 'app-view-list',
  templateUrl: './view-list.component.html',
  styleUrls: ['./view-list.component.scss'],
  imports: [
    MatIcon,
    MatIconButton,
    MatTooltip,
    MatFormField,
    MatInput,
    FormsModule,
    MatSuffix,
    MatTable,
    MatSort,
    MatColumnDef,
    MatHeaderCellDef,
    MatHeaderCell,
    MatSortHeader,
    MatCellDef,
    MatCell,
    RouterLink,
    MatHeaderRowDef,
    MatHeaderRow,
    MatRowDef,
    MatRow,
    MatCard,
    MatProgressSpinner,
    MatPaginator,
    AsyncPipe,
    DatePipe,
  ],
})
export class ViewListComponent implements OnInit, AfterViewInit, OnDestroy {
  private viewsService = inject(ViewsService);
  private dialogService = inject(DialogService);
  private userPermissionsService = inject(UserPermissionsService);

  @ViewChild(MatSort, { static: true }) sort: MatSort;
  @ViewChild(MatPaginator) paginator: MatPaginator;

  public dataSource = new MatTableDataSource<View>([]);
  public displayedColumns: string[] = ['name', 'description', 'dateCreated'];

  public filterString: string;
  public isLoading: boolean;
  private unsubscribe$: Subject<null> = new Subject<null>();

  canCreate$ = this.userPermissionsService.hasPermission(
    SystemPermission.CreateViews,
  );

  constructor() {
    this.viewsService.views$
      .pipe(
        map((x) => x.filter((y) => y.status == 'Active')),
        tap((x) => (this.dataSource.data = x)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  /**
   * Initalization
   */
  ngOnInit() {
    this.isLoading = true;

    forkJoin([
      this.viewsService.loadMyViews().pipe(tap(() => (this.isLoading = false))),
      this.userPermissionsService.load(),
    ]).subscribe();

    this.filterString = '';
  }

  ngAfterViewInit() {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
  }

  /**
   * Called by UI to add a filter to the viewDataSource
   * @param filterValue
   */
  applyFilter(filterValue: string) {
    this.filterString = filterValue;
    filterValue = filterValue.trim(); // Remove whitespace
    filterValue = filterValue.toLowerCase(); // MatTableDataSource defaults to lowercase matches
    this.dataSource.filter = filterValue;
  }

  /**
   * Clears the search string
   */
  clearFilter() {
    this.applyFilter('');
  }

  create() {
    this.dialogService
      .name('Create New View?', '', {
        nameValue: '',
        showDescription: true,
        descriptionValue: '',
      })
      .pipe(take(1))
      .subscribe((result) => {
        if (result) {
          this.viewsService
            .createView({
              name: result.nameValue,
              description: result.descriptionValue || 'Add description',
            })
            .subscribe();
        }
      });
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
