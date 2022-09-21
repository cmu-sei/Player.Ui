/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { MatDialogRef } from '@angular/material/dialog';
import { take } from 'rxjs/operators';
import {
  EventType,
  WebhookService,
  WebhookSubscription,
  WebhookSubscriptionForm,
} from '../../../../generated/player-api';
import { DialogService } from '../../../../services/dialog/dialog.service';

@Component({
  selector: 'app-edit-subscription',
  templateUrl: './edit-subscription.component.html',
  styleUrls: ['./edit-subscription.component.scss'],
})
export class EditSubscriptionComponent implements OnInit {
  @Input() currentSub: WebhookSubscription;

  public form: FormGroup;
  public eventTypes = Object.keys(EventType);

  private readonly redactedSecret = '******';

  constructor(
    private webhookService: WebhookService,
    private formBuilder: FormBuilder,
    private dialogRef: MatDialogRef<EditSubscriptionComponent>,
    private dialogService: DialogService
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
        .subscribe(
          (data) => {
            this.dialogRef.close(false);
          },
          (err) => {
            this.dialogRef.close(true);
          }
        );
    } else {
      // Update an existing subscription
      this.webhookService
        .partialUpdateWebhookSubscription(this.currentSub.id, webhook)
        .pipe(take(1))
        .subscribe(
          (data) => {
            this.dialogRef.close(false);
          },
          (err) => {
            this.dialogRef.close(true);
          }
        );
    }
  }

  onDelete() {
    this.dialogService
      .confirm(
        'Confirm Delete',
        'Are you sure you want to delete this subscription?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.webhookService
            .deleteWebhookSubscription(this.currentSub.id)
            .pipe(take(1))
            .subscribe(
              (data) => {
                this.dialogRef.close(false);
              },
              (err) => {
                this.dialogRef.close(true);
              }
            );
        }
      });
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
