// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, EventEmitter, Output, input } from '@angular/core';
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
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';

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

@Component({ selector: 'app-admin-template-details', template: '' })
class AdminTemplateDetailsStubComponent {
  readonly appTemplate = input<ApplicationTemplate>();
  @Output() refresh = new EventEmitter<boolean>();
}

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
      MatExpansionModule,
      MatFormFieldModule,
      MatInputModule,
      MatTooltipModule,
      MatButtonModule,
      MatTableModule,
      MatSortModule,
      MatPaginatorModule,
      MatCheckboxModule,
      MatIconModule,
      MatBadgeModule,
      AdminTemplateDetailsStubComponent,
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
  /**
   * Verifies: init calls getApplicationTemplates and loads them into the table
   *   data source.
   * Interacts with: ApplicationService.getApplicationTemplates spy;
   *   component.appTemplateDataSource.
   * Data: default sample (two templates).
   */
  it('loads templates on init and populates the data source', async () => {
    const { fixture, getApplicationTemplates } = await renderSearch();
    expect(getApplicationTemplates).toHaveBeenCalled();
    expect(fixture.componentInstance.appTemplateDataSource.data).toEqual(
      sample,
    );
  });

  /**
   * Verifies: an empty template list renders the empty-state message.
   * Interacts with: ApplicationService.getApplicationTemplates stub; rendered DOM.
   * Data: templates override = [] (empty).
   */
  it('shows "No Application Templates found" when the list is empty', async () => {
    await renderSearch({ templates: [] });
    expect(
      await screen.findByText(/No Application Templates found/),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: applyFilter lowercases the term for the data source while keeping the bound filterString
   *   exactly as the user typed it.
   * Interacts with: component.applyFilter; appTemplateDataSource.filter; component.filterString.
   * Data: mixed-case filter term 'AlPhA'.
   * Why: MatTableDataSource only matches lowercase, so the toLowerCase() call is real behavior — an
   *   already-lowercase term satisfies both assertions with that call deleted.
   */
  it('filters the data source with a lowercased term and keeps the typed casing', async () => {
    const { fixture } = await renderSearch();
    fixture.componentInstance.applyFilter('AlPhA');
    expect(fixture.componentInstance.appTemplateDataSource.filter).toBe(
      'alpha',
    );
    expect(fixture.componentInstance.filterString).toBe('AlPhA');
  });

  /**
   * Verifies: clearFilter blanks both filterString and the data source filter
   *   after a prior filter.
   * Interacts with: component.applyFilter then clearFilter.
   * Data: initial filter 'beta', then cleared.
   */
  it('clearFilter resets the filter to empty', async () => {
    const { fixture } = await renderSearch();
    fixture.componentInstance.applyFilter('beta');
    fixture.componentInstance.clearFilter();
    expect(fixture.componentInstance.filterString).toBe('');
    expect(fixture.componentInstance.appTemplateDataSource.filter).toBe('');
  });

  /**
   * Verifies: isAllSelected returns true once every row id is in the selection.
   * Interacts with: component.selection model; isAllSelected.
   * Data: both sample template ids selected.
   */
  it('isAllSelected is true when every filtered row is selected', async () => {
    const { fixture } = await renderSearch();
    const c = fixture.componentInstance;
    sample.forEach((t) => c.selection.select(t.id));
    expect(c.isAllSelected()).toBe(true);
  });

  /**
   * Verifies: toggleAllRows selects every row when none are selected and clears
   *   the selection when invoked again.
   * Interacts with: component.toggleAllRows; selection model.
   * Data: default sample (two rows).
   */
  it('toggleAllRows selects all when none are selected, then clears on second call', async () => {
    const { fixture } = await renderSearch();
    const c = fixture.componentInstance;
    c.toggleAllRows();
    expect(c.selection.selected).toHaveLength(sample.length);
    c.toggleAllRows();
    expect(c.selection.selected).toHaveLength(0);
  });

  /**
   * Verifies: addAppTemplate posts a default-named template and refreshes the
   *   list afterward.
   * Interacts with: ApplicationService.createApplicationTemplate +
   *   getApplicationTemplates spies.
   * Data: default sample; created template named 'New Template'.
   * Why: asserts getApplicationTemplates called >=2 times (initial load + reload).
   */
  it('addAppTemplate creates a new template and reloads the data source', async () => {
    const { fixture, createApplicationTemplate, getApplicationTemplates } =
      await renderSearch();
    fixture.componentInstance.addAppTemplate();
    expect(createApplicationTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New Template' }),
    );
    // Initial load + reload after create.
    expect(getApplicationTemplates.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  /**
   * Verifies: refresh(true) clears the currently-selected template detail.
   * Interacts with: component.refresh; currentAppTemplate field.
   * Data: currentAppTemplate preset to the first sample, then refresh(true).
   */
  it('refresh(true) clears the currentAppTemplate', async () => {
    const { fixture } = await renderSearch();
    fixture.componentInstance.currentAppTemplate = sample[0];
    fixture.componentInstance.refresh(true);
    expect(fixture.componentInstance.currentAppTemplate).toBeUndefined();
  });
});
