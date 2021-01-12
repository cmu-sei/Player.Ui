// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { TestBed, inject } from '@angular/core/testing';

import { FocusedAppService } from './focused-app.service';

describe('FocusedAppService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FocusedAppService],
    });
  });

  it('should be created', inject(
    [FocusedAppService],
    (service: FocusedAppService) => {
      expect(service).toBeTruthy();
    }
  ));
});
