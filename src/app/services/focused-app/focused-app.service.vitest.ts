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

  /**
   * Verifies: a freshly injected service exposes focusedAppUrl whose initial emission is 'about:blank'
   * Interacts with: service.focusedAppUrl (a BehaviorSubject); no collaborators
   * Data: default service construction, no overrides
   */
  it('seeds focusedAppUrl with about:blank', async () => {
    const svc = createService();
    expect(await firstValueFrom(svc.focusedAppUrl)).toBe('about:blank');
  });

  /**
   * Verifies: pushing a url via next() updates both the BehaviorSubject value and what new subscribers receive
   * Interacts with: service.focusedAppUrl.next / .value; no collaborators
   * Data: a single pushed url 'https://app.test'
   */
  it('emits the latest pushed url to subscribers', async () => {
    const svc = createService();
    svc.focusedAppUrl.next('https://app.test');
    expect(svc.focusedAppUrl.value).toBe('https://app.test');
    expect(await firstValueFrom(svc.focusedAppUrl)).toBe('https://app.test');
  });
});
