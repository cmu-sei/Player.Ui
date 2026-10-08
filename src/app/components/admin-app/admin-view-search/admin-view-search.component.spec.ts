// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import {
  Component,
  EventEmitter,
  forwardRef,
  getDebugNode,
  Input,
  Output,
} from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NEVER, Observable, of, Subject } from 'rxjs';
import { AdminViewSearchComponent } from './admin-view-search.component';
import { AdminViewEditComponent } from './admin-view-edit/admin-view-edit.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import {
  SystemPermission,
  View,
  ViewService,
  ViewStatus,
} from '../../../generated/player-api';
import { LoggedInUserService } from '../../../services/logged-in-user/logged-in-user.service';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialogModule } from '@angular/material/dialog';
import { ClipboardModule } from 'ngx-clipboard';
import { ActivatedRoute, Router } from '@angular/router';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltip, MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { ApiStub } from '../../../test-utils/api-stub';
import { dialogRefStub } from '../../../test-utils/dialog-refs';
import { activatedRouteStub } from '../../../test-utils/activated-route';
import { permissionDataProviders } from '../../../test-utils/mock-permission-data.service';
import { unstubbed } from '../../../test-utils/unstubbed';
import {
  captureUnhandledRxErrors,
  flush,
} from '../../../test-utils/unhandled-rx-errors';

const training: View = {
  id: 'view-1',
  name: 'Training View',
  description: 'A training exercise',
  status: ViewStatus.Active,
};
const test: View = {
  id: 'view-2',
  name: 'Test View',
  description: 'A test exercise',
  status: ViewStatus.Inactive,
};
const mockViews = [training, test];

// The search drives these members of the edit child. The stub provides itself
// as AdminViewEditComponent, so the search's @ViewChild finds it.
@Component({
  selector: 'app-admin-view-edit',
  template: '',
  providers: [
    {
      provide: AdminViewEditComponent,
      useExisting: forwardRef(() => AdminViewEditStubComponent),
    },
  ],
})
class AdminViewEditStubComponent implements Pick<
  AdminViewEditComponent,
  | 'resetStepper'
  | 'updateView'
  | 'updateApplicationTemplates'
  | 'setView'
  | 'updateViewTeams'
> {
  @Output() editComplete = new EventEmitter<string>();
  resetStepper = vi.fn();
  updateView = vi.fn();
  updateApplicationTemplates = vi.fn();
  setView = vi.fn();
  updateViewTeams = vi.fn();
}

@Component({ selector: 'app-admin-app-view-export', template: '' })
class ViewExportStubComponent {
  @Input() ids!: string[];
  @Output() complete = new EventEmitter<boolean>();
}

@Component({ selector: 'app-admin-app-view-import', template: '' })
class ViewImportStubComponent {
  @Output() complete = new EventEmitter<boolean>();
}

/** The header button whose matTooltip carries the message. */
function tooltipButton(
  fixture: ComponentFixture<AdminViewSearchComponent>,
  message: string,
): HTMLButtonElement | null {
  const button = fixture.debugElement
    .queryAll(By.directive(MatTooltip))
    .find((el) => el.injector.get(MatTooltip).message === message);
  return (button?.nativeElement as HTMLButtonElement) ?? null;
}

/** The stub component a dialog opened in the overlay. */
function dialogStub<T>(selector: string): T {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`No ${selector} dialog is open`);
  }
  return getDebugNode(element)!.componentInstance as T;
}

/** View names listed in the table, in render order. */
function listedViews(container: Element): string[] {
  return Array.from(
    container.querySelectorAll('mat-cell.mat-column-name button[mat-button]'),
  ).map((button) => button.textContent?.trim() ?? '');
}

async function renderAdminViewSearch(
  overrides: {
    confirmResult?: boolean;
    getView?: (id: string) => Observable<View>;
    queryParamView?: string | null;
    viewsError?: Error;
    permissions?: SystemPermission[];
  } = {},
) {
  const {
    confirmResult = false,
    getView = (id: string) =>
      of<View>(structuredClone(mockViews.find((v) => v.id === id) ?? null)),
    queryParamView = null,
    viewsError,
    permissions = [SystemPermission.ViewViews, SystemPermission.ManageViews],
  } = overrides;

  // A Subject, so getViews() does not emit during ngOnInit (the component
  // calls refreshViews() before it creates viewDataSource).
  const viewsSubject = new Subject<View[]>();
  const navigate = vi.fn(() => Promise.resolve(true));

  const stubs = {
    getViews: vi.fn(() => viewsSubject.asObservable()),
    getView: vi.fn(getView),
    createView: vi.fn((v: View) => of({ ...v, id: 'created-view' })),
    updateView: vi.fn((_id: string, v: View) => of(v)),
    confirm: vi.fn(
      () => dialogRefStub<unknown, boolean>(confirmResult).dialogRef,
    ),
    navigate,
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
      MatDialogModule,
      ClipboardModule,
      AdminViewEditStubComponent,
      ViewExportStubComponent,
      ViewImportStubComponent,
    ],
    providers: [
      ...permissionDataProviders({ system: permissions }),
      {
        provide: ViewService,
        useValue: {
          getViews: stubs.getViews,
          getView: stubs.getView,
          createView: stubs.createView,
          updateView: stubs.updateView,
        } satisfies ApiStub<ViewService>,
      },
      {
        provide: CrucibleDialogService,
        useValue: { confirm: stubs.confirm } satisfies Pick<
          CrucibleDialogService,
          'confirm'
        >,
      },
      // Injected, but the component only reads it in commented-out code.
      unstubbed(LoggedInUserService),
      {
        provide: ActivatedRoute,
        useValue: activatedRouteStub(
          queryParamView == null ? {} : { view: queryParamView },
        ).route,
      },
      {
        provide: Router,
        useValue: { navigate } satisfies Pick<Router, 'navigate'>,
      },
    ],
  });

  /** Answers the pending getViews() requests, as the API would. */
  function emitViews(views: View[] = mockViews) {
    viewsSubject.next(structuredClone(views));
    result.fixture.detectChanges();
  }

  if (viewsError) {
    viewsSubject.error(viewsError);
  } else {
    emitViews();
  }
  await result.fixture.whenStable();

  const edit = result.fixture.debugElement.query(
    By.directive(AdminViewEditStubComponent),
  ).componentInstance as AdminViewEditStubComponent;
  const list = result.container.querySelector('.view-list-container')!;

  return { ...result, stubs, emitViews, edit, list };
}

describe('AdminViewSearchComponent', () => {
  /**
   * Verifies: a failed views request leaves the loading spinner up and lets the error escape (current behavior).
   * Interacts with: ViewService.getViews (errors); the rendered spinner; captureUnhandledRxErrors.
   * Data: getViews fails with a 500.
   */
  it('leaves the spinner up when the views request fails', async () => {
    const errors = captureUnhandledRxErrors();
    const failure = new Error('500');
    await renderAdminViewSearch({ viewsError: failure });
    await flush();
    // Current behavior; see agent-docs/ui-test-bugs/player.ui.md.
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(errors).toEqual([failure]);
  });

  /**
   * Verifies: the loaded views are listed by name, sorted, with their description and status, and no spinner.
   * Interacts with: ViewService.getViews; the rendered table.
   * Data: Training View (Active) and Test View (Inactive).
   */
  it('lists the views sorted by name with description and status', async () => {
    const { container } = await renderAdminViewSearch();
    expect(listedViews(container)).toEqual(['Test View', 'Training View']);
    expect(
      Array.from(container.querySelectorAll('mat-header-cell')).map((cell) =>
        cell.textContent?.trim(),
      ),
    ).toEqual(['', 'Name', 'Description', 'Status']);
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
    expect(screen.getByText('A training exercise')).toBeInTheDocument();
    expect(screen.getByText(ViewStatus.Inactive)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  /**
   * Verifies: typing in Search lists only matching views, ignoring case and surrounding spaces, and Clear Search
   *   lists all again.
   * Interacts with: the rendered Search input and Clear Search button; the table.
   * Data: ' TRAIN ' typed.
   */
  it('filters by the typed text and clears the filter', async () => {
    const user = userEvent.setup();
    const { container } = await renderAdminViewSearch();
    const search = screen.getByPlaceholderText('Search');
    search.focus();
    await user.type(search, ' TRAIN ', { skipClick: true });
    expect(listedViews(container)).toEqual(['Training View']);
    await user.click(screen.getByTitle('Clear Search'));
    expect(listedViews(container)).toEqual(['Test View', 'Training View']);
  });

  /**
   * Verifies: clicking a view's name loads it into the edit screen and hides the list.
   * Interacts with: the rendered view name button; ViewService.getView; the edit child stub.
   * Data: Training View clicked.
   */
  it('opens a view in the edit screen from its name', async () => {
    const user = userEvent.setup();
    const { stubs, edit, list } = await renderAdminViewSearch();
    await user.click(screen.getByText('Training View'));
    expect(stubs.getView).toHaveBeenCalledExactlyOnceWith('view-1');
    expect(edit.resetStepper).toHaveBeenCalledTimes(1);
    expect(edit.updateView).toHaveBeenCalledTimes(1);
    expect(edit.updateApplicationTemplates).toHaveBeenCalledTimes(1);
    expect(edit.setView).toHaveBeenCalledExactlyOnceWith(training);
    expect(edit.updateViewTeams).toHaveBeenCalledTimes(1);
    expect(list).toHaveClass('hidden');
  });

  /**
   * Verifies: when the edit screen completes, the list reloads and shows again.
   * Interacts with: the edit child stub's editComplete output; ViewService.getViews; Router.navigate.
   * Data: Training View opened, then completed; the reload returns a renamed Training View.
   */
  it('returns to the reloaded list when editing completes', async () => {
    const user = userEvent.setup();
    const { container, stubs, edit, list, emitViews } =
      await renderAdminViewSearch();
    await user.click(screen.getByText('Training View'));
    edit.editComplete.emit('view-1');
    emitViews([{ ...training, name: 'Renamed View' }, test]);
    expect(stubs.getViews).toHaveBeenCalledTimes(2);
    expect(list).not.toHaveClass('hidden');
    expect(listedViews(container)).toEqual(['Renamed View', 'Test View']);
    expect(stubs.navigate).not.toHaveBeenCalled();
  });

  /**
   * Verifies: opening the page with ?view= edits that view, and completing the edit clears the query parameter.
   * Interacts with: the ActivatedRoute query params; ViewService.getView; the edit child stub; Router.navigate.
   * Data: queryParamView 'view-2'.
   */
  it('edits the view named in ?view= and clears it when done', async () => {
    const { stubs, edit, list } = await renderAdminViewSearch({
      queryParamView: 'view-2',
    });
    expect(stubs.getView).toHaveBeenCalledExactlyOnceWith('view-2');
    expect(edit.setView).toHaveBeenCalledExactlyOnceWith(test);
    expect(list).toHaveClass('hidden');
    edit.editComplete.emit('view-2');
    expect(stubs.navigate).toHaveBeenCalledExactlyOnceWith([], {
      relativeTo: expect.anything(),
      queryParams: { view: null },
      queryParamsHandling: 'merge',
    });
  });

  /**
   * Verifies: Add creates an Active "New View" and opens it in the edit screen.
   * Interacts with: the Add button; ViewService.createView and getView; the edit child stub.
   * Data: createView returns id 'created-view'; getView for it never answers.
   */
  it('creates a view from Add and opens it for editing', async () => {
    const user = userEvent.setup();
    const { fixture, stubs } = await renderAdminViewSearch({
      getView: () => NEVER,
    });
    await user.click(tooltipButton(fixture, 'Add a new View')!);
    expect(stubs.createView).toHaveBeenCalledExactlyOnceWith({
      name: 'New View',
      description: 'Add description',
      status: ViewStatus.Active,
    });
    expect(stubs.getView).toHaveBeenCalledExactlyOnceWith('created-view');
  });

  /**
   * Verifies: the header checkbox selects every row (the Export badge counts them) and a second click clears the
   *   selection and the badge.
   * Interacts with: the rendered header and row checkboxes; the Export button's badge.
   * Data: two views.
   */
  it('selects and clears every row from the header checkbox', async () => {
    const user = userEvent.setup();
    const { container } = await renderAdminViewSearch();
    const [all, ...rows] = Array.from(
      container.querySelectorAll<HTMLInputElement>('mat-checkbox input'),
    );
    await user.click(all);
    expect(rows.map((box) => box.checked)).toEqual([true, true]);
    expect(container.querySelector('.mat-badge-content')).toHaveTextContent(
      '2',
    );
    await user.click(all);
    expect(rows.map((box) => box.checked)).toEqual([false, false]);
    expect(all.checked).toBe(false);
    expect(container.querySelector('.mat-badge-content')).toHaveTextContent(
      /^$/,
    );
  });

  /**
   * Verifies: the header checkbox selects every row and Export opens the export dialog with those ids; its complete
   *   output closes the dialog.
   * Interacts with: the header checkbox; the Export button; the real MatDialog; the export dialog stub.
   * Data: two views.
   */
  it('exports the selected views in a dialog', async () => {
    const user = userEvent.setup();
    const { container, fixture } = await renderAdminViewSearch();
    const [all] = Array.from(
      container.querySelectorAll<HTMLInputElement>('mat-checkbox input'),
    );
    await user.click(all);
    expect(container.querySelector('.mat-badge-content')).toHaveTextContent(
      '2',
    );
    await user.click(tooltipButton(fixture, 'Export Views')!);
    const dialog = dialogStub<ViewExportStubComponent>(
      'app-admin-app-view-export',
    );
    expect([...dialog.ids].sort()).toEqual(['view-1', 'view-2']);
    dialog.complete.emit(true);
    await fixture.whenStable();
    expect(document.querySelector('app-admin-app-view-export')).toBeNull();
  });

  /**
   * Verifies: Import opens the import dialog, and its complete output closes it and reloads the list.
   * Interacts with: the Import button; the real MatDialog; the import dialog stub; ViewService.getViews.
   * Data: the reload returns a third view, Imported View.
   */
  it('imports in a dialog and reloads the list', async () => {
    const user = userEvent.setup();
    const { container, fixture, stubs, emitViews } =
      await renderAdminViewSearch();
    await user.click(tooltipButton(fixture, 'Import Views')!);
    dialogStub<ViewImportStubComponent>(
      'app-admin-app-view-import',
    ).complete.emit(true);
    emitViews([...mockViews, { id: 'view-3', name: 'Imported View' }]);
    await fixture.whenStable();
    expect(document.querySelector('app-admin-app-view-import')).toBeNull();
    expect(stubs.getViews).toHaveBeenCalledTimes(2);
    expect(listedViews(container)).toEqual([
      'Imported View',
      'Test View',
      'Training View',
    ]);
  });

  /**
   * Verifies: a user who holds only ViewViews (the Views section's gate) is offered Add and Import (current behavior).
   * Interacts with: the rendered header buttons; the real UserPermissionsService over stubbed permission endpoints.
   * Data: system permissions [ViewViews].
   */
  it('offers Add and Import to a user with only ViewViews', async () => {
    const { fixture } = await renderAdminViewSearch({
      permissions: [SystemPermission.ViewViews],
    });
    // Current behavior; see agent-docs/ui-test-bugs/player.ui.md.
    expect(tooltipButton(fixture, 'Add a new View')).toBeInTheDocument();
    expect(tooltipButton(fixture, 'Import Views')).toBeInTheDocument();
  });

  describe("the 'activate' action, which no rendered control offers", () => {
    /**
     * Verifies: activating toggles the view's status after confirmation, with a prompt for the direction.
     * Interacts with: executeViewAction (called directly); ViewService.getView and updateView; CrucibleDialogService.confirm.
     * Data: one row per starting status; confirmResult true.
     */
    it.each<[string, View, string, ViewStatus]>([
      ['activates an inactive view', test, 'Activate View?', ViewStatus.Active],
      [
        'deactivates an active view',
        training,
        'Deactivate View?',
        ViewStatus.Inactive,
      ],
    ])('%s after confirmation', async (_case, view, title, status) => {
      const logged = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { fixture, stubs } = await renderAdminViewSearch({
        confirmResult: true,
      });
      fixture.componentInstance.executeViewAction('activate', view.id!);
      expect(stubs.confirm).toHaveBeenCalledWith(
        expect.objectContaining({ title }),
      );
      expect(stubs.updateView).toHaveBeenCalledExactlyOnceWith(view.id, {
        ...view,
        status,
      });
      expect(logged).toHaveBeenCalledWith(
        `successfully updated view ${view.name}`,
      );
    });

    /**
     * Verifies: declining the confirmation leaves the status unchanged.
     * Interacts with: executeViewAction (called directly); CrucibleDialogService.confirm; ViewService.updateView.
     * Data: confirmResult false.
     */
    it('does not update when the confirmation is declined', async () => {
      const { fixture, stubs } = await renderAdminViewSearch({
        confirmResult: false,
      });
      fixture.componentInstance.executeViewAction('activate', 'view-2');
      expect(stubs.updateView).not.toHaveBeenCalled();
    });

    /**
     * Verifies: an unrecognized action alerts.
     * Interacts with: executeViewAction (called directly); window.alert.
     * Data: action 'bogus'.
     */
    it('alerts on an unknown action', async () => {
      const { fixture } = await renderAdminViewSearch();
      const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
      fixture.componentInstance.executeViewAction('bogus', 'view-1');
      expect(alert).toHaveBeenCalledWith('Unknown Action');
    });
  });
});
