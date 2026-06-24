// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import {
  WebhookService,
  WebhookSubscription,
} from '../../../generated/player-api';
import { DialogService } from '../../../services/dialog/dialog.service';
import { AppAdminSubscriptionSearchComponent } from './app-admin-subscription-search.component';
import { renderComponent } from '../../../test-utils/render-component';

const subs: WebhookSubscription[] = [
  { id: 's1', name: 'Alpha', eventTypes: [] },
  { id: 's2', name: 'Beta', eventTypes: [] },
];

async function renderSearch(
  overrides: {
    list?: WebhookSubscription[];
    editResult?: unknown;
    confirmDelete?: boolean;
  } = {},
) {
  const { list = subs, editResult = undefined, confirmDelete = false } =
    overrides;
  const getAllWebhooks = vi.fn(() => of(list));
  const deleteWebhookSubscription = vi.fn(() => of(undefined));
  const editSubscription = vi.fn(() => of(editResult));
  const confirm = vi.fn(() => of({ confirm: confirmDelete }));

  const rendered = await renderComponent(
    AppAdminSubscriptionSearchComponent,
    {
      declarations: [AppAdminSubscriptionSearchComponent],
      imports: [MatTableModule, MatSortModule],
      providers: [
        {
          provide: WebhookService,
          useValue: { getAllWebhooks, deleteWebhookSubscription },
        },
        { provide: DialogService, useValue: { editSubscription, confirm } },
      ],
    },
  );

  return {
    ...rendered,
    getAllWebhooks,
    deleteWebhookSubscription,
    editSubscription,
    confirm,
  };
}

describe('AppAdminSubscriptionSearchComponent', () => {
  /**
   * Verifies: the subscription-search component instantiates successfully.
   * Interacts with: renderComponent with stubbed WebhookService and DialogService.
   * Data: default subs list (Alpha, Beta).
   */
  it('creates the component', async () => {
    const { fixture } = await renderSearch();
    expect(fixture.componentInstance).toBeTruthy();
  });

  /**
   * Verifies: ngOnInit loads all webhook subscriptions into the table datasource.
   * Interacts with: stubbed WebhookService.getAllWebhooks.
   * Data: default subs list.
   */
  it('loads subscriptions into the data source on init', async () => {
    const { fixture, getAllWebhooks } = await renderSearch();
    expect(getAllWebhooks).toHaveBeenCalled();
    expect(fixture.componentInstance.dataSource.data).toEqual(subs);
  });

  /**
   * Verifies: applyFilter lowercases and trims the value into filterStr and the datasource filter.
   * Interacts with: component.applyFilter and the MatTableDataSource filter.
   * Data: padded mixed-case input '  ALPHA  '.
   */
  it('applyFilter lowercases and trims the filter', async () => {
    const { fixture } = await renderSearch();
    fixture.componentInstance.applyFilter('  ALPHA  ');
    expect(fixture.componentInstance.filterStr).toBe('alpha');
    expect(fixture.componentInstance.dataSource.filter).toBe('alpha');
  });

  /**
   * Verifies: clearFilter empties filterStr.
   * Interacts with: component.applyFilter / clearFilter.
   * Data: an 'alpha' filter set then cleared.
   */
  it('clearFilter resets the filter to empty', async () => {
    const { fixture } = await renderSearch();
    fixture.componentInstance.applyFilter('alpha');
    fixture.componentInstance.clearFilter();
    expect(fixture.componentInstance.filterStr).toBe('');
  });

  /**
   * Verifies: addNewSubscription opens the edit dialog with no argument and reloads the list.
   * Interacts with: stubbed DialogService.editSubscription and WebhookService.getAllWebhooks.
   * Data: default subs; getAllWebhooks called twice (init + reload).
   */
  it('addNewSubscription opens the edit dialog then reloads', async () => {
    const { fixture, editSubscription, getAllWebhooks } = await renderSearch();
    fixture.componentInstance.addNewSubscription();
    expect(editSubscription).toHaveBeenCalledWith();
    // ngOnInit + addNewSubscription reload = 2
    expect(getAllWebhooks).toHaveBeenCalledTimes(2);
  });

  /**
   * Verifies: editSubscription(sub) opens the edit dialog passing the subscription and reloads.
   * Interacts with: stubbed DialogService.editSubscription and WebhookService.getAllWebhooks.
   * Data: subs[0]; getAllWebhooks called twice.
   */
  it('editSubscription(sub) opens the edit dialog with the given subscription', async () => {
    const { fixture, editSubscription, getAllWebhooks } = await renderSearch();
    fixture.componentInstance.editSubscription(subs[0]);
    expect(editSubscription).toHaveBeenCalledWith(subs[0]);
    expect(getAllWebhooks).toHaveBeenCalledTimes(2);
  });

  /**
   * Verifies: when the edit dialog resolves truthy (error), the component logs and skips the reload.
   * Interacts with: DialogService.editSubscription (editResult=true), a console.log spy, getAllWebhooks.
   * Data: editResult override true; getAllWebhooks called only once (init).
   * Why: a truthy dialog result signals an error branch that bypasses refreshSubs.
   */
  it('editSubscription(sub) logs and does not reload when the dialog reports an error', async () => {
    const { fixture, getAllWebhooks } = await renderSearch({ editResult: true });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    fixture.componentInstance.editSubscription(subs[0]);
    expect(logSpy).toHaveBeenCalledWith('Error editing/creating subscription');
    // Only the ngOnInit load happened; the error branch skips refreshSubs.
    expect(getAllWebhooks).toHaveBeenCalledTimes(1);
    logSpy.mockRestore();
  });

  describe('deleteSubscription()', () => {
    /**
     * Verifies: a confirmed delete prompts (message naming the sub), deletes by id, and reloads.
     * Interacts with: stubbed DialogService.confirm, WebhookService.deleteWebhookSubscription, getAllWebhooks.
     * Data: confirmDelete=true; deleting subs[0] (Alpha, id s1).
     */
    it('deletes and reloads when the user confirms', async () => {
      const { fixture, deleteWebhookSubscription, confirm, getAllWebhooks } =
        await renderSearch({ confirmDelete: true });
      fixture.componentInstance.deleteSubscription(subs[0]);
      expect(confirm).toHaveBeenCalledWith(
        'Confirm Delete',
        expect.stringContaining('Alpha'),
      );
      expect(deleteWebhookSubscription).toHaveBeenCalledWith('s1');
      expect(getAllWebhooks).toHaveBeenCalledTimes(2);
    });

    /**
     * Verifies: a declined confirm leaves the delete call untouched.
     * Interacts with: stubbed DialogService.confirm and WebhookService.deleteWebhookSubscription.
     * Data: confirmDelete=false.
     */
    it('does nothing when the user cancels', async () => {
      const { fixture, deleteWebhookSubscription } = await renderSearch({
        confirmDelete: false,
      });
      fixture.componentInstance.deleteSubscription(subs[0]);
      expect(deleteWebhookSubscription).not.toHaveBeenCalled();
    });
  });

  /**
   * Verifies: ngOnDestroy completes the unsubscribe$ teardown subject.
   * Interacts with: a spy on the component's unsubscribe$ Subject.complete.
   * Data: none.
   */
  it('ngOnDestroy completes the unsubscribe subject', async () => {
    const { fixture } = await renderSearch();
    const completeSpy = vi.spyOn(
      fixture.componentInstance.unsubscribe$,
      'complete',
    );
    fixture.componentInstance.ngOnDestroy();
    expect(completeSpy).toHaveBeenCalled();
  });
});
