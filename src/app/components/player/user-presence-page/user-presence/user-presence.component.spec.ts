// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, Input } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture } from '@angular/core/testing';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { BehaviorSubject, of } from 'rxjs';
import {
  Team,
  TeamPermission,
  TeamPermissionsClaim,
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
import { ApiStub } from '../../../../test-utils/api-stub';

// Alpha is the user's primary team and is scoped onto Beta; Gamma is another
// team in the view that nothing scopes the user onto. The API lists them in
// this unsorted order.
const alpha: Team = {
  id: 't1',
  name: 'Alpha',
  isPrimary: true,
  scopedTeamIds: ['t2'],
};
const beta: Team = { id: 't2', name: 'Beta' };
const gamma: Team = { id: 't3', name: 'Gamma' };
const viewTeams: Team[] = [gamma, beta, alpha];

const presence: ViewPresence[] = [
  { userId: 'u2', userName: 'Bob', online: false, teamIds: ['t1'] },
  { userId: 'u4', userName: 'Zoe', online: true, teamIds: ['t1'] },
  { userId: 'u3', userName: 'Carol', online: true, teamIds: ['t2'] },
  { userId: 'u1', userName: 'Alice', online: true, teamIds: ['t1'] },
] as ViewPresence[];

/**
 * The primary team's claim, as `GET team-permissions/mine` returns it:
 * `directPermissionValues` come from the user's own membership in Alpha, and
 * `permissionValues` add whatever other teams scope onto Alpha.
 */
function claim(
  direct: string[],
  inherited: string[] = [],
): TeamPermissionsClaim {
  return {
    viewId: 'view-1',
    teamId: 't1',
    isPrimary: true,
    directPermissionValues: direct,
    permissionValues: [...direct, ...inherited],
    sourceTeamIds: ['t1'],
  };
}

@Component({ selector: 'app-team-user-presence', template: '' })
class TeamUserPresenceStubComponent {
  @Input() team!: Team;
  @Input() users!: ViewPresence[] | null;
  @Input() searchTerm!: string | null;
  @Input() hideInactive!: boolean;
}

async function renderPresence(
  overrides: {
    teams?: Team[];
    claims?: TeamPermissionsClaim[];
    showCloseButton?: boolean;
  } = {},
) {
  const {
    teams = viewTeams,
    claims = [claim([ViewPermission.ViewView])],
    showCloseButton = true,
  } = overrides;
  const userPresence$ = new BehaviorSubject<ViewPresence[]>(
    structuredClone(presence),
  );
  const joinPresence = vi.fn();
  const leavePresence = vi.fn();
  const getMyViewTeams = vi.fn(() => of(structuredClone(teams)));
  const getMyTeamPermissions = vi.fn(() => of(structuredClone(claims)));
  const closeMe = vi.fn();

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
    componentProperties: { viewId: 'view-1', showCloseButton },
    on: { closeMe },
    providers: [
      {
        provide: NotificationService,
        useValue: { userPresence$, joinPresence, leavePresence } satisfies Pick<
          NotificationService,
          'userPresence$' | 'joinPresence' | 'leavePresence'
        >,
      },
      {
        provide: TeamService,
        useValue: { getMyViewTeams } satisfies ApiStub<TeamService>,
      },
      {
        provide: TeamPermissionService,
        useValue: {
          getMyTeamPermissions,
        } satisfies ApiStub<TeamPermissionService>,
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
    closeMe,
  };
}

/** Team names of the rendered expansion panels, in render order. */
function teamPanels(container: Element): string[] {
  return Array.from(container.querySelectorAll('mat-panel-title')).map(
    (title) => title.textContent?.trim() ?? '',
  );
}

/** The "Count: N" description of each rendered panel, in render order. */
function panelCounts(container: Element): string[] {
  return Array.from(container.querySelectorAll('mat-panel-description')).map(
    (description) => description.textContent?.trim() ?? '',
  );
}

/** The team presence child stubs, in render order. */
function teamStubs(
  fixture: ComponentFixture<UserPresenceComponent>,
): TeamUserPresenceStubComponent[] {
  return fixture.debugElement
    .queryAll(By.directive(TeamUserPresenceStubComponent))
    .map((de) => de.componentInstance as TeamUserPresenceStubComponent);
}

describe('UserPresenceComponent', () => {
  /**
   * Verifies: a permission held directly on the primary team decides which teams' presence panels render: a view
   *   permission lists every team in the view, a team permission lists the primary team and the teams it is scoped
   *   onto.
   * Interacts with: TeamPermissionService.getMyTeamPermissions (the primary team's claim), TeamService.getMyViewTeams,
   *   the rendered expansion panels.
   * Data: Alpha (primary, scoped onto Beta), Beta, Gamma; one row per permission, held directly.
   */
  it.each<[string, TeamPermissionsClaim, string[]]>([
    [
      ViewPermission.ViewView,
      claim([ViewPermission.ViewView]),
      ['Alpha', 'Beta', 'Gamma'],
    ],
    [
      ViewPermission.ManageView,
      claim([ViewPermission.ManageView]),
      ['Alpha', 'Beta', 'Gamma'],
    ],
    [
      TeamPermission.ViewTeam,
      claim([TeamPermission.ViewTeam]),
      ['Alpha', 'Beta'],
    ],
    [
      TeamPermission.ManageTeam,
      claim([TeamPermission.ManageTeam]),
      ['Alpha', 'Beta'],
    ],
  ])(
    'lists the teams a direct %s grant reaches',
    async (_permission, primaryClaim, expected) => {
      const { container } = await renderPresence({ claims: [primaryClaim] });
      expect(teamPanels(container)).toEqual(expected);
    },
  );

  /**
   * Verifies: a near-miss grant hides the teams it does not reach: a view or team permission that reaches the
   *   primary team only through another team's scope lists the primary team alone, and a direct team permission
   *   where a view permission is needed leaves out the team nothing scopes the user onto.
   * Interacts with: TeamPermissionService.getMyTeamPermissions (the primary team's claim), TeamService.getMyViewTeams,
   *   the rendered expansion panels.
   * Data: Alpha (primary, scoped onto Beta), Beta, Gamma; one row per near miss.
   */
  it.each<[string, TeamPermissionsClaim, string[]]>([
    [
      'ViewView inherited through a scope only',
      claim([], [ViewPermission.ViewView]),
      ['Alpha'],
    ],
    [
      'ManageView inherited through a scope only',
      claim([], [ViewPermission.ManageView]),
      ['Alpha'],
    ],
    [
      'ViewTeam inherited through a scope only',
      claim([], [TeamPermission.ViewTeam]),
      ['Alpha'],
    ],
    [
      'ManageTeam inherited through a scope only',
      claim([], [TeamPermission.ManageTeam]),
      ['Alpha'],
    ],
    [
      'ViewTeam held directly where ViewView is needed',
      claim([TeamPermission.ViewTeam], [ViewPermission.ViewView]),
      ['Alpha', 'Beta'],
    ],
  ])(
    'hides the teams a near miss does not reach: %s',
    async (_nearMiss, primaryClaim, expected) => {
      const { container } = await renderPresence({ claims: [primaryClaim] });
      expect(teamPanels(container)).toEqual(expected);
    },
  );

  /**
   * Verifies: the presence list asks for the primary team's own claim, not every team's.
   * Interacts with: TeamPermissionService.getMyTeamPermissions stub.
   * Data: default teams, Alpha primary.
   */
  it('reads the claim of the primary team only', async () => {
    const { getMyTeamPermissions } = await renderPresence();
    expect(getMyTeamPermissions).toHaveBeenCalledExactlyOnceWith(
      undefined,
      't1',
      false,
    );
  });

  /**
   * Verifies: without a primary team the dialog renders no team panels, joins no presence channel and reads no claim.
   * Interacts with: TeamService.getMyViewTeams, NotificationService.joinPresence, TeamPermissionService.getMyTeamPermissions.
   * Data: Beta and Gamma only, neither primary.
   */
  it('renders no teams and joins nothing without a primary team', async () => {
    const { container, joinPresence, getMyTeamPermissions } =
      await renderPresence({ teams: [beta, gamma] });
    expect(teamPanels(container)).toEqual([]);
    expect(joinPresence).not.toHaveBeenCalled();
    expect(getMyTeamPermissions).not.toHaveBeenCalled();
  });

  /**
   * Verifies: opening the dialog joins presence for the view and the primary team, and closing it leaves the same channel.
   * Interacts with: NotificationService.joinPresence and leavePresence; fixture.destroy() as the dialog closing.
   * Data: viewId 'view-1'; Alpha (t1) primary.
   */
  it('joins presence for the primary team and leaves it when destroyed', async () => {
    const { fixture, joinPresence, leavePresence } = await renderPresence();
    expect(joinPresence).toHaveBeenCalledExactlyOnceWith('view-1', 't1');
    expect(leavePresence).not.toHaveBeenCalled();
    fixture.destroy();
    expect(leavePresence).toHaveBeenCalledExactlyOnceWith('view-1', 't1');
  });

  /**
   * Verifies: each team panel gets that team's users, online users first and then by user name, and shows their count.
   * Interacts with: NotificationService.userPresence$, the team presence child stubs, the panel descriptions.
   * Data: presence for Alpha in the order Bob (offline), Zoe, Alice; Carol on Beta; ViewView held directly.
   */
  it('passes each team its users, online first and then by name', async () => {
    const { fixture, container } = await renderPresence();
    const [alphaStub, betaStub, gammaStub] = teamStubs(fixture);
    expect(alphaStub.users?.map((p) => p.userName)).toEqual([
      'Alice',
      'Zoe',
      'Bob',
    ]);
    expect(betaStub.users?.map((p) => p.userName)).toEqual(['Carol']);
    expect(gammaStub.users).toEqual([]);
    expect(panelCounts(container)).toEqual([
      'Count: 3',
      'Count: 1',
      'Count: 0',
    ]);
  });

  /**
   * Verifies: typing in Search sends the lowercased term to every team panel and counts only matching users; the
   *   clear button resets it.
   * Interacts with: the rendered Search input and its clear button, the debounced searchTerm$, the child stubs and
   *   panel descriptions.
   * Data: 'ALI' typed; Alice is the only matching user.
   */
  it('filters the counts by the typed search term and clears it', async () => {
    const user = userEvent.setup();
    const { fixture, container } = await renderPresence();
    const search = screen.getByPlaceholderText('Search');
    search.focus();
    await user.type(search, 'ALI', { skipClick: true });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(teamStubs(fixture).map((s) => s.searchTerm)).toEqual([
        'ali',
        'ali',
        'ali',
      ]);
    });
    expect(panelCounts(container)).toEqual([
      'Count: 1',
      'Count: 0',
      'Count: 0',
    ]);

    await user.click(container.querySelector('button[matsuffix]')!);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(panelCounts(container)).toEqual([
        'Count: 3',
        'Count: 1',
        'Count: 0',
      ]);
    });
    expect(container.querySelector('button[matsuffix]')).toBeNull();
  });

  /**
   * Verifies: ticking Hide Offline tells every team panel to hide inactive users and drops offline users from the counts.
   * Interacts with: the rendered Hide Offline checkbox, the child stubs' hideInactive input, the panel descriptions.
   * Data: Bob on Alpha is offline.
   */
  it('hides offline users when Hide Offline is ticked', async () => {
    const user = userEvent.setup();
    const { fixture, container } = await renderPresence();
    expect(teamStubs(fixture).map((s) => s.hideInactive)).toEqual([
      false,
      false,
      false,
    ]);
    await user.click(screen.getByLabelText('Hide Offline'));
    expect(teamStubs(fixture).map((s) => s.hideInactive)).toEqual([
      true,
      true,
      true,
    ]);
    expect(panelCounts(container)).toEqual([
      'Count: 2',
      'Count: 1',
      'Count: 0',
    ]);
  });

  /**
   * Verifies: Expand All opens every team panel and Collapse All closes them again.
   * Interacts with: the rendered Expand All and Collapse All buttons, the MatAccordion, the panel headers' aria-expanded.
   * Data: three teams, all collapsed at first.
   */
  it('expands and collapses every panel from the toolbar', async () => {
    const user = userEvent.setup();
    const { container } = await renderPresence();
    const expanded = () =>
      Array.from(container.querySelectorAll('mat-expansion-panel-header')).map(
        (header) => header.getAttribute('aria-expanded'),
      );
    expect(expanded()).toEqual(['false', 'false', 'false']);
    await user.click(screen.getByText('Expand All'));
    expect(expanded()).toEqual(['true', 'true', 'true']);
    await user.click(screen.getByText('Collapse All'));
    expect(expanded()).toEqual(['false', 'false', 'false']);
  });

  /**
   * Verifies: the Close button emits closeMe.
   * Interacts with: the rendered Close button, the closeMe output.
   * Data: the default showCloseButton (true).
   */
  it('emits closeMe from the Close button', async () => {
    const user = userEvent.setup();
    const { closeMe } = await renderPresence();
    await user.click(screen.getByTitle('Close'));
    expect(closeMe).toHaveBeenCalledTimes(1);
  });

  /**
   * Verifies: with showCloseButton false the dialog renders no Close button of its own (the topbar's dialog has one).
   * Interacts with: the showCloseButton input.
   * Data: showCloseButton false.
   */
  it('renders no Close button when showCloseButton is false', async () => {
    await renderPresence({ showCloseButton: false });
    expect(screen.queryByTitle('Close')).not.toBeInTheDocument();
  });
});
