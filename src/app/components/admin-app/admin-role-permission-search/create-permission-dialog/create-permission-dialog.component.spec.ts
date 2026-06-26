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
  /**
   * Verifies: the dialog component instantiates successfully.
   * Interacts with: renderComponent with a stubbed MatDialogRef.
   * Data: default renderDialog overrides (empty permission, 'Add Permission' title).
   */
  it('creates the component', async () => {
    const { fixture } = await renderDialog();
    expect(fixture.componentInstance).toBeTruthy();
  });

  /**
   * Verifies: the component forces disableClose=true on its injected MatDialogRef.
   * Interacts with: the stubbed MatDialogRef (initialized disableClose=false).
   * Data: default renderDialog overrides.
   */
  it('sets disableClose on the dialog ref', async () => {
    const { dialogRef } = await renderDialog();
    expect(dialogRef.disableClose).toBe(true);
  });

  /**
   * Verifies: the passed-in title input is rendered into the template.
   * Interacts with: the rendered DOM (queried via Testing Library screen).
   * Data: title override 'Edit Permission'.
   */
  it('renders the provided title', async () => {
    await renderDialog({ title: 'Edit Permission' });
    expect(await screen.findByText('Edit Permission')).toBeInTheDocument();
  });

  /**
   * Verifies: close() dismisses the dialog with an empty object (no result).
   * Interacts with: the stubbed MatDialogRef.close spy.
   * Data: default renderDialog overrides.
   */
  it('close() closes the dialog with an empty result', async () => {
    const { fixture, close } = await renderDialog();
    fixture.componentInstance.close();
    expect(close).toHaveBeenCalledWith({});
  });

  /**
   * Verifies: done() dismisses the dialog returning the current permission wrapped as { permission }.
   * Interacts with: the stubbed MatDialogRef.close spy.
   * Data: an edited Permission fixture (id 'p1', name 'edited').
   */
  it('done() closes the dialog with the edited permission', async () => {
    const permission: Permission = { id: 'p1', name: 'edited', description: 'desc' };
    const { fixture, close } = await renderDialog({ permission });
    fixture.componentInstance.done();
    expect(close).toHaveBeenCalledWith({ permission });
  });

  /**
   * Verifies: clicking the Done button submits the form and routes through done(), closing with the permission.
   * Interacts with: the rendered Done button (userEvent click) and MatDialogRef.close spy.
   * Data: a Permission fixture (name 'from-submit').
   */
  it('submitting the form triggers done()', async () => {
    const user = userEvent.setup();
    const permission: Permission = { id: 'p1', name: 'from-submit', description: '' };
    const { close } = await renderDialog({ permission });
    await user.click(screen.getByRole('button', { name: /Done/ }));
    expect(close).toHaveBeenCalledWith({ permission });
  });
});
