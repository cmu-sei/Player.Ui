// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { User, UserService } from '../../../generated/player-api';
import { RolesService } from '../../../services/roles/roles.service';
import { CrucibleDialogService } from '@cmusei/crucible-common';

export interface Action {
  Value: string;
  Text: string;
}

@Component({
  selector: 'app-admin-user-search',
  templateUrl: './admin-user-search.component.html',
  styleUrls: ['./admin-user-search.component.scss'],
  standalone: false,
})
export class AdminUserSearchComponent implements OnInit, AfterViewInit {
  public displayedColumns: string[] = ['id', 'name', 'role'];
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
      this.userDataSource.data = users;
      this.isLoading = false;
    });
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
