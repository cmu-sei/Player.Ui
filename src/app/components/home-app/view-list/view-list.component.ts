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
import { MatSort, MatSortable } from '@angular/material/sort';
import { MatLegacyTableDataSource as MatTableDataSource } from '@angular/material/legacy-table';
import { ViewData } from '../../../models/view-data';
import { ViewsService } from '../../../services/views/views.service';
import { forkJoin, Observable, Subject } from 'rxjs';
import { filter, flatMap, map, mergeMap, take, tap } from 'rxjs/operators';
import { DialogService } from '../../../services/dialog/dialog.service';
import { SystemPermission, View } from '../../../generated/player-api';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UserPermissionsService } from '../../../services/permissions/user-permissions.service';

@Component({
  selector: 'app-view-list',
  templateUrl: './view-list.component.html',
  styleUrls: ['./view-list.component.scss'],
})
export class ViewListComponent implements OnInit, AfterViewInit, OnDestroy {
  private viewsService = inject(ViewsService);
  private dialogService = inject(DialogService);
  private userPermissionsService = inject(UserPermissionsService);

  @ViewChild(MatSort, { static: true }) sort: MatSort;

  public dataSource = new MatTableDataSource<View>([]);
  public displayedColumns: string[] = ['name', 'description'];

  public filterString: string;
  public isLoading: boolean;
  private unsubscribe$: Subject<null> = new Subject<null>();

  canCreate$ = this.userPermissionsService.hasPermission(
    SystemPermission.CreateViews
  );

  constructor() {
    this.viewsService.views$
      .pipe(
        map((x) => x.filter((y) => y.status == 'Active')),
        tap((x) => (this.dataSource.data = x)),
        takeUntilDestroyed()
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
      .name('Create New View?', '', { nameValue: '' })
      .pipe(take(1))
      .subscribe((result) => {
        if (!result.wasCancelled) {
          this.viewsService
            .createView({
              name: result.nameValue,
              description: 'Add description',
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
