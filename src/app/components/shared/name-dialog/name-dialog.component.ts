// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogRef as MatDialogRef,
} from '@angular/material/legacy-dialog';
import { NameValidatorModel } from './name-dialog.models';

@Component({
  selector: 'name-dialog',
  templateUrl: './name-dialog.component.html',
  styleUrls: ['./name-dialog.component.scss'],
})
export class NameDialogComponent {
  public title: string;
  public message: string;
  public removeArtifacts = true;
  public form: FormGroup;
  public validators: Array<NameValidatorModel>;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    public dialogRef: MatDialogRef<NameDialogComponent>,
    private formBuilder: FormBuilder
  ) {
    this.dialogRef.disableClose = true;

    this.form = this.formBuilder.group({
      name: [data.nameValue, [Validators.required]],
    });

    if (data.validators) {
      this.validators = data.validators;
      const validators = (data.validators as Array<NameValidatorModel>).map(
        (x) => x.validator
      );
      this.form.controls['name'].addValidators(validators);
    }
  }

  get name() {
    if (this.form) {
      return this.form?.get('name');
    }
  }

  onClick(): void {
    this.data.artifacts && this.data.artifacts.length > 0
      ? (this.data.removeArtifacts = this.removeArtifacts)
      : (this.data.removeArtifacts = false);
    this.data.nameValue = this.form?.get('name').value;
    this.data.wasCancelled = false;
    this.dialogRef.close(this.data);
  }

  onCancel(): void {
    this.data.artifacts && this.data.artifacts.length > 0
      ? (this.data.removeArtifacts = this.removeArtifacts)
      : (this.data.removeArtifacts = false);
    this.data.wasCancelled = true;
    this.dialogRef.close(this.data);
  }
}
