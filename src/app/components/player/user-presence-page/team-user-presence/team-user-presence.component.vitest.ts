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
  it('creates the component', async () => {
    const { fixture } = await renderPresence();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('stores all users when hideInactive is false', async () => {
    const { fixture } = await renderPresence({ hideInactive: false });
    expect(fixture.componentInstance.userDatasource.data).toHaveLength(3);
  });

  it('filters to online users when hideInactive is true', async () => {
    const { fixture } = await renderPresence({ hideInactive: true });
    expect(
      fixture.componentInstance.userDatasource.data.map((u) => u.userId),
    ).toEqual(['u1', 'u3']);
  });

  it('the searchTerm setter applies a case-insensitive name filter', async () => {
    const { fixture } = await renderPresence();
    fixture.componentInstance.searchTerm = 'ALICE';
    expect(fixture.componentInstance.userDatasource.filteredData).toEqual([
      users[0],
    ]);
  });

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

  it('calculates a smaller table height when only a few rows are present', async () => {
    const { fixture } = await renderPresence({ users: [users[0]] });
    const c = fixture.componentInstance;
    const expected = c.headerSize * 1.2 + 1 * c.itemSize;
    expect(c.tableHeight).toBe(`${expected}px`);
  });
});
