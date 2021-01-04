// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { TestBed, inject } from '@angular/core/testing';

import { TeamsService } from './teams.service';

describe('TeamsService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TeamsService],
    });
  });

  it('should be created', inject([TeamsService], (service: TeamsService) => {
    expect(service).toBeTruthy();
  }));
});
