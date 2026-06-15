// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComnSettingsService } from '@cmusei/crucible-common';
import { TeamsService } from './teams.service';
import { TeamData } from '../../models/team-data';

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
      TeamsService,
    ],
  });
  return {
    service: TestBed.inject(TeamsService),
    httpMock: TestBed.inject(HttpTestingController),
  };
}

describe('TeamsService', () => {
  let httpMock: HttpTestingController;

  afterEach(() => httpMock?.verify());

  it('getUserTeamsByView() GETs the user/view teams endpoint and returns the teams', async () => {
    const ctx = setup();
    httpMock = ctx.httpMock;
    const teams: TeamData[] = [{ id: 't1', name: 'Red' } as TeamData];

    const promise = firstValueFrom(
      ctx.service.getUserTeamsByView('user-1', 'view-1'),
    );
    const req = httpMock.expectOne(
      `${API_URL}/api/users/user-1/views/view-1/teams`,
    );
    expect(req.request.method).toBe('GET');
    req.flush(teams);

    expect(await promise).toEqual(teams);
  });

  it('getUserTeamsByView() surfaces server errors through catchError', async () => {
    const ctx = setup();
    httpMock = ctx.httpMock;

    const promise = firstValueFrom(
      ctx.service.getUserTeamsByView('user-1', 'view-1'),
    );
    const req = httpMock.expectOne(
      `${API_URL}/api/users/user-1/views/view-1/teams`,
    );
    req.flush('boom', { status: 500, statusText: 'Server Error' });

    await expect(promise).rejects.toBeTruthy();
  });
});
