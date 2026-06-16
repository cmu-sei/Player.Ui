// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { PageEvent, MatPaginator } from '@angular/material/paginator';
import { MatSort, MatSortable } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import {
  User,
  UserService,
  Team,
  TeamService,
  TeamMembershipService,
  TeamMembership,
  TeamRole,
  TeamPermissionModel,
} from '../../../generated/player-api';
import { Role } from '../../../generated/player-api';
import { forkJoin, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { TeamRolesService } from '../../../services/roles/team-roles.service';
import { LoggedInUserService } from '../../../services/logged-in-user/logged-in-user.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

/** User node with related user and application information */
export class TeamUser {
  constructor(
    public name: string,
    public user: User,
    public teamMembership: TeamMembership,
  ) { }
}

@Component({
  selector: 'app-add-remove-users-dialog',
  templateUrl: './add-remove-users-dialog.component.html',
  styleUrls: ['./add-remove-users-dialog.component.scss'],
  standalone: false,
})
export class AddRemoveUsersDialogComponent implements OnInit {
  public title: string;
  public team: Team;

  // When false, the dialog runs in a restricted mode for users who only have
  // ManageTeam (not ManageView): the per-user Role column is hidden and team
  // memberships are not fetched, since those endpoints require ManageView.
  public canManageRoles = true;

  public displayedUserColumns: string[] = ['name', 'id'];
  public get displayedTeamColumns(): string[] {
    return this.canManageRoles
      ? ['name', 'teamMembership', 'user']
      : ['name', 'user'];
  }
  public userDataSource = new MatTableDataSource<User>(new Array<User>());
  public teamUserDataSource = new MatTableDataSource<TeamUser>(
    new Array<TeamUser>(),
  );
  public isLoading: boolean;
  public isBusy: boolean;

  public filterString: string;
  public teamFilterString: string;
  public defaultPageSize = 5;
  public pageEvent: PageEvent;

  public roles: Array<Role>;

  // Id of the logged-in user, used to flag their own row and to confirm
  // before they remove themselves from the team.
  public currentUserId: string;

  @ViewChild('searchBox') searchBox: ElementRef<HTMLInputElement>;
  @ViewChild('paginator', { static: true }) paginator: MatPaginator;
  @ViewChild('teamPaginator', { static: true }) teamPaginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;

  constructor(
    private dialogRef: MatDialogRef<AddRemoveUsersDialogComponent>,
    public userService: UserService,
    public teamService: TeamService,
    public teamMembershipService: TeamMembershipService,
    public roleService: TeamRolesService,
    private dialog: MatDialog,
    private loggedInUserService: LoggedInUserService,
  ) {
    this.dialogRef.disableClose = true;
    this.isLoading = false;
    this.isBusy = false;
    this.filterString = '';
    this.teamFilterString = '';
  }

  /**
   * Initializes the components
   */
  ngOnInit() {
    this.currentUserId = this.loggedInUserService.loggedInUser$.value?.profile
      ?.sub as string;

    this.sort.sort(<MatSortable>{ id: 'name', start: 'asc' });
    this.userDataSource.sort = this.sort;
    this.userDataSource.paginator = this.paginator;

    // The team users list is a separate data source with its own paginator
    // and search. Match by user name/id since TeamUser nests the user object.
    this.teamUserDataSource.paginator = this.teamPaginator;
    this.teamUserDataSource.filterPredicate = (
      data: TeamUser,
      filter: string,
    ) =>
      (data.user.name ?? '').toLowerCase().includes(filter) ||
      (data.user.id ?? '').toLowerCase().includes(filter);

    this.pageEvent = new PageEvent();
    this.pageEvent.pageIndex = 0;
    this.pageEvent.pageSize = this.defaultPageSize;

    this.roleService.getRoles().subscribe((roles) => {
      const nullRole = <TeamRole>{
        id: '',
        name: 'None',
        permissions: new Array<TeamPermissionModel>(),
      };

      roles.unshift(nullRole);
      this.roles = roles;
    });
  }

  /**
   * Called by UI to add a filter to the viewDataSource
   * @param filterValue
   */
  applyFilter(filterValue: string) {
    this.filterString = filterValue;
    this.pageEvent.pageIndex = 0;
    filterValue = filterValue.toLowerCase(); // MatTableDataSource defaults to lowercase matches
    this.userDataSource.filter = filterValue;
  }

  /**
   * Clears the search string
   */
  clearFilter() {
    this.applyFilter('');
  }

  /**
   * Filters the team users list
   * @param filterValue
   */
  applyTeamFilter(filterValue: string) {
    this.teamFilterString = filterValue;
    this.teamUserDataSource.filter = filterValue.trim().toLowerCase();
    if (this.teamUserDataSource.paginator) {
      this.teamUserDataSource.paginator.firstPage();
    }
  }

  /**
   * Clears the team users search string
   */
  clearTeamFilter() {
    this.applyTeamFilter('');
  }

  /**
   * Called to load the team before the dialog is opened
   * @param team The team to load in this dialog
   */
  loadTeam(team: Team) {
    this.team = team;

    this.isLoading = true;
    this.userService.getUsers().subscribe((allUsers) => {
      this.userService.getTeamUsers(team.id).subscribe((teamUsers) => {
        const tUsers = teamUsers.slice(0);
        tUsers.sort((a, b) => {
          return this.compare(a.name, b.name, true);
        });

        // Restricted mode (ManageTeam only): role management requires reading and
        // editing team memberships, which need ManageView. Build the team-user
        // list directly from getTeamUsers with no membership and skip those calls.
        if (!this.canManageRoles) {
          this.teamUserDataSource.data = tUsers.map(
            (us) => new TeamUser(us.name, us, null),
          );
          const newAllUsers = allUsers.filter(
            (u) => !tUsers.some((tu) => tu.id === u.id),
          );
          this.userDataSource.data = newAllUsers;
          this.isLoading = false;
          return;
        }

        if (tUsers.length > 0) {
          const newTeamUsers = new Array<TeamUser>();
          // The following gets kind of crazy.  Because observables are non-blocking, an array
          // of all the observables is created.
          const membershipObservable = new Array<
            Observable<Array<TeamMembership>>
          >();
          tUsers.forEach((tu) => {
            membershipObservable.push(
              this.teamMembershipService.getTeamMemberships(
                tu.id,
                this.team.viewId,
              ),
            );
          });
          // The rxjs forJoin allows for multiple observables to be called in parallel and then processing
          // will resume after all of the observables in the array are returned.
          forkJoin(membershipObservable).subscribe(
            (tmbss: Array<Array<TeamMembership>>) => {
              // A 2 dimensional array is returned in this case because the inner observable already returns an array
              tmbss.forEach((tmbs) => {
                const tu = tmbs.find((tmb) => tmb.teamId === this.team.id); // Match by team
                const us = allUsers.find((u) => u.id === tu.userId); // Get user object from getUsers() array
                if (tu.roleId === null) {
                  tu.roleId = '';
                  tu.roleName = '';
                }
                const newTeamUser = new TeamUser(us.name, us, tu); // Create the hybrid object
                newTeamUsers.push(newTeamUser);
              });
              // Now that all of the observables are returned, process accordingly.
              this.teamUserDataSource.data = newTeamUsers;
              const newAllUsers = allUsers.slice(0);
              this.teamUserDataSource.data.forEach((tu) => {
                const index = newAllUsers.findIndex((u) => u.id === tu.user.id);
                newAllUsers.splice(index, 1);
              });
              this.userDataSource.data = newAllUsers;
              this.isLoading = false;
            },
          ); // forkJoin
        } else {
          // In this case, No users have been added to the team.  Therefore proceed accordingly.
          const newTeamUsers = new Array<TeamUser>();
          this.teamUserDataSource.data = newTeamUsers;
          const newAllUsers = allUsers.slice(0);
          this.teamUserDataSource.data.forEach((tu) => {
            const index = newAllUsers.findIndex((u) => u.id === tu.user.id);
            newAllUsers.splice(index, 1);
          });
          this.userDataSource.data = newAllUsers;
          this.isLoading = false;
        }
      }); // getTeamUsers
    }); // getUsers
  }

  /**
   * Called to close the dialog
   */
  done() {
    this.dialogRef.close({
      teamUsers: this.teamUserDataSource.data,
    });
  }

  /**
   * Call to api to add a user to team and update local array
   * @param user The user to be added
   */
  addUserToTeam(user: User): void {
    if (this.isBusy) {
      return;
    }
    const index = this.teamUserDataSource.data.findIndex(
      (u) => u.user.id === user.id,
    );
    if (index === -1) {
      this.isBusy = true;
      this.userService.addUserToTeam(this.team.id, user.id).subscribe({
        next: () => {
          // In restricted mode we cannot read team memberships, so add the user
          // with a null membership rather than fetching one.
          if (!this.canManageRoles) {
            this.addTeamUserToTable(new TeamUser(user.name, user, null));
            return;
          }

          this.teamMembershipService
            .getTeamMemberships(user.id, this.team.viewId)
            .subscribe({
              next: (tmbs) => {
                const teamMembership = tmbs.find(
                  (tmb) => tmb.teamId === this.team.id,
                );
                this.addTeamUserToTable(
                  new TeamUser(user.name, user, teamMembership),
                );
              },
              error: (err) => {
                console.error('Error fetching team membership: ', err);
                this.isBusy = false;
              },
            });
        },
        error: (err) => {
          console.error('Error adding user to team: ', err);
          this.isBusy = false;
        },
      });
    }
  }

  /**
   * Adds a TeamUser to the team-users table and removes them from the all-users table.
   * @param tUser The newly added team user
   */
  private addTeamUserToTable(tUser: TeamUser): void {
    const tUsers = this.teamUserDataSource.data.slice(0);
    tUsers.push(tUser);
    tUsers.sort((a, b) => {
      return this.compare(a.user.name, b.user.name, true);
    });
    this.teamUserDataSource.data = tUsers;
    const allUsers = this.userDataSource.data.slice(0);
    const i = allUsers.findIndex((u) => u.id === tUser.user.id);
    if (i >= 0) {
      allUsers.splice(i, 1);
    }
    this.userDataSource.data = allUsers;
    this.searchBox.nativeElement.focus();
    this.isBusy = false;
  }

  /**
   * Removes a user from the current team. When the user is removing their own
   * account, a confirmation dialog is shown first since this may revoke their
   * own access to the team.
   * @param tuser The team user to remove from team
   */
  removeUserFromTeam(tuser: TeamUser): void {
    if (this.isBusy) {
      return;
    }
    const index = this.teamUserDataSource.data.findIndex(
      (u) => u.user.id === tuser.user.id,
    );
    if (index < 0) {
      return;
    }

    if (tuser.user.id === this.currentUserId) {
      const dialogRef = this.dialog.open(ConfirmDialogComponent, { data: {} });
      dialogRef.componentInstance.title = 'Remove yourself from team?';
      dialogRef.componentInstance.message =
        'You are about to remove your own account from this team. ' +
        'You may lose access to this team. Are you sure?';
      dialogRef.afterClosed().subscribe((result) => {
        if (result && result.confirm) {
          this.performRemoveUserFromTeam(tuser);
        }
      });
    } else {
      this.performRemoveUserFromTeam(tuser);
    }
  }

  /**
   * Performs the actual removal of a user from the team and updates the local
   * data sources. The team-user index is recomputed here because the list may
   * have changed while a confirmation dialog was open.
   * @param tuser The team user to remove from team
   */
  private performRemoveUserFromTeam(tuser: TeamUser): void {
    if (this.isBusy) {
      return;
    }
    const index = this.teamUserDataSource.data.findIndex(
      (u) => u.user.id === tuser.user.id,
    );
    if (index < 0) {
      return;
    }
    this.isBusy = true;
    this.userService.removeUserFromTeam(this.team.id, tuser.user.id).subscribe({
      next: () => {
        const tUsers = this.teamUserDataSource.data.slice(0);
        tUsers.splice(index, 1);
        this.teamUserDataSource.data = tUsers;
        const allUsers = this.userDataSource.data.slice(0);
        allUsers.push(tuser.user);
        this.userDataSource.data = allUsers;
        this.searchBox.nativeElement.focus();
        this.isBusy = false;
      },
      error: (err) => {
        console.error('Error removing user from team: ', err);
        this.isBusy = false;
      },
    });
  }

  updateMembership(teamUser: TeamUser): void {
    if (!this.canManageRoles || !teamUser.teamMembership) {
      return;
    }
    console.log(
      'Update Team Membership: ' +
      teamUser.name +
      '   role: ' +
      teamUser.teamMembership.roleId,
    );

    this.teamMembershipService
      .updateTeamMembership(teamUser.teamMembership.id, {
        roleId:
          teamUser.teamMembership.roleId === ''
            ? null
            : teamUser.teamMembership.roleId,
      })
      .subscribe(() => {
        console.log('Update complete');
      });
  }

  compare(a: string, b: string, isAsc: boolean) {
    if (a === null || b === null) {
      return 0;
    } else {
      return (a.toLowerCase() < b.toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1);
    }
  }

  /**
   * Add users in bulk to this team by uploading a csv
   */
  uploadUsers(files: FileList): void {
    const fp = files[0];
    if (!fp.name.endsWith('.csv')) {
      window.alert('Please upload a csv file');
      return;
    }

    const reader = new FileReader();
    reader.readAsText(fp);
    reader.onload = () => {
      const text = reader.result as string;
      // Assumes user IDs in file are in a column; should split on commas if in rows
      let users = text.includes('\r') ? text.split('\r\n') : text.split('\n');
      users = users.filter((u) => u != '');

      for (const user of users) {
        // Add users to team
        this.userService
          .addUserToTeam(this.team.id, user)
          .pipe(
            switchMap(() => {
              return this.teamMembershipService.getTeamMemberships(
                this.team.viewId,
                user,
              );
            }),
          )
          .subscribe((memberships) => {
            const relevantMembership = memberships.find(
              (m) => m.userId == user,
            );

            // Get the user we just added and set the new userSource array
            const lhsUsers = this.userDataSource.data;
            const addedUser = lhsUsers.find((u) => u.id == user);
            const lhsNew = lhsUsers.filter((usr) => usr != addedUser);

            // Add the user we just uploaded to the teamUser data source array
            const teamUsers = this.teamUserDataSource.data;
            teamUsers.push(
              new TeamUser(addedUser.name, addedUser, relevantMembership),
            );

            // Update the arrays with the new data
            this.userDataSource.data = lhsNew;
            this.teamUserDataSource.data = teamUsers;
          });
      }
    };
  }
}
