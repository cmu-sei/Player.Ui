// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnInit,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
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
} from '../../../generated/player-api';
import {
  Role,
  RoleService,
  TeamMembershipForm,
  Permission,
} from '../../../generated/player-api';
import { forkJoin, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';

/** User node with related user and application information */
export class TeamUser {
  constructor(
    public name: string,
    public user: User,
    public teamMembership: TeamMembership
  ) {}
}

@Component({
  selector: 'app-add-remove-users-dialog',
  templateUrl: './add-remove-users-dialog.component.html',
  styleUrls: ['./add-remove-users-dialog.component.scss'],
})
export class AddRemoveUsersDialogComponent implements OnInit {
  public title: string;
  public team: Team;

  public displayedUserColumns: string[] = ['name', 'id'];
  public displayedTeamColumns: string[] = ['name', 'teamMembership', 'user'];
  public userDataSource = new MatTableDataSource<User>(new Array<User>());
  public teamUserDataSource = new MatTableDataSource<TeamUser>(
    new Array<TeamUser>()
  );
  public isLoading: Boolean;
  public isBusy: Boolean;

  public filterString: string;
  public defaultPageSize = 7;
  public pageEvent: PageEvent;

  public roles: Array<Role>;

  @ViewChild('usersInput') usersInput: ElementRef<HTMLInputElement>;
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;

  constructor(
    private dialogRef: MatDialogRef<AddRemoveUsersDialogComponent>,
    public userService: UserService,
    public teamService: TeamService,
    public teamMembershipService: TeamMembershipService,
    public roleService: RoleService
  ) {
    this.dialogRef.disableClose = true;
    this.isLoading = false;
    this.isBusy = false;
    this.filterString = '';
  }

  /**
   * Initializes the components
   */
  ngOnInit() {
    this.sort.sort(<MatSortable>{ id: 'name', start: 'asc' });
    this.userDataSource.sort = this.sort;

    this.pageEvent = new PageEvent();
    this.pageEvent.pageIndex = 0;
    this.pageEvent.pageSize = this.defaultPageSize;

    this.roleService.getRoles().subscribe((roles) => {
      const nullRole = <Role>{
        id: '',
        name: 'None',
        permissions: new Array<Permission>(),
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
                this.team.viewId,
                tu.id
              )
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
              this.userDataSource = new MatTableDataSource(newAllUsers);
              this.userDataSource.sort = this.sort;
              this.userDataSource.paginator = this.paginator;
              this.isLoading = false;
            }
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
          this.userDataSource = new MatTableDataSource(newAllUsers);
          this.userDataSource.sort = this.sort;
          this.userDataSource.paginator = this.paginator;
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
      (u) => u.user.id === user.id
    );
    if (index === -1) {
      this.isBusy = true;
      this.userService
        .addUserToTeam(this.team.id, user.id)
        .subscribe(() => {
          const tUsers = this.teamUserDataSource.data.slice(0);

          this.teamMembershipService
            .getTeamMemberships(this.team.viewId, user.id)
            .subscribe((tmbs) => {
              const teamMembership = tmbs.find(
                (tmb) => tmb.teamId === this.team.id
              );
              const tUser = new TeamUser(user.name, user, teamMembership);
              tUsers.push(tUser);
              tUsers.sort((a, b) => {
                return this.compare(a.user.name, b.user.name, true);
              });
              this.teamUserDataSource.data = tUsers;
              const allUsers = this.userDataSource.data.slice(0);
              const i = allUsers.findIndex((u) => u.id === user.id);
              allUsers.splice(i, 1);
              this.userDataSource = new MatTableDataSource(allUsers);
              this.userDataSource.sort = this.sort;
              this.userDataSource.paginator = this.paginator;
              this.applyFilter('');
              this.isBusy = false;
            });
        });
    }
  }

  /**
   * Removes a user from the current team
   * @param user The user to remove from team
   */
  removeUserFromTeam(tuser: TeamUser): void {
    if (this.isBusy) {
      return;
    }
    const index = this.teamUserDataSource.data.findIndex(
      (u) => u.user.id === tuser.user.id
    );
    if (index >= 0) {
      this.isBusy = true;
      this.userService
        .removeUserFromTeam(this.team.id, tuser.user.id)
        .subscribe(() => {
          const tUsers = this.teamUserDataSource.data.slice(0);
          tUsers.splice(index, 1);
          this.teamUserDataSource = new MatTableDataSource(tUsers);
          const allUsers = this.userDataSource.data.slice(0);
          allUsers.push(tuser.user);
          this.userDataSource = new MatTableDataSource(allUsers);
          this.userDataSource.sort = this.sort;
          this.userDataSource.paginator = this.paginator;
          this.applyFilter('');
          this.isBusy = false;
        });
    }
  }

  updateMembership(teamUser: TeamUser): void {
    console.log(
      'Update Team Membership: ' +
        teamUser.name +
        '   role: ' +
        teamUser.teamMembership.roleId
    );
    const form = <TeamMembershipForm>{
      roleId:
        teamUser.teamMembership.roleId === ''
          ? null
          : teamUser.teamMembership.roleId,
    };

    this.teamMembershipService
      .updateTeamMembership(teamUser.teamMembership.id, form)
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
      users = users.filter(u => u != '');

      for (let user of users) {
        // Add users to team
        this.userService.addUserToTeam(this.team.id, user).pipe(
          switchMap(() => {
            return this.teamMembershipService.getTeamMemberships(this.team.viewId, user)
          })
        ).subscribe(memberships => {
          const relevantMembership = memberships.find(m => m.userId == user);
          
          // Get the user we just added and set the new userSource array
          const lhsUsers = this.userDataSource.data;
          const addedUser = lhsUsers.find(u => u.id == user);
          const lhsNew = lhsUsers.filter(usr => usr != addedUser);

          // Add the user we just uploaded to the teamUser data source array
          let teamUsers = this.teamUserDataSource.data;
          teamUsers.push(new TeamUser(addedUser.name, addedUser, relevantMembership))

          // Update the arrays with the new data
          this.userDataSource = new MatTableDataSource(lhsNew); 
          this.teamUserDataSource = new MatTableDataSource(teamUsers);
        })
      }
    }
  }
}
