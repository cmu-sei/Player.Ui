// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { of, BehaviorSubject } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { ViewListComponent } from './view-list.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { UserPermissionsService } from '../../../services/permissions/user-permissions.service';
import { ViewsService } from '../../../services/views/views.service';
import { DialogService } from '../../../services/dialog/dialog.service';
import { SystemPermission, View } from '../../../generated/player-api';

function createMockPermissionsService(hasCreateViews: boolean) {
  return {
    permissions$: of(hasCreateViews ? [SystemPermission.CreateViews] : []),
    teamPermissions$: of([]),
    load: () => of(hasCreateViews ? [SystemPermission.CreateViews] : []),
    loadTeamPermissions: () => of([]),
    canViewAdminstration: () => of(false),
    hasPermission: (p: string) =>
      of(hasCreateViews && p === SystemPermission.CreateViews),
    can: () => of(false),
  };
}

async function renderViewList(
  hasCreateViews = false,
  overrides: {
    views?: View[];
    nameResult?: { wasCancelled: boolean; nameValue?: string };
  } = {},
) {
  const {
    views = [],
    nameResult = { wasCancelled: true, nameValue: '' },
  } = overrides;

  const stubs = {
    loadMyViews: vi.fn(() => of([])),
    createView: vi.fn(() => of({ id: 'created' })),
    name: vi.fn(() => of(nameResult)),
  };

  const rendered = await renderComponent(ViewListComponent, {
    declarations: [ViewListComponent],
    imports: [MatTableModule, MatSortModule],
    providers: [
      {
        provide: UserPermissionsService,
        useValue: createMockPermissionsService(hasCreateViews),
      },
      {
        provide: ViewsService,
        useValue: {
          views$: new BehaviorSubject<View[]>(views).asObservable(),
          loadMyViews: stubs.loadMyViews,
          createView: stubs.createView,
        },
      },
      {
        provide: DialogService,
        useValue: { confirm: () => of(true), name: stubs.name },
      },
    ],
  });

  return { ...rendered, stubs };
}

describe('ViewListComponent', () => {
  it('should create the component without error', async () => {
    const { fixture } = await renderViewList();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show "Add New View" button when user has CreateViews permission', async () => {
    const { container } = await renderViewList(true);
    expect(
      container.querySelector('button[mattooltip="Add New View"]'),
    ).not.toBeNull();
  });

  it('should hide "Add New View" button when user lacks CreateViews permission', async () => {
    const { container } = await renderViewList(false);
    expect(
      container.querySelector('button[mattooltip="Add New View"]'),
    ).toBeNull();
  });

  it('shows only Active views from the views$ stream', async () => {
    const { fixture } = await renderViewList(false, {
      views: [
        { id: 'v1', name: 'Active One', status: 'Active' },
        { id: 'v2', name: 'Inactive', status: 'Inactive' },
        { id: 'v3', name: 'Active Two', status: 'Active' },
      ] as View[],
    });
    expect(fixture.componentInstance.dataSource.data.map((v) => v.id)).toEqual([
      'v1',
      'v3',
    ]);
  });

  it('ngOnInit loads my views and clears the loading flag', async () => {
    const { fixture, stubs } = await renderViewList();
    expect(stubs.loadMyViews).toHaveBeenCalled();
    expect(fixture.componentInstance.isLoading).toBe(false);
    expect(fixture.componentInstance.filterString).toBe('');
  });

  it('applyFilter trims, lowercases, and sets the datasource filter', async () => {
    const { fixture } = await renderViewList();
    const c = fixture.componentInstance;
    c.applyFilter('  Training  ');
    expect(c.filterString).toBe('  Training  ');
    expect(c.dataSource.filter).toBe('training');
  });

  it('clearFilter resets the datasource filter', async () => {
    const { fixture } = await renderViewList();
    const c = fixture.componentInstance;
    c.applyFilter('Training');
    c.clearFilter();
    expect(c.dataSource.filter).toBe('');
  });

  describe('create()', () => {
    it('creates a view when the dialog returns a name', async () => {
      const { fixture, stubs } = await renderViewList(true, {
        nameResult: { wasCancelled: false, nameValue: 'My New View' },
      });
      fixture.componentInstance.create();
      expect(stubs.createView).toHaveBeenCalledWith({
        name: 'My New View',
        description: 'Add description',
      });
    });

    it('does nothing when the dialog is cancelled', async () => {
      const { fixture, stubs } = await renderViewList(true, {
        nameResult: { wasCancelled: true },
      });
      fixture.componentInstance.create();
      expect(stubs.createView).not.toHaveBeenCalled();
    });
  });

  it('ngOnDestroy completes the unsubscribe subject', async () => {
    const { fixture } = await renderViewList();
    const c = fixture.componentInstance;
    expect(() => c.ngOnDestroy()).not.toThrow();
  });
});
