/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Component, Input, OnInit, inject } from '@angular/core';
import {
  UntypedFormBuilder,
  UntypedFormGroup,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatCheckboxChange, MatCheckbox } from '@angular/material/checkbox';
import { MatDialogRef } from '@angular/material/dialog';
import { take } from 'rxjs/operators';
import {
  EventType,
  WebhookService,
  WebhookSubscription,
  WebhookSubscriptionForm,
} from '../../../../generated/player-api';
import {
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import { MatFormField, MatLabel, MatInput } from '@angular/material/input';
import { MatTooltip } from '@angular/material/tooltip';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/autocomplete';

@Component({
  selector: 'app-edit-subscription',
  templateUrl: './edit-subscription.component.html',
  styleUrls: ['./edit-subscription.component.scss'],
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    FormsModule,
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatInput,
    MatTooltip,
    MatCheckbox,
    MatSelect,
    MatOption,
  ],
})
export class EditSubscriptionComponent implements OnInit {
  private webhookService = inject(WebhookService);
  private formBuilder = inject(UntypedFormBuilder);
  private dialogRef =
    inject<MatDialogRef<EditSubscriptionComponent>>(MatDialogRef);

  @Input() currentSub: WebhookSubscription;

  public form: UntypedFormGroup;
  public eventTypes = Object.keys(EventType);

  private readonly redactedSecret = '******';

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
