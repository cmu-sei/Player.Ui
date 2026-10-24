// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, Input, inject, output } from '@angular/core';
import {
  ApplicationTemplate,
  ApplicationService,
} from '../../../../generated/player-api';
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
  ],
})
export class AdminTemplateDetailsComponent {
  applicationService = inject(ApplicationService);
  private confirmDialogService = inject(CrucibleDialogService);

  @Input() appTemplate: ApplicationTemplate;
  readonly refresh = output<boolean>();

  /**
   * Edit an application template
   */
  editAppTemplate() {
    // get new credentials and upload path
    this.applicationService
      .updateApplicationTemplate(this.appTemplate.id, this.appTemplate)
      .subscribe((result) => {
        this.appTemplate = result;
      });
  }

  /**
   * Deletes the application template
   */
  deleteApplicationTemplate() {
    this.confirmDialogService
      .confirm({
        title: 'Delete Application Template?',
        message:
          'Are you sure that you want to delete application template ' +
          this.appTemplate.name +
          '?',
        confirmText: 'Delete',
        cancelText: 'Cancel',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.applicationService
            .deleteApplicationTemplate(this.appTemplate.id)
            .subscribe(() => {
              this.refresh.emit(true); // True indicates that the template was deleted
            });
        }
      });
  }
}
