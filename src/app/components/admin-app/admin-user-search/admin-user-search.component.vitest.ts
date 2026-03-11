// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { AdminUserSearchComponent } from './admin-user-search.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { UserService } from '../../../generated/player-api';
import { RolesService } from '../../../services/roles/roles.service';
import { DialogService } from '../../../services/dialog/dialog.service';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';

const mockUsers = [
  { id: 'user-1', name: 'Alice Smith', roleName: 'Admin' },
  { id: 'user-2', name: 'Bob Jones', roleName: 'User' },
];

async function renderAdminUserSearch() {
  return renderComponent(AdminUserSearchComponent, {
    declarations: [AdminUserSearchComponent],
    imports: [MatTableModule, MatSortModule, MatPaginatorModule],
    providers: [
      {
        provide: UserService,
        useValue: { getUsers: () => of(mockUsers) },
      },
      {
        provide: RolesService,
        useValue: { getRoles: () => of([]) },
      },
      {
        provide: DialogService,
        useValue: { confirm: () => of({ confirm: false }) },
      },
    ],
  });
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
    expect(screen.getByText('User Name')).toBeInTheDocument();
  });

  it('should show delete button for users', async () => {
    await renderAdminUserSearch();
    const deleteButtons = screen.getAllByTitle('Delete User');
    expect(deleteButtons.length).toBeGreaterThan(0);
  });
});
