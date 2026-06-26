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
  /**
   * Verifies: UserPresenceComponent instantiates successfully.
   * Interacts with: renderPresence harness with NotificationService/TeamService stubs.
   * Data: default renderPresence() (viewId 'view-1', two teams, three presences).
   */
  it('creates the component', async () => {
    const { fixture } = await renderPresence();
    expect(fixture.componentInstance).toBeTruthy();
  });

  /**
   * Verifies: init joins the presence channel for the bound viewId.
   * Interacts with: NotificationService.joinPresence spy.
   * Data: viewId input 'view-1'.
   */
  it('joins the presence channel for the given viewId on init', async () => {
    const { joinPresence } = await renderPresence();
    expect(joinPresence).toHaveBeenCalledWith('view-1');
  });

  /**
   * Verifies: ngOnDestroy leaves the presence channel for the viewId.
   * Interacts with: NotificationService.leavePresence spy.
   * Data: viewId input 'view-1'.
   */
  it('ngOnDestroy leaves the presence channel', async () => {
    const { fixture, leavePresence } = await renderPresence();
    fixture.componentInstance.ngOnDestroy();
    expect(leavePresence).toHaveBeenCalledWith('view-1');
  });

  /**
   * Verifies: the _teams stream emits teams sorted alphabetically by name.
   * Interacts with: TeamService.getMyViewTeams stub, component _teams observable.
   * Data: unsorted teams [Beta, Alpha]; expects ['Alpha', 'Beta'].
   */
  it('teams observable sorts alphabetically by name', async () => {
    const { fixture } = await renderPresence();
    const sorted = await firstValueFrom(fixture.componentInstance._teams);
    expect(sorted.map((t) => t.name)).toEqual(['Alpha', 'Beta']);
  });

  /**
   * Verifies: applyFilter lowercases the term, stores it in searchTerm, and pushes it onto searchTermSubject.
   * Interacts with: component applyFilter, searchTerm field, searchTermSubject.
   * Data: input 'ALICE'; expects 'alice'.
   */
  it('applyFilter lowercases input and pushes to searchTermSubject', async () => {
    const { fixture } = await renderPresence();
    fixture.componentInstance.applyFilter('ALICE');
    expect(fixture.componentInstance.searchTerm).toBe('alice');
    expect(fixture.componentInstance.searchTermSubject.getValue()).toBe(
      'alice',
    );
  });

  /**
   * Verifies: clearFilter empties searchTerm after a prior applyFilter.
   * Interacts with: component applyFilter/clearFilter, searchTerm field.
   * Data: applyFilter('bob') then clearFilter().
   */
  it('clearFilter resets the filter to empty', async () => {
    const { fixture } = await renderPresence();
    fixture.componentInstance.applyFilter('bob');
    fixture.componentInstance.clearFilter();
    expect(fixture.componentInstance.searchTerm).toBe('');
  });

  /**
   * Verifies: setHideInactive updates the hideInactive flag.
   * Interacts with: component setHideInactive, hideInactive field.
   * Data: setHideInactive(true).
   */
  it('setHideInactive updates the flag', async () => {
    const { fixture } = await renderPresence();
    fixture.componentInstance.setHideInactive(true);
    expect(fixture.componentInstance.hideInactive).toBe(true);
  });

  /**
   * Verifies: trackByTeamId returns the team's id for ngFor identity tracking.
   * Interacts with: component trackByTeamId seam (pure method).
   * Data: inline team { id: 'some-id', name: 'x' }.
   */
  it('trackByTeamId returns the team id', async () => {
    const { fixture } = await renderPresence();
    expect(
      fixture.componentInstance.trackByTeamId({ id: 'some-id', name: 'x' }),
    ).toBe('some-id');
  });

  /**
   * Verifies: getPresenceByTeamId returns only that team's presences, ordering online users before offline ones.
   * Interacts with: NotificationService.userPresence$ stream, component getPresenceByTeamId.
   * Data: team 't1' has u1 (online) and u2 (offline); expects ['u1', 'u2'].
   */
  it('getPresenceByTeamId filters to the team and sorts online users first', async () => {
    const { fixture } = await renderPresence();
    const result = await firstValueFrom(
      fixture.componentInstance.getPresenceByTeamId('t1'),
    );
    expect(result.map((p) => p.userId)).toEqual(['u1', 'u2']); // online first, then offline
  });
});
