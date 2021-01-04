// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import {
  ApplicationTemplate,
  ApplicationService,
} from '../../../../generated/player-api';
import { DialogService } from '../../../../services/dialog/dialog.service';

@Component({
  selector: 'app-admin-template-details',
  templateUrl: './admin-template-details.component.html',
  styleUrls: ['./admin-template-details.component.scss'],
})
export class AdminTemplateDetailsComponent implements OnInit {
  @Input() appTemplate: ApplicationTemplate;
  @Output() refresh = new EventEmitter<boolean>();

  constructor(
    public applicationService: ApplicationService,
    public dialogService: DialogService
  ) {}

  ngOnInit() {}

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
    this.dialogService
      .confirm(
        'Delete Application Template?',
        'Are you sure that you want to delete application template ' +
          this.appTemplate.name +
          '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.applicationService
            .deleteApplicationTemplate(this.appTemplate.id)
            .subscribe(() => {
              this.refresh.emit(true); // True indicates that the template was deleted
            });
        }
      });
  }
}
