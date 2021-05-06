/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { EventType, WebhookService, WebhookSubscriptionForm } from '../../../../generated/player-api';

@Component({
  selector: 'app-edit-subscription',
  templateUrl: './edit-subscription.component.html',
  styleUrls: ['./edit-subscription.component.scss']
})
export class EditSubscriptionComponent implements OnInit {
  @Input() currentSubId: string;
  
  public control: FormControl;
  public form: FormGroup;
  public eventTypes = ['ViewCreated', 'ViewDeleted'];

  constructor(
    private webhookService: WebhookService,
    private formBuilder: FormBuilder,
    private dialogRef: MatDialogRef<EditSubscriptionComponent>,
  ) {}

  ngOnInit(): void {
    this.control = new FormControl();

    this.form = this.formBuilder.group({
      name: [''],
      callback: [''],
      clientId: [''],
      clientSecret: [''],
      events: new FormControl([]),
    });
  }

  onSubmit() {
    const webhook = <WebhookSubscriptionForm> {
      name: this.form.get('name').value as string,
      callbackUri: this.form.get('callback').value as string,
      clientId: this.form.get('clientId').value as string,
      clientSecret: this.form.get('clientSecret').value as string,
      eventTypes: this.form.get('events').value as EventType[]
    };

    this.webhookService.subscribe(webhook).subscribe(
      data => {
        this.dialogRef.close(false);
      },
      err => {
        this.dialogRef.close(true);
      }
    );
  }

  onDelete() {
    this.webhookService._delete(this.currentSubId).subscribe(
      data => {
        this.dialogRef.close(false);
      },
      err => {
        this.dialogRef.close(true);
      }
    );
  }
}
