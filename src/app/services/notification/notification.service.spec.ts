// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { TestBed, inject } from '@angular/core/testing';

import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [NotificationService],
    });
  });

  it('should be created', inject(
    [NotificationService],
    (service: NotificationService) => {
      expect(service).toBeTruthy();
    }
  ));
});
