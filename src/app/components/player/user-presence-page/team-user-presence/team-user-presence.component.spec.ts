// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Team } from '../../../../generated/player-api';
import { ViewPresence } from '../../../../models/view-presence';
import { TeamUserPresenceComponent } from './team-user-presence.component';
import { renderComponent } from '../../../../test-utils/render-component';

const team: Team = { id: 't1', name: 'Red' };

const users: ViewPresence[] = [
  { userId: 'u1', userName: 'Alice', online: true } as ViewPresence,
  { userId: 'u2', userName: 'Bob', online: false } as ViewPresence,
  { userId: 'u3', userName: 'Carol', online: true } as ViewPresence,
];

async function renderPresence(
  overrides: {
    users?: ViewPresence[];
    hideInactive?: boolean;
  } = {},
) {
  const { users: u = users, hideInactive = false } = overrides;
  return renderComponent(TeamUserPresenceComponent, {
    declarations: [TeamUserPresenceComponent],
    schemas: [NO_ERRORS_SCHEMA],
    componentProperties: { team, users: u, hideInactive },
  });
}

describe('TeamUserPresenceComponent', () => {
  /**
   * Verifies: TeamUserPresenceComponent instantiates successfully.
   * Interacts with: renderPresence harness binding team/users/hideInactive inputs.
   * Data: default renderPresence() (three users, hideInactive false).
   */
  it('creates the component', async () => {
    const { fixture } = await renderPresence();
    expect(fixture.componentInstance).toBeTruthy();
  });

  /**
   * Verifies: with hideInactive false the datasource keeps every user (online and offline).
   * Interacts with: component userDatasource populated from the users input.
   * Data: three users (2 online, 1 offline), hideInactive false; expects length 3.
   */
  it('stores all users when hideInactive is false', async () => {
    const { fixture } = await renderPresence({ hideInactive: false });
    expect(fixture.componentInstance.userDatasource.data).toHaveLength(3);
  });

  /**
   * Verifies: with hideInactive true the datasource keeps only online users.
   * Interacts with: component userDatasource, hideInactive input.
   * Data: three users (u1, u3 online; u2 offline); expects ['u1', 'u3'].
   */
  it('filters to online users when hideInactive is true', async () => {
    const { fixture } = await renderPresence({ hideInactive: true });
    expect(
      fixture.componentInstance.userDatasource.data.map((u) => u.userId),
    ).toEqual(['u1', 'u3']);
  });

  /**
   * Verifies: assigning searchTerm filters the datasource by name case-insensitively.
   * Interacts with: component searchTerm setter, userDatasource.filteredData.
   * Data: searchTerm 'ALICE'; expects only the Alice user (users[0]).
   */
  it('the searchTerm setter applies a case-insensitive name filter', async () => {
    const { fixture } = await renderPresence();
    fixture.componentInstance.searchTerm = 'ALICE';
    expect(fixture.componentInstance.userDatasource.filteredData).toEqual([
      users[0],
    ]);
  });

  /**
   * Verifies: tableHeight is capped at maxSize when there are more rows than fit.
   * Interacts with: component tableHeight getter, maxSize.
   * Data: 50 generated online users; expects height equal to maxSize px.
   */
  it('calculates a table height bounded by maxSize', async () => {
    const many: ViewPresence[] = [];
    for (let i = 0; i < 50; i++) {
      many.push({
        userId: `u${i}`,
        userName: `user-${i}`,
        online: true,
      } as ViewPresence);
    }
    const { fixture } = await renderPresence({ users: many });
    const expected = fixture.componentInstance.maxSize;
    expect(fixture.componentInstance.tableHeight).toBe(`${expected}px`);
  });

  /**
   * Verifies: tableHeight scales to header plus per-row size when rows are below the cap.
   * Interacts with: component tableHeight getter using headerSize and itemSize.
   * Data: a single user; expects headerSize*1.2 + 1*itemSize px.
   */
  it('calculates a smaller table height when only a few rows are present', async () => {
    const { fixture } = await renderPresence({ users: [users[0]] });
    const c = fixture.componentInstance;
    const expected = c.headerSize * 1.2 + 1 * c.itemSize;
    expect(c.tableHeight).toBe(`${expected}px`);
  });
});
