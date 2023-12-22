// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnInit, Input } from '@angular/core';
import {
  Team,
  ApplicationService,
  ApplicationInstance,
  Application,
  ApplicationInstanceForm,
  View,
  ApplicationTemplate,
} from '../../../generated/player-api';
import { DialogService } from '../../../services/dialog/dialog.service';

export enum ObjectType {
  Unknown,
  Team,
  View,
}

@Component({
  selector: 'app-team-applications-select',
  templateUrl: './team-applications-select.component.html',
  styleUrls: ['./team-applications-select.component.scss'],
})
export class TeamApplicationsSelectComponent implements OnInit {
  @Input() team: Team;
  @Input() view: View;

  public viewApplications: Array<Application>;
  public applications: Array<ApplicationInstance>;
  public applicationTemplates = new Array<ApplicationTemplate>();
  public objTypes = ObjectType;

  public subjectType = ObjectType.Unknown;
  public subject: any;
  public currentApp: Application;

  constructor(
    public applicationService: ApplicationService,
    public dialogService: DialogService
  ) {}

  /**
   * Initialization
   */
  ngOnInit() {
    if (!this.team) {
      // a team must be provided or will not be functional
      console.log(
        'The applications select component requires a team, therefore will be non-functional.'
      );
      return;
    } else {
      this.subjectType = ObjectType.Team;
      this.subject = this.team;
      this.refreshTeamApplications();
    }
  }

  /**
   * Refreshes the View Apps list
   */
  refreshViewAppsAvailable(): void {
    this.applicationService
      .getViewApplications(this.view.id)
      .subscribe((apps) => {
        this.viewApplications = new Array<Application>();
        apps.forEach((app) => {
          if (
            this.applications.findIndex((a) => app.id === a.applicationId) ===
            -1
          ) {
            this.viewApplications.push(app);
          }
        });
      });

    this.applicationService.getApplicationTemplates().subscribe((appTmps) => {
      this.applicationTemplates = appTmps;
    });
  }

  /**
   * Refreshes the team apps
   */
  refreshTeamApplications(): void {
    this.applicationService
      .getTeamApplicationInstances(this.team.id)
      .subscribe((appInsts) => {
        this.applications = appInsts;
        this.refreshViewAppsAvailable();
      });
  }

  /**
   * Adds an application to the team
   * @param app The app to add
   */
  addViewAppToTeam(app: Application): void {
    const appInstance = <ApplicationInstanceForm>{
      teamId: this.team.id,
      applicationId: app.id,
      displayOrder: this.applications.length,
    };
    this.applicationService
      .createApplicationInstance(this.team.id, appInstance)
      .subscribe(() => {
        this.refreshTeamApplications();
      });
  }

  public moveAppUp(id: string) {
    this.applicationService
      .moveUpApplicationInstance(id)
      .subscribe((x) => (this.applications = x));
  }

  public moveAppDown(id: string) {
    this.applicationService
      .moveDownApplicationInstance(id)
      .subscribe((x) => (this.applications = x));
  }

  /**
   * Removes an application from a team
   * @param app App to remove
   */
  removeApplicationInstanceFromTeam(app: ApplicationInstance): void {
    this.dialogService
      .confirm(
        'Remove Application from Team',
        'Are you sure that you want to remove application ' +
          app.name +
          ' from team ' +
          this.team.name +
          '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.applicationService
            .deleteApplicationInstance(app.id)
            .subscribe(() => {
              // Verify display orders and fix if necessary
              let index = 0;
              const apps = this.applications.filter((a) => a.id !== app.id);
              apps.forEach((a) => {
                if (a.displayOrder !== index) {
                  const appOrdered = <ApplicationInstanceForm>{
                    id: a.id,
                    teamId: this.team.id,
                    applicationId: a.applicationId,
                    displayOrder: index,
                  };
                  this.applicationService
                    .updateApplicationInstance(appOrdered.id, appOrdered)
                    .subscribe(() => {
                      a.displayOrder = index; // Update here rather than calling again.
                    });
                }
                index++;
              });

              this.refreshTeamApplications();
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
}
