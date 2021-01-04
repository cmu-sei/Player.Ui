// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { TestBed, inject } from '@angular/core/testing';

import { LoggedInUserService } from './logged-in-user.service';

describe('UsersService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LoggedInUserService],
    });
  });

  it('should be created', inject(
    [LoggedInUserService],
    (service: LoggedInUserService) => {
      expect(service).toBeTruthy();
    }
  ));
});
