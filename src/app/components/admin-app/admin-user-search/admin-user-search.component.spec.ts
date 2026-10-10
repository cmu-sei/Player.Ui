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
      usersError ? throwError(() => usersError) : of(structuredClone(result)),
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

/** User names listed in the table, in render order. */
function listedUsers(container: Element): string[] {
  return Array.from(container.querySelectorAll('td.mat-column-name')).map(
    (cell) => cell.textContent?.trim() ?? '',
  );
}

/** Header texts of the users table, in render order. */
function headers(container: Element): string[] {
  return Array.from(container.querySelectorAll('th[mat-header-cell]')).map(
    (cell) => cell.textContent?.trim() ?? '',
  );
}

/** The identity attribute cells of the named user's row. */
function rowCells(container: Element, name: string): string[] {
  const row = Array.from(container.querySelectorAll('tr[mat-row]')).find(
    (r) => r.querySelector('td.mat-column-name')?.textContent?.trim() === name,
  );
  return Array.from(
    row?.querySelectorAll('td[class*="mat-column-identityAttribute-"]') ?? [],
  ).map((cell) => cell.textContent?.trim() ?? '');
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
   * Verifies: ngOnInit fetches users and loads the role catalog into RolesService, lists the users, and clears the spinner.
   * Interacts with: stubbed UserService.getUsers; the real RolesService.getRoles over the RoleService.getRoles stub.
   * Data: mockUsers; one role, Admin.
   */
  it('ngOnInit loads users and roles and clears the loading flag', async () => {
    const { stubs } = await renderAdminUserSearch();
    expect(stubs.getUsers).toHaveBeenCalled();
    expect(stubs.getRoles).toHaveBeenCalledTimes(1);
    // The roles select in each row reads this stream.
    const roles = await firstValueFrom(TestBed.inject(RolesService).roles$);
    expect(roles.map((r) => r.name)).toEqual(['Admin']);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(mockUsers.every((u) => screen.queryByText(u.name!) !== null)).toBe(
      true,
    );
  });

  /**
   * Verifies: a failed users request leaves the loading spinner up and lets the error escape (current behavior).
   * Interacts with: UserService.getUsers (throws); the rendered spinner; captureUnhandledRxErrors.
   * Data: getUsers fails with a 500.
   */
  it('leaves the spinner up when the users request fails', async () => {
    const errors = captureUnhandledRxErrors();
    const failure = new Error('500');
    await renderAdminUserSearch({ usersError: failure });
    await flush();
    // Current behavior; see agent-docs/ui-test-bugs/player.ui.md.
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(errors).toEqual([failure]);
  });

  /**
   * Verifies: typing in Search lists only the users whose name, role or identity attributes match, case-insensitively,
   *   and Clear Search lists everyone again.
   * Interacts with: the rendered Search input and Clear Search button; the users table.
   * Data: one row per search text: Alice by name, by role name and by Department value; Bob by Location value.
   */
  it.each<[string, string[]]>([
    ['ALICE', ['Alice Smith']],
    ['administrator', ['Alice Smith']],
    ['logistics', ['Alice Smith']],
    ['West', ['Bob Jones']],
  ])('filters the users by "%s"', async (text, expected) => {
    const user = userEvent.setup();
    const { container } = await renderAdminUserSearch();
    const search = screen.getByPlaceholderText('Search');
    search.focus();
    await user.type(search, text, { skipClick: true });
    expect(listedUsers(container)).toEqual(expected);
    await user.click(screen.getByTitle('Clear Search'));
    expect(listedUsers(container)).toEqual(['Alice Smith', 'Bob Jones']);
  });

  describe('identity attribute columns', () => {
    /**
     * Verifies: each identity attribute becomes a column, in response order, between Name and Role, showing each
     *   user's value or nothing when the user lacks it.
     * Interacts with: the rendered table headers and cells.
     * Data: mockUsers (Department, Organization, Location) plus Carol, who has no Location.
     */
    it('shows a column per identity attribute', async () => {
      const carol: UserDirectoryEntry = {
        id: 'user-3',
        name: 'Carol King',
        identityAttributes: [
          { key: 'department', name: 'Department', value: 'Finance' },
          { key: 'organization', name: 'Organization', value: 'Example Three' },
        ],
      };
      const { container } = await renderAdminUserSearch({
        result: [...mockUsers, carol],
      });
      expect(headers(container)).toEqual([
        'ID',
        'Name',
        'Department',
        'Organization',
        'Location',
        'Role',
      ]);
      expect(rowCells(container, 'Alice Smith')).toEqual([
        'Logistics',
        'Example One',
        'East',
      ]);
      expect(rowCells(container, 'Carol King')).toEqual([
        'Finance',
        'Example Three',
        '',
      ]);
    });

    /**
     * Verifies: clicking an attribute column's header sorts the users by that attribute, ascending then descending.
     * Interacts with: the rendered Organization header (MatSort); the users table.
     * Data: Alice (Example One) and Bob (Example Two).
     */
    it('sorts the users by an attribute column', async () => {
      const user = userEvent.setup();
      const { container } = await renderAdminUserSearch();
      await user.click(screen.getByText('Organization'));
      expect(listedUsers(container)).toEqual(['Alice Smith', 'Bob Jones']);
      await user.click(screen.getByText('Organization'));
      expect(listedUsers(container)).toEqual(['Bob Jones', 'Alice Smith']);
    });

    /**
     * Verifies: with no users only the static columns render.
     * Interacts with: stubbed UserService.getUsers; the rendered headers.
     * Data: getUsers returns no users.
     */
    it('keeps only static columns when no users are returned', async () => {
      const { container } = await renderAdminUserSearch({ result: [] });
      expect(headers(container)).toEqual(['ID', 'Name', 'Role']);
      expect(listedUsers(container)).toEqual([]);
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
     * Verifies: clicking Delete User and confirming deletes the user by id and renders the reloaded list.
     * Interacts with: the rendered Delete User button; stubbed CrucibleDialogService.confirm, UserService.deleteUser and getUsers.
     * Data: ManageUsers granted; confirmResult=true; Alice Smith's row (user-1); the reload returns Bob only.
     */
    it('deletes and refreshes when the user confirms', async () => {
      const { container, stubs } = await renderAdminUserSearch({
        confirmResult: true,
        permissions: [SystemPermission.ManageUsers],
      });
      stubs.getUsers.mockClear();
      stubs.getUsers.mockReturnValueOnce(of(structuredClone([mockUsers[1]])));
      await clickDeleteInRow('Alice Smith');
      expect(stubs.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Delete User?',
          message: expect.stringContaining('Alice Smith'),
          confirmText: 'Delete',
        }),
      );
      expect(stubs.deleteUser).toHaveBeenCalledWith('user-1');
      expect(stubs.getUsers).toHaveBeenCalledTimes(1);
      expect(listedUsers(container)).toEqual(['Bob Jones']);
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
