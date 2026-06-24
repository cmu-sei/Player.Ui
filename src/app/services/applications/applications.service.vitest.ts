// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComnSettingsService } from '@cmusei/crucible-common';
import { ApplicationsService } from './applications.service';
import { ApplicationData } from '../../models/application-data';

const API_URL = 'https://player.test';

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: ComnSettingsService,
        useValue: { settings: { ApiUrl: API_URL } },
      },
      ApplicationsService,
    ],
  });
  return {
    service: TestBed.inject(ApplicationsService),
    httpMock: TestBed.inject(HttpTestingController),
  };
}

describe('ApplicationsService', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    // The error path logs to the console; keep test output clean.
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    httpMock?.verify();
    vi.restoreAllMocks();
  });

  /**
   * Verifies: the observable issues a GET to /api/teams/{id}/application-instances and resolves to the flushed body unchanged
   * Interacts with: HttpTestingController (expectOne/flush) standing in for HttpClient; service.getApplicationsByTeam
   * Data: a single-element ApplicationData[] fixture flushed as the response
   */
  it('getApplicationsByTeam() GETs the team application-instances endpoint', async () => {
    const ctx = setup();
    httpMock = ctx.httpMock;
    const apps: ApplicationData[] = [
      { id: 'a1', name: 'App One' } as ApplicationData,
    ];

    const promise = firstValueFrom(ctx.service.getApplicationsByTeam('team-1'));
    const req = httpMock.expectOne(
      `${API_URL}/api/teams/team-1/application-instances`,
    );
    expect(req.request.method).toBe('GET');
    req.flush(apps);

    expect(await promise).toEqual(apps);
  });

  /**
   * Verifies: a 500 response causes the returned observable to reject rather than swallow the error
   * Interacts with: HttpTestingController flushing an error status; service.getApplicationsByTeam catchError path
   * Data: a 500 "Server Error" flush with body 'boom'
   * Why: catchError re-throws and also logs to console.log, which beforeEach silences to keep output clean
   */
  it('getApplicationsByTeam() surfaces server errors through catchError', async () => {
    const ctx = setup();
    httpMock = ctx.httpMock;

    const promise = firstValueFrom(ctx.service.getApplicationsByTeam('team-1'));
    const req = httpMock.expectOne(
      `${API_URL}/api/teams/team-1/application-instances`,
    );
    req.flush('boom', { status: 500, statusText: 'Server Error' });

    await expect(promise).rejects.toBeTruthy();
  });
});
