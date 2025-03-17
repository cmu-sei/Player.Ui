// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { ValidatorFn } from '@angular/forms';

export interface NameValidatorModel {
  validator: ValidatorFn;
  name: string;
  errorMessage: string;
}
