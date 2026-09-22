// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { CrucibleDialogService } from '@cmusei/crucible-common';
import { of } from 'rxjs';
import {
  AdminUser,
  AdminUsers,
  UserService,
} from '../../../generated/player-api';
import { RolesService } from '../../../services/roles/roles.service';
import { AdminUserSearchComponent } from './admin-user-search.component';

describe('AdminUserSearchComponent', () => {
  const result: AdminUsers = {
    attributeDefinitions: [
      { key: 'department', name: 'Department' },
      { key: 'organization', name: 'Organization' },
      { key: 'location', name: 'Location' },
    ],
    users: [
      {
        id: 'user-1',
        name: 'Alice Smith',
        roleName: 'Administrator',
        identityAttributes: [
          { key: 'department', value: 'Logistics' },
          { key: 'organization', value: 'Example One' },
          { key: 'location', value: 'East' },
        ],
      },
      {
        id: 'user-2',
        name: 'Bob Jones',
        roleName: 'User',
        identityAttributes: [
          { key: 'department', value: 'Operations' },
          { key: 'organization', value: 'Example Two' },
          { key: 'location', value: 'West' },
        ],
      },
    ],
  };
  const users = result.users as AdminUser[];

  let component: AdminUserSearchComponent;
  let userService: {
    getAdminUsers: jasmine.Spy;
    deleteUser: jasmine.Spy;
  };
  let rolesService: {
    getRoles: jasmine.Spy;
  };
  let dialogService: {
    confirm: jasmine.Spy;
  };

  beforeEach(() => {
    userService = jasmine.createSpyObj('UserService', [
      'getAdminUsers',
      'deleteUser',
    ]);
    rolesService = jasmine.createSpyObj('RolesService', ['getRoles']);
    dialogService = jasmine.createSpyObj('CrucibleDialogService', ['confirm']);

    userService.getAdminUsers.and.returnValue(of(result));
    rolesService.getRoles.and.returnValue(of([]));

    component = new AdminUserSearchComponent(
      userService as unknown as UserService,
      rolesService as unknown as RolesService,
      dialogService as unknown as CrucibleDialogService,
    );
    component.ngOnInit();
  });

  it('creates ordered columns from configured identity attributes', () => {
    expect(component.attributeColumns.map((column) => column.name)).toEqual([
      'Department',
      'Organization',
      'Location',
    ]);
    expect(component.displayedColumns).toEqual([
      'id',
      'name',
      'identityAttribute-0',
      'identityAttribute-1',
      'identityAttribute-2',
      'role',
    ]);
  });

  it('returns the configured value for each user', () => {
    expect(component.getAttributeValue(users[0], 'department')).toBe(
      'Logistics',
    );
    expect(component.getAttributeValue(users[0], 'location')).toBe('East');
    expect(component.getAttributeValue(users[0], 'missing')).toBe('');
  });

  it('filters users by identity attribute values', () => {
    component.applyFilter('logistics');

    expect(component.userDataSource.filteredData).toEqual([users[0]]);
  });

  it('filters users by role name', () => {
    component.applyFilter('administrator');

    expect(component.userDataSource.filteredData).toEqual([users[0]]);
  });

  it('sorts dynamic columns by their identity attribute values', () => {
    const organizationColumn = component.attributeColumns.find(
      (column) => column.key === 'organization',
    );

    expect(organizationColumn).toBeDefined();
    if (!organizationColumn) {
      return;
    }

    expect(
      component.userDataSource.sortingDataAccessor(
        users[1],
        organizationColumn.columnId,
      ),
    ).toBe('Example Two');
  });

  it('creates configured columns when no users have values yet', () => {
    userService.getAdminUsers.and.returnValue(
      of({
        attributeDefinitions: result.attributeDefinitions,
        users: [],
      }),
    );

    component.refreshUsers();

    expect(component.attributeColumns.map((column) => column.name)).toEqual([
      'Department',
      'Organization',
      'Location',
    ]);
    expect(component.userDataSource.data).toEqual([]);
  });
});
