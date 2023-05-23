// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnInit, Input, ViewChild } from '@angular/core';
import {
  View,
  ApplicationTemplate,
  ApplicationService,
  Application,
} from '../../../generated/player-api';
import { DialogService } from '../../../services/dialog/dialog.service';
import {
  UntypedFormControl,
  FormGroupDirective,
  NgForm,
  Validators,
} from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';

@Component({
  selector: 'app-view-applications-select',
  templateUrl: './view-applications-select.component.html',
  styleUrls: ['./view-applications-select.component.scss'],
})
export class ViewApplicationsSelectComponent implements OnInit {
  @Input() view: View;
  @ViewChild(ViewApplicationsSelectComponent) child;

  public nameFormControl = new UntypedFormControl('', [
    Validators.required,
    Validators.minLength(3),
  ]);

  public urlFormControl = new UntypedFormControl('', [Validators.required]);

  public iconFormControl = new UntypedFormControl('', [Validators.required]);

  public matcher = new AppErrorStateMatcher();

  public applications: Array<Application>;
  public applicationTemplates = new Array<ApplicationTemplate>();
  public currentApp: Application;
  public isLoading: boolean;

  constructor(
    public applicationService: ApplicationService,
    public dialogService: DialogService
  ) {}

  /**
   * Initialization
   */
  ngOnInit() {
    this.isLoading = false;

    if (!this.view) {
      // either a team or a view must be provided, so roles and permissions will not be functional
      console.log(
        'The applications select component requires either an view, therefore will be non-functional.'
      );
      return;
    } else {
      this.updateApplications();
    }

    this.applicationService.getApplicationTemplates().subscribe((appTmps) => {
      this.applicationTemplates = appTmps;
    });
  }

  /**
   * Called to update the list of apps for the view
   */
  updateApplications() {
    this.isLoading = true;
    this.applicationService
      .getViewApplications(this.view.id)
      .subscribe((appInsts) => {
        this.applications = appInsts;
        this.isLoading = false;
      });
  }

  /**
   * Saves the application name
   * @param name New name of the application
   * @param id app Guid
   */
  saveApplicationName(name: string, id: string): void {
    if (name === '') {
      name = null;
    }

    // if (!this.nameFormControl.hasError('minlength') && !this.nameFormControl.hasError('required')) {
    this.applicationService.getApplication(id).subscribe((app) => {
      app.name = name;
      this.saveApplication(app);
    });
    // }
  }

  /**
   * Saves the application url
   * @param url New url for the application
   * @param id app Guid
   */
  saveApplicationUrl(url: string, id: string): void {
    if (url === '') {
      url = null;
    }

    // if (!this.urlFormControl.hasError('required')) {
    this.applicationService.getApplication(id).subscribe((app) => {
      app.url = url;
      this.saveApplication(app);
    });
    // }
  }

  /**
   * Saves the application icon path
   * @param iconPath New icon path for the application
   * @param id app Guid
   */
  saveApplicationIcon(iconPath: string, id: string): void {
    if (iconPath === '') {
      iconPath = null;
    }

    // if (!this.iconFormControl.hasError('required')) {
    this.applicationService.getApplication(id).subscribe((app) => {
      app.icon = iconPath;
      this.saveApplication(app);
    });
    // }
  }

  /**
   * Saves the application embeddable flag
   * @param application The changed application object
   */
  saveApplicationEmbeddable(application: Application): void {
    this.applicationService.getApplication(application.id).subscribe((app) => {
      app.embeddable = application.embeddable;
      this.saveApplication(app);
    });
  }

  /**
   * Saves the application load in background flag
   * @param application The changed application object
   */
  saveApplicationLoadInBackground(application: Application): void {
    this.applicationService.getApplication(application.id).subscribe((app) => {
      app.loadInBackground = application.loadInBackground;
      this.saveApplication(app);
    });
  }

  saveApplicationTemplateId(application: Application): void {
    this.applicationService.getApplication(application.id).subscribe((app) => {
      app.applicationTemplateId = application.applicationTemplateId;
      this.saveApplication(app);
    });
  }

  /**
   * Generically saves the application for the view and updates the applications list
   */
  saveApplication(app: Application) {
    this.applicationService.updateApplication(app.id, app).subscribe(() => {
      this.applicationService
        .getViewApplications(this.view.id)
        .subscribe((appInsts) => {
          this.applications = appInsts;
        });
      console.log('Application name updated');
    });
  }

  /**
   * Removes an app from the view
   * @param app The app to delete
   */
  deleteViewApplication(app: Application) {
    this.dialogService
      .confirm(
        'Delete Application',
        'Are you sure that you want to remove the application ' +
          this.getAppName(app) +
          '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.applicationService.deleteApplication(app.id).subscribe(() => {
            console.log('successfully deleted application');
            this.updateApplications();
          });
        }
      });
  }

  getAppName(app: Application) {
    if (app.name != null) {
      return app.name;
    } else if (app.applicationTemplateId != null) {
      const template = this.applicationTemplates.find(
        (x) => x.id === app.applicationTemplateId
      );

      if (template != null) {
        return template.name;
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  getAppIcon(app: Application) {
    if (app.icon != null) {
      return app.icon;
    } else if (app.applicationTemplateId != null) {
      const template = this.applicationTemplates.find(
        (x) => x.id === app.applicationTemplateId
      );

      if (template != null) {
        return template.icon;
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  getTemplate(applicationTemplateId: string) {
    const template = this.applicationTemplates.find(
      (x) => x.id === applicationTemplateId
    );
    return template;
  }
}
/** Error when invalid control is dirty, touched, or submitted. */
export class AppErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(
    control: UntypedFormControl | null,
    form: FormGroupDirective | NgForm | null
  ): boolean {
    const isSubmitted = form && form.submitted;
    return !!(control && control.invalid && (control.dirty || isSubmitted));
  }
}
