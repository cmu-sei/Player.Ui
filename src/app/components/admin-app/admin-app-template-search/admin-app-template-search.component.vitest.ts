// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { ApplicationTemplate } from '../../../generated/player-api';
import { ApplicationService } from '../../../generated/player-api/api/application.service';
import { AdminAppTemplateSearchComponent } from './admin-app-template-search.component';
import { renderComponent } from '../../../test-utils/render-component';

const sample: ApplicationTemplate[] = [
  {
    id: 't1',
    name: 'Alpha',
    url: 'https://alpha.test',
    embeddable: true,
    icon: 'assets/img/player.png',
    loadInBackground: false,
  },
  {
    id: 't2',
    name: 'Beta',
    url: 'https://beta.test',
    embeddable: false,
    icon: 'assets/img/player.png',
    loadInBackground: false,
  },
];

async function renderSearch(
  overrides: { templates?: ApplicationTemplate[] } = {},
) {
  const { templates = sample } = overrides;

  const getApplicationTemplates = vi.fn(() => of(templates));
  const createApplicationTemplate = vi.fn((t: ApplicationTemplate) =>
    of({ ...t, id: 'new-id' }),
  );

  const rendered = await renderComponent(AdminAppTemplateSearchComponent, {
    declarations: [AdminAppTemplateSearchComponent],
    imports: [
      MatTableModule,
      MatSortModule,
      MatPaginatorModule,
      MatCheckboxModule,
      MatIconModule,
      MatBadgeModule,
    ],
    providers: [
      {
        provide: ApplicationService,
        useValue: { getApplicationTemplates, createApplicationTemplate },
      },
    ],
  });

  return { ...rendered, getApplicationTemplates, createApplicationTemplate };
}

describe('AdminAppTemplateSearchComponent', () => {
  it('creates the component', async () => {
    const { fixture } = await renderSearch();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads templates on init and populates the data source', async () => {
    const { fixture, getApplicationTemplates } = await renderSearch();
    expect(getApplicationTemplates).toHaveBeenCalled();
    expect(fixture.componentInstance.appTemplateDataSource.data).toEqual(
      sample,
    );
  });

  it('shows "No Application Templates found" when the list is empty', async () => {
    await renderSearch({ templates: [] });
    expect(
      await screen.findByText(/No Application Templates found/),
    ).toBeInTheDocument();
  });

  it('filters the data source when applyFilter is called', async () => {
    const { fixture } = await renderSearch();
    fixture.componentInstance.applyFilter('alpha');
    expect(fixture.componentInstance.appTemplateDataSource.filter).toBe(
      'alpha',
    );
    expect(fixture.componentInstance.filterString).toBe('alpha');
  });

  it('clearFilter resets the filter to empty', async () => {
    const { fixture } = await renderSearch();
    fixture.componentInstance.applyFilter('beta');
    fixture.componentInstance.clearFilter();
    expect(fixture.componentInstance.filterString).toBe('');
    expect(fixture.componentInstance.appTemplateDataSource.filter).toBe('');
  });

  it('isAllSelected is true when every filtered row is selected', async () => {
    const { fixture } = await renderSearch();
    const c = fixture.componentInstance;
    sample.forEach((t) => c.selection.select(t.id));
    expect(c.isAllSelected()).toBe(true);
  });

  it('toggleAllRows selects all when none are selected, then clears on second call', async () => {
    const { fixture } = await renderSearch();
    const c = fixture.componentInstance;
    c.toggleAllRows();
    expect(c.selection.selected).toHaveLength(sample.length);
    c.toggleAllRows();
    expect(c.selection.selected).toHaveLength(0);
  });

  it('addAppTemplate creates a new template and reloads the data source', async () => {
    const { fixture, createApplicationTemplate, getApplicationTemplates } =
      await renderSearch();
    fixture.componentInstance.addAppTemplate();
    expect(createApplicationTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New Template' }),
    );
    // Initial load + reload after create.
    expect(getApplicationTemplates.mock.calls.length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it('refresh(true) clears the currentAppTemplate', async () => {
    const { fixture } = await renderSearch();
    fixture.componentInstance.currentAppTemplate = sample[0];
    fixture.componentInstance.refresh(true);
    expect(fixture.componentInstance.currentAppTemplate).toBeUndefined();
  });
});
