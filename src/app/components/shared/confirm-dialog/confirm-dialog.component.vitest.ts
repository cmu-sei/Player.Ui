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

async function renderConfirmDialog(
  overrides: { title?: string; message?: string; data?: any } = {}
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
  it('should create', async () => {
    const { fixture } = await renderConfirmDialog();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display dialog title', async () => {
    await renderConfirmDialog({ title: 'Delete Item?' });
    expect(screen.getByText('Delete Item?')).toBeInTheDocument();
  });

  it('should display dialog message', async () => {
    await renderConfirmDialog({ message: 'This action cannot be undone.' });
    expect(
      screen.getByText('This action cannot be undone.')
    ).toBeInTheDocument();
  });

  it('should display YES button', async () => {
    await renderConfirmDialog();
    expect(screen.getByText('YES')).toBeInTheDocument();
  });

  it('should display NO button', async () => {
    await renderConfirmDialog();
    expect(screen.getByText('NO')).toBeInTheDocument();
  });

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
