// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, EventEmitter, Output, TemplateRef } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { screen } from '@testing-library/angular';
import { NEVER, of, Subject } from 'rxjs';
import { AdminViewSearchComponent } from './admin-view-search.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { View, ViewService, ViewStatus } from '../../../generated/player-api';
import { LoggedInUserService } from '../../../services/logged-in-user/logged-in-user.service';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatBadgeModule } from '@angular/material/badge';
import { ClipboardModule } from 'ngx-clipboard';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltip, MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import type { AdminViewEditComponent } from './admin-view-edit/admin-view-edit.component';

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

@Component({ selector: 'app-admin-view-edit', template: '' })
class AdminViewEditStubComponent {
  @Output() editComplete = new EventEmitter<string>();
}

// executeViewAction drives exactly these five members of the edit child, so the
// stand-in is typed off the real component: renaming any of them fails to compile.
type ViewEditStub = Pick<
  AdminViewEditComponent,
  | 'resetStepper'
  | 'updateView'
  | 'updateApplicationTemplates'
  | 'setView'
  | 'updateViewTeams'
>;

function viewEditStub(): ViewEditStub {
  return {
    resetStepper: vi.fn(),
    updateView: vi.fn(),
    updateApplicationTemplates: vi.fn(),
    setView: vi.fn(),
    updateViewTeams: vi.fn(),
  };
}

// The header buttons carry only a matTooltip, so they are found by asking each
// MatTooltip directive for its message.
function tooltipButton(
  fixture: ComponentFixture<AdminViewSearchComponent>,
  message: string,
): HTMLButtonElement {
  const button = fixture.debugElement
    .queryAll(By.directive(MatTooltip))
    .find((el) => el.injector.get(MatTooltip).message === message);
  if (!button) {
    throw new Error(`No button with a "${message}" tooltip was rendered`);
  }
  return button.nativeElement as HTMLButtonElement;
}

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
  const dialogClose = vi.fn();

  const stubs = {
    getViews: vi.fn(() => viewsSubject.asObservable()),
    getView: vi.fn(getView),
    createView: vi.fn((v: View) => of({ ...v, id: 'created-view' })),
    updateView: vi.fn((_id: string, v: View) => of(v)),
    confirm: vi.fn(() => ({
      afterClosed: () => of(confirmResult),
    })),
    dialogOpen: vi.fn(() => ({ close: dialogClose })),
    dialogClose,
  };

  const result = await renderComponent(AdminViewSearchComponent, {
    declarations: [AdminViewSearchComponent],
    imports: [
      MatCardModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatTooltipModule,
      MatButtonModule,
      MatTableModule,
      MatSortModule,
      MatPaginatorModule,
      MatProgressSpinnerModule,
      MatCheckboxModule,
      MatBadgeModule,
      ClipboardModule,
      AdminViewEditStubComponent,
    ],
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
        provide: CrucibleDialogService,
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
          paramMap: of(convertToParamMap({})),
          queryParams: of({}),
          queryParamMap: of(convertToParamMap({})),
          snapshot: {
            params: {},
            paramMap: convertToParamMap({}),
            queryParamMap: convertToParamMap(
              queryParamView == null ? {} : { view: queryParamView },
            ),
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
  await result.fixture.whenStable();

  return { ...result, stubs, viewsSubject };
}

describe('AdminViewSearchComponent', () => {
  /**
   * Verifies: the search input is rendered.
   * Interacts with: the rendered DOM (queried by placeholder).
   * Data: default overrides.
   */
  it('should show search input', async () => {
    await renderAdminViewSearch();
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
  });

  /**
   * Verifies: each emitted view renders as a table row.
   * Interacts with: the rendered DOM fed by the views Subject.
   * Data: mockViews (Training View, Test View).
   */
  it('should display views table', async () => {
    await renderAdminViewSearch();
    expect(screen.getByText('Training View')).toBeInTheDocument();
    expect(screen.getByText('Test View')).toBeInTheDocument();
  });

  /**
   * Verifies: the Name and Description column headers are rendered.
   * Interacts with: the rendered DOM (queried via Testing Library screen).
   * Data: default overrides.
   */
  it('should show Name and Description column headers', async () => {
    await renderAdminViewSearch();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  /**
   * Verifies: applyFilter trims and lowercases the value before applying it to the datasource filter.
   * Interacts with: component.applyFilter and the MatTableDataSource filter.
   * Data: padded mixed-case input '  Training  '.
   * Why: contrasts with admin-user-search whose applyFilter keeps surrounding whitespace.
   */
  it('applyFilter trims, lowercases, and sets the datasource filter', async () => {
    const { fixture } = await renderAdminViewSearch();
    const c = fixture.componentInstance;
    c.applyFilter('  Training  ');
    expect(c.filterString).toBe('  Training  ');
    expect(c.viewDataSource.filter).toBe('training');
  });

  /**
   * Verifies: clearFilter empties the datasource filter.
   * Interacts with: component.applyFilter / clearFilter and the datasource.
   * Data: a 'Training' filter set then cleared.
   */
  it('clearFilter resets the datasource filter', async () => {
    const { fixture } = await renderAdminViewSearch();
    const c = fixture.componentInstance;
    c.applyFilter('Training');
    c.clearFilter();
    expect(c.viewDataSource.filter).toBe('');
  });

  /**
   * Verifies: refreshViews loads views into the datasource and clears isLoading and showEditScreen.
   * Interacts with: stubbed ViewService.getViews via the views Subject.
   * Data: mockViews re-emitted for the fresh subscription.
   * Why: getViews is a Subject, so the test must emit again after refreshViews re-subscribes.
   */
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

  /**
   * Verifies: executeViewAction('edit') fetches the view and drives the edit child (reset/setView/updateViewTeams) and shows it.
   * Interacts with: stubbed ViewService.getView and a fake AdminViewEditComponent ViewChild.
   * Data: getView override returns mockViews[0]; child stub with spied methods.
   */
  it("executeViewAction('edit') loads the view and shows the edit screen", async () => {
    const { fixture, stubs } = await renderAdminViewSearch({
      getView: () => of(mockViews[0]),
    });
    const c = fixture.componentInstance;
    const editStub = viewEditStub();
    c.adminViewEditComponent = editStub as AdminViewEditComponent;
    c.executeViewAction('edit', 'view-1');
    expect(stubs.getView).toHaveBeenCalledWith('view-1');
    expect(editStub.resetStepper).toHaveBeenCalled();
    expect(editStub.setView).toHaveBeenCalledWith(mockViews[0]);
    expect(editStub.updateViewTeams).toHaveBeenCalled();
    expect(c.showEditScreen).toBe(true);
  });

  /**
   * Verifies: activating an inactive view confirms then updates status to Active.
   * Interacts with: stubbed ViewService.getView/updateView and DialogService.confirm.
   * Data: inactive mockViews[1]; confirmResult=true.
   */
  it("executeViewAction('activate') activates an inactive view after confirmation", async () => {
    const inactive: View = { ...mockViews[1] };
    const { fixture, stubs } = await renderAdminViewSearch({
      getView: () => of(inactive),
      confirmResult: true,
    });
    fixture.componentInstance.executeViewAction('activate', 'view-2');
    expect(stubs.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Activate View?',
        message: expect.stringContaining('Activate'),
      }),
    );
    expect(stubs.updateView).toHaveBeenCalledWith(
      'view-2',
      expect.objectContaining({ status: ViewStatus.Active }),
    );
  });

  /**
   * Verifies: the same 'activate' action on an active view prompts a Deactivate confirm and updates status to Inactive.
   * Interacts with: stubbed ViewService.getView/updateView and DialogService.confirm.
   * Data: active mockViews[0]; confirmResult=true.
   */
  it("executeViewAction('activate') deactivates an active view after confirmation", async () => {
    const active: View = { ...mockViews[0] };
    const { fixture, stubs } = await renderAdminViewSearch({
      getView: () => of(active),
      confirmResult: true,
    });
    fixture.componentInstance.executeViewAction('activate', 'view-1');
    expect(stubs.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Deactivate View?',
        message: expect.stringContaining('deactivate'),
      }),
    );
    expect(stubs.updateView).toHaveBeenCalledWith(
      'view-1',
      expect.objectContaining({ status: ViewStatus.Inactive }),
    );
  });

  /**
   * Verifies: declining the confirm skips the status update.
   * Interacts with: stubbed DialogService.confirm and ViewService.updateView.
   * Data: confirmResult=false.
   */
  it("executeViewAction('activate') does not update when confirmation is declined", async () => {
    const { fixture, stubs } = await renderAdminViewSearch({
      getView: () => of({ ...mockViews[1] }),
      confirmResult: false,
    });
    fixture.componentInstance.executeViewAction('activate', 'view-2');
    expect(stubs.updateView).not.toHaveBeenCalled();
  });

  /**
   * Verifies: an unrecognized action triggers an 'Unknown Action' alert.
   * Interacts with: a spy on window.alert.
   * Data: action string 'bogus'.
   */
  it('executeViewAction with an unknown action alerts', async () => {
    const { fixture } = await renderAdminViewSearch();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    fixture.componentInstance.executeViewAction('bogus', 'view-1');
    expect(alertSpy).toHaveBeenCalledWith('Unknown Action');
  });

  /**
   * Verifies: addNewView creates a default 'New View' (Active) then dispatches executeViewAction('edit') on its id.
   * Interacts with: stubbed ViewService.createView and a spy on executeViewAction.
   * Data: createView returns id 'created-view'.
   */
  it('addNewView creates a view then edits it', async () => {
    const { fixture, stubs } = await renderAdminViewSearch({
      getView: () => of(mockViews[0]),
    });
    const c = fixture.componentInstance;
    c.adminViewEditComponent = viewEditStub() as AdminViewEditComponent;
    const executeSpy = vi.spyOn(c, 'executeViewAction');
    c.addNewView();
    expect(stubs.createView).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New View', status: ViewStatus.Active }),
    );
    expect(executeSpy).toHaveBeenCalledWith('edit', 'created-view');
  });

  /**
   * Verifies: onEditComplete triggers a refresh of the view list.
   * Interacts with: a spy on refreshViews.
   * Data: arbitrary view id 'view-1'.
   */
  it('onEditComplete refreshes the views', async () => {
    const { fixture } = await renderAdminViewSearch();
    const c = fixture.componentInstance;
    const refreshSpy = vi.spyOn(c, 'refreshViews');
    c.onEditComplete('view-1');
    expect(refreshSpy).toHaveBeenCalled();
  });

  /**
   * Verifies: isAllSelected is false initially and true after every row is toggled on.
   * Interacts with: component.isAllSelected and toggleAllRows over the loaded rows.
   * Data: mockViews (two rows).
   */
  it('isAllSelected reflects whether every filtered row is selected', async () => {
    const { fixture } = await renderAdminViewSearch();
    const c = fixture.componentInstance;
    expect(c.isAllSelected()).toBe(false);
    c.toggleAllRows();
    expect(c.isAllSelected()).toBe(true);
  });

  /**
   * Verifies: toggleAllRows selects all row ids on the first call and clears them on the second.
   * Interacts with: component.toggleAllRows and the SelectionModel.
   * Data: mockViews (view-1, view-2).
   */
  it('toggleAllRows selects all rows then clears them', async () => {
    const { fixture } = await renderAdminViewSearch();
    const c = fixture.componentInstance;
    c.toggleAllRows();
    expect(c.selection.selected.sort()).toEqual(['view-1', 'view-2']);
    c.toggleAllRows();
    expect(c.selection.selected).toEqual([]);
  });

  /**
   * Verifies: the Import Views button opens the import template in a dialog and importComplete closes that ref and refreshes views.
   * Interacts with: the rendered Import Views button, stubbed MatDialog.open, and a spy on refreshViews.
   * Data: the component's own #importDialog TemplateRef, passed by the template's (click) binding.
   * Why: clicking the button covers the (click)="openDialog(importDialog)" binding, which a direct openDialog() call leaves untested.
   */
  it('the Import Views button opens a dialog and importComplete closes it and refreshes', async () => {
    const { fixture, stubs } = await renderAdminViewSearch();
    const c = fixture.componentInstance;
    tooltipButton(fixture, 'Import Views').click();
    await fixture.whenStable();
    expect(stubs.dialogOpen).toHaveBeenCalledWith(
      expect.any(TemplateRef),
      expect.objectContaining({ width: '480px' }),
    );
    const refreshSpy = vi.spyOn(c, 'refreshViews');
    c.importComplete();
    expect(stubs.dialogClose).toHaveBeenCalled();
    expect(refreshSpy).toHaveBeenCalled();
  });

  /**
   * Verifies: closeDialog closes the ref opened by the Export Views button.
   * Interacts with: the rendered Export Views button and stubbed MatDialog.open (ref with a close spy).
   * Data: the component's own #exportDialog TemplateRef.
   */
  it('closeDialog closes the open dialog', async () => {
    const { fixture, stubs } = await renderAdminViewSearch();
    tooltipButton(fixture, 'Export Views').click();
    await fixture.whenStable();
    fixture.componentInstance.closeDialog();
    expect(stubs.dialogClose).toHaveBeenCalled();
  });

  /**
   * Verifies: ngOnInit reads the ?view= query param and dispatches an edit fetch for that view id.
   * Interacts with: the ActivatedRoute queryParamMap stub and ViewService.getView.
   * Data: queryParamView 'view-1'; getView returns NEVER.
   * Why: getView returns NEVER so executeViewAction('edit')'s subscribe body (which touches the un-rendered edit ViewChild) never runs; only the dispatch is asserted.
   */
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
