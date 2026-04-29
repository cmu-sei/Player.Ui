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
  overrides: { list?: WebhookSubscription[] } = {},
) {
  const { list = subs } = overrides;
  const getAllWebhooks = vi.fn(() => of(list));
  const editSubscription = vi.fn(() => of(undefined));

  const rendered = await renderComponent(
    AppAdminSubscriptionSearchComponent,
    {
      declarations: [AppAdminSubscriptionSearchComponent],
      imports: [MatTableModule, MatSortModule],
      providers: [
        { provide: WebhookService, useValue: { getAllWebhooks } },
        { provide: DialogService, useValue: { editSubscription } },
      ],
    },
  );

  return { ...rendered, getAllWebhooks, editSubscription };
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
