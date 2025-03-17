/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Component, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { take } from 'rxjs/operators';
import { ApplicationService, FileModel } from '../../../generated/player-api';
import { TeamUserApp } from '../../admin-app/admin-view-search/admin-view-edit/admin-view-edit.component';

@Component({
  selector: 'app-create-application-dialog',
  templateUrl: './create-application-dialog.component.html',
  styleUrls: ['./create-application-dialog.component.scss'],
})
export class CreateApplicationDialogComponent implements OnInit {
  @Input() applicationId: string;
  @Input() file: FileModel;
  @Input() viewName: string;
  @Input() currentTeams: TeamUserApp[];

  form: UntypedFormGroup;

  constructor(
    public formBuilder: UntypedFormBuilder,
    private applicationService: ApplicationService,
    private dialogRef: MatDialogRef<CreateApplicationDialogComponent>
  ) {}

  ngOnInit(): void {
    this.form = this.formBuilder.group({
      teams: [this.file.teamIds],
    });
  }

  /**
   * Submit the form and send the new name back to the parent component
   */
  submit() {
    const teams = this.form.get('teams').value as string[];

    teams.forEach((teamId) => {
      this.applicationService
        .getTeamApplicationInstances(teamId)
        .pipe(take(1))
        .subscribe((app) => {
          this.applicationService
            .createApplicationInstance(teamId, {
              teamId: teamId,
              applicationId: this.applicationId,
              displayOrder: app.length,
            })
            .pipe(take(1))
            .subscribe();
        });
    });

    this.dialogRef.close({
      teams: teams,
    });
  }

  cancel() {
    // The user does not want the teams to have the application
    this.dialogRef.close({
      teams: [],
    });
  }
}
