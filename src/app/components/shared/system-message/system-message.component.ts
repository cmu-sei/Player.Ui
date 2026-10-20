// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, inject } from '@angular/core';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'app-system-message',
  templateUrl: './system-message.component.html',
  styleUrls: ['./system-message.component.scss'],
  imports: [MatIconButton, MatIcon],
})
export class SystemMessageComponent {
  messageSheet =
    inject<MatBottomSheetRef<SystemMessageComponent>>(MatBottomSheetRef);
  data = inject(MAT_BOTTOM_SHEET_DATA);

  public displayTitle: string;
  public displayMessage: string;

  constructor() {
    const data = this.data;

    this.displayTitle = data.title;
    this.displayMessage = data.message;
  }

  close() {
    this.messageSheet.dismiss();
  }
}
