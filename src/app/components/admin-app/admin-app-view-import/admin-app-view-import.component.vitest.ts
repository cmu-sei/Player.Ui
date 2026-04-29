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
  it('creates the component', async () => {
    const { fixture } = await renderImport();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('disables Import until an archive is chosen', async () => {
    await renderImport();
    expect(screen.getByRole('button', { name: /^Import$/ })).toBeDisabled();
  });

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

  it('emits complete=false when cancel is clicked', async () => {
    const user = userEvent.setup();
    const { fixture } = await renderImport();
    const spy = vi.fn();
    fixture.componentInstance.complete.subscribe(spy);
    await user.click(screen.getByRole('button', { name: /Cancel/ }));
    expect(spy).toHaveBeenCalledWith(false);
  });

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

  it('onFileSelected captures the file from the input event', async () => {
    const { fixture } = await renderImport();
    const file = new File(['x'], 'views.zip');
    fixture.componentInstance.onFileSelected({
      target: { files: [file] },
    } as unknown as Event);
    expect(fixture.componentInstance.form.value.archive).toBe(file);
  });
});
