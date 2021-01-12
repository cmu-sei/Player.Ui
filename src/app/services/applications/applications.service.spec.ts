// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { TestBed, inject } from '@angular/core/testing';

import { ApplicationsService } from './applications.service';

describe('ApplicationsService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ApplicationsService],
    });
  });

  it('should be created', inject(
    [ApplicationsService],
    (service: ApplicationsService) => {
      expect(service).toBeTruthy();
    }
  ));
});
