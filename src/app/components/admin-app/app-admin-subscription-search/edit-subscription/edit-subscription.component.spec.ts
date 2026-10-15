// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { MatDialogRef } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSelectHarness } from '@angular/material/select/testing';
import { MatSelectModule } from '@angular/material/select';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import {
  WebhookService,
  WebhookSubscription,
} from '../../../../generated/player-api';
import { EditSubscriptionComponent } from './edit-subscription.component';
import { renderComponent } from '../../../../test-utils/render-component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { A11yModule } from '@angular/cdk/a11y';
import { dialogRefStub } from '../../../../test-utils/dialog-refs';
import { ApiStub } from '../../../../test-utils/api-stub';

const existingSub: WebhookSubscription = {
  id: 's1',
  name: 'Alpha',
  callbackUri: 'https://example.test/wh',
  clientId: 'client-a',
  clientSecretSet: true,
  eventTypes: [],
};

async function renderEdit(
  overrides: {
    currentSub?: WebhookSubscription | null;
    createResult?: 'ok' | 'err';
    updateResult?: 'ok' | 'err';
  } = {},
) {
  const {
    currentSub = null,
    createResult = 'ok',
    updateResult = 'ok',
  } = overrides;

  const { dialogRef, close } = dialogRefStub<EditSubscriptionComponent>();

  const createWebhookSubscription = vi.fn(() =>
    createResult === 'ok' ? of(undefined) : throwError(() => new Error('fail')),
  );
  const partialUpdateWebhookSubscription = vi.fn(() =>
    updateResult === 'ok' ? of(undefined) : throwError(() => new Error('fail')),
  );

  const rendered = await renderComponent(EditSubscriptionComponent, {
    declarations: [EditSubscriptionComponent],
    imports: [
      MatFormFieldModule,
      MatInputModule,
      MatTooltipModule,
      A11yModule,
      MatSelectModule,
      MatCheckboxModule,
      ...CRUCIBLE_DIALOG_IMPORTS,
    ],
    componentProperties: { currentSub },
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      {
        provide: WebhookService,
        useValue: {
          createWebhookSubscription,
          partialUpdateWebhookSubscription,
        } satisfies ApiStub<WebhookService>,
      },
    ],
  });

  return {
    ...rendered,
    close,
    createWebhookSubscription,
    partialUpdateWebhookSubscription,
  };
}

describe('EditSubscriptionComponent', () => {
  /**
   * Verifies: without a subscription the dialog is titled Add Subscription with empty fields and an editable secret.
   * Interacts with: the rendered dialog title and fields.
   * Data: currentSub null.
   */
  it('opens empty for a new subscription', async () => {
    await renderEdit({ currentSub: null });
    expect(screen.getByRole('heading')).toHaveTextContent('Add Subscription');
    expect(screen.getByLabelText('Name')).toHaveValue('');
    const secret = screen.getByLabelText('Client Secret') as HTMLInputElement;
    expect(secret).toHaveValue('');
    expect(secret.disabled).toBe(false);
    expect(screen.getByLabelText('Edit')).toBeChecked();
  });

  /**
   * Verifies: an existing subscription is shown with its fields and a redacted, read-only secret.
   * Interacts with: the rendered dialog title and fields.
   * Data: Alpha, whose client secret is set.
   */
  it('shows an existing subscription with its secret redacted', async () => {
    await renderEdit({ currentSub: existingSub });
    expect(screen.getByRole('heading')).toHaveTextContent('Edit Subscription');
    expect(screen.getByLabelText('Name')).toHaveValue('Alpha');
    expect(screen.getByLabelText('Callback URL')).toHaveValue(
      'https://example.test/wh',
    );
    const secret = screen.getByLabelText('Client Secret') as HTMLInputElement;
    expect(secret).toHaveValue('******');
    expect(secret.disabled).toBe(true);
    expect(screen.getByLabelText('Edit')).not.toBeChecked();
  });

  /**
   * Verifies: ticking Edit clears and unlocks the secret, and unticking redacts and locks it again, so it is not sent.
   * Interacts with: the Edit checkbox; the Client Secret field; Save; WebhookService.partialUpdateWebhookSubscription.
   * Data: Alpha; Edit ticked, 'new-secret' typed, Edit unticked, then Save.
   */
  it('unlocks the secret only while Edit is ticked', async () => {
    const user = userEvent.setup();
    const { partialUpdateWebhookSubscription } = await renderEdit({
      currentSub: existingSub,
    });
    const secret = screen.getByLabelText('Client Secret') as HTMLInputElement;
    await user.click(screen.getByLabelText('Edit'));
    expect(secret).toHaveValue('');
    expect(secret.disabled).toBe(false);
    secret.focus();
    await user.type(secret, 'new-secret', { skipClick: true });
    await user.click(screen.getByLabelText('Edit'));
    expect(secret).toHaveValue('******');
    expect(secret.disabled).toBe(true);
    await user.click(screen.getByText('Save'));
    expect(partialUpdateWebhookSubscription).toHaveBeenCalledExactlyOnceWith(
      's1',
      {},
    );
  });

  /**
   * Verifies: saving a new subscription sends only the fields the user filled in and closes with false (no error).
   * Interacts with: the Name and Callback URL fields; Save; WebhookService.createWebhookSubscription; MatDialogRef.close.
   * Data: name 'Beta' and callback 'https://b.test' typed.
   */
  it('creates a subscription from the filled-in fields', async () => {
    const user = userEvent.setup();
    const { createWebhookSubscription, close } = await renderEdit({
      currentSub: null,
    });
    await user.type(screen.getByLabelText('Name'), 'Beta');
    await user.type(screen.getByLabelText('Callback URL'), 'https://b.test');
    await user.click(screen.getByText('Save'));
    expect(createWebhookSubscription).toHaveBeenCalledExactlyOnceWith({
      name: 'Beta',
      callbackUri: 'https://b.test',
    });
    expect(close).toHaveBeenCalledExactlyOnceWith(false);
  });

  /**
   * Verifies: saving an existing subscription sends only the changed fields and closes with false (no error).
   * Interacts with: the Client ID field; Save; WebhookService.partialUpdateWebhookSubscription; MatDialogRef.close.
   * Data: Alpha; client id changed to 'client-b'.
   */
  it('updates only the changed fields of a subscription', async () => {
    const user = userEvent.setup();
    const { partialUpdateWebhookSubscription, close } = await renderEdit({
      currentSub: existingSub,
    });
    const clientId = screen.getByLabelText('Client ID');
    await user.clear(clientId);
    await user.type(clientId, 'client-b', { skipClick: true });
    await user.click(screen.getByText('Save'));
    expect(partialUpdateWebhookSubscription).toHaveBeenCalledExactlyOnceWith(
      's1',
      { clientId: 'client-b' },
    );
    expect(close).toHaveBeenCalledExactlyOnceWith(false);
  });

  /**
   * Verifies: choosing events sends them with the subscription.
   * Interacts with: the Events select (MatSelectHarness); Save; WebhookService.createWebhookSubscription.
   * Data: a new subscription named 'Gamma' with the first event type chosen.
   */
  it('sends the chosen events', async () => {
    const user = userEvent.setup();
    const { fixture, createWebhookSubscription } = await renderEdit({
      currentSub: null,
    });
    await user.type(screen.getByLabelText('Name'), 'Gamma');
    const events =
      await TestbedHarnessEnvironment.loader(fixture).getHarness(
        MatSelectHarness,
      );
    await events.open();
    const [first] = await events.getOptions();
    const eventType = await first.getText();
    await first.click();
    await events.close();
    await user.click(screen.getByText('Save'));
    expect(createWebhookSubscription).toHaveBeenCalledExactlyOnceWith({
      name: 'Gamma',
      eventTypes: [eventType],
    });
  });

  /**
   * Verifies: a failed save closes the dialog with true, which the search page reads as an error.
   * Interacts with: Save; the failing WebhookService endpoint; MatDialogRef.close.
   * Data: one row per mode: creating (currentSub null) and updating (Alpha).
   */
  it.each<[string, WebhookSubscription | null]>([
    ['creating', null],
    ['updating', existingSub],
  ])('closes with true when %s fails', async (_mode, currentSub) => {
    const user = userEvent.setup();
    const { close } = await renderEdit({
      currentSub,
      createResult: 'err',
      updateResult: 'err',
    });
    await user.type(screen.getByLabelText('Name'), 'x');
    await user.click(screen.getByText('Save'));
    expect(close).toHaveBeenCalledExactlyOnceWith(true);
  });
});
