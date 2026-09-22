// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import {
  User,
  UserIdentityAttribute,
  UserService,
} from '../../../generated/player-api';
import { RolesService } from '../../../services/roles/roles.service';
import { CrucibleDialogService } from '@cmusei/crucible-common';

export interface Action {
  Value: string;
  Text: string;
}

interface UserAttributeColumn {
  columnId: string;
  key: string;
  name: string;
}

@Component({
  selector: 'app-admin-user-search',
  templateUrl: './admin-user-search.component.html',
  styleUrls: ['./admin-user-search.component.scss'],
  standalone: false,
})
export class AdminUserSearchComponent implements OnInit, AfterViewInit {
  public displayedColumns: string[] = ['id', 'name', 'role'];
  public attributeColumns: UserAttributeColumn[] = [];
  public filterString = '';

  public userDataSource = new MatTableDataSource<User>(new Array<User>());
  public isLoading: boolean;

  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;

  constructor(
    private userService: UserService,
    private rolesService: RolesService,
    private confirmDialogService: CrucibleDialogService,
  ) {}

  /**
   * Initialization
   */
  ngOnInit() {
    this.userDataSource.sort = this.sort;
    this.userDataSource.sortingDataAccessor = (user, columnId) =>
      this.getColumnValue(user, columnId);
    this.userDataSource.filterPredicate = (user, filter) =>
      [
        user.id,
        user.name,
        user.roleName,
        ...(user.identityAttributes ?? []).map((attribute) => attribute.value),
      ].some((value) => value?.toLowerCase().includes(filter));
    this.isLoading = false;
    this.refreshUsers();
    this.rolesService.getRoles().subscribe();
  }

  /**
   * Called after the components initialized
   */
  ngAfterViewInit() {
    this.userDataSource.paginator = this.paginator;
  }

  /**
   * Called by UI to add a filter to the viewDataSource
   * @param filterValue
   */
  applyFilter(filterValue: string) {
    this.filterString = filterValue.toLowerCase();
    this.userDataSource.filter = this.filterString;
  }

  /**
   * Refreshes the users list and updates the mat table control
   */
  refreshUsers() {
    this.isLoading = true;
    this.userService.getUsers().subscribe((users) => {
      const attributes =
        users.find((user) => user.identityAttributes?.length)
          ?.identityAttributes ?? [];
      this.configureAttributeColumns(attributes);
      this.userDataSource.data = users;
      this.isLoading = false;
    });
  }

  /**
   * Gets a configured identity attribute value for a User.
   */
  getAttributeValue(user: User, attributeKey: string): string {
    return (
      user.identityAttributes?.find(
        (attribute) => attribute.key === attributeKey,
      )?.value ?? ''
    );
  }

  private configureAttributeColumns(attributes: UserIdentityAttribute[]): void {
    this.attributeColumns = attributes
      .filter((attribute) => attribute.key && attribute.name)
      .map((attribute, index) => ({
        columnId: `identityAttribute-${index}`,
        key: attribute.key,
        name: attribute.name,
      }));

    this.displayedColumns = [
      'id',
      'name',
      ...this.attributeColumns.map((column) => column.columnId),
      'role',
    ];
  }

  private getColumnValue(user: User, columnId: string): string {
    const attributeColumn = this.attributeColumns.find(
      (column) => column.columnId === columnId,
    );

    if (attributeColumn) {
      return this.getAttributeValue(user, attributeColumn.key);
    }

    if (columnId === 'id') {
      return user.id ?? '';
    }

    if (columnId === 'name') {
      return user.name ?? '';
    }

    return '';
  }

  /**
   * Deletes a user after confirmation
   * @param user The user to delete
   */
  deleteUser(user: User) {
    this.confirmDialogService
      .confirm({
        title: 'Delete User?',
        message: `Are you sure you want to delete ${user.name || user.id}?`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.userService.deleteUser(user.id).subscribe(() => {
            // Refresh the users list after successful deletion
            this.refreshUsers();
          });
        }
      });
  }
}
