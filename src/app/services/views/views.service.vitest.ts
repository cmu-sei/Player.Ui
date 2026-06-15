// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, firstValueFrom } from 'rxjs';
import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { ViewsService } from './views.service';
import {
  ArchiveType,
  CreateViewCommand,
  TeamService,
  View,
  ViewService,
} from '../../generated/player-api';

function view(overrides: Partial<View> = {}): View {
  return { id: 'v1', name: 'View One', ...overrides };
}

function createService(
  viewApi: Partial<Record<keyof ViewService, unknown>> = {},
  teamApi: Partial<Record<keyof TeamService, unknown>> = {},
) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: ViewService, useValue: viewApi },
      { provide: TeamService, useValue: teamApi },
      ViewsService,
    ],
  });
  return TestBed.inject(ViewsService);
}

describe('ViewsService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loadMyViews() fetches and caches the user views', async () => {
    const svc = createService({
      getMyViews: () => of([view({ id: 'v1' }), view({ id: 'v2' })]),
    });
    await firstValueFrom(svc.loadMyViews());
    expect((await firstValueFrom(svc.views$)).map((v) => v.id)).toEqual([
      'v1',
      'v2',
    ]);
  });

  it('createView() calls the API and adds the new view to the cache', async () => {
    const createView = vi.fn(() => of(view({ id: 'new', name: 'New' })));
    const svc = createService({ getMyViews: () => of([]), createView });
    await firstValueFrom(svc.loadMyViews());
    const cmd: CreateViewCommand = { name: 'New' };
    await firstValueFrom(svc.createView(cmd));
    expect(createView).toHaveBeenCalledWith(cmd);
    expect((await firstValueFrom(svc.views$)).map((v) => v.id)).toContain(
      'new',
    );
  });

  describe('upsert()', () => {
    it('mutates an existing view in place', async () => {
      const svc = createService({
        getMyViews: () => of([view({ id: 'v1', name: 'Old' })]),
      });
      await firstValueFrom(svc.loadMyViews());
      svc.upsert('v1', { name: 'Updated' });
      const cached = await firstValueFrom(svc.views$);
      expect(cached).toHaveLength(1);
      expect(cached[0].name).toBe('Updated');
    });

    it('appends a new view when the id is absent', async () => {
      const svc = createService({ getMyViews: () => of([]) });
      await firstValueFrom(svc.loadMyViews());
      svc.upsert('v9', { name: 'Brand New' });
      expect(
        (await firstValueFrom(svc.views$)).find((v) => v.id === 'v9')?.name,
      ).toBe('Brand New');
    });
  });

  it('remove() drops the view from the cache', async () => {
    const svc = createService({
      getMyViews: () => of([view({ id: 'v1' }), view({ id: 'v2' })]),
    });
    await firstValueFrom(svc.loadMyViews());
    svc.remove('v1');
    expect((await firstValueFrom(svc.views$)).map((v) => v.id)).toEqual(['v2']);
  });

  it('setPrimaryTeamId() delegates to TeamService.setUserPrimaryTeam', async () => {
    const setUserPrimaryTeam = vi.fn(() => of(undefined));
    const svc = createService({}, { setUserPrimaryTeam });
    await firstValueFrom(svc.setPrimaryTeamId('user-1', 'team-1'));
    expect(setUserPrimaryTeam).toHaveBeenCalledWith('user-1', 'team-1');
  });

  it('export() maps the response into blob/filename/hasErrors', async () => {
    const body = new Blob(['data']);
    const headers = new HttpHeaders({
      'content-disposition': 'attachment; filename=export.zip',
      'X-Archive-Contains-Errors': 'true',
    });
    const exportViews = vi.fn(() => of(new HttpResponse({ body, headers })));
    const svc = createService({ exportViews });

    const result = await firstValueFrom(
      svc.export(['v1', 'v2'], ArchiveType.Zip),
    );
    expect(exportViews).toHaveBeenCalledWith(
      ArchiveType.Zip,
      ['v1', 'v2'],
      'response',
    );
    expect(result.blob).toBe(body);
    expect(result.filename).toBe('export.zip');
    expect(result.hasErrors).toBe(true);
  });

  it('import() forwards its arguments to ViewService.importViews', async () => {
    const importViews = vi.fn(() => of(view()));
    const svc = createService({ importViews });
    const archive = new Blob(['archive']);
    await firstValueFrom(svc.import(true, false, archive));
    expect(importViews).toHaveBeenCalledWith(true, false, archive);
  });
});
