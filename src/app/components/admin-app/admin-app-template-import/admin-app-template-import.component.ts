// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  ChangeDetectionStrategy,
  Output,
  EventEmitter,
  Optional,
} from '@angular/core';
import {
  UntypedFormGroup,
  UntypedFormBuilder,
  Validators,
} from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import {
  ApplicationService,
  ImportApplicationTemplatesResult,
} from '../../../generated/player-api';
import { BehaviorSubject, finalize, tap } from 'rxjs';

@Component({
    selector: 'app-admin-app-template-import',
    templateUrl: './admin-app-template-import.component.html',
    styleUrls: ['./admin-app-template-import.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class AdminAppTemplateImportComponent {
  @Output() complete = new EventEmitter<boolean>();

  form: UntypedFormGroup;
  typeString = 'Application Templates';
  finished = new BehaviorSubject<boolean>(false);
  finished$ = this.finished.asObservable();
  loading = false;
  resultSubject = new BehaviorSubject<ImportApplicationTemplatesResult>(null);
  result$ = this.resultSubject.asObservable();
  private completeEmitted = false;

  onFileSelected(event: any): void {
    this.form.patchValue({ archive: event.target.files[0] ?? null });
  }

  constructor(
    private applicationService: ApplicationService,
    formBuilder: UntypedFormBuilder,
    @Optional()
    private dialogRef?: MatDialogRef<AdminAppTemplateImportComponent>
  ) {
    this.form = formBuilder.group({
      archive: [null, Validators.required],
      overwriteExisting: [false, Validators.required],
    });

    this.dialogRef?.beforeClosed().subscribe(() => {
      if (this.finished.value) {
        this.emitComplete();
      }
    });
  }

  import() {
    this.onImport(this.form.value.archive, this.form.value.overwriteExisting);
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

  private onImport(archive: Blob, overwriteExisting: boolean) {
    this.loading = true;

    this.applicationService
      .importApplicationTemplates(overwriteExisting, archive)
      .pipe(
        tap((x) => this.resultSubject.next(x)),
        finalize(() => {
          this.finished.next(true);
          this.loading = false;
        })
      )
      .subscribe();
  }
}
