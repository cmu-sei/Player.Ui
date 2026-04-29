// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MatDialogRef } from '@angular/material/dialog';
import { Permission } from '../../../../generated/player-api';
import { CreatePermissionDialogComponent } from './create-permission-dialog.component';
import { renderComponent } from '../../../../test-utils/render-component';

async function renderDialog(
  overrides: { title?: string; permission?: Permission } = {},
) {
  const { title = 'Add Permission', permission = { name: '', description: '' } as Permission } = overrides;

  const close = vi.fn();
  const dialogRef = { close, disableClose: false } as unknown as MatDialogRef<
    CreatePermissionDialogComponent
  >;

  const rendered = await renderComponent(CreatePermissionDialogComponent, {
    declarations: [CreatePermissionDialogComponent],
    componentProperties: { title, permission },
    providers: [{ provide: MatDialogRef, useValue: dialogRef }],
  });

  return { ...rendered, close, dialogRef };
}

describe('CreatePermissionDialogComponent', () => {
  it('creates the component', async () => {
    const { fixture } = await renderDialog();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('sets disableClose on the dialog ref', async () => {
    const { dialogRef } = await renderDialog();
    expect(dialogRef.disableClose).toBe(true);
  });

  it('renders the provided title', async () => {
    await renderDialog({ title: 'Edit Permission' });
    expect(await screen.findByText('Edit Permission')).toBeInTheDocument();
  });

  it('close() closes the dialog with an empty result', async () => {
    const { fixture, close } = await renderDialog();
    fixture.componentInstance.close();
    expect(close).toHaveBeenCalledWith({});
  });

  it('done() closes the dialog with the edited permission', async () => {
    const permission: Permission = { id: 'p1', name: 'edited', description: 'desc' };
    const { fixture, close } = await renderDialog({ permission });
    fixture.componentInstance.done();
    expect(close).toHaveBeenCalledWith({ permission });
  });

  it('submitting the form triggers done()', async () => {
    const user = userEvent.setup();
    const permission: Permission = { id: 'p1', name: 'from-submit', description: '' };
    const { close } = await renderDialog({ permission });
    await user.click(screen.getByRole('button', { name: /Done/ }));
    expect(close).toHaveBeenCalledWith({ permission });
  });
});
