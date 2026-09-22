// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, input } from '@angular/core';
import { screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { ClipboardModule } from 'ngx-clipboard';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import {
  AdminUser,
  AdminUsers,
  UserService,
} from '../../../generated/player-api';
import { RolesService } from '../../../services/roles/roles.service';
import { renderComponent } from '../../../test-utils/render-component';
import { AdminUserSearchComponent } from './admin-user-search.component';

const mockResult: AdminUsers = {
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

const mockUsers = mockResult.users as AdminUser[];

@Component({ selector: 'app-roles-permissions-select', template: '' })
class RolesPermissionsSelectStubComponent {
  readonly user = input<AdminUser>();
}

async function renderAdminUserSearch(
  overrides: { confirmResult?: boolean; result?: AdminUsers } = {},
) {
  const { confirmResult = false, result = mockResult } = overrides;

  const stubs = {
    getAdminUsers: vi.fn(() => of(result)),
    deleteUser: vi.fn(() => of(undefined)),
    getRoles: vi.fn(() => of([])),
    confirm: vi.fn(() => ({
      afterClosed: () => of(confirmResult),
    })),
  };

  const rendered = await renderComponent(AdminUserSearchComponent, {
    declarations: [AdminUserSearchComponent],
    imports: [
      MatCardModule,
      MatFormFieldModule,
      MatIconModule,
      MatProgressSpinnerModule,
      MatInputModule,
      MatButtonModule,
      MatTableModule,
      MatSortModule,
      MatPaginatorModule,
      ClipboardModule,
      RolesPermissionsSelectStubComponent,
    ],
    providers: [
      {
        provide: UserService,
        useValue: {
          getAdminUsers: stubs.getAdminUsers,
          deleteUser: stubs.deleteUser,
        },
      },
      {
        provide: RolesService,
        useValue: { getRoles: stubs.getRoles },
      },
      {
        provide: CrucibleDialogService,
        useValue: { confirm: stubs.confirm },
      },
    ],
  });

  return { ...rendered, stubs };
}

describe('AdminUserSearchComponent', () => {
  it('should show search input', async () => {
    await renderAdminUserSearch();
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
  });

  it('should display users table', async () => {
    await renderAdminUserSearch();
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
  });

  it('should show static and configured column headers', async () => {
    await renderAdminUserSearch();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Department')).toBeInTheDocument();
    expect(screen.getByText('Organization')).toBeInTheDocument();
    expect(screen.getByText('Location')).toBeInTheDocument();
  });

  it('should show delete button for users', async () => {
    await renderAdminUserSearch();
    const deleteButtons = screen.getAllByTitle('Delete User');
    expect(deleteButtons.length).toBeGreaterThan(0);
  });

  it('ngOnInit loads users and roles and clears the loading flag', async () => {
    const { fixture, stubs } = await renderAdminUserSearch();
    expect(stubs.getAdminUsers).toHaveBeenCalled();
    expect(stubs.getRoles).toHaveBeenCalled();
    expect(fixture.componentInstance.isLoading).toBe(false);
    expect(fixture.componentInstance.userDataSource.data).toEqual(mockUsers);
  });

  it('applyFilter lowercases the value and sets the datasource filter', async () => {
    const { fixture } = await renderAdminUserSearch();
    const component = fixture.componentInstance;
    component.applyFilter('  ALICE  ');
    expect(component.filterString).toBe('  alice  ');
    expect(component.userDataSource.filter).toBe('  alice  ');
  });

  it('refreshUsers reloads the user list into the datasource', async () => {
    const { fixture, stubs } = await renderAdminUserSearch();
    const component = fixture.componentInstance;
    const refreshedResult: AdminUsers = {
      attributeDefinitions: mockResult.attributeDefinitions,
      users: [{ id: 'user-9', name: 'New' }],
    };

    stubs.getAdminUsers.mockClear();
    stubs.getAdminUsers.mockReturnValueOnce(of(refreshedResult));
    component.refreshUsers();

    expect(stubs.getAdminUsers).toHaveBeenCalled();
    expect(component.userDataSource.data).toEqual(refreshedResult.users);
    expect(component.isLoading).toBe(false);
  });

  describe('identity attribute columns', () => {
    it('creates ordered columns from configured identity attributes', async () => {
      const { fixture } = await renderAdminUserSearch();
      const component = fixture.componentInstance;

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

    it('returns the configured value for each user', async () => {
      const { fixture } = await renderAdminUserSearch();
      const component = fixture.componentInstance;

      expect(component.getAttributeValue(mockUsers[0], 'department')).toBe(
        'Logistics',
      );
      expect(component.getAttributeValue(mockUsers[0], 'location')).toBe(
        'East',
      );
      expect(component.getAttributeValue(mockUsers[0], 'missing')).toBe('');
    });

    it('filters users by identity attribute values', async () => {
      const { fixture } = await renderAdminUserSearch();
      const component = fixture.componentInstance;

      component.applyFilter('logistics');

      expect(component.userDataSource.filteredData).toEqual([mockUsers[0]]);
    });

    it('filters users by role name', async () => {
      const { fixture } = await renderAdminUserSearch();
      const component = fixture.componentInstance;

      component.applyFilter('administrator');

      expect(component.userDataSource.filteredData).toEqual([mockUsers[0]]);
    });

    it('sorts dynamic columns by their identity attribute values', async () => {
      const { fixture } = await renderAdminUserSearch();
      const component = fixture.componentInstance;
      const organizationColumn = component.attributeColumns.find(
        (column) => column.key === 'organization',
      );

      expect(organizationColumn).toBeDefined();
      expect(
        component.userDataSource.sortingDataAccessor(
          mockUsers[1],
          organizationColumn!.columnId,
        ),
      ).toBe('Example Two');
    });

    it('creates configured columns when no users have values yet', async () => {
      const { fixture } = await renderAdminUserSearch({
        result: {
          attributeDefinitions: mockResult.attributeDefinitions,
          users: [],
        },
      });
      const component = fixture.componentInstance;

      expect(component.attributeColumns.map((column) => column.name)).toEqual([
        'Department',
        'Organization',
        'Location',
      ]);
      expect(component.userDataSource.data).toEqual([]);
    });
  });

  describe('deleteUser()', () => {
    it('deletes and refreshes when the user confirms', async () => {
      const { fixture, stubs } = await renderAdminUserSearch({
        confirmResult: true,
      });
      stubs.getAdminUsers.mockClear();
      fixture.componentInstance.deleteUser(mockUsers[0]);
      expect(stubs.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Delete User?',
          message: expect.stringContaining('Alice Smith'),
          confirmText: 'Delete',
        }),
      );
      expect(stubs.deleteUser).toHaveBeenCalledWith('user-1');
      expect(stubs.getAdminUsers).toHaveBeenCalled();
    });

    it('falls back to the user id in the prompt when name is missing', async () => {
      const { fixture, stubs } = await renderAdminUserSearch({
        confirmResult: true,
      });
      fixture.componentInstance.deleteUser({ id: 'user-3' });
      expect(stubs.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Delete User?',
          message: expect.stringContaining('user-3'),
        }),
      );
    });

    it('does nothing when the user cancels', async () => {
      const { fixture, stubs } = await renderAdminUserSearch({
        confirmResult: false,
      });
      fixture.componentInstance.deleteUser(mockUsers[0]);
      expect(stubs.deleteUser).not.toHaveBeenCalled();
    });
  });
});
