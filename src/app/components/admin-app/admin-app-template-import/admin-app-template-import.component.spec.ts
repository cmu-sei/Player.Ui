// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import {
  ApplicationService,
  ImportApplicationTemplatesResult,
} from '../../../generated/player-api';
import { AdminAppTemplateImportComponent } from './admin-app-template-import.component';
import { renderComponent } from '../../../test-utils/render-component';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { ComponentFixture } from '@angular/core/testing';
import { fileList } from '../../../test-utils/file-list';

async function renderImport(
  overrides: {
    result?: ImportApplicationTemplatesResult;
  } = {},
) {
  const { result = { failures: [] } as ImportApplicationTemplatesResult } =
    overrides;

  const importApplicationTemplates = vi.fn(() => of(result));

  const rendered = await renderComponent(AdminAppTemplateImportComponent, {
    declarations: [AdminAppTemplateImportComponent],
    imports: [
      MatSlideToggleModule,
      MatTooltipModule,
      MatButtonModule,
      ...CRUCIBLE_DIALOG_IMPORTS,
    ],
    providers: [
      {
        provide: ApplicationService,
        useValue: { importApplicationTemplates },
      },
    ],
  });

  return { ...rendered, importApplicationTemplates };
}

function fileInput(
  fixture: ComponentFixture<AdminAppTemplateImportComponent>,
): HTMLInputElement {
  const root: HTMLElement = fixture.nativeElement;
  const input = root.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) {
    throw new Error('The file input was not rendered');
  }
  return input;
}

describe('AdminAppTemplateImportComponent', () => {
  /**
   * Verifies: the Import button is disabled until a file is chosen.
   * Interacts with: rendered DOM via screen.getByRole.
   * Data: default render (no archive set).
   */
  it('disables the Import button until an archive is chosen', async () => {
    await renderImport();
    const importBtn = screen.getByRole('button', { name: /^Import$/ });
    expect(importBtn).toBeDisabled();
  });

  /**
   * Verifies: patching an archive into the form enables the Import button.
   * Interacts with: component.form patchValue; rendered DOM.
   * Data: a zip Blob set as the archive control.
   */
  it('enables the Import button once an archive is set', async () => {
    const { fixture } = await renderImport();
    const archive = new Blob(['x'], { type: 'application/zip' });
    fixture.componentInstance.form.patchValue({ archive });
    await fixture.whenStable();
    const importBtn = screen.getByRole('button', { name: /^Import$/ });
    expect(importBtn).not.toBeDisabled();
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
   * Verifies: submitting forwards the overwrite flag and archive (in that order)
   *   to the service.
   * Interacts with: ApplicationService.importApplicationTemplates spy.
   * Data: archive Blob with overwriteExisting = true.
   */
  it('calls importApplicationTemplates with archive and overwrite flag on submit', async () => {
    const user = userEvent.setup();
    const { fixture, importApplicationTemplates } = await renderImport();
    const archive = new Blob(['x'], { type: 'application/zip' });
    fixture.componentInstance.form.patchValue({
      archive,
      overwriteExisting: true,
    });
    await fixture.whenStable();
    await user.click(screen.getByRole('button', { name: /^Import$/ }));
    expect(importApplicationTemplates).toHaveBeenCalledWith(true, archive);
  });

  /**
   * Verifies: a result with no failures renders the success message.
   * Interacts with: ApplicationService.importApplicationTemplates stub; rendered DOM.
   * Data: result with empty failures array.
   */
  it('shows "Import Successful" when the import result has no failures', async () => {
    const user = userEvent.setup();
    const { fixture } = await renderImport({ result: { failures: [] } });
    const archive = new Blob(['x'], { type: 'application/zip' });
    fixture.componentInstance.form.patchValue({ archive });
    await fixture.whenStable();
    await user.click(screen.getByRole('button', { name: /^Import$/ }));
    expect(await screen.findByText(/Import Successful/)).toBeInTheDocument();
  });

  /**
   * Verifies: a result with failures renders the conflict heading and each
   *   failing template name.
   * Interacts with: ApplicationService.importApplicationTemplates stub; rendered DOM.
   * Data: result with failures ['app-alpha', 'app-beta'].
   */
  it('lists failures when the import result reports conflicts', async () => {
    const user = userEvent.setup();
    const { fixture } = await renderImport({
      result: { failures: ['app-alpha', 'app-beta'] },
    });
    const archive = new Blob(['x'], { type: 'application/zip' });
    fixture.componentInstance.form.patchValue({ archive });
    await fixture.whenStable();
    await user.click(screen.getByRole('button', { name: /^Import$/ }));
    expect(
      await screen.findByText(/Application Templates already exist/),
    ).toBeInTheDocument();
    expect(screen.getByText('app-alpha')).toBeInTheDocument();
    expect(screen.getByText('app-beta')).toBeInTheDocument();
  });

  /**
   * Verifies: a change event on the rendered file input stores the chosen File as the form's archive.
   * Interacts with: the template's (change)="onFileSelected($event)" binding on the hidden file input.
   * Data: a templates.zip File exposed through the input's files list.
   * Why: jsdom cannot populate a file input, so files is defined on the element and a real change event dispatched.
   */
  it('captures the file name from the file input change event', async () => {
    const { fixture } = await renderImport();
    const file = new File(['x'], 'templates.zip', { type: 'application/zip' });
    const input = fileInput(fixture);
    Object.defineProperty(input, 'files', { value: fileList(file) });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(fixture.componentInstance.form.value.archive).toBe(file);
  });
});
