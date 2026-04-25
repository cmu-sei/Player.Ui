// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { of, Subject } from 'rxjs';
import { AdminViewSearchComponent } from './admin-view-search.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { View, ViewService, ViewStatus } from '../../../generated/player-api';
import { DialogService } from '../../../services/dialog/dialog.service';
import { LoggedInUserService } from '../../../services/logged-in-user/logged-in-user.service';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';

const mockViews: View[] = [
  {
    id: 'view-1',
    name: 'Training View',
    description: 'A training exercise',
    status: ViewStatus.Active,
  },
  {
    id: 'view-2',
    name: 'Test View',
    description: 'A test exercise',
    status: ViewStatus.Inactive,
  },
];

async function renderAdminViewSearch() {
  // Use a Subject so getViews() does not emit synchronously during ngOnInit
  // (the component calls refreshViews() before initializing viewDataSource).
  const viewsSubject = new Subject<View[]>();

  const result = await renderComponent(AdminViewSearchComponent, {
    declarations: [AdminViewSearchComponent],
    imports: [MatTableModule, MatSortModule, MatCheckboxModule],
    providers: [
      {
        provide: ViewService,
        useValue: {
          getViews: () => viewsSubject.asObservable(),
          getView: () => of(null),
        },
      },
      {
        provide: DialogService,
        useValue: { confirm: () => of({ confirm: false }) },
      },
      {
        provide: LoggedInUserService,
        useValue: {
          loggedInUser$: of({ name: '', id: '' }),
          setLoggedInUser: () => {},
        },
      },
      {
        provide: MatDialog,
        useValue: { open: () => ({}) },
      },
      {
        provide: ActivatedRoute,
        useValue: {
          params: of({}),
          paramMap: of({ get: () => null, has: () => false }),
          queryParams: of({}),
          queryParamMap: of({ get: () => null, has: () => false }),
          snapshot: {
            params: {},
            paramMap: { get: () => null, has: () => false },
            queryParamMap: { get: () => null, has: () => false },
          },
        },
      },
      {
        provide: Router,
        useValue: { navigate: () => {} },
      },
    ],
  });

  // Now that ngOnInit has run and viewDataSource is initialized, emit the views.
  viewsSubject.next(mockViews);
  result.fixture.detectChanges();

  return result;
}

describe('AdminViewSearchComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderAdminViewSearch();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show search input', async () => {
    await renderAdminViewSearch();
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
  });

  it('should display views table', async () => {
    await renderAdminViewSearch();
    expect(screen.getByText('Training View')).toBeInTheDocument();
    expect(screen.getByText('Test View')).toBeInTheDocument();
  });

  it('should show Name and Description column headers', async () => {
    await renderAdminViewSearch();
    expect(screen.getByText('View Name')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
  });
});
