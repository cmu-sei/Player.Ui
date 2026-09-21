// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { CrucibleDialogService } from '@cmusei/crucible-common';
import { of } from 'rxjs';
import { User, UserService } from '../../../generated/player-api';
import { RolesService } from '../../../services/roles/roles.service';
import { AdminUserSearchComponent } from './admin-user-search.component';

describe('AdminUserSearchComponent', () => {
  const users: User[] = [
    {
      id: 'user-1',
      name: 'Alice Smith',
      identityAttributes: [
        { name: 'Email', value: 'alice@example.test', displayOrder: 0 },
        { name: 'Air Force Rank', value: 'Major', displayOrder: 1 },
        { name: 'Unit', value: '42nd Wing', displayOrder: 2 },
      ],
    },
    {
      id: 'user-2',
      name: 'Bob Jones',
      identityAttributes: [
        { name: 'Email', value: 'bob@example.test', displayOrder: 0 },
        {
          name: 'Air Force Rank',
          value: 'Staff Sergeant',
          displayOrder: 1,
        },
        { name: 'Unit', value: '17th Squadron', displayOrder: 2 },
      ],
    },
  ];

  let component: AdminUserSearchComponent;
  let userService: {
    getUsers: jasmine.Spy;
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
      'getUsers',
      'deleteUser',
    ]);
    rolesService = jasmine.createSpyObj('RolesService', ['getRoles']);
    dialogService = jasmine.createSpyObj(
      'CrucibleDialogService',
      ['confirm'],
    );

    userService.getUsers.and.returnValue(of(users));
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
      'Email',
      'Air Force Rank',
      'Unit',
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
    expect(component.getAttributeValue(users[0], 'Email')).toBe(
      'alice@example.test',
    );
    expect(component.getAttributeValue(users[0], 'Unit')).toBe('42nd Wing');
    expect(component.getAttributeValue(users[0], 'Missing')).toBe('');
  });

  it('filters users by identity attribute values', () => {
    component.applyFilter('major');

    expect(component.userDataSource.filteredData).toEqual([users[0]]);
  });

  it('sorts dynamic columns by their identity attribute values', () => {
    const rankColumn = component.attributeColumns.find(
      (column) => column.name === 'Air Force Rank',
    );

    expect(rankColumn).toBeDefined();
    if (!rankColumn) {
      return;
    }

    expect(
      component.userDataSource.sortingDataAccessor(users[1], rankColumn.id),
    ).toBe('Staff Sergeant');
  });
});
