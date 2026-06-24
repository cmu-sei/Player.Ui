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
  it('creates the component', async () => {
    const { fixture } = await renderSearch();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads subscriptions into the data source on init', async () => {
    const { fixture, getAllWebhooks } = await renderSearch();
    expect(getAllWebhooks).toHaveBeenCalled();
    expect(fixture.componentInstance.dataSource.data).toEqual(subs);
  });

  it('applyFilter lowercases and trims the filter', async () => {
    const { fixture } = await renderSearch();
    fixture.componentInstance.applyFilter('  ALPHA  ');
    expect(fixture.componentInstance.filterStr).toBe('alpha');
    expect(fixture.componentInstance.dataSource.filter).toBe('alpha');
  });

  it('clearFilter resets the filter to empty', async () => {
    const { fixture } = await renderSearch();
    fixture.componentInstance.applyFilter('alpha');
    fixture.componentInstance.clearFilter();
    expect(fixture.componentInstance.filterStr).toBe('');
  });

  it('addNewSubscription opens the edit dialog then reloads', async () => {
    const { fixture, editSubscription, getAllWebhooks } = await renderSearch();
    fixture.componentInstance.addNewSubscription();
    expect(editSubscription).toHaveBeenCalledWith();
    // ngOnInit + addNewSubscription reload = 2
    expect(getAllWebhooks).toHaveBeenCalledTimes(2);
  });

  it('editSubscription(sub) opens the edit dialog with the given subscription', async () => {
    const { fixture, editSubscription, getAllWebhooks } = await renderSearch();
    fixture.componentInstance.editSubscription(subs[0]);
    expect(editSubscription).toHaveBeenCalledWith(subs[0]);
    expect(getAllWebhooks).toHaveBeenCalledTimes(2);
  });

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

    it('does nothing when the user cancels', async () => {
      const { fixture, deleteWebhookSubscription } = await renderSearch({
        confirmDelete: false,
      });
      fixture.componentInstance.deleteSubscription(subs[0]);
      expect(deleteWebhookSubscription).not.toHaveBeenCalled();
    });
  });

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
