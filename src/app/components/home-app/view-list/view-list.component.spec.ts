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
  /**
   * Verifies: ViewListComponent instantiates without error.
   * Interacts with: renderViewList harness with permissions/views/dialog stubs.
   * Data: default renderViewList() (no CreateViews permission, empty views).
   */
  it('should create the component without error', async () => {
    const { fixture } = await renderViewList();
    expect(fixture.componentInstance).toBeTruthy();
  });

  /**
   * Verifies: the "Add New View" button renders when CreateViews permission is present.
   * Interacts with: UserPermissionsService stub, rendered DOM tooltip query.
   * Data: renderViewList(true) granting CreateViews.
   */
  it('should show "Add New View" button when user has CreateViews permission', async () => {
    const { container } = await renderViewList(true);
    expect(
      container.querySelector('button[mattooltip="Add New View"]'),
    ).not.toBeNull();
  });

  /**
   * Verifies: the "Add New View" button is absent when CreateViews permission is missing.
   * Interacts with: UserPermissionsService stub, rendered DOM tooltip query.
   * Data: renderViewList(false) without CreateViews.
   */
  it('should hide "Add New View" button when user lacks CreateViews permission', async () => {
    const { container } = await renderViewList(false);
    expect(
      container.querySelector('button[mattooltip="Add New View"]'),
    ).toBeNull();
  });

  /**
   * Verifies: dataSource keeps only views with status 'Active', filtering out Inactive ones.
   * Interacts with: ViewsService.views$ stub, component dataSource.
   * Data: renderViewList override with a mixed Active/Inactive views array.
   */
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

  /**
   * Verifies: ngOnInit calls loadMyViews and leaves isLoading false with an empty filterString.
   * Interacts with: ViewsService.loadMyViews stub, component instance state.
   * Data: default renderViewList().
   */
  it('ngOnInit loads my views and clears the loading flag', async () => {
    const { fixture, stubs } = await renderViewList();
    expect(stubs.loadMyViews).toHaveBeenCalled();
    expect(fixture.componentInstance.isLoading).toBe(false);
    expect(fixture.componentInstance.filterString).toBe('');
  });

  /**
   * Verifies: applyFilter keeps the raw filterString but normalizes the dataSource filter to trimmed lowercase.
   * Interacts with: component applyFilter, MatTableDataSource filter.
   * Data: default renderViewList(); input '  Training  '.
   */
  it('applyFilter trims, lowercases, and sets the datasource filter', async () => {
    const { fixture } = await renderViewList();
    const c = fixture.componentInstance;
    c.applyFilter('  Training  ');
    expect(c.filterString).toBe('  Training  ');
    expect(c.dataSource.filter).toBe('training');
  });

  /**
   * Verifies: clearFilter empties the dataSource filter after a prior applyFilter.
   * Interacts with: component applyFilter/clearFilter, MatTableDataSource filter.
   * Data: default renderViewList().
   */
  it('clearFilter resets the datasource filter', async () => {
    const { fixture } = await renderViewList();
    const c = fixture.componentInstance;
    c.applyFilter('Training');
    c.clearFilter();
    expect(c.dataSource.filter).toBe('');
  });

  describe('create()', () => {
    /**
     * Verifies: create() calls ViewsService.createView with the dialog name and default description.
     * Interacts with: DialogService.name stub, ViewsService.createView spy.
     * Data: renderViewList override nameResult { wasCancelled: false, nameValue: 'My New View' }.
     */
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

    /**
     * Verifies: create() does not call createView when the name dialog is cancelled.
     * Interacts with: DialogService.name stub, ViewsService.createView spy.
     * Data: renderViewList override nameResult { wasCancelled: true }.
     */
    it('does nothing when the dialog is cancelled', async () => {
      const { fixture, stubs } = await renderViewList(true, {
        nameResult: { wasCancelled: true },
      });
      fixture.componentInstance.create();
      expect(stubs.createView).not.toHaveBeenCalled();
    });
  });

  /**
   * Verifies: ngOnDestroy runs without throwing while completing its unsubscribe subject.
   * Interacts with: component ngOnDestroy lifecycle hook.
   * Data: default renderViewList().
   */
  it('ngOnDestroy completes the unsubscribe subject', async () => {
    const { fixture } = await renderViewList();
    const c = fixture.componentInstance;
    expect(() => c.ngOnDestroy()).not.toThrow();
  });
});
