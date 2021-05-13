/*
Crucible
Copyright 2020 Carnegie Mellon University.
NO WARRANTY. THIS CARNEGIE MELLON UNIVERSITY AND SOFTWARE ENGINEERING INSTITUTE MATERIAL IS FURNISHED ON AN "AS-IS" BASIS. CARNEGIE MELLON UNIVERSITY MAKES NO WARRANTIES OF ANY KIND, EITHER EXPRESSED OR IMPLIED, AS TO ANY MATTER INCLUDING, BUT NOT LIMITED TO, WARRANTY OF FITNESS FOR PURPOSE OR MERCHANTABILITY, EXCLUSIVITY, OR RESULTS OBTAINED FROM USE OF THE MATERIAL. CARNEGIE MELLON UNIVERSITY DOES NOT MAKE ANY WARRANTY OF ANY KIND WITH RESPECT TO FREEDOM FROM PATENT, TRADEMARK, OR COPYRIGHT INFRINGEMENT.
Released under a MIT (SEI)-style license, please see license.txt or contact permission@sei.cmu.edu for full terms.
[DISTRIBUTION STATEMENT A] This material has been approved for public release and unlimited distribution.  Please see Copyright notice for non-US Government use and distribution.
Carnegie Mellon(R) and CERT(R) are registered in the U.S. Patent and Trademark Office by Carnegie Mellon University.
DM20-0181
*/

import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FileService, Team, TeamService } from '../../../generated/player-api';
import { FileModel } from '../../../generated/player-api/model/fileModel';

@Component({
  selector: 'app-file-browse',
  templateUrl: './file-browse.component.html',
  styleUrls: ['./file-browse.component.scss'],
})
export class FileBrowseComponent implements OnInit {
  public files = new Array<FileModel>();
  public teams = new Set<Team>();
  public currentTeam = '';

  constructor(
    private fileService: FileService,
    private teamService: TeamService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.getFiles();
  }

  getFiles(): void {
    const viewId = this.route.snapshot.paramMap.get('id');
    this.fileService.getViewFiles(viewId).subscribe(
      (data) => {
        this.files = data;
        console.log(this.files);
      },
      (err) => {
        console.log('Error fetching files ' + err);
      }
    );
    this.teamService.getMyViewTeams(viewId).subscribe(
      (data) => {
        for (let team of data) {
          this.teams.add(team);
        }
      },
      (err) => {
        console.log('Error fetching teams ' + err);
      }
    );
  }

  downloadFile(id: string, name: string) {
    this.fileService.download(id).subscribe(
      (data) => {
        const url = window.URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        if (!this.isImageOrPdf(name)) {
          console.log('Not image or pdf');
          link.download = name;
        }
        link.click();
      },
      (err) => {
        window.alert('Error downloading file');
      },
      () => {
        console.log('Got a next value');
      }
    );
  }

  filtered() {
    let ret = new Array<FileModel>();
    for (let file of this.files) {
      if (file.teamIds.includes(this.currentTeam)) {
        ret.push(file);
      }
    }
    return ret;
  }

  selectTeam(team: string) {
    this.currentTeam = team;
  }

  // Returns true if the filename is an image or pdf and false otherwise
  private isImageOrPdf(file: string): boolean {
    return (
      file.endsWith('.pdf') ||
      file.endsWith('.jpeg') ||
      file.endsWith('.jpg') ||
      file.endsWith('.png') ||
      file.endsWith('.bmp') ||
      file.endsWith('.heic') ||
      file.endsWith('.gif')
    );
  }
}
