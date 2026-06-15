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
  it('should create', async () => {
    const { fixture } = await renderAdminUserSearch();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show search input', async () => {
    await renderAdminUserSearch();
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
  });

  it('should display users table', async () => {
    await renderAdminUserSearch();
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
  });

  it('should show User Name column header', async () => {
    await renderAdminUserSearch();
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('should show delete button for users', async () => {
    await renderAdminUserSearch();
    const deleteButtons = screen.getAllByTitle('Delete User');
    expect(deleteButtons.length).toBeGreaterThan(0);
  });

  it('ngOnInit loads users and roles and clears the loading flag', async () => {
    const { fixture, stubs } = await renderAdminUserSearch();
    expect(stubs.getUsers).toHaveBeenCalled();
    expect(stubs.getRoles).toHaveBeenCalled();
    expect(fixture.componentInstance.isLoading).toBe(false);
    expect(fixture.componentInstance.userDataSource.data).toEqual(mockUsers);
  });

  it('applyFilter lowercases the value and sets the datasource filter', async () => {
    const { fixture } = await renderAdminUserSearch();
    const c = fixture.componentInstance;
    c.applyFilter('  ALICE  ');
    expect(c.filterString).toBe('  alice  ');
    expect(c.userDataSource.filter).toBe('  alice  ');
  });

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

    it('does nothing when the user cancels', async () => {
      const { fixture, stubs } = await renderAdminUserSearch({
        confirmResult: false,
      });
      fixture.componentInstance.deleteUser(mockUsers[0]);
      expect(stubs.deleteUser).not.toHaveBeenCalled();
    });
  });
});
