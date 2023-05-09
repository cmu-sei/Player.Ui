/*
Crucible
Copyright 2023 Carnegie Mellon University.
NO WARRANTY. THIS CARNEGIE MELLON UNIVERSITY AND SOFTWARE ENGINEERING INSTITUTE MATERIAL IS FURNISHED ON AN "AS-IS" BASIS. CARNEGIE MELLON UNIVERSITY MAKES NO WARRANTIES OF ANY KIND, EITHER EXPRESSED OR IMPLIED, AS TO ANY MATTER INCLUDING, BUT NOT LIMITED TO, WARRANTY OF FITNESS FOR PURPOSE OR MERCHANTABILITY, EXCLUSIVITY, OR RESULTS OBTAINED FROM USE OF THE MATERIAL. CARNEGIE MELLON UNIVERSITY DOES NOT MAKE ANY WARRANTY OF ANY KIND WITH RESPECT TO FREEDOM FROM PATENT, TRADEMARK, OR COPYRIGHT INFRINGEMENT.
Released under a MIT (SEI)-style license, please see license.txt or contact permission@sei.cmu.edu for full terms.
[DISTRIBUTION STATEMENT A] This material has been approved for public release and unlimited distribution.  Please see Copyright notice for non-US Government use and distribution.
Carnegie Mellon(R) and CERT(R) are registered in the U.S. Patent and Trademark Office by Carnegie Mellon University.
DM20-0181
*/

import { Component, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { FileService } from '../../../generated/player-api';

@Component({
  selector: 'app-edit-file',
  templateUrl: './edit-file-dialog.component.html',
  styleUrls: ['./edit-file-dialog.component.scss'],
})
export class EditFileDialogComponent implements OnInit {
  form: UntypedFormGroup;

  @Input() fileId: string;
  @Input() viewId: string;
  @Input() oldName: string;
  @Input() oldTeams: string[];

  extension: string;

  constructor(
    private fileService: FileService,
    private formBuilder: UntypedFormBuilder,
    private dialogRef: MatDialogRef<EditFileDialogComponent>
  ) {}

  ngOnInit(): void {

    const nameSplit = this.oldName.split('.');
    const name = nameSplit[0];
    this.extension = '.' + nameSplit[1];

    this.form = this.formBuilder.group({
      name: [name],
    });
  }

  /**
   * Submit the form and send the new name back to the parent component
   */
  submit() {
    // Do not allow the file extension to change
    const name = (this.form.get('name').value as string) + this.extension;
    const teams = this.oldTeams; // Note that teams are no longer updated in this popup but in the main edit panel
    console.log('submit');
    this.fileService.updateFile(this.fileId, name, teams, null).subscribe(
      (data) => {
        this.dialogRef.close({
          name: name,
          teams: teams,
        });
      },
      (err) => {
        console.log('Error updating file: ' + err);
      }
    );
  }

  cancel() {
    this.dialogRef.close({
      name: this.oldName,
      teams: this.oldTeams,
    });
  }
}
