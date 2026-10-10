// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import {
  Component,
  EventEmitter,
  getDebugNode,
  Input,
  Output,
} from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';
import {
  ApplicationTemplate,
  SystemPermission,
} from '../../../generated/player-api';
import { ApplicationService } from '../../../generated/player-api/api/application.service';
import { AdminAppTemplateSearchComponent } from './admin-app-template-search.component';
import { renderComponent } from '../../../test-utils/render-component';
import { permissionDataProviders } from '../../../test-utils/mock-permission-data.service';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { ApiStub } from '../../../test-utils/api-stub';

const alpha: ApplicationTemplate = {
  id: 't1',
  name: 'Alpha',
  url: 'https://alpha.test',
  embeddable: true,
  icon: 'assets/img/player.png',
  loadInBackground: false,
};
const beta: ApplicationTemplate = {
  id: 't2',
  name: 'Beta',
  url: 'https://beta.test',
  embeddable: false,
  icon: 'assets/img/player.png',
  loadInBackground: false,
};

@Component({ selector: 'app-admin-template-details', template: '' })
class AdminTemplateDetailsStubComponent {
  @Input() appTemplate!: ApplicationTemplate;
  @Output() refresh = new EventEmitter<boolean>();
}

@Component({ selector: 'app-admin-app-template-export', template: '' })
class TemplateExportStubComponent {
  @Input() ids!: string[];
  @Output() complete = new EventEmitter<boolean>();
}

@Component({ selector: 'app-admin-app-template-import', template: '' })
class TemplateImportStubComponent {
  @Output() complete = new EventEmitter<boolean>();
}

async function renderSearch(
  overrides: {
    templates?: ApplicationTemplate[];
    permissions?: SystemPermission[];
  } = {},
) {
  const {
    templates = [beta, alpha],
    permissions = [
      SystemPermission.ViewApplications,
      SystemPermission.ManageApplications,
    ],
  } = overrides;

  const getApplicationTemplates = vi.fn(() => of(structuredClone(templates)));
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
      MatDialogModule,
      AdminTemplateDetailsStubComponent,
      TemplateExportStubComponent,
      TemplateImportStubComponent,
    ],
    providers: [
      ...permissionDataProviders({ system: permissions }),
      {
        provide: ApplicationService,
        useValue: {
          getApplicationTemplates,
          createApplicationTemplate,
        } satisfies ApiStub<ApplicationService>,
      },
    ],
  });

  return { ...rendered, getApplicationTemplates, createApplicationTemplate };
}

/** Template names listed in the table, in render order. */
function listedTemplates(container: Element): string[] {
  return Array.from(container.querySelectorAll('mat-cell.mat-column-name')).map(
    (cell) => cell.textContent?.trim() ?? '',
  );
}

/** The header button whose matTooltip carries the message. */
function tooltipButton(
  fixture: ComponentFixture<AdminAppTemplateSearchComponent>,
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

/** aria-expanded of each row's URL panel, in render order. */
function expandedPanels(container: Element): (string | null)[] {
  return Array.from(
    container.querySelectorAll('mat-expansion-panel-header'),
  ).map((header) => header.getAttribute('aria-expanded'));
}

describe('AdminAppTemplateSearchComponent', () => {
  /**
   * Verifies: the loaded templates are listed by name, sorted, each with its URL as the panel title.
   * Interacts with: ApplicationService.getApplicationTemplates; the rendered table.
   * Data: Beta and Alpha, in that order.
   */
  it('lists the templates sorted by name with their URLs', async () => {
    const { container } = await renderSearch();
    expect(listedTemplates(container)).toEqual(['Alpha', 'Beta']);
    expect(screen.getByText('https://alpha.test')).toBeInTheDocument();
    expect(screen.getByText('https://beta.test')).toBeInTheDocument();
  });

  /**
   * Verifies: an empty template list renders the empty-state message.
   * Interacts with: ApplicationService.getApplicationTemplates stub; rendered DOM.
   * Data: no templates.
   */
  it('shows "No Application Templates found" when the list is empty', async () => {
    await renderSearch({ templates: [] });
    expect(
      screen.getByText('No Application Templates found'),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: typing in Search lists only matching templates, case-insensitively, and Clear Search lists all again.
   * Interacts with: the rendered Search input and Clear Search button; the table.
   * Data: 'ALP' typed.
   */
  it('filters by the typed text and clears the filter', async () => {
    const user = userEvent.setup();
    const { container } = await renderSearch();
    const search = screen.getByPlaceholderText('Search');
    search.focus();
    await user.type(search, 'ALP', { skipClick: true });
    expect(listedTemplates(container)).toEqual(['Alpha']);
    expect(search).toHaveValue('ALP');
    await user.click(screen.getByTitle('Clear Search'));
    expect(listedTemplates(container)).toEqual(['Alpha', 'Beta']);
    expect(search).toHaveValue('');
  });

  /**
   * Verifies: the header checkbox selects every row (the Export badge counts them) and a second click clears the
   *   selection.
   * Interacts with: the rendered header and row checkboxes; the Export button's badge.
   * Data: two templates.
   */
  it('selects and clears every row from the header checkbox', async () => {
    const user = userEvent.setup();
    const { container } = await renderSearch();
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
  });

  /**
   * Verifies: Export opens the export dialog with the selected template ids, and its complete output closes it.
   * Interacts with: a row checkbox; the Export button; the real MatDialog; the export dialog stub.
   * Data: Beta's row selected.
   */
  it('exports the selected templates in a dialog', async () => {
    const user = userEvent.setup();
    const { container, fixture } = await renderSearch();
    const [, , betaBox] = Array.from(
      container.querySelectorAll<HTMLInputElement>('mat-checkbox input'),
    );
    await user.click(betaBox);
    await user.click(tooltipButton(fixture, 'Export Application Templates')!);
    const dialog = dialogStub<TemplateExportStubComponent>(
      'app-admin-app-template-export',
    );
    expect(dialog.ids).toEqual(['t2']);
    dialog.complete.emit(true);
    await fixture.whenStable();
    expect(document.querySelector('app-admin-app-template-export')).toBeNull();
  });

  /**
   * Verifies: Import opens the import dialog, and its complete output closes it and reloads the list.
   * Interacts with: the Import button; the real MatDialog; the import dialog stub; ApplicationService.getApplicationTemplates.
   * Data: the reload after the import returns a third template, Gamma.
   */
  it('imports in a dialog and reloads the list', async () => {
    const user = userEvent.setup();
    const { container, fixture, getApplicationTemplates } =
      await renderSearch();
    await user.click(tooltipButton(fixture, 'Import Application Templates')!);
    getApplicationTemplates.mockReturnValue(
      of([alpha, beta, { ...beta, id: 't3', name: 'Gamma' }]),
    );
    dialogStub<TemplateImportStubComponent>(
      'app-admin-app-template-import',
    ).complete.emit(true);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(document.querySelector('app-admin-app-template-import')).toBeNull();
    expect(listedTemplates(container)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  /**
   * Verifies: Add creates a "New Template", reloads the list, and opens the new template's panel.
   * Interacts with: the Add button; ApplicationService.createApplicationTemplate and getApplicationTemplates.
   * Data: the reload returns Alpha, Beta and the created template.
   */
  it('adds a new template and opens it', async () => {
    const user = userEvent.setup();
    const {
      container,
      fixture,
      createApplicationTemplate,
      getApplicationTemplates,
    } = await renderSearch();
    const created = {
      ...alpha,
      id: 'new-id',
      name: 'New Template',
      url: 'http://localhost',
    };
    getApplicationTemplates.mockReturnValue(of([alpha, beta, created]));
    await user.click(tooltipButton(fixture, 'Add a new Application Template')!);
    expect(createApplicationTemplate).toHaveBeenCalledExactlyOnceWith({
      name: 'New Template',
      url: 'http://localhost',
      embeddable: true,
      icon: 'assets/img/player.png',
      loadInBackground: false,
    });
    expect(listedTemplates(container)).toEqual([
      'Alpha',
      'Beta',
      'New Template',
    ]);
    expect(expandedPanels(container)).toEqual(['false', 'false', 'true']);
  });

  /**
   * Verifies: a details panel reporting a deletion reloads the list without the deleted template, and the remaining
   *   panel stays closed.
   * Interacts with: the details stub's refresh output; ApplicationService.getApplicationTemplates.
   * Data: Alpha's panel opened by the user, then deleted (the reload returns Beta only).
   */
  it('reloads the list after a template is deleted', async () => {
    const user = userEvent.setup();
    const { container, fixture, getApplicationTemplates } =
      await renderSearch();
    await user.click(screen.getByText('https://alpha.test'));
    expect(expandedPanels(container)).toEqual(['true', 'false']);
    getApplicationTemplates.mockReturnValue(of([beta]));
    const [alphaDetails] = fixture.debugElement
      .queryAll(By.directive(AdminTemplateDetailsStubComponent))
      .map((de) => de.componentInstance as AdminTemplateDetailsStubComponent);
    alphaDetails.refresh.emit(true);
    fixture.detectChanges();
    expect(listedTemplates(container)).toEqual(['Beta']);
    expect(expandedPanels(container)).toEqual(['false']);
  });

  /**
   * Verifies: a user who holds only ViewApplications (the section's gate) is offered Add and Import (current behavior).
   * Interacts with: the rendered header buttons; the real UserPermissionsService over stubbed permission endpoints.
   * Data: system permissions [ViewApplications].
   */
  it('offers Add and Import to a user with only ViewApplications', async () => {
    const { fixture } = await renderSearch({
      permissions: [SystemPermission.ViewApplications],
    });
    // Current behavior; see agent-docs/ui-test-bugs/player.ui.md.
    expect(
      tooltipButton(fixture, 'Add a new Application Template'),
    ).toBeInTheDocument();
    expect(
      tooltipButton(fixture, 'Import Application Templates'),
    ).toBeInTheDocument();
  });
});
