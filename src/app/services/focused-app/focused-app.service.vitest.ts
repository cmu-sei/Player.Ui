// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { FocusedAppService } from './focused-app.service';

function createService() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [FocusedAppService] });
  return TestBed.inject(FocusedAppService);
}

describe('FocusedAppService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('seeds focusedAppUrl with about:blank', async () => {
    const svc = createService();
    expect(await firstValueFrom(svc.focusedAppUrl)).toBe('about:blank');
  });

  it('emits the latest pushed url to subscribers', async () => {
    const svc = createService();
    svc.focusedAppUrl.next('https://app.test');
    expect(svc.focusedAppUrl.value).toBe('https://app.test');
    expect(await firstValueFrom(svc.focusedAppUrl)).toBe('https://app.test');
  });
});
