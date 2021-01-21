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
import { FileService } from '../../../generated/player-api';

@Component({
  selector: 'app-open-file',
  templateUrl: './open-file.component.html',
  styleUrls: ['./open-file.component.scss']
})
export class OpenFileComponent implements OnInit {

  constructor(
    private fileService: FileService,
    private route: ActivatedRoute,
  ) { }

  ngOnInit(): void {
    const fileId = this.route.snapshot.queryParamMap.get('id')
    const fileName = this.route.snapshot.queryParamMap.get('name');
    this.fileService.download(fileId).subscribe(
      data => {
        const url = window.URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        if (!this.isImageOrPdf(fileName)) {
          link.download = fileName;
        }
        link.click();
      },
      err => { window.alert('Error downloading file'); },
      () => { console.log('Got a next value'); }
    )
  }

  private isImageOrPdf(file: string): boolean {
    return file.endsWith('.pdf') || file.endsWith('.jpeg') || file.endsWith('.jpg') || file.endsWith('.png') 
      || file.endsWith('.bmp') || file.endsWith('.heic') || file.endsWith('.gif');
  }

}
