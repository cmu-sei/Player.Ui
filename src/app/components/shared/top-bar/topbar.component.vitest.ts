// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { TopbarComponent } from './topbar.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { UserPermissionsService } from '../../../services/permissions/user-permissions.service';
import { LoggedInUserService } from '../../../services/logged-in-user/logged-in-user.service';
import { TopbarView } from './topbar.models';
import { ComnAuthService, ComnAuthQuery } from '@cmusei/crucible-common';
import { MatDialog } from '@angular/material/dialog';
import { MatSidenav } from '@angular/material/sidenav';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DialogService } from '../../../services/dialog/dialog.service';
import { Team } from '../../../generated/player-api';

const mockLogout = vi.fn();

function createMockPermissionsService(
  opts: {
    canViewAdmin?: boolean;
    canManageViews?: boolean;
    canCreateViews?: boolean;
  } = {},
) {
  const {
    canViewAdmin = false,
    canManageViews = false,
    canCreateViews = false,
  } = opts;
  return {
    permissions$: of(canCreateViews ? ['CreateViews'] : []),
    teamPermissions$: of([]),
    loadPermissions: () => of([]),
    canViewAdminstration: () => of(canViewAdmin),
    can: () => of(canManageViews),
    hasPermission: (p: string) => of(canCreateViews && p === 'CreateViews'),
  };
}

async function renderTopbar(
  overrides: {
    title?: string;
    topbarView?: TopbarView;
    viewId?: string;
    sidenav?: MatSidenav;
    teams?: Team[];
    team?: Team;
    mini?: boolean;
    canViewAdmin?: boolean;
    canManageViews?: boolean;
    canCreateViews?: boolean;
  } = {},
) {
  const {
    title = 'Player',
    topbarView = TopbarView.PLAYER_HOME,
    viewId = '',
    sidenav = undefined,
    teams = undefined,
    team = undefined,
    mini = false,
    canViewAdmin = false,
    canManageViews = false,
    canCreateViews = false,
  } = overrides;

  mockLogout.mockClear();

  return renderComponent(TopbarComponent, {
    declarations: [TopbarComponent],
    providers: [
      {
        provide: UserPermissionsService,
        useValue: createMockPermissionsService({
          canViewAdmin,
          canManageViews,
          canCreateViews,
        }),
      },
      {
        provide: LoggedInUserService,
        useValue: {
          loggedInUser$: of({ profile: { name: 'Test User' } }),
          setLoggedInUser: () => {},
        },
      },
      {
        provide: ComnAuthService,
        useValue: {
          isAuthenticated$: of(true),
          user$: of({}),
          logout: mockLogout,
          setUserTheme: vi.fn(),
        },
      },
      {
        provide: ComnAuthQuery,
        useValue: {
          userTheme$: of('light-theme'),
          isLoggedIn$: of(true),
        },
      },
      {
        provide: MatDialog,
        useValue: { open: vi.fn(), closeAll: vi.fn() },
      },
      {
        provide: DialogService,
        useValue: { confirm: () => of({ confirm: false }) },
      },
      {
        provide: MatSnackBar,
        useValue: { open: vi.fn() },
      },
    ],
    componentProperties: {
      title,
      topbarView,
      viewId,
      sidenav,
      teams,
      team,
      mini,
    },
  });
}

describe('TopbarComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderTopbar();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display title from input', async () => {
    await renderTopbar({ title: 'My Custom Title' });
    expect(screen.getByText('My Custom Title')).toBeInTheDocument();
  });

  it('should show user menu button', async () => {
    await renderTopbar();
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('should show Administration link when showAdministration$ emits true', async () => {
    await renderTopbar({
      canViewAdmin: true,
      topbarView: TopbarView.PLAYER_HOME,
    });
    const user = userEvent.setup();
    const menuButton = screen.getByText('Test User');
    await user.click(menuButton);
    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  it('should hide Administration link when showAdministration$ emits false', async () => {
    await renderTopbar({
      canViewAdmin: false,
      topbarView: TopbarView.PLAYER_HOME,
    });
    const user = userEvent.setup();
    const menuButton = screen.getByText('Test User');
    await user.click(menuButton);
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
  });

  it('should show logout option', async () => {
    await renderTopbar();
    const user = userEvent.setup();
    const menuButton = screen.getByText('Test User');
    await user.click(menuButton);
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('should show dark theme toggle', async () => {
    await renderTopbar();
    const user = userEvent.setup();
    const menuButton = screen.getByText('Test User');
    await user.click(menuButton);
    expect(screen.getByText('Dark Theme')).toBeInTheDocument();
  });

  it('should call logout when logout clicked', async () => {
    await renderTopbar();
    const user = userEvent.setup();
    const menuButton = screen.getByText('Test User');
    await user.click(menuButton);
    const logoutButton = screen.getByText('Logout');
    await user.click(logoutButton);
    expect(mockLogout).toHaveBeenCalled();
  });

  it('should not show sidebar toggle button (topbar has no toggle button)', async () => {
    const result = await renderTopbar({ sidenav: { opened: true } });
    result.fixture.detectChanges();
    expect(
      result.fixture.nativeElement.querySelector(
        'button[aria-label="Close Sidebar"]',
      ),
    ).toBeNull();
  });

  it('should display player title in toolbar', async () => {
    await renderTopbar({ title: 'Player' });
    expect(screen.getByText('Player')).toBeInTheDocument();
  });

  it('should show Exit Administration when in admin view', async () => {
    await renderTopbar({
      canViewAdmin: true,
      topbarView: TopbarView.PLAYER_ADMIN,
    });
    const user = userEvent.setup();
    const menuButton = screen.getByText('Test User');
    await user.click(menuButton);
    expect(screen.getByText('Exit Administration')).toBeInTheDocument();
  });

  it('should hide Exit Administration when not in admin view', async () => {
    await renderTopbar({
      canViewAdmin: true,
      topbarView: TopbarView.PLAYER_HOME,
    });
    const user = userEvent.setup();
    const menuButton = screen.getByText('Test User');
    await user.click(menuButton);
    expect(screen.queryByText('Exit Administration')).not.toBeInTheDocument();
  });

  it('should show Edit View when user has ManageViews permission and team is set', async () => {
    await renderTopbar({
      canManageViews: true,
      team: { id: 'team-1', name: 'Team 1' },
      topbarView: TopbarView.PLAYER_PLAYER,
    });
    const user = userEvent.setup();
    const menuButton = screen.getByText('Test User');
    await user.click(menuButton);
    expect(screen.getByText('Edit View')).toBeInTheDocument();
  });

  it('should show Reset UI option in menu when in player view', async () => {
    await renderTopbar({
      topbarView: TopbarView.PLAYER_PLAYER,
      team: { id: 'team-1', name: 'Team 1' },
    });
    const user = userEvent.setup();
    const menuButton = screen.getByText('Test User');
    await user.click(menuButton);
    expect(screen.getByText('Reset UI')).toBeInTheDocument();
  });

  it('should show Edit View when user has ManageView view-permission and team is set', async () => {
    await renderTopbar({
      canManageViews: true,
      team: { id: 'team-1', name: 'Team 1' },
      topbarView: TopbarView.PLAYER_PLAYER,
    });
    const user = userEvent.setup();
    const menuButton = screen.getByText('Test User');
    await user.click(menuButton);
    expect(screen.getByText('Edit View')).toBeInTheDocument();
  });

  it('should hide Edit View when user lacks ManageViews/ManageView permission', async () => {
    await renderTopbar({
      canManageViews: false,
      team: { id: 'team-1', name: 'Team 1' },
      topbarView: TopbarView.PLAYER_PLAYER,
    });
    const user = userEvent.setup();
    const menuButton = screen.getByText('Test User');
    await user.click(menuButton);
    expect(screen.queryByText('Edit View')).not.toBeInTheDocument();
  });

  it('should hide Edit View when team is not set even if user has permission', async () => {
    await renderTopbar({
      canManageViews: true,
      team: undefined,
      topbarView: TopbarView.PLAYER_PLAYER,
    });
    const user = userEvent.setup();
    const menuButton = screen.getByText('Test User');
    await user.click(menuButton);
    expect(screen.queryByText('Edit View')).not.toBeInTheDocument();
  });

  it('should show Administration link when user has ViewViews system permission', async () => {
    await renderTopbar({
      canViewAdmin: true,
      topbarView: TopbarView.PLAYER_HOME,
    });
    const user = userEvent.setup();
    const menuButton = screen.getByText('Test User');
    await user.click(menuButton);
    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  it('should hide Administration link when user lacks any View* permission', async () => {
    await renderTopbar({
      canViewAdmin: false,
      topbarView: TopbarView.PLAYER_HOME,
    });
    const user = userEvent.setup();
    const menuButton = screen.getByText('Test User');
    await user.click(menuButton);
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
  });

  it('should show Exit Administration and hide Administration when in admin view with permissions', async () => {
    await renderTopbar({
      canViewAdmin: true,
      topbarView: TopbarView.PLAYER_ADMIN,
    });
    const user = userEvent.setup();
    const menuButton = screen.getByText('Test User');
    await user.click(menuButton);
    expect(screen.getByText('Exit Administration')).toBeInTheDocument();
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
  });
});
