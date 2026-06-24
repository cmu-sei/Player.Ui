// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { ImportViewsResult } from '../../../generated/player-api';
import { ViewsService } from '../../../services/views/views.service';
import { AdminAppViewImportComponent } from './admin-app-view-import.component';
import { renderComponent } from '../../../test-utils/render-component';

async function renderImport(
  overrides: { result?: ImportViewsResult } = {},
) {
  const { result = { failures: [] } as ImportViewsResult } = overrides;

  const importFn = vi.fn(() => of(result));

  const rendered = await renderComponent(AdminAppViewImportComponent, {
    declarations: [AdminAppViewImportComponent],
    providers: [
      { provide: ViewsService, useValue: { import: importFn } },
    ],
  });

  return { ...rendered, importFn };
}

describe('AdminAppViewImportComponent', () => {
  /**
   * Verifies: the component instantiates without error.
   * Interacts with: ViewsService.import stub.
   * Data: default render (no failures result).
   */
  it('creates the component', async () => {
    const { fixture } = await renderImport();
    expect(fixture.componentInstance).toBeTruthy();
  });

  /**
   * Verifies: the Import button is disabled until a file is chosen.
   * Interacts with: rendered DOM via screen.getByRole.
   * Data: default render (no archive set).
   */
  it('disables Import until an archive is chosen', async () => {
    await renderImport();
    expect(screen.getByRole('button', { name: /^Import$/ })).toBeDisabled();
  });

  /**
   * Verifies: patching an archive into the form enables the Import button.
   * Interacts with: component.form patchValue; rendered DOM.
   * Data: a zip Blob set as the archive control.
   */
  it('enables Import once an archive is set', async () => {
    const { fixture } = await renderImport();
    fixture.componentInstance.form.patchValue({
      archive: new Blob(['x'], { type: 'application/zip' }),
    });
    fixture.detectChanges();
    expect(
      screen.getByRole('button', { name: /^Import$/ }),
    ).not.toBeDisabled();
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
   * Interacts with: ViewsService.import spy; userEvent click.
   * Data: archive Blob with matchApplicationTemplatesByName and matchRolesByName true.
   */
  it('calls ViewsService.import with the form values', async () => {
    const user = userEvent.setup();
    const { fixture, importFn } = await renderImport();
    const archive = new Blob(['x'], { type: 'application/zip' });
    fixture.componentInstance.form.patchValue({
      archive,
      matchApplicationTemplatesByName: true,
      matchRolesByName: true,
    });
    fixture.detectChanges();
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
    fixture.componentInstance.form.patchValue({
      archive: new Blob(['x']),
    });
    fixture.detectChanges();
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
    fixture.componentInstance.form.patchValue({
      archive: new Blob(['x']),
    });
    fixture.detectChanges();
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
   * Verifies: onFileSelected pulls the chosen File off the input event and
   *   stores it as the form's archive.
   * Interacts with: component.onFileSelected with a synthetic change event.
   * Data: a File built from event.target.files[0].
   * Why: the Event is hand-built (cast through unknown) since jsdom file inputs
   *      cannot be populated programmatically.
   */
  it('onFileSelected captures the file from the input event', async () => {
    const { fixture } = await renderImport();
    const file = new File(['x'], 'views.zip');
    fixture.componentInstance.onFileSelected({
      target: { files: [file] },
    } as unknown as Event);
    expect(fixture.componentInstance.form.value.archive).toBe(file);
  });
});
