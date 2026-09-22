// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, Input } from '@angular/core';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import {
  Team,
  TeamPermissionService,
  TeamService,
  ViewPermission,
} from '../../../../generated/player-api';
import { ViewPresence } from '../../../../models/view-presence';
import { NotificationService } from '../../../../services/notification/notification.service';
import { UserPresenceComponent } from './user-presence.component';
import { renderComponent } from '../../../../test-utils/render-component';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';

const teams: Team[] = [
  { id: 't2', name: 'Beta' },
  { id: 't1', name: 'Alpha', isPrimary: true, scopedTeamIds: ['t2'] },
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

@Component({ selector: 'app-team-user-presence', template: '' })
class TeamUserPresenceStubComponent {
  @Input() team!: Team;
  @Input() users!: ViewPresence[] | null;
  @Input() searchTerm!: string | null;
  @Input() hideInactive!: boolean;
}

async function renderPresence() {
  const userPresence$ = new BehaviorSubject<ViewPresence[]>(presence);
  const joinPresence = vi.fn();
  const leavePresence = vi.fn();
  const getMyViewTeams = vi.fn(() => of(teams));
  const getMyTeamPermissions = vi.fn(() =>
    of([{ directPermissionValues: [ViewPermission.ViewView] }]),
  );

  const rendered = await renderComponent(UserPresenceComponent, {
    imports: [
      MatExpansionModule,
      MatCheckboxModule,
      MatDialogModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatTooltipModule,
      MatButtonModule,
      TeamUserPresenceStubComponent,
    ],
    declarations: [UserPresenceComponent],
    componentProperties: { viewId: 'view-1' },
    providers: [
      {
        provide: NotificationService,
        useValue: { userPresence$, joinPresence, leavePresence },
      },
      { provide: TeamService, useValue: { getMyViewTeams } },
      {
        provide: TeamPermissionService,
        useValue: { getMyTeamPermissions },
      },
    ],
  });

  return {
    ...rendered,
    userPresence$,
    joinPresence,
    leavePresence,
    getMyViewTeams,
    getMyTeamPermissions,
  };
}

describe('UserPresenceComponent', () => {
  /**
   * Verifies: init joins the presence channel for the bound viewId.
   * Interacts with: NotificationService.joinPresence spy.
   * Data: viewId input 'view-1'.
   */
  it('joins the presence channel for the given viewId on init', async () => {
    const { joinPresence } = await renderPresence();
    expect(joinPresence).toHaveBeenCalledWith('view-1', 't1');
  });

  /**
   * Verifies: ngOnDestroy leaves the presence channel for the viewId.
   * Interacts with: NotificationService.leavePresence spy.
   * Data: viewId input 'view-1'.
   */
  it('ngOnDestroy leaves the presence channel', async () => {
    const { fixture, leavePresence } = await renderPresence();
    fixture.componentInstance.ngOnDestroy();
    expect(leavePresence).toHaveBeenCalledWith('view-1', 't1');
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
   * Verifies: getPresenceByTeamId returns only that team's presences, ordering online users before
   *   offline ones and breaking ties by username.
   * Interacts with: NotificationService.userPresence$ stream, component getPresenceByTeamId.
   * Data: a purpose-built emission whose order (Bob offline, Zoe online, Carol on t2, Alice online)
   *   contradicts the expected ['u1', 'u4', 'u2'] on every axis the comparator sorts by.
   * Why: the shared presence fixture is already in sorted order, so asserting against it passes with the
   *   comparator deleted. Feeding an order that has to change — and one that ties two online users so the
   *   username branch is reached — is what pins the sort.
   */
  it('getPresenceByTeamId filters to the team and sorts online first, then by username', async () => {
    const { fixture, userPresence$ } = await renderPresence();
    userPresence$.next([
      { userId: 'u2', userName: 'Bob', online: false, teamIds: ['t1'] },
      { userId: 'u4', userName: 'Zoe', online: true, teamIds: ['t1'] },
      { userId: 'u3', userName: 'Carol', online: true, teamIds: ['t2'] },
      { userId: 'u1', userName: 'Alice', online: true, teamIds: ['t1'] },
    ] as ViewPresence[]);
    const result = await firstValueFrom(
      fixture.componentInstance.getPresenceByTeamId('t1'),
    );
    expect(result.map((p) => p.userId)).toEqual(['u1', 'u4', 'u2']);
  });
});
