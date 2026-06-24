// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { AdminUserSearchComponent } from './admin-user-search.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { User, UserService } from '../../../generated/player-api';
import { RolesService } from '../../../services/roles/roles.service';
import { DialogService } from '../../../services/dialog/dialog.service';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';

const mockUsers: User[] = [
  { id: 'user-1', name: 'Alice Smith' },
  { id: 'user-2', name: 'Bob Jones' },
];

async function renderAdminUserSearch(
  overrides: { confirmResult?: boolean } = {},
) {
  const { confirmResult = false } = overrides;

  const stubs = {
    getUsers: vi.fn(() => of(mockUsers)),
    deleteUser: vi.fn(() => of(undefined)),
    getRoles: vi.fn(() => of([])),
    confirm: vi.fn(() => of({ confirm: confirmResult })),
  };

  const rendered = await renderComponent(AdminUserSearchComponent, {
    declarations: [AdminUserSearchComponent],
    imports: [MatTableModule, MatSortModule, MatPaginatorModule],
    providers: [
      {
        provide: UserService,
        useValue: { getUsers: stubs.getUsers, deleteUser: stubs.deleteUser },
      },
      {
        provide: RolesService,
        useValue: { getRoles: stubs.getRoles },
      },
      {
        provide: DialogService,
        useValue: { confirm: stubs.confirm },
      },
    ],
  });

  return { ...rendered, stubs };
}

describe('AdminUserSearchComponent', () => {
  /**
   * Verifies: the user-search component instantiates successfully.
   * Interacts with: renderComponent with stubbed UserService, RolesService, DialogService.
   * Data: default mockUsers and a non-confirming dialog.
   */
  it('should create', async () => {
    const { fixture } = await renderAdminUserSearch();
    expect(fixture.componentInstance).toBeTruthy();
  });

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
   * Verifies: the "Name" column header is rendered.
   * Interacts with: the rendered DOM (queried via Testing Library screen).
   * Data: default overrides.
   */
  it('should show User Name column header', async () => {
    await renderAdminUserSearch();
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  /**
   * Verifies: a per-row Delete User control is rendered for users.
   * Interacts with: the rendered DOM (queried by title).
   * Data: mockUsers.
   */
  it('should show delete button for users', async () => {
    await renderAdminUserSearch();
    const deleteButtons = screen.getAllByTitle('Delete User');
    expect(deleteButtons.length).toBeGreaterThan(0);
  });

  /**
   * Verifies: ngOnInit fetches users and roles, fills the datasource, and clears isLoading.
   * Interacts with: stubbed UserService.getUsers and RolesService.getRoles.
   * Data: mockUsers.
   */
  it('ngOnInit loads users and roles and clears the loading flag', async () => {
    const { fixture, stubs } = await renderAdminUserSearch();
    expect(stubs.getUsers).toHaveBeenCalled();
    expect(stubs.getRoles).toHaveBeenCalled();
    expect(fixture.componentInstance.isLoading).toBe(false);
    expect(fixture.componentInstance.userDataSource.data).toEqual(mockUsers);
  });

  /**
   * Verifies: applyFilter lowercases the value (without trimming) and applies it to the datasource filter.
   * Interacts with: component.applyFilter and the MatTableDataSource filter.
   * Data: padded mixed-case input '  ALICE  '.
   * Why: asserts surrounding whitespace is preserved (only case is changed), distinct from the view-search trim behavior.
   */
  it('applyFilter lowercases the value and sets the datasource filter', async () => {
    const { fixture } = await renderAdminUserSearch();
    const c = fixture.componentInstance;
    c.applyFilter('  ALICE  ');
    expect(c.filterString).toBe('  alice  ');
    expect(c.userDataSource.filter).toBe('  alice  ');
  });

  /**
   * Verifies: refreshUsers re-fetches users into the datasource and clears isLoading.
   * Interacts with: stubbed UserService.getUsers (re-stubbed for this call).
   * Data: getUsers returns a fresh single-user list ('New') on the next call.
   */
  it('refreshUsers reloads the user list into the datasource', async () => {
    const { fixture, stubs } = await renderAdminUserSearch();
    const c = fixture.componentInstance;
    stubs.getUsers.mockClear();
    stubs.getUsers.mockReturnValueOnce(of([{ id: 'user-9', name: 'New' }]));
    c.refreshUsers();
    expect(stubs.getUsers).toHaveBeenCalled();
    expect(c.userDataSource.data).toEqual([{ id: 'user-9', name: 'New' }]);
    expect(c.isLoading).toBe(false);
  });

  describe('deleteUser()', () => {
    /**
     * Verifies: a confirmed prompt deletes the user by id and triggers a refresh.
     * Interacts with: stubbed DialogService.confirm, UserService.deleteUser and getUsers.
     * Data: confirmResult=true; deleting mockUsers[0] (Alice Smith).
     */
    it('deletes and refreshes when the user confirms', async () => {
      const { fixture, stubs } = await renderAdminUserSearch({
        confirmResult: true,
      });
      stubs.getUsers.mockClear();
      fixture.componentInstance.deleteUser(mockUsers[0]);
      expect(stubs.confirm).toHaveBeenCalledWith(
        'Delete User?',
        expect.stringContaining('Alice Smith'),
        expect.objectContaining({ buttonTrueText: 'Delete' }),
      );
      expect(stubs.deleteUser).toHaveBeenCalledWith('user-1');
      // refreshUsers() runs after a successful delete
      expect(stubs.getUsers).toHaveBeenCalled();
    });

    /**
     * Verifies: the confirm message uses the user id when the user has no name.
     * Interacts with: stubbed DialogService.confirm (message argument inspected).
     * Data: a nameless user { id: 'user-3' }; confirmResult=true.
     */
    it('falls back to the user id in the prompt when name is missing', async () => {
      const { fixture, stubs } = await renderAdminUserSearch({
        confirmResult: true,
      });
      fixture.componentInstance.deleteUser({ id: 'user-3' } as User);
      expect(stubs.confirm).toHaveBeenCalledWith(
        'Delete User?',
        expect.stringContaining('user-3'),
        expect.anything(),
      );
    });

    /**
     * Verifies: a declined prompt leaves deleteUser untouched.
     * Interacts with: stubbed DialogService.confirm and UserService.deleteUser.
     * Data: confirmResult=false.
     */
    it('does nothing when the user cancels', async () => {
      const { fixture, stubs } = await renderAdminUserSearch({
        confirmResult: false,
      });
      fixture.componentInstance.deleteUser(mockUsers[0]);
      expect(stubs.deleteUser).not.toHaveBeenCalled();
    });
  });
});
