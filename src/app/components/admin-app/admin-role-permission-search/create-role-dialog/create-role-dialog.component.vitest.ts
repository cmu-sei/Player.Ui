// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CreateRoleDialogComponent } from './create-role-dialog.component';
import { renderComponent } from '../../../../test-utils/render-component';

async function renderDialog(overrides: { title?: string } = {}) {
  const { title = 'Add Role' } = overrides;

  const close = vi.fn();
  const dialogRef = { close, disableClose: false } as unknown as MatDialogRef<
    CreateRoleDialogComponent
  >;

  const rendered = await renderComponent(CreateRoleDialogComponent, {
    declarations: [CreateRoleDialogComponent],
    componentProperties: { title },
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: MAT_DIALOG_DATA, useValue: '' },
    ],
  });

  return { ...rendered, close, dialogRef };
}

describe('CreateRoleDialogComponent', () => {
  it('creates the component', async () => {
    const { fixture } = await renderDialog();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('sets disableClose on the dialog ref', async () => {
    const { dialogRef } = await renderDialog();
    expect(dialogRef.disableClose).toBe(true);
  });

  it('renders the provided title', async () => {
    await renderDialog({ title: 'Edit Role' });
    expect(await screen.findByText('Edit Role')).toBeInTheDocument();
  });

  it('close() closes the dialog with an empty result', async () => {
    const { fixture, close } = await renderDialog();
    fixture.componentInstance.close();
    expect(close).toHaveBeenCalledWith({});
  });

  it('done() closes the dialog with the typed name', async () => {
    const { fixture, close } = await renderDialog();
    fixture.componentInstance.name = 'Admin';
    fixture.componentInstance.done();
    expect(close).toHaveBeenCalledWith({ name: 'Admin', value: '' });
  });

  it('Cancel button triggers close()', async () => {
    const user = userEvent.setup();
    const { close } = await renderDialog();
    await user.click(screen.getByRole('button', { name: /Cancel/ }));
    expect(close).toHaveBeenCalledWith({});
  });

  it('Done button (form submit) triggers done() with the current name', async () => {
    const user = userEvent.setup();
    const { fixture, close } = await renderDialog();
    fixture.componentInstance.name = 'Submitter';
    await user.click(screen.getByRole('button', { name: /Done/ }));
    expect(close).toHaveBeenCalledWith({ name: 'Submitter', value: '' });
  });
});
