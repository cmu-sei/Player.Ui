// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { MatDialogRef } from '@angular/material/dialog';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import {
  WebhookService,
  WebhookSubscription,
} from '../../../../generated/player-api';
import { EditSubscriptionComponent } from './edit-subscription.component';
import { renderComponent } from '../../../../test-utils/render-component';

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
  const { currentSub = null, createResult = 'ok', updateResult = 'ok' } =
    overrides;

  const close = vi.fn();
  const dialogRef = { close } as unknown as MatDialogRef<EditSubscriptionComponent>;

  const createWebhookSubscription = vi.fn(() =>
    createResult === 'ok' ? of(undefined) : throwError(() => new Error('fail')),
  );
  const partialUpdateWebhookSubscription = vi.fn(() =>
    updateResult === 'ok' ? of(undefined) : throwError(() => new Error('fail')),
  );

  const rendered = await renderComponent(EditSubscriptionComponent, {
    declarations: [EditSubscriptionComponent],
    imports: [MatSelectModule, MatCheckboxModule],
    componentProperties: { currentSub },
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      {
        provide: WebhookService,
        useValue: {
          createWebhookSubscription,
          partialUpdateWebhookSubscription,
        },
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
   * Verifies: the edit-subscription component instantiates successfully.
   * Interacts with: renderComponent with stubbed MatDialogRef and WebhookService.
   * Data: default renderEdit (currentSub null, create/update succeed).
   */
  it('creates the component', async () => {
    const { fixture } = await renderEdit();
    expect(fixture.componentInstance).toBeTruthy();
  });

  /**
   * Verifies: with no currentSub the form's name/callbackUri/clientId/eventTypes controls initialize to null.
   * Interacts with: the component's reactive form (getRawValue).
   * Data: currentSub null.
   * Why: optional-chaining on a null currentSub yields undefined, which FormBuilder stores as null.
   */
  it('initializes empty form fields when currentSub is null', async () => {
    const { fixture } = await renderEdit({ currentSub: null });
    const v = fixture.componentInstance.form.getRawValue();
    // Optional-chaining on a null currentSub yields undefined, which
    // FormBuilder stores as null in the control value.
    expect(v.name).toBeNull();
    expect(v.callbackUri).toBeNull();
    expect(v.clientId).toBeNull();
    expect(v.eventTypes).toBeNull();
  });

  /**
   * Verifies: when the sub already has a secret, the clientSecret control shows a redacted mask and is disabled.
   * Interacts with: the component's reactive form clientSecret control.
   * Data: existingSub with clientSecretSet=true.
   */
  it('redacts the secret and disables the control when clientSecretSet is true', async () => {
    const { fixture } = await renderEdit({ currentSub: existingSub });
    const secret = fixture.componentInstance.form.get('clientSecret');
    expect(secret.value).toBe('******');
    expect(secret.disabled).toBe(true);
  });

  /**
   * Verifies: toggling edit-secret on clears the masked secret and enables the control for input.
   * Interacts with: component.editSecretChanged and the clientSecret control.
   * Data: existingSub; checkbox change checked=true.
   */
  it('editSecretChanged(true) clears and enables the secret control', async () => {
    const { fixture } = await renderEdit({ currentSub: existingSub });
    fixture.componentInstance.editSecretChanged({
      checked: true,
    } as MatCheckboxChange);
    const secret = fixture.componentInstance.form.get('clientSecret');
    expect(secret.value).toBe('');
    expect(secret.enabled).toBe(true);
  });

  /**
   * Verifies: toggling edit-secret back off restores the redacted mask, re-disables, and resets the control to pristine.
   * Interacts with: component.editSecretChanged and the clientSecret control.
   * Data: existingSub; toggle on (and dirty) then off.
   */
  it('editSecretChanged(false) redacts, marks pristine, and disables the control', async () => {
    const { fixture } = await renderEdit({ currentSub: existingSub });
    fixture.componentInstance.editSecretChanged({
      checked: true,
    } as MatCheckboxChange);
    fixture.componentInstance.form.get('clientSecret').markAsDirty();
    fixture.componentInstance.editSecretChanged({
      checked: false,
    } as MatCheckboxChange);
    const secret = fixture.componentInstance.form.get('clientSecret');
    expect(secret.value).toBe('******');
    expect(secret.disabled).toBe(true);
    expect(secret.pristine).toBe(true);
  });

  /**
   * Verifies: with no currentSub, onSubmit creates a subscription sending only the dirty fields, then closes with false.
   * Interacts with: stubbed WebhookService.createWebhookSubscription and MatDialogRef.close.
   * Data: only the name control set/dirty to 'New Sub'.
   * Why: close(false) signals success (no error) to the parent search.
   */
  it('onSubmit(create) only sends dirty fields', async () => {
    const { fixture, createWebhookSubscription, close } = await renderEdit({
      currentSub: null,
    });
    const name = fixture.componentInstance.form.get('name');
    name.setValue('New Sub');
    name.markAsDirty();
    fixture.componentInstance.onSubmit();
    expect(createWebhookSubscription).toHaveBeenCalledWith({ name: 'New Sub' });
    expect(close).toHaveBeenCalledWith(false);
  });

  /**
   * Verifies: when the create call errors, onSubmit closes the dialog with true.
   * Interacts with: WebhookService.createWebhookSubscription (throwing) and MatDialogRef.close.
   * Data: createResult='err'; name marked dirty.
   * Why: close(true) signals the error case so the parent skips its reload.
   */
  it('onSubmit(create) closes with true when the create call errors', async () => {
    const { fixture, close } = await renderEdit({
      currentSub: null,
      createResult: 'err',
    });
    fixture.componentInstance.form.get('name').markAsDirty();
    fixture.componentInstance.onSubmit();
    expect(close).toHaveBeenCalledWith(true);
  });

  /**
   * Verifies: with an existing sub, onSubmit sends only the dirty fields to partialUpdate (keyed by id) and closes false.
   * Interacts with: stubbed WebhookService.partialUpdateWebhookSubscription and MatDialogRef.close.
   * Data: existingSub (id s1); only callbackUri changed/dirty.
   */
  it('onSubmit(update) calls partialUpdate with only dirty fields', async () => {
    const { fixture, partialUpdateWebhookSubscription, close } =
      await renderEdit({ currentSub: existingSub });
    const callback = fixture.componentInstance.form.get('callbackUri');
    callback.setValue('https://new.test/wh');
    callback.markAsDirty();
    fixture.componentInstance.onSubmit();
    expect(partialUpdateWebhookSubscription).toHaveBeenCalledWith('s1', {
      callbackUri: 'https://new.test/wh',
    });
    expect(close).toHaveBeenCalledWith(false);
  });

  /**
   * Verifies: onCancel closes with false and never calls the create/update services.
   * Interacts with: MatDialogRef.close and WebhookService.createWebhookSubscription.
   * Data: default renderEdit (currentSub null).
   */
  it('onCancel closes the dialog without saving', async () => {
    const { fixture, close, createWebhookSubscription } = await renderEdit({
      currentSub: null,
    });
    fixture.componentInstance.onCancel();
    expect(close).toHaveBeenCalledWith(false);
    expect(createWebhookSubscription).not.toHaveBeenCalled();
  });
});
