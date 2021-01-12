// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { TestBed, inject } from '@angular/core/testing';

import { ViewsService } from './views.service';

describe('ViewsService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ViewsService],
    });
  });

  it('should be created', inject([ViewsService], (service: ViewsService) => {
    expect(service).toBeTruthy();
  }));
});
