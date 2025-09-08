/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Component, EventEmitter, Output } from '@angular/core';
import {
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
} from '@angular/forms';
import { BehaviorSubject, finalize, tap } from 'rxjs';
import { ImportViewsResult } from '../../../generated/player-api';
import { ViewsService } from '../../../services/views/views.service';

@Component({
  selector: 'app-admin-app-view-import',
  templateUrl: './admin-app-view-import.component.html',
  styleUrls: ['./admin-app-view-import.component.scss'],
})
export class AdminAppViewImportComponent {
  @Output() complete = new EventEmitter<boolean>();

  form: UntypedFormGroup;
  typeString = 'Views';
  finished = new BehaviorSubject<boolean>(false);
  finished$ = this.finished.asObservable();
  loading = false;
  resultSubject = new BehaviorSubject<ImportViewsResult>(null);
  result$ = this.resultSubject.asObservable();

  onFileSelected(event: any): void {
    this.form.patchValue({ archive: event.target.files[0] ?? null });
  }

  constructor(
    private viewService: ViewsService,
    formBuilder: UntypedFormBuilder
  ) {
    this.form = formBuilder.group({
      archive: [null, Validators.required],
      matchApplicationTemplatesByName: [false, Validators.required],
      matchRolesByName: [false, Validators.required],
    });
  }

  import() {
    this.onImport(
      this.form.value.archive,
      this.form.value.matchApplicationTemplatesByName,
      this.form.value.matchRolesByName
    );
  }

  cancel() {
    this.complete.emit(false);
  }

  private onImport(
    archive: Blob,
    matchApplicationTemplatesByName: boolean,
    matchRolesByName: boolean
  ) {
    this.loading = true;

    this.viewService
      .import(matchApplicationTemplatesByName, matchRolesByName, archive)
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
