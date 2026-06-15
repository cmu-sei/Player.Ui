// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import { NEVER, of, Subject } from 'rxjs';
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

async function renderAdminViewSearch(
  overrides: {
    confirmResult?: boolean;
    getView?: (id: string) => unknown;
    queryParamView?: string | null;
  } = {},
) {
  const {
    confirmResult = false,
    getView = () => of(null),
    queryParamView = null,
  } = overrides;

  // Use a Subject so getViews() does not emit synchronously during ngOnInit
  // (the component calls refreshViews() before initializing viewDataSource).
  const viewsSubject = new Subject<View[]>();

  const stubs = {
    getViews: vi.fn(() => viewsSubject.asObservable()),
    getView: vi.fn(getView),
    createView: vi.fn((v: View) => of({ ...v, id: 'created-view' })),
    updateView: vi.fn((_id: string, v: View) => of(v)),
    confirm: vi.fn(() => of({ confirm: confirmResult })),
    dialogOpen: vi.fn(() => ({ close: vi.fn() })),
  };

  const result = await renderComponent(AdminViewSearchComponent, {
    declarations: [AdminViewSearchComponent],
    imports: [MatTableModule, MatSortModule, MatCheckboxModule],
    providers: [
      {
        provide: ViewService,
        useValue: {
          getViews: stubs.getViews,
          getView: stubs.getView,
          createView: stubs.createView,
          updateView: stubs.updateView,
        },
      },
      {
        provide: DialogService,
        useValue: { confirm: stubs.confirm },
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
        useValue: { open: stubs.dialogOpen },
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
            queryParamMap: {
              get: (k: string) => (k === 'view' ? queryParamView : null),
              has: (k: string) => k === 'view' && queryParamView != null,
            },
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

  return { ...result, stubs, viewsSubject };
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

  it('applyFilter trims, lowercases, and sets the datasource filter', async () => {
    const { fixture } = await renderAdminViewSearch();
    const c = fixture.componentInstance;
    c.applyFilter('  Training  ');
    expect(c.filterString).toBe('  Training  ');
    expect(c.viewDataSource.filter).toBe('training');
  });

  it('clearFilter resets the datasource filter', async () => {
    const { fixture } = await renderAdminViewSearch();
    const c = fixture.componentInstance;
    c.applyFilter('Training');
    c.clearFilter();
    expect(c.viewDataSource.filter).toBe('');
  });

  it('refreshViews loads views into the datasource and clears loading', async () => {
    const { fixture, viewsSubject } = await renderAdminViewSearch();
    const c = fixture.componentInstance;
    c.refreshViews();
    // getViews() is backed by a Subject, so emit again for this fresh subscribe.
    viewsSubject.next(mockViews);
    expect(c.viewDataSource.data.map((v) => v.id)).toEqual([
      'view-1',
      'view-2',
    ]);
    expect(c.isLoading).toBe(false);
    expect(c.showEditScreen).toBe(false);
  });

  it("executeViewAction('edit') loads the view and shows the edit screen", async () => {
    const { fixture, stubs } = await renderAdminViewSearch({
      getView: () => of(mockViews[0]),
    });
    const c = fixture.componentInstance;
    const editStub = {
      resetStepper: vi.fn(),
      updateView: vi.fn(),
      updateApplicationTemplates: vi.fn(),
      setView: vi.fn(),
      updateViewTeams: vi.fn(),
    };
    c.adminViewEditComponent = editStub as never;
    c.executeViewAction('edit', 'view-1');
    expect(stubs.getView).toHaveBeenCalledWith('view-1');
    expect(editStub.resetStepper).toHaveBeenCalled();
    expect(editStub.setView).toHaveBeenCalledWith(mockViews[0]);
    expect(editStub.updateViewTeams).toHaveBeenCalled();
    expect(c.showEditScreen).toBe(true);
  });

  it("executeViewAction('activate') activates an inactive view after confirmation", async () => {
    const inactive: View = { ...mockViews[1] };
    const { fixture, stubs } = await renderAdminViewSearch({
      getView: () => of(inactive),
      confirmResult: true,
    });
    fixture.componentInstance.executeViewAction('activate', 'view-2');
    expect(stubs.confirm).toHaveBeenCalledWith(
      'Activate View?',
      expect.stringContaining('Activate'),
    );
    expect(stubs.updateView).toHaveBeenCalledWith(
      'view-2',
      expect.objectContaining({ status: ViewStatus.Active }),
    );
  });

  it("executeViewAction('activate') deactivates an active view after confirmation", async () => {
    const active: View = { ...mockViews[0] };
    const { fixture, stubs } = await renderAdminViewSearch({
      getView: () => of(active),
      confirmResult: true,
    });
    fixture.componentInstance.executeViewAction('activate', 'view-1');
    expect(stubs.confirm).toHaveBeenCalledWith(
      'Deactivate View?',
      expect.stringContaining('deactivate'),
    );
    expect(stubs.updateView).toHaveBeenCalledWith(
      'view-1',
      expect.objectContaining({ status: ViewStatus.Inactive }),
    );
  });

  it("executeViewAction('activate') does not update when confirmation is declined", async () => {
    const { fixture, stubs } = await renderAdminViewSearch({
      getView: () => of({ ...mockViews[1] }),
      confirmResult: false,
    });
    fixture.componentInstance.executeViewAction('activate', 'view-2');
    expect(stubs.updateView).not.toHaveBeenCalled();
  });

  it('executeViewAction with an unknown action alerts', async () => {
    const { fixture } = await renderAdminViewSearch();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    fixture.componentInstance.executeViewAction('bogus', 'view-1');
    expect(alertSpy).toHaveBeenCalledWith('Unknown Action');
    alertSpy.mockRestore();
  });

  it('addNewView creates a view then edits it', async () => {
    const { fixture, stubs } = await renderAdminViewSearch({
      getView: () => of(mockViews[0]),
    });
    const c = fixture.componentInstance;
    c.adminViewEditComponent = {
      resetStepper: vi.fn(),
      updateView: vi.fn(),
      updateApplicationTemplates: vi.fn(),
      setView: vi.fn(),
      updateViewTeams: vi.fn(),
    } as never;
    const executeSpy = vi.spyOn(c, 'executeViewAction');
    c.addNewView();
    expect(stubs.createView).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New View', status: ViewStatus.Active }),
    );
    expect(executeSpy).toHaveBeenCalledWith('edit', 'created-view');
  });

  it('onEditComplete refreshes the views', async () => {
    const { fixture } = await renderAdminViewSearch();
    const c = fixture.componentInstance;
    const refreshSpy = vi.spyOn(c, 'refreshViews');
    c.onEditComplete('view-1');
    expect(refreshSpy).toHaveBeenCalled();
  });

  it('isAllSelected reflects whether every filtered row is selected', async () => {
    const { fixture } = await renderAdminViewSearch();
    const c = fixture.componentInstance;
    expect(c.isAllSelected()).toBe(false);
    c.toggleAllRows();
    expect(c.isAllSelected()).toBe(true);
  });

  it('toggleAllRows selects all rows then clears them', async () => {
    const { fixture } = await renderAdminViewSearch();
    const c = fixture.componentInstance;
    c.toggleAllRows();
    expect(c.selection.selected.sort()).toEqual(['view-1', 'view-2']);
    c.toggleAllRows();
    expect(c.selection.selected).toEqual([]);
  });

  it('openDialog opens a dialog and importComplete closes it and refreshes', async () => {
    const { fixture, stubs } = await renderAdminViewSearch();
    const c = fixture.componentInstance;
    const close = vi.fn();
    stubs.dialogOpen.mockReturnValueOnce({ close } as never);
    c.openDialog({} as never);
    expect(stubs.dialogOpen).toHaveBeenCalled();
    const refreshSpy = vi.spyOn(c, 'refreshViews');
    c.importComplete();
    expect(close).toHaveBeenCalled();
    expect(refreshSpy).toHaveBeenCalled();
  });

  it('closeDialog closes the open dialog', async () => {
    const { fixture, stubs } = await renderAdminViewSearch();
    const c = fixture.componentInstance;
    const close = vi.fn();
    stubs.dialogOpen.mockReturnValueOnce({ close } as never);
    c.openDialog({} as never);
    c.closeDialog();
    expect(close).toHaveBeenCalled();
  });

  it('edits the view named in the ?view= query param on init', async () => {
    // getView returns NEVER so executeViewAction('edit')'s subscribe body (which
    // touches the un-rendered AdminViewEditComponent ViewChild) never runs — we
    // only assert that ngOnInit dispatched the edit for the query-param view.
    const { stubs } = await renderAdminViewSearch({
      queryParamView: 'view-1',
      getView: () => NEVER,
    });
    expect(stubs.getView).toHaveBeenCalledWith('view-1');
  });
});
