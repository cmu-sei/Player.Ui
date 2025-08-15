// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnInit,
  Input,
  ChangeDetectionStrategy,
  Output,
  EventEmitter,
} from '@angular/core';
import {
  UntypedFormGroup,
  UntypedFormBuilder,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { ApplicationService, ArchiveType } from '../../../generated/player-api';
import FileDownloadUtils from '../../../utilities/file-download-utils';
import HttpHeaderUtils from '../../../utilities/http-header-utils';
import { BehaviorSubject, finalize, map } from 'rxjs';

@Component({
  selector: 'app-admin-app-template-export',
  templateUrl: './admin-app-template-export.component.html',
  styleUrls: ['./admin-app-template-export.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAppTemplateExportComponent implements OnInit {
  @Input() ids: string[];

  @Output() complete = new EventEmitter<boolean>();

  form: UntypedFormGroup;
  isArchiveable: boolean = true;
  archiveTypes = Object.keys(ArchiveType);
  typeString: string;
  includeIcons: AbstractControl;
  loading = false;
  hasErrors = new BehaviorSubject(false);
  hasErrors$ = this.hasErrors.asObservable();

  constructor(
    private applicationService: ApplicationService,
    formBuilder: UntypedFormBuilder
  ) {
    this.form = formBuilder.group({
      archiveType: [this.archiveTypes[0]],
      includeIcons: [false, Validators.required],
      embedIcons: [{ value: false, disabled: true }, Validators.required],
    });

    this.includeIcons = this.form.get('includeIcons');
    const embedIcons = this.form.get('embedIcons');

    this.includeIcons.valueChanges.subscribe((enabled: boolean) => {
      if (enabled) {
        embedIcons.enable();
      } else {
        embedIcons.disable();
      }
    });
  }

  ngOnInit() {}

  export() {
    this.onExport(
      this.ids,
      ArchiveType[this.form.value.archiveType],
      this.form.value.includeIcons,
      this.includeIcons.value ? this.form.value.embedIcons : false
    );
  }

  cancel() {
    this.complete.emit(false);
  }

  private onExport(
    ids: string[],
    archiveType: ArchiveType,
    includeIcons,
    embedIcons
  ) {
    this.loading = true;
    this.applicationService
      .exportApplicationTemplates(
        includeIcons,
        embedIcons,
        archiveType,
        ids,
        'response'
      )
      .pipe(
        map((response) => {
          return {
            blob: response.body,
            filename: HttpHeaderUtils.getFilename(response.headers),
            hasErrors: HttpHeaderUtils.hasArchiveErrors(response.headers),
          };
        }),
        finalize(() => (this.loading = false))
      )
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
