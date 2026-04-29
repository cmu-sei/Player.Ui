// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import {
  ApplicationService,
  ImportApplicationTemplatesResult,
} from '../../../generated/player-api';
import { AdminAppTemplateImportComponent } from './admin-app-template-import.component';
import { renderComponent } from '../../../test-utils/render-component';

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
    providers: [
      {
        provide: ApplicationService,
        useValue: { importApplicationTemplates },
      },
    ],
  });

  return { ...rendered, importApplicationTemplates };
}

describe('AdminAppTemplateImportComponent', () => {
  it('creates the component', async () => {
    const { fixture } = await renderImport();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('disables the Import button until an archive is chosen', async () => {
    await renderImport();
    const importBtn = screen.getByRole('button', { name: /^Import$/ });
    expect(importBtn).toBeDisabled();
  });

  it('enables the Import button once an archive is set', async () => {
    const { fixture } = await renderImport();
    const archive = new Blob(['x'], { type: 'application/zip' });
    fixture.componentInstance.form.patchValue({ archive });
    fixture.detectChanges();
    const importBtn = screen.getByRole('button', { name: /^Import$/ });
    expect(importBtn).not.toBeDisabled();
  });

  it('emits complete=false when cancel is clicked', async () => {
    const user = userEvent.setup();
    const { fixture } = await renderImport();
    const spy = vi.fn();
    fixture.componentInstance.complete.subscribe(spy);
    await user.click(screen.getByRole('button', { name: /Cancel/ }));
    expect(spy).toHaveBeenCalledWith(false);
  });

  it('calls importApplicationTemplates with archive and overwrite flag on submit', async () => {
    const user = userEvent.setup();
    const { fixture, importApplicationTemplates } = await renderImport();
    const archive = new Blob(['x'], { type: 'application/zip' });
    fixture.componentInstance.form.patchValue({
      archive,
      overwriteExisting: true,
    });
    fixture.detectChanges();
    await user.click(screen.getByRole('button', { name: /^Import$/ }));
    expect(importApplicationTemplates).toHaveBeenCalledWith(true, archive);
  });

  it('shows "Import Successful" when the import result has no failures', async () => {
    const user = userEvent.setup();
    const { fixture } = await renderImport({ result: { failures: [] } });
    const archive = new Blob(['x'], { type: 'application/zip' });
    fixture.componentInstance.form.patchValue({ archive });
    fixture.detectChanges();
    await user.click(screen.getByRole('button', { name: /^Import$/ }));
    expect(await screen.findByText(/Import Successful/)).toBeInTheDocument();
  });

  it('lists failures when the import result reports conflicts', async () => {
    const user = userEvent.setup();
    const { fixture } = await renderImport({
      result: { failures: ['app-alpha', 'app-beta'] },
    });
    const archive = new Blob(['x'], { type: 'application/zip' });
    fixture.componentInstance.form.patchValue({ archive });
    fixture.detectChanges();
    await user.click(screen.getByRole('button', { name: /^Import$/ }));
    expect(
      await screen.findByText(/Application Templates already exist/),
    ).toBeInTheDocument();
    expect(screen.getByText('app-alpha')).toBeInTheDocument();
    expect(screen.getByText('app-beta')).toBeInTheDocument();
  });

  it('captures the file name from the file input change event', async () => {
    const { fixture } = await renderImport();
    const file = new File(['x'], 'templates.zip', { type: 'application/zip' });
    const event = {
      target: { files: [file] },
    } as unknown as Event;
    fixture.componentInstance.onFileSelected(event);
    expect(fixture.componentInstance.form.value.archive).toBe(file);
  });
});
