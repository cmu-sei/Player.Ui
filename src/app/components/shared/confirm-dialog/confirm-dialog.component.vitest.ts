// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

const mockClose = vi.fn();

interface ConfirmDialogData {
  title?: string;
  message?: string;
  removeArtifacts?: boolean;
  confirm?: boolean;
}

async function renderConfirmDialog(
  overrides: { title?: string; message?: string; data?: ConfirmDialogData } = {}
) {
  const {
    title = 'Confirm Action',
    message = 'Are you sure?',
    data = {},
  } = overrides;

  const dialogData = { title, message, ...data };
  mockClose.mockClear();

  return renderComponent(ConfirmDialogComponent, {
    declarations: [ConfirmDialogComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: dialogData },
      {
        provide: MatDialogRef,
        useValue: {
          close: mockClose,
          disableClose: false,
          afterClosed: () => of(null),
        },
      },
    ],
    componentProperties: {
      title,
      message,
    },
  });
}

describe('ConfirmDialogComponent', () => {
  /**
   * Verifies: the component instantiates without error under the dialog providers.
   * Interacts with: MAT_DIALOG_DATA and MatDialogRef stubs via renderConfirmDialog.
   * Data: default dialogData (title/message), no extra overrides.
   */
  it('should create', async () => {
    const { fixture } = await renderConfirmDialog();
    expect(fixture.componentInstance).toBeTruthy();
  });

  /**
   * Verifies: the injected title is rendered into the dialog DOM.
   * Interacts with: MAT_DIALOG_DATA title; queries DOM via screen.getByText.
   * Data: title override 'Delete Item?'.
   */
  it('should display dialog title', async () => {
    await renderConfirmDialog({ title: 'Delete Item?' });
    expect(screen.getByText('Delete Item?')).toBeInTheDocument();
  });

  /**
   * Verifies: the injected message is rendered into the dialog DOM.
   * Interacts with: MAT_DIALOG_DATA message; queries DOM via screen.getByText.
   * Data: message override 'This action cannot be undone.'.
   */
  it('should display dialog message', async () => {
    await renderConfirmDialog({ message: 'This action cannot be undone.' });
    expect(
      screen.getByText('This action cannot be undone.')
    ).toBeInTheDocument();
  });

  /**
   * Verifies: the affirmative ("YES") action button is present in the template.
   * Interacts with: rendered ConfirmDialogComponent template; screen.getByText.
   * Data: default dialogData.
   */
  it('should display YES button', async () => {
    await renderConfirmDialog();
    expect(screen.getByText('YES')).toBeInTheDocument();
  });

  /**
   * Verifies: the negative ("NO") action button is present in the template.
   * Interacts with: rendered ConfirmDialogComponent template; screen.getByText.
   * Data: default dialogData.
   */
  it('should display NO button', async () => {
    await renderConfirmDialog();
    expect(screen.getByText('NO')).toBeInTheDocument();
  });

  /**
   * Verifies: clicking YES closes the dialog returning a payload with confirm=true.
   * Interacts with: MatDialogRef.close (mockClose); driven by a real user click.
   * Data: default dialogData; asserts on the first close-call argument.
   */
  it('should close dialog with confirm=true when YES clicked', async () => {
    await renderConfirmDialog();
    const user = userEvent.setup();
    const yesButton = screen.getByText('YES');
    await user.click(yesButton);
    expect(mockClose).toHaveBeenCalled();
    const closeArg = mockClose.mock.calls[0][0];
    expect(closeArg.confirm).toBe(true);
  });
});
