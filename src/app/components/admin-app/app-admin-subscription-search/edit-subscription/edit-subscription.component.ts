/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Component, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { MatDialogRef } from '@angular/material/dialog';
import { take } from 'rxjs/operators';
import {
  EventType,
  WebhookService,
  WebhookSubscription,
  WebhookSubscriptionForm,
} from '../../../../generated/player-api';

@Component({
    selector: 'app-edit-subscription',
    templateUrl: './edit-subscription.component.html',
    styleUrls: ['./edit-subscription.component.scss'],
    standalone: false
})
export class EditSubscriptionComponent implements OnInit {
  @Input() currentSub: WebhookSubscription;

  public form: UntypedFormGroup;
  public eventTypes = Object.keys(EventType);

  private readonly redactedSecret = '******';

  constructor(
    private webhookService: WebhookService,
    private formBuilder: UntypedFormBuilder,
    private dialogRef: MatDialogRef<EditSubscriptionComponent>
  ) {}

  ngOnInit(): void {
    this.form = this.formBuilder.group({
      name: [this.currentSub?.name],
      callbackUri: [this.currentSub?.callbackUri],
      clientId: [this.currentSub?.clientId],
      clientSecret: [
        {
          value: this.currentSub?.clientSecretSet ? this.redactedSecret : '',
          disabled: this.currentSub?.clientSecretSet,
        },
      ],
      eventTypes: [this.currentSub?.eventTypes],
    });
  }

  onSubmit() {
    const webhook: Partial<WebhookSubscriptionForm> = {};

    Object.keys(this.form.controls).forEach((name) => {
      const currentControl = this.form.controls[name];

      if (currentControl.dirty) {
        webhook[name] = currentControl.value;
      }
    });

    // Create a new subscription
    if (this.currentSub == null) {
      this.webhookService
        .createWebhookSubscription(webhook)
        .pipe(take(1))
        .subscribe({
          next: () => this.dialogRef.close(false),
          error: () => this.dialogRef.close(true),
        });
    } else {
      // Update an existing subscription
      this.webhookService
        .partialUpdateWebhookSubscription(this.currentSub.id, webhook)
        .pipe(take(1))
        .subscribe({
          next: () => this.dialogRef.close(false),
          error: () => this.dialogRef.close(true),
        });
    }
  }

  onCancel() {
    this.dialogRef.close(false);
  }

  editSecretChanged(change: MatCheckboxChange) {
    const control = this.form.get('clientSecret');

    if (change.checked) {
      control.setValue('');
      control.enable();
    } else {
      control.setValue(this.redactedSecret);
      control.markAsPristine();
      control.disable();
    }
  }
}
