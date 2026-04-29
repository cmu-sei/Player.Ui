// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { Team, TeamService } from '../../../../generated/player-api';
import { ViewPresence } from '../../../../models/view-presence';
import { NotificationService } from '../../../../services/notification/notification.service';
import { UserPresenceComponent } from './user-presence.component';
import { renderComponent } from '../../../../test-utils/render-component';

const teams: Team[] = [
  { id: 't2', name: 'Beta' },
  { id: 't1', name: 'Alpha' },
];

const presence: ViewPresence[] = [
  {
    userId: 'u1',
    userName: 'Alice',
    online: true,
    teamIds: ['t1'],
  } as ViewPresence,
  {
    userId: 'u2',
    userName: 'Bob',
    online: false,
    teamIds: ['t1'],
  } as ViewPresence,
  {
    userId: 'u3',
    userName: 'Carol',
    online: true,
    teamIds: ['t2'],
  } as ViewPresence,
];

async function renderPresence() {
  const userPresence$ = new BehaviorSubject<ViewPresence[]>(presence);
  const joinPresence = vi.fn();
  const leavePresence = vi.fn();
  const getMyViewTeams = vi.fn(() => of(teams));

  const rendered = await renderComponent(UserPresenceComponent, {
    declarations: [UserPresenceComponent],
    schemas: [NO_ERRORS_SCHEMA],
    componentProperties: { viewId: 'view-1' },
    providers: [
      {
        provide: NotificationService,
        useValue: { userPresence$, joinPresence, leavePresence },
      },
      { provide: TeamService, useValue: { getMyViewTeams } },
    ],
  });

  return { ...rendered, userPresence$, joinPresence, leavePresence, getMyViewTeams };
}

describe('UserPresenceComponent', () => {
  it('creates the component', async () => {
    const { fixture } = await renderPresence();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('joins the presence channel for the given viewId on init', async () => {
    const { joinPresence } = await renderPresence();
    expect(joinPresence).toHaveBeenCalledWith('view-1');
  });

  it('ngOnDestroy leaves the presence channel', async () => {
    const { fixture, leavePresence } = await renderPresence();
    fixture.componentInstance.ngOnDestroy();
    expect(leavePresence).toHaveBeenCalledWith('view-1');
  });

  it('teams observable sorts alphabetically by name', async () => {
    const { fixture } = await renderPresence();
    const sorted = await firstValueFrom(fixture.componentInstance._teams);
    expect(sorted.map((t) => t.name)).toEqual(['Alpha', 'Beta']);
  });

  it('applyFilter lowercases input and pushes to searchTermSubject', async () => {
    const { fixture } = await renderPresence();
    fixture.componentInstance.applyFilter('ALICE');
    expect(fixture.componentInstance.searchTerm).toBe('alice');
    expect(fixture.componentInstance.searchTermSubject.getValue()).toBe(
      'alice',
    );
  });

  it('clearFilter resets the filter to empty', async () => {
    const { fixture } = await renderPresence();
    fixture.componentInstance.applyFilter('bob');
    fixture.componentInstance.clearFilter();
    expect(fixture.componentInstance.searchTerm).toBe('');
  });

  it('setHideInactive updates the flag', async () => {
    const { fixture } = await renderPresence();
    fixture.componentInstance.setHideInactive(true);
    expect(fixture.componentInstance.hideInactive).toBe(true);
  });

  it('trackByTeamId returns the team id', async () => {
    const { fixture } = await renderPresence();
    expect(
      fixture.componentInstance.trackByTeamId({ id: 'some-id', name: 'x' }),
    ).toBe('some-id');
  });

  it('getPresenceByTeamId filters to the team and sorts online users first', async () => {
    const { fixture } = await renderPresence();
    const result = await firstValueFrom(
      fixture.componentInstance.getPresenceByTeamId('t1'),
    );
    expect(result.map((p) => p.userId)).toEqual(['u1', 'u2']); // online first, then offline
  });
});
