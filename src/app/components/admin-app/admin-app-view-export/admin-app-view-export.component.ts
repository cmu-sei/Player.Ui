/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Component, EventEmitter, Output, inject, input } from '@angular/core';
import {
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { ArchiveType } from '../../../generated/player-api';
import { BehaviorSubject, finalize } from 'rxjs';
import { ViewsService } from '../../../services/views/views.service';
import FileDownloadUtils from '../../../utilities/file-download-utils';
import {
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
  CrucibleDialogActionsDirective,
} from '@cmusei/crucible-common';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/autocomplete';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-admin-app-view-export',
  templateUrl: './admin-app-view-export.component.html',
  styleUrls: ['./admin-app-view-export.component.scss'],
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    CrucibleDialogActionsDirective,
    MatButton,
    FormsModule,
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    AsyncPipe,
  ],
})
export class AdminAppViewExportComponent {
  private viewService = inject(ViewsService);

  readonly ids = input<string[]>(undefined);

  @Output() complete = new EventEmitter<boolean>();

  form: UntypedFormGroup;
  archiveTypes = Object.keys(ArchiveType);
  typeString: string;
  loading = false;
  hasErrors = new BehaviorSubject(false);
  hasErrors$ = this.hasErrors.asObservable();

  constructor() {
    const formBuilder = inject(UntypedFormBuilder);

    this.form = formBuilder.group({
      archiveType: [this.archiveTypes[0]],
    });
  }

  export() {
    this.onExport(this.ids(), ArchiveType[this.form.value.archiveType]);
  }

  cancel() {
    this.complete.emit(false);
  }

  private onExport(ids: string[], archiveType: ArchiveType) {
    this.loading = true;
    this.viewService
      .export(ids, archiveType)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe((result) => {
        FileDownloadUtils.downloadFile(result.blob, result.filename);

        if (result.hasErrors) {
          this.hasErrors.next(true);
        } else {
          this.complete.emit(true);
        }
      });
  }
}
