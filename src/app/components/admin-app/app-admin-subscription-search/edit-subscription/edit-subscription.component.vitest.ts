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
import { DialogService } from '../../../../services/dialog/dialog.service';
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
    deleteResult?: 'ok' | 'err';
    confirmDelete?: boolean;
  } = {},
) {
  const {
    currentSub = null,
    createResult = 'ok',
    updateResult = 'ok',
    deleteResult = 'ok',
    confirmDelete = true,
  } = overrides;

  const close = vi.fn();
  const dialogRef = { close } as unknown as MatDialogRef<EditSubscriptionComponent>;

  const createWebhookSubscription = vi.fn(() =>
    createResult === 'ok' ? of(undefined) : throwError(() => new Error('fail')),
  );
  const partialUpdateWebhookSubscription = vi.fn(() =>
    updateResult === 'ok' ? of(undefined) : throwError(() => new Error('fail')),
  );
  const deleteWebhookSubscription = vi.fn(() =>
    deleteResult === 'ok' ? of(undefined) : throwError(() => new Error('fail')),
  );
  const confirm = vi.fn(() => of({ confirm: confirmDelete }));

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
          deleteWebhookSubscription,
        },
      },
      { provide: DialogService, useValue: { confirm } },
    ],
  });

  return {
    ...rendered,
    close,
    createWebhookSubscription,
    partialUpdateWebhookSubscription,
    deleteWebhookSubscription,
    confirm,
  };
}

describe('EditSubscriptionComponent', () => {
  it('creates the component', async () => {
    const { fixture } = await renderEdit();
    expect(fixture.componentInstance).toBeTruthy();
  });

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

  it('redacts the secret and disables the control when clientSecretSet is true', async () => {
    const { fixture } = await renderEdit({ currentSub: existingSub });
    const secret = fixture.componentInstance.form.get('clientSecret');
    expect(secret.value).toBe('******');
    expect(secret.disabled).toBe(true);
  });

  it('editSecretChanged(true) clears and enables the secret control', async () => {
    const { fixture } = await renderEdit({ currentSub: existingSub });
    fixture.componentInstance.editSecretChanged({
      checked: true,
    } as MatCheckboxChange);
    const secret = fixture.componentInstance.form.get('clientSecret');
    expect(secret.value).toBe('');
    expect(secret.enabled).toBe(true);
  });

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

  it('onSubmit(create) closes with true when the create call errors', async () => {
    const { fixture, close } = await renderEdit({
      currentSub: null,
      createResult: 'err',
    });
    fixture.componentInstance.form.get('name').markAsDirty();
    fixture.componentInstance.onSubmit();
    expect(close).toHaveBeenCalledWith(true);
  });

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

  it('onDelete only deletes after confirm', async () => {
    const { fixture, deleteWebhookSubscription, close } = await renderEdit({
      currentSub: existingSub,
      confirmDelete: true,
    });
    fixture.componentInstance.onDelete();
    expect(deleteWebhookSubscription).toHaveBeenCalledWith('s1');
    expect(close).toHaveBeenCalledWith(false);
  });

  it('onDelete is a no-op when confirm returns false', async () => {
    const { fixture, deleteWebhookSubscription, close } = await renderEdit({
      currentSub: existingSub,
      confirmDelete: false,
    });
    fixture.componentInstance.onDelete();
    expect(deleteWebhookSubscription).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it('onDelete closes with true when the delete call errors', async () => {
    const { fixture, close } = await renderEdit({
      currentSub: existingSub,
      deleteResult: 'err',
      confirmDelete: true,
    });
    fixture.componentInstance.onDelete();
    expect(close).toHaveBeenCalledWith(true);
  });
});
