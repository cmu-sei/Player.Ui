// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  AfterViewInit,
  Component,
  OnInit,
  TemplateRef,
  ViewChild,
  inject,
} from '@angular/core';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
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
import { ApplicationTemplate } from '../../../generated/player-api';
import { ApplicationService } from '../../../generated/player-api/api/application.service';
import { SelectionModel } from '@angular/cdk/collections';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatFormField, MatInput, MatSuffix } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { MatBadge } from '@angular/material/badge';
import { MatCheckbox } from '@angular/material/checkbox';
import {
  MatExpansionPanel,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
} from '@angular/material/expansion';
import { AdminTemplateDetailsComponent } from './admin-template-details/admin-template-details.component';
import { AdminAppTemplateExportComponent } from '../admin-app-template-export/admin-app-template-export.component';
import { AdminAppTemplateImportComponent } from '../admin-app-template-import/admin-app-template-import.component';

export interface Action {
  Value: string;
  Text: string;
}

@Component({
  selector: 'app-admin-app-template-search',
  templateUrl: './admin-app-template-search.component.html',
  styleUrls: ['./admin-app-template-search.component.scss'],
  imports: [
    MatFormField,
    MatInput,
    FormsModule,
    MatIconButton,
    MatSuffix,
    MatIcon,
    MatTooltip,
    MatBadge,
    MatTable,
    MatSort,
    MatColumnDef,
    MatHeaderCellDef,
    MatHeaderCell,
    MatCheckbox,
    MatCellDef,
    MatCell,
    MatSortHeader,
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    AdminTemplateDetailsComponent,
    MatHeaderRowDef,
    MatHeaderRow,
    MatRowDef,
    MatRow,
    MatPaginator,
    AdminAppTemplateExportComponent,
    AdminAppTemplateImportComponent,
  ],
})
export class AdminAppTemplateSearchComponent implements OnInit, AfterViewInit {
  private applicationService = inject(ApplicationService);
  private dialog = inject(MatDialog);

  public appTemplateDataSource: MatTableDataSource<ApplicationTemplate>;
  public appTemplateColumns: string[] = ['select', 'name', 'url'];
  public filterString: string;
  public currentAppTemplate: ApplicationTemplate;

  // MatPaginator Output
  public defaultPageSize = 10;
  public pageEvent: PageEvent;
  public uploading = false;
  public uploadProgress = 0;

  selection = new SelectionModel<string>(true, []);

  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;

  private dialogRef: MatDialogRef<any>;

  /**
   * Initialization
   */
  ngOnInit() {
    this.pageEvent = new PageEvent();
    this.pageEvent.pageIndex = 0;
    this.pageEvent.pageSize = this.defaultPageSize;

    // Initial datasource
    this.appTemplateDataSource = new MatTableDataSource<ApplicationTemplate>(
      new Array<ApplicationTemplate>(),
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
      icon: 'assets/img/player.png',
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

  /** Whether the number of selected elements matches the total number of rows. */
  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.appTemplateDataSource.filteredData.length;
    return numSelected == numRows;
  }

  /** Selects all rows if they are not all selected; otherwise clear selection. */
  toggleAllRows() {
    this.isAllSelected()
      ? this.selection.clear()
      : this.appTemplateDataSource.filteredData.forEach((row) =>
          this.selection.select(row.id),
        );
  }

  openDialog(templateRef: TemplateRef<any>) {
    this.dialogRef = this.dialog.open(templateRef, {
      autoFocus: true,
      width: '480px',
      maxWidth: '90vw',
    });
  }

  closeDialog() {
    this.dialogRef.close();
  }

  importComplete() {
    this.dialogRef.close();
    this.refresh(false);
  }
}
