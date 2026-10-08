// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatTooltip } from '@angular/material/tooltip';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { permissionDataProviders } from '../../../test-utils/mock-permission-data.service';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  SystemPermission,
  WebhookService,
  WebhookSubscription,
} from '../../../generated/player-api';
import { DialogService } from '../../../services/dialog/dialog.service';
import { AppAdminSubscriptionSearchComponent } from './app-admin-subscription-search.component';
import { renderComponent } from '../../../test-utils/render-component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { ApiStub } from '../../../test-utils/api-stub';
import { dialogRefStub } from '../../../test-utils/dialog-refs';

const alpha: WebhookSubscription = { id: 's1', name: 'Alpha', eventTypes: [] };
const beta: WebhookSubscription = {
  id: 's2',
  name: 'Beta',
  eventTypes: [],
  lastError: 'timeout',
};
const subs = [beta, alpha];

async function renderSearch(
  overrides: {
    list?: WebhookSubscription[];
    editResult?: boolean;
    confirmDelete?: boolean;
    permissions?: SystemPermission[];
  } = {},
) {
  const {
    list = subs,
    editResult = undefined,
    confirmDelete = false,
    permissions = [
      SystemPermission.ViewWebhookSubscriptions,
      SystemPermission.ManageWebhookSubscriptions,
    ],
  } = overrides;
  const getAllWebhooks = vi.fn(() => of(structuredClone(list)));
  const deleteWebhookSubscription = vi.fn(() => of(undefined));
  const editSubscription = vi.fn(() => of(editResult));
  const confirm = vi.fn(
    () => dialogRefStub<unknown, boolean>(confirmDelete).dialogRef,
  );

  const rendered = await renderComponent(AppAdminSubscriptionSearchComponent, {
    declarations: [AppAdminSubscriptionSearchComponent],
    imports: [
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatTooltipModule,
      MatButtonModule,
      MatTableModule,
      MatSortModule,
    ],
    providers: [
      ...permissionDataProviders({ system: permissions }),
      {
        provide: WebhookService,
        useValue: {
          getAllWebhooks,
          deleteWebhookSubscription,
        } satisfies ApiStub<WebhookService>,
      },
      {
        provide: DialogService,
        useValue: { editSubscription } satisfies Pick<
          DialogService,
          'editSubscription'
        >,
      },
      {
        provide: CrucibleDialogService,
        useValue: { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>,
      },
    ],
  });

  return {
    ...rendered,
    getAllWebhooks,
    deleteWebhookSubscription,
    editSubscription,
    confirm,
  };
}

/** Subscription names listed in the table, in render order. */
function listedSubscriptions(container: Element): string[] {
  return Array.from(container.querySelectorAll('mat-cell.mat-column-name')).map(
    (cell) => cell.textContent?.trim() ?? '',
  );
}

/** The Edit or Delete button on a subscription's row. */
function rowButton(
  container: Element,
  name: string,
  title: 'Edit Subscription' | 'Delete Subscription',
): HTMLButtonElement {
  const row = Array.from(container.querySelectorAll('mat-row')).find(
    (r) =>
      r.querySelector('mat-cell.mat-column-name')?.textContent?.trim() === name,
  );
  const button = row?.querySelector<HTMLButtonElement>(
    `button[title="${title}"]`,
  );
  if (!button) {
    throw new Error(`No ${title} button on the ${name} row`);
  }
  return button;
}

/** The Add a new Subscription header button (matTooltip only). */
function addButton(
  fixture: ComponentFixture<AppAdminSubscriptionSearchComponent>,
): HTMLButtonElement | null {
  const button = fixture.debugElement
    .queryAll(By.directive(MatTooltip))
    .find(
      (el) => el.injector.get(MatTooltip).message === 'Add a new Subscription',
    );
  return (button?.nativeElement as HTMLButtonElement) ?? null;
}

describe('AppAdminSubscriptionSearchComponent', () => {
  /**
   * Verifies: the subscriptions load into the table, sorted by name, with their event types and last error.
   * Interacts with: WebhookService.getAllWebhooks; the rendered table.
   * Data: Beta (last error 'timeout') and Alpha, in that order.
   */
  it('lists the subscriptions sorted by name', async () => {
    const { container } = await renderSearch();
    expect(listedSubscriptions(container)).toEqual(['Alpha', 'Beta']);
    expect(screen.getByText('timeout')).toBeInTheDocument();
  });

  /**
   * Verifies: typing in Search lists only matching subscriptions, case-insensitively, and Clear Search lists all again.
   * Interacts with: the rendered Search input and Clear Search button; the table.
   * Data: 'BET' typed.
   */
  it('filters by the typed text and clears the filter', async () => {
    const user = userEvent.setup();
    const { container } = await renderSearch();
    const search = screen.getByPlaceholderText('Search');
    search.focus();
    await user.type(search, 'BET', { skipClick: true });
    expect(listedSubscriptions(container)).toEqual(['Beta']);
    await user.click(screen.getByTitle('Clear Search'));
    expect(listedSubscriptions(container)).toEqual(['Alpha', 'Beta']);
  });

  /**
   * Verifies: Add opens the subscription dialog with no subscription and reloads the list when it closes.
   * Interacts with: the Add button; DialogService.editSubscription; WebhookService.getAllWebhooks.
   * Data: the reload returns a third subscription, Gamma.
   */
  it('adds a subscription in the dialog and reloads the list', async () => {
    const user = userEvent.setup();
    const { container, fixture, editSubscription, getAllWebhooks } =
      await renderSearch();
    getAllWebhooks.mockReturnValue(
      of([...subs, { id: 's3', name: 'Gamma', eventTypes: [] }]),
    );
    await user.click(addButton(fixture)!);
    expect(editSubscription).toHaveBeenCalledExactlyOnceWith();
    expect(listedSubscriptions(container)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  /**
   * Verifies: a row's Edit opens the dialog with that subscription and reloads the list when it closes without error.
   * Interacts with: the row's Edit button; DialogService.editSubscription (closes with no error); WebhookService.getAllWebhooks.
   * Data: Alpha edited; the reload returns Alpha renamed to Alpha 2.
   */
  it('edits a subscription in the dialog and reloads the list', async () => {
    const user = userEvent.setup();
    const { container, editSubscription, getAllWebhooks } = await renderSearch({
      editResult: false,
    });
    getAllWebhooks.mockReturnValue(of([{ ...alpha, name: 'Alpha 2' }, beta]));
    await user.click(rowButton(container, 'Alpha', 'Edit Subscription'));
    expect(editSubscription).toHaveBeenCalledExactlyOnceWith(alpha);
    expect(listedSubscriptions(container)).toEqual(['Alpha 2', 'Beta']);
  });

  /**
   * Verifies: when the edit dialog reports an error, the list is not reloaded and the error is logged.
   * Interacts with: the row's Edit button; DialogService.editSubscription (closes with true); console.log;
   *   WebhookService.getAllWebhooks.
   * Data: editResult true.
   */
  it('keeps the list when the edit dialog reports an error', async () => {
    const user = userEvent.setup();
    const logged = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { container, getAllWebhooks } = await renderSearch({
      editResult: true,
    });
    await user.click(rowButton(container, 'Alpha', 'Edit Subscription'));
    expect(logged.mock.calls).toEqual([
      ['Error editing/creating subscription'],
    ]);
    expect(getAllWebhooks).toHaveBeenCalledTimes(1);
  });

  /**
   * Verifies: a confirmed Delete prompts with the subscription's name, deletes it by id and reloads the list.
   * Interacts with: the row's Delete button; CrucibleDialogService.confirm; WebhookService.deleteWebhookSubscription
   *   and getAllWebhooks.
   * Data: confirmDelete true; Alpha (s1) deleted; the reload returns Beta only.
   */
  it('deletes a subscription after confirmation and reloads the list', async () => {
    const user = userEvent.setup();
    const { container, confirm, deleteWebhookSubscription, getAllWebhooks } =
      await renderSearch({ confirmDelete: true });
    getAllWebhooks.mockReturnValue(of([beta]));
    await user.click(rowButton(container, 'Alpha', 'Delete Subscription'));
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Confirm Delete',
        message: 'Are you sure you want to delete Alpha?',
      }),
    );
    expect(deleteWebhookSubscription).toHaveBeenCalledExactlyOnceWith('s1');
    expect(listedSubscriptions(container)).toEqual(['Beta']);
  });

  /**
   * Verifies: a declined Delete deletes nothing and keeps the row.
   * Interacts with: the row's Delete button; CrucibleDialogService.confirm; WebhookService.deleteWebhookSubscription.
   * Data: confirmDelete false.
   */
  it('keeps the subscription when the deletion is declined', async () => {
    const user = userEvent.setup();
    const { container, deleteWebhookSubscription } = await renderSearch({
      confirmDelete: false,
    });
    await user.click(rowButton(container, 'Alpha', 'Delete Subscription'));
    expect(deleteWebhookSubscription).not.toHaveBeenCalled();
    expect(listedSubscriptions(container)).toEqual(['Alpha', 'Beta']);
  });

  /**
   * Verifies: a user who holds only ViewWebhookSubscriptions (the section's gate) is offered Add, Edit and Delete
   *   (current behavior).
   * Interacts with: the rendered header and row buttons; the real UserPermissionsService over stubbed permission endpoints.
   * Data: system permissions [ViewWebhookSubscriptions].
   */
  it('offers Add, Edit and Delete to a user with only ViewWebhookSubscriptions', async () => {
    const { container, fixture } = await renderSearch({
      permissions: [SystemPermission.ViewWebhookSubscriptions],
    });
    // Current behavior; see agent-docs/ui-test-bugs/player.ui.md.
    expect(addButton(fixture)).toBeInTheDocument();
    expect(
      rowButton(container, 'Alpha', 'Edit Subscription'),
    ).toBeInTheDocument();
    expect(
      rowButton(container, 'Alpha', 'Delete Subscription'),
    ).toBeInTheDocument();
  });
});
