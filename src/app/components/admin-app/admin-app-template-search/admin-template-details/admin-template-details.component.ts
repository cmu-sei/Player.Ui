// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, Input, inject, output } from '@angular/core';
import {
  ApplicationTemplate,
  ApplicationService,
  SystemPermission,
} from '../../../../generated/player-api';
import { UserPermissionsService } from '../../../../services/permissions/user-permissions.service';
import { AsyncPipe } from '@angular/common';
import { catchError, throwError } from 'rxjs';
import { MatSelect, MatOption } from '@angular/material/select';
import { MatHint } from '@angular/material/form-field';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { MatFormField, MatLabel, MatInput } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatButton } from '@angular/material/button';

@Component({
  selector: 'app-admin-template-details',
  templateUrl: './admin-template-details.component.html',
  styleUrls: ['./admin-template-details.component.scss'],
  imports: [
    MatFormField,
    MatLabel,
    MatInput,
    FormsModule,
    MatCheckbox,
    MatButton,
    MatSelect,
    MatOption,
    MatHint,
    AsyncPipe,
  ],
})
export class AdminTemplateDetailsComponent {
  applicationService = inject(ApplicationService);
  private confirmDialogService = inject(CrucibleDialogService);
  private userPermissionsService = inject(UserPermissionsService);

  canEdit$ = this.userPermissionsService.hasPermission(
    SystemPermission.ManageApplications,
  );

  @Input() appTemplate: ApplicationTemplate;
  /** Every template, to choose where this one's applications move when it is deleted. */
  @Input() templates: ApplicationTemplate[] = [];
  replacementTemplateId: string | null = null;
  readonly refresh = output<boolean>();

  /**
   * Edit an application template. If the API refuses the change (a name another template already
   * uses), the template goes back to its saved values; the error itself still reaches the error handler.
   */
  editAppTemplate() {
    const id = this.appTemplate.id;
    this.applicationService
      .updateApplicationTemplate(id, this.appTemplate)
      .pipe(
        catchError((err) => {
          // In place: the object is the list's row too, so its Name column and the other panels'
          // replacement choices go back to the saved values as well.
          this.applicationService
            .getApplicationTemplate(id)
            .subscribe((saved) => Object.assign(this.appTemplate, saved));
          return throwError(() => err);
        }),
      )
      .subscribe((result) => {
        this.appTemplate = result;
      });
  }

  get otherTemplates(): ApplicationTemplate[] {
    return (this.templates ?? []).filter((x) => x.id !== this.appTemplate?.id);
  }

  /**
   * Deletes the application template, first moving any applications that use it to the chosen
   * replacement. Without one, the API refuses to delete a template that is still in use.
   */
  deleteApplicationTemplate() {
    const replacement = this.otherTemplates.find(
      (x) => x.id === this.replacementTemplateId,
    );
    this.confirmDialogService
      .confirm({
        title: 'Delete Application Template?',
        message:
          'Are you sure that you want to delete application template ' +
          this.appTemplate.name +
          '?' +
          (replacement
            ? ` Applications that use it will move to ${replacement.name} (${replacement.url}).`
            : ''),
        confirmText: 'Delete',
        cancelText: 'Cancel',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.applicationService
            .deleteApplicationTemplate(this.appTemplate.id, replacement?.id)
            .subscribe(() => {
              this.refresh.emit(true); // True indicates that the template was deleted
            });
        }
      });
  }
}
