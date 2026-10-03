// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, input } from '@angular/core';
import { By } from '@angular/platform-browser';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { firstValueFrom, of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
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
  SystemPermission,
  UserDirectoryEntry,
  UserService,
  Role,
  RoleService,
} from '../../../generated/player-api';
import { permissionDataProviders } from '../../../test-utils/mock-permission-data.service';
import { RolesService } from '../../../services/roles/roles.service';
import { renderComponent } from '../../../test-utils/render-component';
import { AdminUserSearchComponent } from './admin-user-search.component';
import { ApiStub } from '../../../test-utils/api-stub';
import { dialogRefStub } from '../../../test-utils/dialog-refs';
import {
  captureUnhandledRxErrors,
  flush,
} from '../../../test-utils/unhandled-rx-errors';

const mockUsers: UserDirectoryEntry[] = [
  {
    id: 'user-1',
    name: 'Alice Smith',
    roleName: 'Administrator',
    identityAttributes: [
      { key: 'department', name: 'Department', value: 'Logistics' },
      { key: 'organization', name: 'Organization', value: 'Example One' },
      { key: 'location', name: 'Location', value: 'East' },
    ],
  },
  {
    id: 'user-2',
    name: 'Bob Jones',
    roleName: 'User',
    identityAttributes: [
      { key: 'department', name: 'Department', value: 'Operations' },
      { key: 'organization', name: 'Organization', value: 'Example Two' },
      { key: 'location', name: 'Location', value: 'West' },
    ],
  },
];

@Component({ selector: 'app-roles-permissions-select', template: '' })
class RolesPermissionsSelectStubComponent {
  readonly user = input<UserDirectoryEntry>();
  readonly canEdit = input<boolean>();
}

async function renderAdminUserSearch(
  overrides: {
    confirmResult?: boolean;
    permissions?: SystemPermission[];
    result?: UserDirectoryEntry[];
    usersError?: Error;
  } = {},
) {
  const {
    confirmResult = false,
    permissions = [],
    result = mockUsers,
    usersError,
  } = overrides;

  const stubs = {
    getUsers: vi.fn(() =>
      usersError ? throwError(() => usersError) : of(result),
    ),
    deleteUser: vi.fn(() => of(undefined)),
    // The real RolesService loads the role catalog over this endpoint.
    getRoles: vi.fn(() => of<Role[]>([{ id: 'r1', name: 'Admin' }])),
    confirm: vi.fn(
      () => dialogRefStub<unknown, boolean>(confirmResult).dialogRef,
    ),
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
          getUsers: stubs.getUsers,
          deleteUser: stubs.deleteUser,
        } satisfies ApiStub<UserService>,
      },
      {
        provide: RoleService,
        useValue: { getRoles: stubs.getRoles } satisfies ApiStub<RoleService>,
      },
      ...permissionDataProviders({ system: permissions }),
      {
        provide: CrucibleDialogService,
        useValue: { confirm: stubs.confirm } satisfies Pick<
          CrucibleDialogService,
          'confirm'
        >,
      },
    ],
  });

  return { ...rendered, stubs };
}

describe('AdminUserSearchComponent', () => {
  /**
   * Verifies: the search input is rendered.
   * Interacts with: the rendered DOM (queried by placeholder).
   * Data: default overrides.
   */
  it('should show search input', async () => {
    await renderAdminUserSearch();
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
  });

  /**
   * Verifies: each loaded user renders as a table row.
   * Interacts with: the rendered DOM driven by the getUsers stub.
   * Data: mockUsers (Alice Smith, Bob Jones).
   */
  it('should display users table', async () => {
    await renderAdminUserSearch();
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
  });

  /**
   * Verifies: the "Name" header and a header for each configured identity attribute are rendered.
   * Interacts with: the rendered DOM (queried via Testing Library screen).
   * Data: mockUsers identity attributes (Department, Organization, Location).
   */
  it('should show static and configured column headers', async () => {
    await renderAdminUserSearch();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Department')).toBeInTheDocument();
    expect(screen.getByText('Organization')).toBeInTheDocument();
    expect(screen.getByText('Location')).toBeInTheDocument();
  });

  /**
   * Verifies: a per-row Delete User control is rendered for users.
   * Interacts with: the rendered DOM (queried by title).
   * Data: mockUsers and ManageUsers permission.
   */
  it('should show delete button for users', async () => {
    await renderAdminUserSearch({
      permissions: [SystemPermission.ManageUsers],
    });
    const deleteButtons = screen.getAllByTitle('Delete User');
    expect(deleteButtons.length).toBeGreaterThan(0);
  });

  /**
   * Verifies: users without ManageUsers cannot see per-row delete controls.
   * Interacts with: the real UserPermissionsService over stubbed permission endpoints and rendered DOM.
   * Data: ViewUsers without ManageUsers.
   */
  it('should hide delete buttons without ManageUsers permission', async () => {
    await renderAdminUserSearch({
      permissions: [SystemPermission.ViewUsers],
    });
    expect(screen.queryByTitle('Delete User')).not.toBeInTheDocument();
  });

  /**
   * Verifies: users without ManageUsers receive a read-only role selector.
   * Interacts with: the real UserPermissionsService over stubbed permission endpoints and child input binding.
   * Data: ViewUsers without ManageUsers.
   */
  it('disables role selectors without ManageUsers permission', async () => {
    const { fixture } = await renderAdminUserSearch({
      permissions: [SystemPermission.ViewUsers],
    });
    const selector = fixture.debugElement.query(
      By.directive(RolesPermissionsSelectStubComponent),
    ).componentInstance as RolesPermissionsSelectStubComponent;

    expect(selector.canEdit()).toBe(false);
  });

  /**
   * Verifies: users with ManageUsers retain role-editing access.
   * Interacts with: the real UserPermissionsService over stubbed permission endpoints and child input binding.
   * Data: ViewUsers and ManageUsers.
   */
  it('enables role selectors with ManageUsers permission', async () => {
    const { fixture } = await renderAdminUserSearch({
      permissions: [SystemPermission.ViewUsers, SystemPermission.ManageUsers],
    });
    const selector = fixture.debugElement.query(
      By.directive(RolesPermissionsSelectStubComponent),
    ).componentInstance as RolesPermissionsSelectStubComponent;

    expect(selector.canEdit()).toBe(true);
  });

  /**
   * Verifies: ngOnInit fetches users and loads the role catalog into RolesService, fills the datasource, and clears isLoading.
   * Interacts with: stubbed UserService.getUsers; the real RolesService.getRoles over the RoleService.getRoles stub.
   * Data: mockUsers; one role, Admin.
   */
  it('ngOnInit loads users and roles and clears the loading flag', async () => {
    const { fixture, stubs } = await renderAdminUserSearch();
    expect(stubs.getUsers).toHaveBeenCalled();
    expect(stubs.getRoles).toHaveBeenCalledTimes(1);
    // The roles select in each row reads this stream.
    const roles = await firstValueFrom(TestBed.inject(RolesService).roles$);
    expect(roles.map((r) => r.name)).toEqual(['Admin']);
    expect(fixture.componentInstance.isLoading).toBe(false);
    expect(fixture.componentInstance.userDataSource.data).toEqual(mockUsers);
  });

  /**
   * Verifies: a failed users request leaves the loading spinner up and lets the error escape (current behavior).
   * Interacts with: UserService.getUsers (throws); the rendered spinner; captureUnhandledRxErrors.
   * Data: getUsers fails with a 500.
   */
  it('leaves the spinner up when the users request fails', async () => {
    const errors = captureUnhandledRxErrors();
    const failure = new Error('500');
    const { fixture } = await renderAdminUserSearch({ usersError: failure });
    await flush();
    expect(fixture.componentInstance.isLoading).toBe(true);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(errors).toEqual([failure]);
  });

  /**
   * Verifies: applyFilter lowercases the value (without trimming) and applies it to the datasource filter.
   * Interacts with: component.applyFilter and the MatTableDataSource filter.
   * Data: padded mixed-case input '  ALICE  '.
   */
  it('applyFilter lowercases the value and sets the datasource filter', async () => {
    const { fixture } = await renderAdminUserSearch();
    const component = fixture.componentInstance;
    component.applyFilter('  ALICE  ');
    expect(component.filterString).toBe('  alice  ');
    expect(component.userDataSource.filter).toBe('  alice  ');
  });

  /**
   * Verifies: refreshUsers re-fetches users into the datasource and clears isLoading.
   * Interacts with: stubbed UserService.getUsers (re-stubbed for this call).
   * Data: getUsers returns a fresh single-user list ('New') on the next call.
   */
  it('refreshUsers reloads the user list into the datasource', async () => {
    const { fixture, stubs } = await renderAdminUserSearch();
    const component = fixture.componentInstance;
    const refreshedResult: UserDirectoryEntry[] = [
      { id: 'user-9', name: 'New' },
    ];

    stubs.getUsers.mockClear();
    stubs.getUsers.mockReturnValueOnce(of(refreshedResult));
    component.refreshUsers();

    expect(stubs.getUsers).toHaveBeenCalled();
    expect(component.userDataSource.data).toEqual(refreshedResult);
    expect(component.isLoading).toBe(false);
  });

  describe('identity attribute columns', () => {
    /**
     * Verifies: identity attributes become columns, in response order, between the name and role columns.
     * Interacts with: component.attributeColumns and component.displayedColumns.
     * Data: mockUsers identity attributes (Department, Organization, Location).
     */
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

    /**
     * Verifies: getAttributeValue returns the user's value for a key, or '' when the key is missing.
     * Interacts with: component.getAttributeValue.
     * Data: mockUsers[0] (Alice Smith) with keys 'department', 'location' and 'missing'.
     */
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

    /**
     * Verifies: the datasource filter matches identity attribute values.
     * Interacts with: component.applyFilter and the MatTableDataSource filterPredicate.
     * Data: filter 'logistics', matching Alice Smith's Department.
     */
    it('filters users by identity attribute values', async () => {
      const { fixture } = await renderAdminUserSearch();
      const component = fixture.componentInstance;

      component.applyFilter('logistics');

      expect(component.userDataSource.filteredData).toEqual([mockUsers[0]]);
    });

    /**
     * Verifies: the datasource filter matches the role name.
     * Interacts with: component.applyFilter and the MatTableDataSource filterPredicate.
     * Data: filter 'administrator', matching Alice Smith's roleName.
     */
    it('filters users by role name', async () => {
      const { fixture } = await renderAdminUserSearch();
      const component = fixture.componentInstance;

      component.applyFilter('administrator');

      expect(component.userDataSource.filteredData).toEqual([mockUsers[0]]);
    });

    /**
     * Verifies: the sorting accessor returns the identity attribute value for a dynamic column.
     * Interacts with: the MatTableDataSource sortingDataAccessor.
     * Data: mockUsers[1] (Bob Jones) and the Organization column.
     */
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

    /**
     * Verifies: with no users, no attribute columns are added and only the static columns display.
     * Interacts with: stubbed UserService.getUsers, component.attributeColumns and displayedColumns.
     * Data: getUsers returns an empty list (result=[]).
     */
    it('keeps only static columns when no users are returned', async () => {
      const { fixture } = await renderAdminUserSearch({
        result: [],
      });
      const component = fixture.componentInstance;

      expect(component.attributeColumns).toEqual([]);
      expect(component.displayedColumns).toEqual(['id', 'name', 'role']);
      expect(component.userDataSource.data).toEqual([]);
    });
  });

  describe('deleting a user', () => {
    /** Clicks the Delete User button in the table row that shows `rowText`. */
    async function clickDeleteInRow(rowText: string) {
      const row = screen.getByText(rowText).closest('tr');
      if (!row) {
        throw new Error(`No table row shows '${rowText}'`);
      }
      await userEvent.setup().click(within(row).getByTitle('Delete User'));
    }

    /**
     * Verifies: clicking Delete User and confirming deletes the user by id and refreshes the list.
     * Interacts with: the rendered Delete User button; stubbed CrucibleDialogService.confirm, UserService.deleteUser and getUsers.
     * Data: ManageUsers granted; confirmResult=true; Alice Smith's row (user-1).
     */
    it('deletes and refreshes when the user confirms', async () => {
      const { stubs } = await renderAdminUserSearch({
        confirmResult: true,
        permissions: [SystemPermission.ManageUsers],
      });
      stubs.getUsers.mockClear();
      await clickDeleteInRow('Alice Smith');
      expect(stubs.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Delete User?',
          message: expect.stringContaining('Alice Smith'),
          confirmText: 'Delete',
        }),
      );
      expect(stubs.deleteUser).toHaveBeenCalledWith('user-1');
      expect(stubs.getUsers).toHaveBeenCalled();
    });

    /**
     * Verifies: the confirm message uses the user id when the user has no name.
     * Interacts with: the rendered Delete User button; stubbed CrucibleDialogService.confirm (message argument inspected).
     * Data: ManageUsers granted; getUsers returns a nameless user { id: 'user-3' }; confirmResult=true.
     */
    it('falls back to the user id in the prompt when name is missing', async () => {
      const { stubs } = await renderAdminUserSearch({
        confirmResult: true,
        permissions: [SystemPermission.ManageUsers],
        result: [{ id: 'user-3' }],
      });
      await clickDeleteInRow('user-3');
      expect(stubs.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Delete User?',
          message: expect.stringContaining('user-3'),
        }),
      );
    });

    /**
     * Verifies: a declined prompt leaves deleteUser untouched.
     * Interacts with: the rendered Delete User button; stubbed CrucibleDialogService.confirm and UserService.deleteUser.
     * Data: ManageUsers granted; confirmResult=false.
     */
    it('does nothing when the user cancels', async () => {
      const { stubs } = await renderAdminUserSearch({
        confirmResult: false,
        permissions: [SystemPermission.ManageUsers],
      });
      await clickDeleteInRow('Alice Smith');
      expect(stubs.confirm).toHaveBeenCalled();
      expect(stubs.deleteUser).not.toHaveBeenCalled();
    });
  });
});
