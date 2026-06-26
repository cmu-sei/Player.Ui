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
    /**
     * Verifies: viewViewed short-circuits to null and never reaches the generated client when xAPI is disabled.
     * Interacts with: GeneratedXApiService.viewViewed (vi.fn spy), XApiService.viewViewed.
     * Data: createService override with enabled:false (XApiEnabled setting off).
     */
    it('viewViewed returns null without calling the generated client', async () => {
      const { service, generated } = createService({ enabled: false });
      expect(await firstValueFrom(service.viewViewed('v1'))).toBeNull();
      expect(generated.viewViewed).not.toHaveBeenCalled();
    });

    /**
     * Verifies: applicationSwitched short-circuits to null without calling the generated client when disabled.
     * Interacts with: GeneratedXApiService.applicationSwitched (vi.fn spy), XApiService.applicationSwitched.
     * Data: createService override with enabled:false.
     */
    it('applicationSwitched returns null without calling the generated client', async () => {
      const { service, generated } = createService({ enabled: false });
      expect(
        await firstValueFrom(service.applicationSwitched('v1', 'App', 'url')),
      ).toBeNull();
      expect(generated.applicationSwitched).not.toHaveBeenCalled();
    });

    /**
     * Verifies: teamSwitched short-circuits to null without calling the generated client when disabled.
     * Interacts with: GeneratedXApiService.teamSwitched (vi.fn spy), XApiService.teamSwitched.
     * Data: createService override with enabled:false.
     */
    it('teamSwitched returns null without calling the generated client', async () => {
      const { service, generated } = createService({ enabled: false });
      expect(await firstValueFrom(service.teamSwitched('v1', 't1'))).toBeNull();
      expect(generated.teamSwitched).not.toHaveBeenCalled();
    });

    /**
     * Verifies: viewTerminated short-circuits to null without calling the generated client when disabled.
     * Interacts with: GeneratedXApiService.viewTerminated (vi.fn spy), XApiService.viewTerminated.
     * Data: createService override with enabled:false.
     */
    it('viewTerminated returns null without calling the generated client', async () => {
      const { service, generated } = createService({ enabled: false });
      expect(await firstValueFrom(service.viewTerminated('v1', 30))).toBeNull();
      expect(generated.viewTerminated).not.toHaveBeenCalled();
    });

    /**
     * Verifies: a missing XApiEnabled setting is treated as disabled, so viewViewed returns null.
     * Interacts with: ComnSettingsService (empty settings), GeneratedXApiService.viewViewed, XApiService.viewViewed.
     * Data: hand-rolled TestBed with settings:{} rather than the createService helper.
     * Why: builds its own module to exercise the absent-setting branch the helper can't express.
     */
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
    /**
     * Verifies: when enabled, viewViewed forwards the view id to the generated client.
     * Interacts with: GeneratedXApiService.viewViewed (vi.fn spy), XApiService.viewViewed.
     * Data: createService with enabled:true; view id 'v1'.
     */
    it('viewViewed delegates to the generated client', async () => {
      const { service, generated } = createService({ enabled: true });
      await firstValueFrom(service.viewViewed('v1'));
      expect(generated.viewViewed).toHaveBeenCalledWith('v1');
    });

    /**
     * Verifies: applicationSwitched forwards view id, app name, and url unchanged to the generated client.
     * Interacts with: GeneratedXApiService.applicationSwitched (vi.fn spy), XApiService.applicationSwitched.
     * Data: createService with enabled:true; ('v1','My App','https://app.test').
     */
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

    /**
     * Verifies: teamSwitched forwards view id and team id to the generated client.
     * Interacts with: GeneratedXApiService.teamSwitched (vi.fn spy), XApiService.teamSwitched.
     * Data: createService with enabled:true; ('v1','t1').
     */
    it('teamSwitched delegates with the view and team ids', async () => {
      const { service, generated } = createService({ enabled: true });
      await firstValueFrom(service.teamSwitched('v1', 't1'));
      expect(generated.teamSwitched).toHaveBeenCalledWith('v1', 't1');
    });

    /**
     * Verifies: viewTerminated forwards view id and the numeric duration to the generated client.
     * Interacts with: GeneratedXApiService.viewTerminated (vi.fn spy), XApiService.viewTerminated.
     * Data: createService with enabled:true; ('v1', 42).
     */
    it('viewTerminated delegates with the duration', async () => {
      const { service, generated } = createService({ enabled: true });
      await firstValueFrom(service.viewTerminated('v1', 42));
      expect(generated.viewTerminated).toHaveBeenCalledWith('v1', 42);
    });
  });

  describe('error handling', () => {
    /**
     * Verifies: a failing generated call is caught so viewViewed emits null and logs the error.
     * Interacts with: GeneratedXApiService.viewViewed (throwError), XApiService.viewViewed, console.error spy.
     * Data: createService with enabled:true and fail:true (client emits an Error).
     * Why: fail flag swaps the stub to throwError to drive the catchError path; console.error is spied/silenced in beforeEach.
     */
    it('viewViewed swallows errors and returns null', async () => {
      const { service } = createService({ enabled: true, fail: true });
      expect(await firstValueFrom(service.viewViewed('v1'))).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    /**
     * Verifies: applicationSwitched emits null instead of propagating a failing generated call.
     * Interacts with: GeneratedXApiService.applicationSwitched (throwError), XApiService.applicationSwitched.
     * Data: createService with enabled:true and fail:true.
     */
    it('applicationSwitched swallows errors and returns null', async () => {
      const { service } = createService({ enabled: true, fail: true });
      expect(
        await firstValueFrom(service.applicationSwitched('v1', 'App', 'url')),
      ).toBeNull();
    });

    /**
     * Verifies: teamSwitched emits null instead of propagating a failing generated call.
     * Interacts with: GeneratedXApiService.teamSwitched (throwError), XApiService.teamSwitched.
     * Data: createService with enabled:true and fail:true.
     */
    it('teamSwitched swallows errors and returns null', async () => {
      const { service } = createService({ enabled: true, fail: true });
      expect(await firstValueFrom(service.teamSwitched('v1', 't1'))).toBeNull();
    });

    /**
     * Verifies: viewTerminated emits null instead of propagating a failing generated call.
     * Interacts with: GeneratedXApiService.viewTerminated (throwError), XApiService.viewTerminated.
     * Data: createService with enabled:true and fail:true.
     */
    it('viewTerminated swallows errors and returns null', async () => {
      const { service } = createService({ enabled: true, fail: true });
      expect(await firstValueFrom(service.viewTerminated('v1', 5))).toBeNull();
    });
  });
});
