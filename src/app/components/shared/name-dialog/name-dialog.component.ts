// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
import { Component, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NameValidatorModel } from './name-dialog.models';
import {
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import {
  MatFormField,
  MatLabel,
  MatInput,
  MatError,
} from '@angular/material/input';

@Component({
  selector: 'name-dialog',
  templateUrl: './name-dialog.component.html',
  styleUrls: ['./name-dialog.component.scss'],
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    FormsModule,
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatInput,
    MatError,
  ],
})
export class NameDialogComponent {
  data = inject(MAT_DIALOG_DATA);
  dialogRef = inject<MatDialogRef<NameDialogComponent>>(MatDialogRef);
  private formBuilder = inject(FormBuilder);

  public title: string;
  public message: string;
  public removeArtifacts = true;
  public form: FormGroup;
  public validators: Array<NameValidatorModel> = [];

  constructor() {
    const data = this.data;

    this.form = this.formBuilder.group({
      name: [data.nameValue, [Validators.required]],
    });

    if (data.showDescription) {
      this.form.addControl(
        'description',
        this.formBuilder.control(data.descriptionValue ?? ''),
      );
    }

    if (data.validators) {
      this.validators = data.validators;
      const validators = (data.validators as Array<NameValidatorModel>).map(
        (x) => x.validator,
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
    if (this.data.showDescription) {
      this.data.descriptionValue = this.form?.get('description')?.value;
    }
    this.dialogRef.close(this.data);
  }
}
