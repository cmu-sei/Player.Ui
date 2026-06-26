// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { SystemMessageComponent } from './system-message.component';
import { renderComponent } from '../../../test-utils/render-component';

async function renderMessage(
  overrides: { title?: string; message?: string } = {},
) {
  const { title = 'Heads up', message = 'Something happened' } = overrides;

  const dismiss = vi.fn();
  const messageSheet = { dismiss } as unknown as MatBottomSheetRef<
    SystemMessageComponent
  >;

  const rendered = await renderComponent(SystemMessageComponent, {
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
   * Verifies: the component instantiates under the bottom-sheet providers.
   * Interacts with: MatBottomSheetRef and MAT_BOTTOM_SHEET_DATA via renderMessage.
   * Data: default title/message overrides.
   */
  it('creates the component', async () => {
    const { fixture } = await renderMessage();
    expect(fixture.componentInstance).toBeTruthy();
  });

  /**
   * Verifies: displayTitle/displayMessage are populated from the injected sheet data.
   * Interacts with: MAT_BOTTOM_SHEET_DATA read on init.
   * Data: title 'Error', message 'Boom'.
   */
  it('captures the title and message from the bottom sheet data', async () => {
    const { fixture } = await renderMessage({
      title: 'Error',
      message: 'Boom',
    });
    expect(fixture.componentInstance.displayTitle).toBe('Error');
    expect(fixture.componentInstance.displayMessage).toBe('Boom');
  });

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
   * Verifies: close() dismisses the bottom sheet.
   * Interacts with: MatBottomSheetRef.dismiss (dismiss spy).
   * Data: default render.
   */
  it('close() dismisses the bottom sheet', async () => {
    const { fixture, dismiss } = await renderMessage();
    fixture.componentInstance.close();
    expect(dismiss).toHaveBeenCalled();
  });

  /**
   * Verifies: clicking the rendered close control wires through to dismiss.
   * Interacts with: MatBottomSheetRef.dismiss; driven by a real user click.
   * Data: default render; clicks the first rendered button.
   * Why: the close button's accessible name is not guaranteed, so the test
   *      clicks the first button rather than querying by name.
   */
  it('clicking the close control invokes close()', async () => {
    const user = userEvent.setup();
    const { dismiss } = await renderMessage();
    // The template exposes a button whose accessible name is "Close"
    // (fallback: any button in the rendered message).
    const buttons = await screen.findAllByRole('button');
    await user.click(buttons[0]);
    expect(dismiss).toHaveBeenCalled();
  });
});
