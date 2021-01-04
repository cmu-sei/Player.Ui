// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { SafeUrl } from '@angular/platform-browser';

export interface ApplicationData {
  id: string;
  applicationId: string;
  displayOrder: number;
  name: string;
  url: string;
  icon: string;
  embeddable: boolean;
  loadInBackground: boolean;
  viewId: string;
  safeUrl: SafeUrl;
}
