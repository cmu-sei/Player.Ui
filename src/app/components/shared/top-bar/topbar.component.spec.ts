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
    canManageAnyTeam?: boolean;
  } = {},
) {
  const {
    canViewAdmin = false,
    canManageViews = false,
    canCreateViews = false,
    canManageAnyTeam = false,
  } = opts;
  return {
    permissions$: of(canCreateViews ? ['CreateViews'] : []),
    teamPermissions$: of([]),
    loadPermissions: () => of([]),
    canViewAdminstration: () => of(canViewAdmin),
    can: () => of(canManageViews),
    hasPermission: (p: string) => of(canCreateViews && p === 'CreateViews'),
    canManageAnyTeam$: of(canManageAnyTeam),
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
    canManageAnyTeam?: boolean;
    confirmResult?: boolean;
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
    canManageAnyTeam = false,
  } = overrides;

  mockLogout.mockClear();

  const setUserTheme = vi.fn();
  const dialogOpen = vi.fn();
  const dialogCloseAll = vi.fn();
  const snackbarOpen = vi.fn();
  const confirm = vi.fn(() => of({ confirm: overrides.confirmResult ?? false }));

  const rendered = await renderComponent(TopbarComponent, {
    declarations: [TopbarComponent],
    providers: [
      {
        provide: UserPermissionsService,
        useValue: createMockPermissionsService({
          canViewAdmin,
          canManageViews,
          canCreateViews,
          canManageAnyTeam,
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
          setUserTheme,
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
        useValue: { open: dialogOpen, closeAll: dialogCloseAll },
      },
      {
        provide: DialogService,
        useValue: { confirm },
      },
      {
        provide: MatSnackBar,
        useValue: { open: snackbarOpen },
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

  return {
    ...rendered,
    setUserTheme,
    dialogOpen,
    dialogCloseAll,
    snackbarOpen,
    confirm,
  };
}

describe('TopbarComponent', () => {
  /**
   * Verifies: the component instantiates under the full provider set.
   * Interacts with: permissions/auth/dialog stubs via renderTopbar.
   * Data: default render (Player title, PLAYER_HOME view, no permissions).
   */
  it('should create', async () => {
    const { fixture } = await renderTopbar();
    expect(fixture.componentInstance).toBeTruthy();
  });

  /**
   * Verifies: the title input is rendered in the toolbar.
   * Interacts with: rendered template; screen.getByText.
   * Data: title 'My Custom Title'.
   */
  it('should display title from input', async () => {
    await renderTopbar({ title: 'My Custom Title' });
    expect(screen.getByText('My Custom Title')).toBeInTheDocument();
  });

  /**
   * Verifies: the logged-in user's name is shown as the menu trigger.
   * Interacts with: LoggedInUserService.loggedInUser$; screen.getByText.
   * Data: stub user profile name 'Test User'.
   */
  it('should show user menu button', async () => {
    await renderTopbar();
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  /**
   * Verifies: the Administration menu item appears when admin access is granted.
   * Interacts with: UserPermissionsService.canViewAdminstration$; opens the user menu via click.
   * Data: canViewAdmin true; PLAYER_HOME view.
   */
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

  /**
   * Verifies: the Administration menu item is hidden when admin access is denied.
   * Interacts with: UserPermissionsService.canViewAdminstration$; opens the user menu via click.
   * Data: canViewAdmin false; PLAYER_HOME view.
   */
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

  /**
   * Verifies: the Logout item is present in the opened user menu.
   * Interacts with: rendered menu; opens it via a user click.
   * Data: default render.
   */
  it('should show logout option', async () => {
    await renderTopbar();
    const user = userEvent.setup();
    const menuButton = screen.getByText('Test User');
    await user.click(menuButton);
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  /**
   * Verifies: the Dark Theme toggle is present in the opened user menu.
   * Interacts with: rendered menu; opens it via a user click.
   * Data: default render.
   */
  it('should show dark theme toggle', async () => {
    await renderTopbar();
    const user = userEvent.setup();
    const menuButton = screen.getByText('Test User');
    await user.click(menuButton);
    expect(screen.getByText('Dark Theme')).toBeInTheDocument();
  });

  /**
   * Verifies: clicking Logout invokes the auth service logout.
   * Interacts with: ComnAuthService.logout (mockLogout); driven by user clicks.
   * Data: default render.
   */
  it('should call logout when logout clicked', async () => {
    await renderTopbar();
    const user = userEvent.setup();
    const menuButton = screen.getByText('Test User');
    await user.click(menuButton);
    const logoutButton = screen.getByText('Logout');
    await user.click(logoutButton);
    expect(mockLogout).toHaveBeenCalled();
  });

  /**
   * Verifies: the topbar does not render a "Close Sidebar" toggle button.
   * Interacts with: rendered DOM queried directly via querySelector.
   * Data: sidenav stub with opened=true.
   */
  it('should not show sidebar toggle button (topbar has no toggle button)', async () => {
    const result = await renderTopbar({ sidenav: { opened: true } });
    result.fixture.detectChanges();
    expect(
      result.fixture.nativeElement.querySelector(
        'button[aria-label="Close Sidebar"]',
      ),
    ).toBeNull();
  });

  /**
   * Verifies: the default 'Player' title renders in the toolbar.
   * Interacts with: rendered template; screen.getByText.
   * Data: title 'Player'.
   */
  it('should display player title in toolbar', async () => {
    await renderTopbar({ title: 'Player' });
    expect(screen.getByText('Player')).toBeInTheDocument();
  });

  /**
   * Verifies: the Exit Administration item shows while in the admin view.
   * Interacts with: topbarView input + canViewAdmin permission; opens the menu via click.
   * Data: canViewAdmin true; PLAYER_ADMIN view.
   */
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

  /**
   * Verifies: the Exit Administration item is hidden outside the admin view.
   * Interacts with: topbarView input + canViewAdmin permission; opens the menu via click.
   * Data: canViewAdmin true; PLAYER_HOME view.
   */
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

  /**
   * Verifies: Edit View appears when the user can manage views and a team is set.
   * Interacts with: UserPermissionsService.can$ (canManageViews) + team input; opens the menu via click.
   * Data: canManageViews true; team 'Team 1'; PLAYER_PLAYER view.
   */
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

  /**
   * Verifies: the Reset UI item is available in the menu while in the player view.
   * Interacts with: topbarView input + team input; opens the menu via click.
   * Data: PLAYER_PLAYER view; team 'Team 1'.
   */
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

  /**
   * Verifies: Edit View also appears for the per-view ManageView permission path
   *   when a team is set (companion to the system-permission case above).
   * Interacts with: UserPermissionsService.can$ (canManageViews) + team input; opens the menu via click.
   * Data: canManageViews true; team 'Team 1'; PLAYER_PLAYER view.
   */
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

  /**
   * Verifies: Edit View is hidden when the user lacks view-management permission,
   *   even with a team set.
   * Interacts with: UserPermissionsService.can$ (canManageViews false) + team input; opens the menu via click.
   * Data: canManageViews false; team 'Team 1'; PLAYER_PLAYER view.
   */
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

  /**
   * Verifies: Edit View is hidden when no team is set, despite having permission.
   * Interacts with: UserPermissionsService.can$ (canManageViews) + team input; opens the menu via click.
   * Data: canManageViews true; team undefined; PLAYER_PLAYER view.
   */
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

  /**
   * Verifies: Manage Teams shows (and Edit View does not) when the user can
   *   manage a team but cannot edit the view.
   * Interacts with: canManageAnyTeam$ + can$ permissions and team input; opens the menu via click.
   * Data: canManageViews false, canManageAnyTeam true; team 'Team 1'.
   */
  it('should show Manage Teams when user can manage a team but cannot edit the view', async () => {
    await renderTopbar({
      canManageViews: false,
      canManageAnyTeam: true,
      team: { id: 'team-1', name: 'Team 1' },
      topbarView: TopbarView.PLAYER_PLAYER,
    });
    const user = userEvent.setup();
    const menuButton = screen.getByText('Test User');
    await user.click(menuButton);
    expect(screen.getByText('Manage Teams')).toBeInTheDocument();
    // Manage Teams replaces Edit View for these users.
    expect(screen.queryByText('Edit View')).not.toBeInTheDocument();
  });

  /**
   * Verifies: when the user can edit the view, Edit View takes precedence and
   *   Manage Teams is suppressed.
   * Interacts with: canManageAnyTeam$ + can$ permissions and team input; opens the menu via click.
   * Data: canManageViews true, canManageAnyTeam true; team 'Team 1'.
   */
  it('should hide Manage Teams when user can edit the view (Edit View takes precedence)', async () => {
    await renderTopbar({
      canManageViews: true,
      canManageAnyTeam: true,
      team: { id: 'team-1', name: 'Team 1' },
      topbarView: TopbarView.PLAYER_PLAYER,
    });
    const user = userEvent.setup();
    const menuButton = screen.getByText('Test User');
    await user.click(menuButton);
    expect(screen.queryByText('Manage Teams')).not.toBeInTheDocument();
    expect(screen.getByText('Edit View')).toBeInTheDocument();
  });

  /**
   * Verifies: Manage Teams is hidden when no team is set, despite team-manage rights.
   * Interacts with: canManageAnyTeam$ permission and team input; opens the menu via click.
   * Data: canManageAnyTeam true; team undefined; PLAYER_PLAYER view.
   */
  it('should hide Manage Teams when team is not set even if user can manage a team', async () => {
    await renderTopbar({
      canManageAnyTeam: true,
      team: undefined,
      topbarView: TopbarView.PLAYER_PLAYER,
    });
    const user = userEvent.setup();
    const menuButton = screen.getByText('Test User');
    await user.click(menuButton);
    expect(screen.queryByText('Manage Teams')).not.toBeInTheDocument();
  });

  /**
   * Verifies: openManageTeams opens a dialog passing the current view id as data.
   * Interacts with: MatDialog.open (dialogOpen spy).
   * Data: viewId 'view-42'; asserts data { viewId: 'view-42' }.
   */
  it('openManageTeams opens the manage teams dialog with the view id', async () => {
    const { fixture, dialogOpen } = await renderTopbar({ viewId: 'view-42' });
    fixture.componentInstance.openManageTeams();
    expect(dialogOpen).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ data: { viewId: 'view-42' } }),
    );
  });

  /**
   * Verifies: the Administration link appears for a user with system view access
   *   (companion case to the showAdministration$ test above).
   * Interacts with: UserPermissionsService.canViewAdminstration$; opens the menu via click.
   * Data: canViewAdmin true; PLAYER_HOME view.
   */
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

  /**
   * Verifies: the Administration link is hidden for a user lacking any View* access.
   * Interacts with: UserPermissionsService.canViewAdminstration$; opens the menu via click.
   * Data: canViewAdmin false; PLAYER_HOME view.
   */
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

  /**
   * Verifies: inside the admin view, Exit Administration is shown while the
   *   Administration entry is suppressed (mutually exclusive).
   * Interacts with: canViewAdminstration$ + topbarView; opens the menu via click.
   * Data: canViewAdmin true; PLAYER_ADMIN view.
   */
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

  describe('setTeamFn()', () => {
    /**
     * Verifies: setTeamFn emits the id on the setTeam output when one is provided.
     * Interacts with: component.setTeam EventEmitter.
     * Data: id 'team-9'.
     */
    it('emits setTeam when an id is provided', async () => {
      const { fixture } = await renderTopbar();
      const spy = vi.fn();
      fixture.componentInstance.setTeam.subscribe(spy);
      fixture.componentInstance.setTeamFn('team-9');
      expect(spy).toHaveBeenCalledWith('team-9');
    });

    /**
     * Verifies: setTeamFn does not emit for an empty id.
     * Interacts with: component.setTeam EventEmitter (asserted not called).
     * Data: id ''.
     */
    it('does not emit when id is empty', async () => {
      const { fixture } = await renderTopbar();
      const spy = vi.fn();
      fixture.componentInstance.setTeam.subscribe(spy);
      fixture.componentInstance.setTeamFn('');
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('themeFn()', () => {
    /**
     * Verifies: themeFn applies the dark theme when the toggle is checked.
     * Interacts with: ComnAuthService.setUserTheme (setUserTheme spy).
     * Data: toggle event { checked: true }.
     */
    it('sets the dark theme when toggled on', async () => {
      const { fixture, setUserTheme } = await renderTopbar();
      fixture.componentInstance.themeFn({ checked: true });
      expect(setUserTheme).toHaveBeenCalledWith('dark-theme');
    });

    /**
     * Verifies: themeFn applies the light theme when the toggle is unchecked.
     * Interacts with: ComnAuthService.setUserTheme (setUserTheme spy).
     * Data: toggle event { checked: false }.
     */
    it('sets the light theme when toggled off', async () => {
      const { fixture, setUserTheme } = await renderTopbar();
      fixture.componentInstance.themeFn({ checked: false });
      expect(setUserTheme).toHaveBeenCalledWith('light-theme');
    });
  });

  describe('editFn / editFnNewTab', () => {
    /**
     * Verifies: editFn calls preventDefault on the event and emits editView.
     * Interacts with: component.editView EventEmitter and the event's preventDefault.
     * Data: event stub with a preventDefault spy.
     */
    it('editFn prevents default and emits the event', async () => {
      const { fixture } = await renderTopbar();
      const spy = vi.fn();
      fixture.componentInstance.editView.subscribe(spy);
      const preventDefault = vi.fn();
      fixture.componentInstance.editFn({ preventDefault });
      expect(preventDefault).toHaveBeenCalled();
      expect(spy).toHaveBeenCalled();
    });

    /**
     * Verifies: editFnNewTab emits editView with the event augmented by
     *   isNewBrowserTab: true.
     * Interacts with: component.editView EventEmitter.
     * Data: event stub { foo: 1 }.
     */
    it('editFnNewTab emits the event flagged for a new browser tab', async () => {
      const { fixture } = await renderTopbar();
      const spy = vi.fn();
      fixture.componentInstance.editView.subscribe(spy);
      fixture.componentInstance.editFnNewTab({ foo: 1 });
      expect(spy).toHaveBeenCalledWith({ foo: 1, isNewBrowserTab: true });
    });
  });

  /**
   * Verifies: sidenavToggleFn emits the negation of the sidenav's opened state.
   * Interacts with: component.sidenavToggle EventEmitter; reads sidenav.opened.
   * Data: sidenav stub opened=true (expects emitted false).
   */
  it('sidenavToggleFn emits the negation of the current sidenav opened state', async () => {
    const { fixture } = await renderTopbar({
      sidenav: { opened: true } as never,
    });
    const spy = vi.fn();
    fixture.componentInstance.sidenavToggle.subscribe(spy);
    fixture.componentInstance.sidenavToggleFn();
    expect(spy).toHaveBeenCalledWith(false);
  });

  describe('user presence dialog', () => {
    /**
     * Verifies: openUserPresence opens a dialog.
     * Interacts with: MatDialog.open (dialogOpen spy).
     * Data: default render.
     */
    it('openUserPresence opens the presence dialog', async () => {
      const { fixture, dialogOpen } = await renderTopbar();
      fixture.componentInstance.openUserPresence();
      expect(dialogOpen).toHaveBeenCalled();
    });

    /**
     * Verifies: closeUserPresence closes all open dialogs.
     * Interacts with: MatDialog.closeAll (dialogCloseAll spy).
     * Data: default render.
     */
    it('closeUserPresence closes all dialogs', async () => {
      const { fixture, dialogCloseAll } = await renderTopbar();
      fixture.componentInstance.closeUserPresence();
      expect(dialogCloseAll).toHaveBeenCalled();
    });
  });

  /**
   * Verifies: getEditViewUrl builds the admin views deep-link for the view id.
   * Interacts with: component.getEditViewUrl (pure helper).
   * Data: viewId 'view-42'; asserts URL contains the section/view query.
   */
  it('getEditViewUrl builds the admin views URL for the current view id', async () => {
    const { fixture } = await renderTopbar({ viewId: 'view-42' });
    expect(fixture.componentInstance.getEditViewUrl()).toContain(
      '/admin?section=views&view=view-42',
    );
  });

  describe('resetUI()', () => {
    /**
     * Verifies: resetUI opens a confirm dialog whose message names the team.
     * Interacts with: DialogService.confirm (confirm spy).
     * Data: team 'Team 7'; confirmResult false.
     * Why: the confirmed branch calls window.location.reload(), which under
     *      real-browser mode reloads the runner and is non-configurable, so only
     *      the prompt is asserted (confirmResult left false).
     */
    it('prompts for confirmation with the team name', async () => {
      // We intentionally do not exercise the confirmed branch here: on a
      // positive confirm resetUI() calls window.location.reload(), which under
      // real-browser test mode reloads the runner page and kills the Vitest
      // connection (and Location.reload is non-configurable, so it can't be
      // stubbed either). With confirmResult left false the confirm observable
      // still emits, so we assert resetUI() opens the confirm dialog with the
      // team-specific prompt. The cancelled-state behavior is covered below.
      const { fixture, confirm } = await renderTopbar({
        team: { id: 'team-7', name: 'Team 7' },
        confirmResult: false,
      });
      fixture.componentInstance.resetUI();
      expect(confirm).toHaveBeenCalledWith(
        'Reset UI?',
        expect.stringContaining('Team 7'),
      );
    });

    /**
     * Verifies: a cancelled confirm leaves persisted team UI state untouched.
     * Interacts with: DialogService.confirm (emits cancel) and localStorage.
     * Data: team 'Team 7'; confirmResult false; localStorage seeded under 'team-7'.
     */
    it('does nothing when the reset is cancelled', async () => {
      const { fixture } = await renderTopbar({
        team: { id: 'team-7', name: 'Team 7' },
        confirmResult: false,
      });
      localStorage.setItem('team-7', '{"width":300}');
      fixture.componentInstance.resetUI();
      expect(localStorage.getItem('team-7')).toBe('{"width":300}');
      localStorage.removeItem('team-7');
    });
  });

  /**
   * Verifies: openSnackBar opens a snackbar with the message positioned at top.
   * Interacts with: MatSnackBar.open (snackbarOpen spy).
   * Data: message 'Saved'; asserts verticalPosition 'top'.
   */
  it('openSnackBar opens a top snackbar with the message', async () => {
    const { fixture, snackbarOpen } = await renderTopbar();
    fixture.componentInstance.openSnackBar('Saved');
    expect(snackbarOpen).toHaveBeenCalledWith(
      'Saved',
      '',
      expect.objectContaining({ verticalPosition: 'top' }),
    );
  });

  /**
   * Verifies: ngOnDestroy completes the unsubscribe Subject to tear down streams.
   * Interacts with: component.unsubscribe$.complete (spied).
   * Data: default render.
   */
  it('ngOnDestroy completes the unsubscribe subject', async () => {
    const { fixture } = await renderTopbar();
    const complete = vi.spyOn(
      fixture.componentInstance.unsubscribe$,
      'complete',
    );
    fixture.componentInstance.ngOnDestroy();
    expect(complete).toHaveBeenCalled();
  });
});
