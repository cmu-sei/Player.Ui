// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { SystemMessageComponent } from './system-message.component';
import { renderComponent } from '../../../test-utils/render-component';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { bottomSheetRefStub } from '../../../test-utils/dialog-refs';

async function renderMessage(
  overrides: { title?: string; message?: string } = {},
) {
  const { title = 'Heads up', message = 'Something happened' } = overrides;

  const { sheetRef: messageSheet, dismiss } =
    bottomSheetRefStub<SystemMessageComponent>();

  const rendered = await renderComponent(SystemMessageComponent, {
    imports: [MatIconModule, MatButtonModule],
    declarations: [SystemMessageComponent],
    providers: [
      { provide: MatBottomSheetRef, useValue: messageSheet },
      { provide: MAT_BOTTOM_SHEET_DATA, useValue: { title, message } },
    ],
  });

  return { ...rendered, dismiss };
}

describe('SystemMessageComponent', () => {
  /**
   * Verifies: the title and message are rendered into the DOM.
   * Interacts with: rendered template; screen.findByText/getByText.
   * Data: title 'Info', message 'Hello'.
   */
  it('renders the title and message in the DOM', async () => {
    await renderMessage({ title: 'Info', message: 'Hello' });
    expect(await screen.findByText('Info')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  /**
   * Verifies: clicking Close dismisses the bottom sheet.
   * Interacts with: the rendered Close button; MatBottomSheetRef.dismiss.
   * Data: default render.
   */
  it('dismisses the bottom sheet from Close', async () => {
    const user = userEvent.setup();
    const { dismiss } = await renderMessage();
    await user.click(screen.getByTitle('Close'));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
