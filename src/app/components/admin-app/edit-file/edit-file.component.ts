/*
Crucible
Copyright 2020 Carnegie Mellon University.
NO WARRANTY. THIS CARNEGIE MELLON UNIVERSITY AND SOFTWARE ENGINEERING INSTITUTE MATERIAL IS FURNISHED ON AN "AS-IS" BASIS. CARNEGIE MELLON UNIVERSITY MAKES NO WARRANTIES OF ANY KIND, EITHER EXPRESSED OR IMPLIED, AS TO ANY MATTER INCLUDING, BUT NOT LIMITED TO, WARRANTY OF FITNESS FOR PURPOSE OR MERCHANTABILITY, EXCLUSIVITY, OR RESULTS OBTAINED FROM USE OF THE MATERIAL. CARNEGIE MELLON UNIVERSITY DOES NOT MAKE ANY WARRANTY OF ANY KIND WITH RESPECT TO FREEDOM FROM PATENT, TRADEMARK, OR COPYRIGHT INFRINGEMENT.
Released under a MIT (SEI)-style license, please see license.txt or contact permission@sei.cmu.edu for full terms.
[DISTRIBUTION STATEMENT A] This material has been approved for public release and unlimited distribution.  Please see Copyright notice for non-US Government use and distribution.
Carnegie Mellon(R) and CERT(R) are registered in the U.S. Patent and Trademark Office by Carnegie Mellon University.
DM20-0181
*/

import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { FileService, Team, TeamService } from '../../../generated/player-api';

@Component({
  selector: 'app-edit-file',
  templateUrl: './edit-file.component.html',
  styleUrls: ['./edit-file.component.scss'],
})
export class EditFileComponent implements OnInit {
  form: FormGroup;

  @Input() fileId: string;
  @Input() viewId: string;
  @Input() oldName: string;
  @Input() oldTeams: string[];

  availableTeams: Team[];
  extension: string;

  constructor(
    private teamService: TeamService,
    private fileService: FileService,
    private formBuilder: FormBuilder,
    private dialogRef: MatDialogRef<EditFileComponent>
  ) {}

  ngOnInit(): void {
    this.getTeams();
    const nameSplit = this.oldName.split('.');
    const name = nameSplit[0];
    this.extension = '.' + nameSplit[1];

    this.form = this.formBuilder.group({
      name: [name],
      teamIDs: [this.oldTeams],
    });
  }

  /**
   * Get the teams in this view available to the user
   */
  getTeams() {
    this.teamService.getMyViewTeams(this.viewId).subscribe((data) => {
      this.availableTeams = data;
    });
  }

  /**
   * Submit the form and send the new name back to the parent component
   */
  submit() {
    // Do not allow the file extension to change
    const name = (this.form.get('name').value as string) + this.extension;
    const teams = this.form.get('teamIDs').value as string[];
    this.fileService.updateFile(this.fileId, name, teams, null).subscribe(
      (data) => {
        this.dialogRef.close({
          name: name,
        });
      },
      (err) => {
        console.log('Error updating file: ' + err);
      }
    );
  }
}
