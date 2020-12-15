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
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { FileService } from '../../../generated/player-api';
import { FileModel } from '../../../generated/player-api/model/fileModel';

@Component({
  selector: 'app-file-browse',
  templateUrl: './file-browse.component.html',
  styleUrls: ['./file-browse.component.scss']
})
export class FileBrowseComponent implements OnInit {

  public files: FileModel[];

  constructor(
    private fileService: FileService,
    private route: ActivatedRoute,
    private sanitizer: DomSanitizer  
  ) { }

  ngOnInit(): void {
    this.getFiles();
  }

  getFiles(): void {
    this.route.params.subscribe(params => {
      const viewId = params['id'];
      this.fileService.getViewFiles(viewId).subscribe(
        data => { this.files = data; console.log(this.files); },
        err => { console.log('Error fetching files ' + err); },
        () => { console.log('Done fetching files'); }
      );
    });
  }
}
