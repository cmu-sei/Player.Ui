/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Component, inject, output } from '@angular/core';
import {
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { BehaviorSubject, finalize, tap } from 'rxjs';
import { ImportViewsResult } from '../../../generated/player-api';
import { ViewsService } from '../../../services/views/views.service';
import {
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
  CrucibleDialogActionsDirective,
} from '@cmusei/crucible-common';
import { MatButton } from '@angular/material/button';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatTooltip } from '@angular/material/tooltip';
import { AsyncPipe, TitleCasePipe } from '@angular/common';

@Component({
  selector: 'app-admin-app-view-import',
  templateUrl: './admin-app-view-import.component.html',
  styleUrls: ['./admin-app-view-import.component.scss'],
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    CrucibleDialogActionsDirective,
    MatButton,
    FormsModule,
    ReactiveFormsModule,
    MatSlideToggle,
    MatTooltip,
    AsyncPipe,
    TitleCasePipe,
  ],
})
export class AdminAppViewImportComponent {
  private viewService = inject(ViewsService);
  private dialogRef = inject<MatDialogRef<AdminAppViewImportComponent>>(
    MatDialogRef,
    { optional: true },
  );

  readonly complete = output<boolean>();

  form: UntypedFormGroup;
  typeString = 'Views';
  finished = new BehaviorSubject<boolean>(false);
  finished$ = this.finished.asObservable();
  loading = false;
  resultSubject = new BehaviorSubject<ImportViewsResult>(null);
  result$ = this.resultSubject.asObservable();
  private completeEmitted = false;

  onFileSelected(event: any): void {
    this.form.patchValue({ archive: event.target.files[0] ?? null });
  }

  constructor() {
    const formBuilder = inject(UntypedFormBuilder);

    this.form = formBuilder.group({
      archive: [null, Validators.required],
      matchApplicationTemplatesByName: [false, Validators.required],
      matchRolesByName: [false, Validators.required],
    });

    this.dialogRef?.beforeClosed().subscribe(() => {
      if (this.finished.value) {
        this.emitComplete();
      }
    });
  }

  import() {
    this.onImport(
      this.form.value.archive,
      this.form.value.matchApplicationTemplatesByName,
      this.form.value.matchRolesByName,
    );
  }

  cancel() {
    this.emitComplete();
  }

  private emitComplete() {
    if (this.completeEmitted) {
      return;
    }

    this.completeEmitted = true;
    this.complete.emit(false);
  }

  private onImport(
    archive: Blob,
    matchApplicationTemplatesByName: boolean,
    matchRolesByName: boolean,
  ) {
    this.loading = true;

    this.viewService
      .import(matchApplicationTemplatesByName, matchRolesByName, archive)
      .pipe(
        tap((x) => this.resultSubject.next(x)),
        finalize(() => {
          this.finished.next(true);
          this.loading = false;
        }),
      )
      .subscribe();
  }
}
