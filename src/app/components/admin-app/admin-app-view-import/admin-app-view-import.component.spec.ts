// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { of } from 'rxjs';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { ImportViewsResult, ViewService } from '../../../generated/player-api';
import { ApiStub } from '../../../test-utils/api-stub';
import { AdminAppViewImportComponent } from './admin-app-view-import.component';
import { renderComponent } from '../../../test-utils/render-component';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { ComponentFixture } from '@angular/core/testing';

async function renderImport(overrides: { result?: ImportViewsResult } = {}) {
  const { result = { failures: [] } as ImportViewsResult } = overrides;

  // The real ViewsService.import (a default provider) forwards to this.
  const importFn = vi.fn(
    (_byName: boolean, _rolesByName: boolean, _archive?: Blob) =>
      of(structuredClone(result)),
  );

  const rendered = await renderComponent(AdminAppViewImportComponent, {
    declarations: [AdminAppViewImportComponent],
    imports: [
      MatSlideToggleModule,
      MatTooltipModule,
      MatButtonModule,
      ...CRUCIBLE_DIALOG_IMPORTS,
    ],
    providers: [
      {
        provide: ViewService,
        useValue: { importViews: importFn } satisfies ApiStub<ViewService>,
      },
    ],
  });

  return { ...rendered, importFn };
}

function fileInput(
  fixture: ComponentFixture<AdminAppViewImportComponent>,
): HTMLInputElement {
  const root: HTMLElement = fixture.nativeElement;
  const input = root.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) {
    throw new Error('The file input was not rendered');
  }
  return input;
}

// The archive reaches the form through the file input's (change) handler, as
// it does in the app. user-event dispatches through Testing Library, which runs
// change detection afterwards. Patching the form from the test body would skip
// the handler the app relies on, and nothing would re-render the dialog until
// the test called fixture.detectChanges().
async function chooseArchive(
  user: UserEvent,
  fixture: ComponentFixture<AdminAppViewImportComponent>,
  file: File,
) {
  await user.upload(fileInput(fixture), file);
}

const archiveFile = () => new File(['x'], 'views.zip');

describe('AdminAppViewImportComponent', () => {
  /**
   * Verifies: the Import button is disabled until a file is chosen.
   * Interacts with: rendered DOM via screen.getByRole.
   * Data: default render (no archive set).
   */
  it('disables Import until an archive is chosen', async () => {
    await renderImport();
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: /^Import$/ })
        .disabled,
    ).toBe(true);
  });

  /**
   * Verifies: choosing a file through the file input enables the Import button.
   * Interacts with: the file input's (change) handler; rendered DOM.
   * Data: a views.zip File.
   */
  it('enables Import once an archive is chosen', async () => {
    const user = userEvent.setup();
    const { fixture } = await renderImport();
    await chooseArchive(user, fixture, archiveFile());
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: /^Import$/ })
        .disabled,
    ).toBe(false);
  });

  /**
   * Verifies: clicking Cancel emits complete(false) without importing.
   * Interacts with: component.complete output; userEvent click.
   * Data: default render.
   */
  it('emits complete=false when cancel is clicked', async () => {
    const user = userEvent.setup();
    const { fixture } = await renderImport();
    const spy = vi.fn();
    fixture.componentInstance.complete.subscribe(spy);
    await user.click(screen.getByRole('button', { name: /Cancel/ }));
    expect(spy).toHaveBeenCalledWith(false);
  });

  /**
   * Verifies: submitting forwards the two match-by-name flags and the archive
   *   (in that order) to the service.
   * Interacts with: ViewsService.import spy; the two match toggles; userEvent clicks.
   * Data: a views.zip File with both match-by-name toggles switched on.
   */
  it('calls ViewsService.import with the form values', async () => {
    const user = userEvent.setup();
    const { fixture, importFn } = await renderImport();
    const archive = archiveFile();
    await chooseArchive(user, fixture, archive);
    await user.click(
      screen.getByRole('switch', { name: 'Match Templates By Name' }),
    );
    await user.click(screen.getByRole('switch', { name: 'Match By Name' }));
    await user.click(screen.getByRole('button', { name: /^Import$/ }));
    expect(importFn).toHaveBeenCalledWith(true, true, archive);
  });

  /**
   * Verifies: a result with no failures renders the success message.
   * Interacts with: ViewsService.import stub; rendered DOM.
   * Data: result with empty failures array.
   */
  it('shows "Import Successful" on a clean result', async () => {
    const user = userEvent.setup();
    const { fixture } = await renderImport({ result: { failures: [] } });
    await chooseArchive(user, fixture, archiveFile());
    await user.click(screen.getByRole('button', { name: /^Import$/ }));
    expect(await screen.findByText(/Import Successful/)).toBeInTheDocument();
  });

  /**
   * Verifies: a result with failures renders the error heading plus each
   *   failure's name and reason.
   * Interacts with: ViewsService.import stub; rendered DOM.
   * Data: result with two failures (name + reason each).
   */
  it('lists each failure when the result reports errors', async () => {
    const user = userEvent.setup();
    const { fixture } = await renderImport({
      result: {
        failures: [
          { id: 'id-a', name: 'View A', reason: 'duplicate' },
          { id: 'id-b', name: 'View B', reason: 'invalid' },
        ],
      },
    });
    await chooseArchive(user, fixture, archiveFile());
    await user.click(screen.getByRole('button', { name: /^Import$/ }));
    expect(
      await screen.findByText(/The following errors occurred/),
    ).toBeInTheDocument();
    expect(screen.getByText(/View A/)).toBeInTheDocument();
    expect(screen.getByText(/duplicate/)).toBeInTheDocument();
    expect(screen.getByText(/View B/)).toBeInTheDocument();
    expect(screen.getByText(/invalid/)).toBeInTheDocument();
  });

  /**
   * Verifies: a change event on the rendered file input stores the chosen File
   *   as the form's archive and shows its name.
   * Interacts with: the template's (change)="onFileSelected($event)" binding on the hidden file input.
   * Data: a views.zip File exposed through the input's files list.
   */
  it('captures the file from the file input change event', async () => {
    const user = userEvent.setup();
    const { fixture } = await renderImport();
    const file = archiveFile();
    await chooseArchive(user, fixture, file);
    expect(fixture.componentInstance.form.value.archive).toBe(file);
    expect(screen.getByText('views.zip')).toBeInTheDocument();
  });
});
