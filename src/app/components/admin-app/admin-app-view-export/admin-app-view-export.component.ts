import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
} from '@angular/forms';
import { ArchiveType } from '../../../generated/player-api';
import { BehaviorSubject, finalize } from 'rxjs';
import { ViewsService } from '../../../services/views/views.service';
import FileDownloadUtils from '../../../utilities/file-download-utils';

@Component({
  selector: 'app-admin-app-view-export',
  templateUrl: './admin-app-view-export.component.html',
  styleUrls: ['./admin-app-view-export.component.scss'],
})
export class AdminAppViewExportComponent {
  @Input() ids: string[];

  @Output() complete = new EventEmitter<boolean>();

  form: UntypedFormGroup;
  isArchiveable: boolean = true;
  archiveTypes = Object.keys(ArchiveType);
  typeString: string;
  loading = false;
  hasErrors = new BehaviorSubject(false);
  hasErrors$ = this.hasErrors.asObservable();

  constructor(
    private viewService: ViewsService,
    formBuilder: UntypedFormBuilder
  ) {
    this.form = formBuilder.group({
      archiveType: [this.archiveTypes[0]],
    });
  }

  ngOnInit() {}

  export() {
    this.onExport(this.ids, ArchiveType[this.form.value.archiveType]);
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
