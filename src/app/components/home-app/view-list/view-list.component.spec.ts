// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { ViewListComponent } from './view-list.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionDataProviders } from 'src/app/test-utils/mock-permission-data.service';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { DialogService } from '../../../services/dialog/dialog.service';
import {
  CreateViewCommand,
  SystemPermission,
  View,
  ViewService,
  ViewStatus,
} from '../../../generated/player-api';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import {
  captureUnhandledRxErrors,
  flush,
} from '../../../test-utils/unhandled-rx-errors';

// The component runs over the REAL ViewsService (a default provider); only the
// generated ViewService endpoints are stubbed. Each call returns a fresh array,
// as ViewsService pushes created views into the array it stores.
async function renderViewList(
  hasCreateViews = false,
  overrides: {
    views?: View[];
    nameResult?: {
      nameValue?: string;
      descriptionValue?: string;
    } | null;
    viewsError?: Error;
  } = {},
) {
  const { views = [], nameResult = null, viewsError } = overrides;

  const viewApi = {
    getMyViews: vi.fn(() =>
      viewsError ? throwError(() => viewsError) : of(structuredClone(views)),
    ),
    // The API creates views as Active; echo the command back that way.
    createView: vi.fn((command?: CreateViewCommand) =>
      of<View>({
        id: 'created',
        name: command?.name,
        description: command?.description,
        status: ViewStatus.Active,
      }),
    ),
  } satisfies ApiStub<ViewService>;
  const name = vi.fn(() => of(nameResult));

  const rendered = await renderComponent(ViewListComponent, {
    declarations: [ViewListComponent],
    imports: [
      MatCardModule,
      MatFormFieldModule,
      MatIconModule,
      MatProgressSpinnerModule,
      MatInputModule,
      MatTooltipModule,
      MatButtonModule,
      MatTableModule,
      MatSortModule,
      MatPaginatorModule,
    ],
    providers: [
      ...permissionDataProviders({
        // Denied is a near miss: every other view permission.
        system: hasCreateViews
          ? [SystemPermission.CreateViews]
          : [
              SystemPermission.ViewViews,
              SystemPermission.EditViews,
              SystemPermission.ManageViews,
            ],
      }),
      { provide: ViewService, useValue: viewApi },
      {
        provide: DialogService,
        useValue: { name } satisfies Pick<DialogService, 'name'>,
      },
    ],
  });

  return { ...rendered, viewApi, name };
}

// The Add New View icon button has no accessible name (matTooltip only sets
// aria-describedby), so it is found by its tooltip attribute.
function addViewButton(container: Element): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(
    'button[mattooltip="Add New View"]',
  );
  if (!button) {
    throw new Error('The Add New View button was not rendered');
  }
  return button;
}

/** View names linked in the table, in render order. */
function viewLinks(): string[] {
  return screen.queryAllByRole('link').map((a) => a.textContent?.trim() ?? '');
}

describe('ViewListComponent', () => {
  /**
   * Verifies: the "Add New View" button renders when CreateViews permission is present.
   * Interacts with: real UserPermissionsService over stubbed permission endpoints, rendered DOM tooltip query.
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
   * Interacts with: real UserPermissionsService over stubbed permission endpoints, rendered DOM tooltip query.
   * Data: renderViewList(false), granting ViewViews, EditViews and ManageViews but not CreateViews (near miss).
   */
  it('should hide "Add New View" button when user lacks CreateViews permission', async () => {
    const { container } = await renderViewList(false);
    expect(
      container.querySelector('button[mattooltip="Add New View"]'),
    ).toBeNull();
  });

  /**
   * Verifies: the table lists only the user's Active views, linked by name.
   * Interacts with: the real ViewsService.loadMyViews over the ViewService.getMyViews stub; the rendered table.
   * Data: getMyViews returns Active One, Inactive, Active Two.
   */
  it('shows only Active views from the loaded views', async () => {
    await renderViewList(false, {
      views: [
        { id: 'v1', name: 'Active One', status: ViewStatus.Active },
        { id: 'v2', name: 'Inactive', status: ViewStatus.Inactive },
        { id: 'v3', name: 'Active Two', status: ViewStatus.Active },
      ],
    });
    expect(viewLinks()).toEqual(['Active One', 'Active Two']);
    expect(screen.getByText('Active One')).toHaveAttribute('href', '/view/v1');
    expect(screen.queryByText('No results found')).not.toBeInTheDocument();
  });

  /**
   * Verifies: on init the view list is loaded once, the spinner is gone, and an empty list shows "No results found".
   * Interacts with: the real ViewsService.loadMyViews over the ViewService.getMyViews stub; the rendered list.
   * Data: default renderViewList() (no views).
   */
  it('loads my views once and shows an empty list', async () => {
    const { viewApi } = await renderViewList();
    expect(viewApi.getMyViews).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  /**
   * Verifies: typing in Search lists only matching views, ignoring case and surrounding spaces, and Clear Search lists
   *   all again.
   * Interacts with: the rendered Search input and Clear Search button; the table.
   * Data: Training and Exercise views; ' TRAIN ' typed.
   */
  it('filters by the typed text and clears the filter', async () => {
    const user = userEvent.setup();
    await renderViewList(false, {
      views: [
        { id: 'v1', name: 'Training', status: ViewStatus.Active },
        { id: 'v2', name: 'Exercise', status: ViewStatus.Active },
      ],
    });
    const search = screen.getByPlaceholderText('Search');
    search.focus();
    await user.type(search, ' TRAIN ', { skipClick: true });
    expect(viewLinks()).toEqual(['Training']);
    await user.click(screen.getByTitle('Clear Search'));
    expect(viewLinks()).toEqual(['Exercise', 'Training']);
  });

  /**
   * Verifies: a failed "my views" request leaves the loading spinner up and lets the error escape (current behavior).
   * Interacts with: ViewService.getMyViews (throws) through the real ViewsService.loadMyViews; the rendered spinner;
   *   captureUnhandledRxErrors.
   * Data: getMyViews fails with a 500.
   */
  it('leaves the spinner up when the views request fails', async () => {
    const errors = captureUnhandledRxErrors();
    const failure = new Error('500');
    await renderViewList(false, { viewsError: failure });
    await flush();
    // Current behavior; see agent-docs/ui-test-bugs/player.ui.md.
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(errors).toEqual([failure]);
  });

  describe('create()', () => {
    /**
     * Verifies: clicking Add New View and naming it creates the view with the default description, and it appears in the table.
     * Interacts with: DialogService.name stub; the real ViewsService.createView over the ViewService.createView stub.
     * Data: CreateViews granted; one existing view; nameResult { nameValue: 'My New View' }.
     */
    it('creates a view when the dialog returns a name', async () => {
      const user = userEvent.setup();
      const { container, viewApi, name } = await renderViewList(true, {
        views: [{ id: 'v1', name: 'Existing', status: ViewStatus.Active }],
        nameResult: { nameValue: 'My New View' },
      });
      await user.click(addViewButton(container));
      expect(name).toHaveBeenCalled();
      expect(viewApi.createView).toHaveBeenCalledWith({
        name: 'My New View',
        description: 'Add description',
      });
      expect(viewLinks()).toEqual(['Existing', 'My New View']);
    });

    /**
     * Verifies: a cancelled name dialog creates nothing and the table is unchanged.
     * Interacts with: DialogService.name stub; ViewService.createView stub (asserted not called).
     * Data: CreateViews granted; one existing view; nameResult null.
     */
    it('does nothing when the dialog is cancelled', async () => {
      const user = userEvent.setup();
      const { container, viewApi } = await renderViewList(true, {
        views: [{ id: 'v1', name: 'Existing', status: ViewStatus.Active }],
        nameResult: null,
      });
      await user.click(addViewButton(container));
      expect(viewApi.createView).not.toHaveBeenCalled();
      expect(viewLinks()).toEqual(['Existing']);
    });
  });
});
