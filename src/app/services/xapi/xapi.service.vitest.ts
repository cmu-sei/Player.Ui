// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError, firstValueFrom } from 'rxjs';
import { ComnSettingsService } from '@cmusei/crucible-common';
import { XApiService as GeneratedXApiService } from '../../generated/player-api';
import { XApiService } from './xapi.service';

function createService(
  overrides: {
    enabled?: boolean;
    fail?: boolean;
  } = {},
) {
  const { enabled = true, fail = false } = overrides;

  const result = () =>
    fail ? throwError(() => new Error('boom')) : of({ ok: true });

  const generated = {
    viewViewed: vi.fn(result),
    applicationSwitched: vi.fn(result),
    teamSwitched: vi.fn(result),
    viewTerminated: vi.fn(result),
  };

  TestBed.configureTestingModule({
    providers: [
      { provide: GeneratedXApiService, useValue: generated },
      {
        provide: ComnSettingsService,
        useValue: { settings: { XApiEnabled: enabled } },
      },
      XApiService,
    ],
  });

  return { service: TestBed.inject(XApiService), generated };
}

describe('XApiService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when XApiEnabled is false', () => {
    it('viewViewed returns null without calling the generated client', async () => {
      const { service, generated } = createService({ enabled: false });
      expect(await firstValueFrom(service.viewViewed('v1'))).toBeNull();
      expect(generated.viewViewed).not.toHaveBeenCalled();
    });

    it('applicationSwitched returns null without calling the generated client', async () => {
      const { service, generated } = createService({ enabled: false });
      expect(
        await firstValueFrom(service.applicationSwitched('v1', 'App', 'url')),
      ).toBeNull();
      expect(generated.applicationSwitched).not.toHaveBeenCalled();
    });

    it('teamSwitched returns null without calling the generated client', async () => {
      const { service, generated } = createService({ enabled: false });
      expect(await firstValueFrom(service.teamSwitched('v1', 't1'))).toBeNull();
      expect(generated.teamSwitched).not.toHaveBeenCalled();
    });

    it('viewTerminated returns null without calling the generated client', async () => {
      const { service, generated } = createService({ enabled: false });
      expect(await firstValueFrom(service.viewTerminated('v1', 30))).toBeNull();
      expect(generated.viewTerminated).not.toHaveBeenCalled();
    });

    it('defaults to disabled when XApiEnabled setting is absent', async () => {
      TestBed.configureTestingModule({
        providers: [
          {
            provide: GeneratedXApiService,
            useValue: { viewViewed: vi.fn(() => of({})) },
          },
          { provide: ComnSettingsService, useValue: { settings: {} } },
          XApiService,
        ],
      });
      const service = TestBed.inject(XApiService);
      expect(await firstValueFrom(service.viewViewed('v1'))).toBeNull();
    });
  });

  describe('when XApiEnabled is true', () => {
    it('viewViewed delegates to the generated client', async () => {
      const { service, generated } = createService({ enabled: true });
      await firstValueFrom(service.viewViewed('v1'));
      expect(generated.viewViewed).toHaveBeenCalledWith('v1');
    });

    it('applicationSwitched delegates with all arguments', async () => {
      const { service, generated } = createService({ enabled: true });
      await firstValueFrom(
        service.applicationSwitched('v1', 'My App', 'https://app.test'),
      );
      expect(generated.applicationSwitched).toHaveBeenCalledWith(
        'v1',
        'My App',
        'https://app.test',
      );
    });

    it('teamSwitched delegates with the view and team ids', async () => {
      const { service, generated } = createService({ enabled: true });
      await firstValueFrom(service.teamSwitched('v1', 't1'));
      expect(generated.teamSwitched).toHaveBeenCalledWith('v1', 't1');
    });

    it('viewTerminated delegates with the duration', async () => {
      const { service, generated } = createService({ enabled: true });
      await firstValueFrom(service.viewTerminated('v1', 42));
      expect(generated.viewTerminated).toHaveBeenCalledWith('v1', 42);
    });
  });

  describe('error handling', () => {
    it('viewViewed swallows errors and returns null', async () => {
      const { service } = createService({ enabled: true, fail: true });
      expect(await firstValueFrom(service.viewViewed('v1'))).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it('applicationSwitched swallows errors and returns null', async () => {
      const { service } = createService({ enabled: true, fail: true });
      expect(
        await firstValueFrom(service.applicationSwitched('v1', 'App', 'url')),
      ).toBeNull();
    });

    it('teamSwitched swallows errors and returns null', async () => {
      const { service } = createService({ enabled: true, fail: true });
      expect(await firstValueFrom(service.teamSwitched('v1', 't1'))).toBeNull();
    });

    it('viewTerminated swallows errors and returns null', async () => {
      const { service } = createService({ enabled: true, fail: true });
      expect(await firstValueFrom(service.viewTerminated('v1', 5))).toBeNull();
    });
  });
});
