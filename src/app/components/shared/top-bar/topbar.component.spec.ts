// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, Mock } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { BehaviorSubject, of } from 'rxjs';
import { TopbarComponent } from './topbar.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionDataProviders } from 'src/app/test-utils/mock-permission-data.service';
import { LoggedInUserService } from '../../../services/logged-in-user/logged-in-user.service';
import { TopbarView } from './topbar.models';
import {
  ComnAuthService,
  ComnAuthQuery,
  CrucibleDialogService,
  CRUCIBLE_DIALOG_IMPORTS,
} from '@cmusei/crucible-common';
import { MatDialog } from '@angular/material/dialog';
import { MatSidenav } from '@angular/material/sidenav';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  SystemPermission,
  Team,
  TeamPermission,
  TeamPermissionsClaim,
  ViewPermission,
} from '../../../generated/player-api';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { ClipboardModule } from 'ngx-clipboard';
import { dialogRefStub } from '../../../test-utils/dialog-refs';
import type { User as AuthUser } from 'oidc-client-ts';

const mockLogout = vi.fn();

const TEAM_1: Team = { id: 'team-1', name: 'Team 1' };

function manageTeamClaim(teamId = 'team-1'): TeamPermissionsClaim {
  return { teamId, permissionValues: [TeamPermission.ManageTeam] };
}

function manageViewClaim(teamId = 'team-1'): TeamPermissionsClaim {
  return { teamId, permissionValues: [ViewPermission.ManageView] };
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
    systemPermissions?: SystemPermission[];
    teamClaims?: TeamPermissionsClaim[];
    confirmResult?: boolean;
    theme?: string;
    on?: Partial<Record<'setTeam' | 'editView' | 'sidenavToggle', Mock>>;
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
    systemPermissions = [],
    teamClaims = [],
  } = overrides;

  const setUserTheme = vi.fn();
  const dialogOpen = vi.fn();
  const dialogCloseAll = vi.fn();
  const snackbarOpen = vi.fn();
  const confirm = vi.fn(
    () =>
      dialogRefStub<unknown, boolean>(overrides.confirmResult ?? false)
        .dialogRef,
  );
  const loggedInUser$ = new BehaviorSubject({
    profile: { name: 'Test User' },
  } as AuthUser);

  const rendered = await renderComponent(TopbarComponent, {
    imports: [
      MatDialogModule,
      MatFormFieldModule,
      MatIconModule,
      MatMenuModule,
      MatSlideToggleModule,
      MatToolbarModule,
      MatTooltipModule,
      MatButtonModule,
      ClipboardModule,
      ...CRUCIBLE_DIALOG_IMPORTS,
    ],
    declarations: [TopbarComponent],
    providers: [
      ...permissionDataProviders({
        system: systemPermissions,
        teams: teamClaims,
      }),
      {
        provide: LoggedInUserService,
        useValue: {
          loggedInUser$,
          setLoggedInUser: () => {},
        } satisfies Pick<
          LoggedInUserService,
          'loggedInUser$' | 'setLoggedInUser'
        >,
      },
      {
        provide: ComnAuthService,
        // TopbarComponent calls only these two.
        useValue: {
          logout: mockLogout,
          setUserTheme,
        } satisfies Pick<ComnAuthService, 'logout' | 'setUserTheme'>,
      },
      {
        provide: ComnAuthQuery,
        useValue: {
          userTheme$: of(overrides.theme ?? 'light-theme'),
          isLoggedIn$: of(true),
        },
      },
      {
        provide: MatDialog,
        useValue: { open: dialogOpen, closeAll: dialogCloseAll } satisfies Pick<
          MatDialog,
          'open' | 'closeAll'
        >,
      },
      {
        provide: CrucibleDialogService,
        useValue: { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>,
      },
      {
        provide: MatSnackBar,
        useValue: { open: snackbarOpen } satisfies Pick<MatSnackBar, 'open'>,
      },
    ],
    on: overrides.on,
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
    loggedInUser$,
  };
}

async function openUserMenu() {
  const user = userEvent.setup();
  await user.click(screen.getByText('Test User'));
  return user;
}

describe('TopbarComponent', () => {
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
   * Verifies: the Logout item is present in the opened user menu.
   * Interacts with: rendered menu; opens it via a user click.
   * Data: default render.
   */
  it('should show logout option', async () => {
    await renderTopbar();
    await openUserMenu();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  /**
   * Verifies: the Dark Theme toggle is present in the opened user menu.
   * Interacts with: rendered menu; opens it via a user click.
   * Data: default render.
   */
  it('should show dark theme toggle', async () => {
    await renderTopbar();
    await openUserMenu();
    expect(screen.getByText('Dark Theme')).toBeInTheDocument();
  });

  /**
   * Verifies: clicking Logout invokes the auth service logout.
   * Interacts with: ComnAuthService.logout (mockLogout); driven by user clicks.
   * Data: default render.
   */
  it('should call logout when logout clicked', async () => {
    await renderTopbar();
    const user = await openUserMenu();
    await user.click(screen.getByText('Logout'));
    expect(mockLogout).toHaveBeenCalled();
  });

  /**
   * Verifies: once the topbar is destroyed it no longer follows the logged-in user: it holds no subscription to the
   *   user stream, and a renewed user renders nowhere.
   * Interacts with: LoggedInUserService.loggedInUser$ (a live subject, observed); fixture.destroy(); the document.
   * Data: 'Test User' shown; after destroy the user stream emits 'Renamed User'.
   */
  it('stops following the logged-in user after destroy', async () => {
    const { fixture, loggedInUser$ } = await renderTopbar();
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(loggedInUser$.observed).toBe(true);
    fixture.destroy();
    expect(loggedInUser$.observed).toBe(false);
    loggedInUser$.next({ profile: { name: 'Renamed User' } } as AuthUser);
    expect(screen.queryByText('Renamed User')).not.toBeInTheDocument();
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

  describe('Administration entry', () => {
    /**
     * Verifies: the Administration link appears for a user holding a View* system permission.
     * Interacts with: UserPermissionsService.canViewAdminstration(); opens the menu via click.
     * Data: systemPermissions [ViewViews]; PLAYER_HOME view.
     */
    it('should show Administration link when user has ViewViews system permission', async () => {
      await renderTopbar({
        systemPermissions: [SystemPermission.ViewViews],
        topbarView: TopbarView.PLAYER_HOME,
      });
      await openUserMenu();
      expect(screen.getByText('Administration')).toBeInTheDocument();
    });

    /**
     * Verifies: a user holding a system permission that is not a View* one (near miss) gets neither the
     *   Administration link nor, inside the admin area, Exit Administration.
     * Interacts with: UserPermissionsService.canViewAdminstration(); opens the menu via click.
     * Data: one row per topbar view; systemPermissions [ManageRoles, ManageViews].
     */
    it.each<[string, TopbarView]>([
      ['Administration', TopbarView.PLAYER_HOME],
      ['Exit Administration', TopbarView.PLAYER_ADMIN],
    ])(
      'hides "%s" in the %s view without a View* permission',
      async (entry, topbarView) => {
        await renderTopbar({
          systemPermissions: [
            SystemPermission.ManageRoles,
            SystemPermission.ManageViews,
          ],
          topbarView,
        });
        await openUserMenu();
        // The menu is open (Logout renders), so the absence below is the gate.
        expect(screen.getByText('Logout')).toBeInTheDocument();
        expect(screen.queryByText(entry)).not.toBeInTheDocument();
      },
    );

    /**
     * Verifies: inside the admin view, Exit Administration is shown while the
     *   Administration entry is suppressed (mutually exclusive).
     * Interacts with: canViewAdminstration() + topbarView; opens the menu via click.
     * Data: systemPermissions [ViewViews]; PLAYER_ADMIN view.
     */
    it('should show Exit Administration and hide Administration when in admin view', async () => {
      await renderTopbar({
        systemPermissions: [SystemPermission.ViewViews],
        topbarView: TopbarView.PLAYER_ADMIN,
      });
      await openUserMenu();
      expect(screen.getByText('Exit Administration')).toBeInTheDocument();
      expect(screen.queryByText('Administration')).not.toBeInTheDocument();
    });

    /**
     * Verifies: the Exit Administration item is hidden outside the admin view.
     * Interacts with: topbarView input + canViewAdminstration(); opens the menu via click.
     * Data: systemPermissions [ViewViews]; PLAYER_HOME view.
     */
    it('should hide Exit Administration when not in admin view', async () => {
      await renderTopbar({
        systemPermissions: [SystemPermission.ViewViews],
        topbarView: TopbarView.PLAYER_HOME,
      });
      await openUserMenu();
      expect(screen.queryByText('Exit Administration')).not.toBeInTheDocument();
    });
  });

  describe('Edit View entry', () => {
    /**
     * Verifies: Edit View appears via the ManageViews *system* permission.
     * Interacts with: UserPermissionsService.can(ManageViews, ...) + team input; opens the menu via click.
     * Data: systemPermissions [ManageViews], no team claims; team 'Team 1'; PLAYER_PLAYER view.
     */
    it('should show Edit View for the ManageViews system permission', async () => {
      await renderTopbar({
        systemPermissions: [SystemPermission.ManageViews],
        team: TEAM_1,
        topbarView: TopbarView.PLAYER_PLAYER,
      });
      await openUserMenu();
      expect(screen.getByText('Edit View')).toBeInTheDocument();
    });

    /**
     * Verifies: Edit View appears via the per-view ManageView claim with no system permission.
     * Interacts with: UserPermissionsService.can(..., viewPermission: ManageView) + team input.
     * Data: systemPermissions []; team claim { team-1, [ManageView] }; team 'Team 1'.
     */
    it('should show Edit View for the ManageView view-permission alone', async () => {
      await renderTopbar({
        systemPermissions: [],
        teamClaims: [manageViewClaim()],
        team: TEAM_1,
        topbarView: TopbarView.PLAYER_PLAYER,
      });
      await openUserMenu();
      expect(screen.getByText('Edit View')).toBeInTheDocument();
    });

    /**
     * Verifies: Edit View is hidden when the user holds only the neighbours of ManageViews and ManageView (near miss).
     * Interacts with: UserPermissionsService.can() + team input; opens the menu via click.
     * Data: systemPermissions [ViewViews, CreateViews, EditViews]; team claim { team-1, [ViewView, ManageTeam] };
     *   team 'Team 1'; PLAYER_PLAYER view.
     */
    it('should hide Edit View when user lacks ManageViews/ManageView permission', async () => {
      await renderTopbar({
        systemPermissions: [
          SystemPermission.ViewViews,
          SystemPermission.CreateViews,
          SystemPermission.EditViews,
        ],
        teamClaims: [
          {
            teamId: 'team-1',
            permissionValues: [
              ViewPermission.ViewView,
              TeamPermission.ManageTeam,
            ],
          },
        ],
        team: TEAM_1,
        topbarView: TopbarView.PLAYER_PLAYER,
      });
      await openUserMenu();
      // The menu is open (Reset UI renders), so the absence below is the gate.
      expect(screen.getByText('Reset UI')).toBeInTheDocument();
      expect(screen.queryByText('Edit View')).not.toBeInTheDocument();
    });

    /**
     * Verifies: Edit View is hidden when no team is set, despite having permission.
     * Interacts with: UserPermissionsService.can() + team input; opens the menu via click.
     * Data: systemPermissions [ManageViews]; team undefined; PLAYER_PLAYER view.
     */
    it('should hide Edit View when team is not set even if user has permission', async () => {
      await renderTopbar({
        systemPermissions: [SystemPermission.ManageViews],
        team: undefined,
        topbarView: TopbarView.PLAYER_PLAYER,
      });
      await openUserMenu();
      expect(screen.queryByText('Edit View')).not.toBeInTheDocument();
    });
  });

  describe('Manage Teams entry', () => {
    /**
     * Verifies: Manage Teams shows (and Edit View does not) when the user can
     *   manage a team but cannot edit the view.
     * Interacts with: canManageAnyTeam$ (derived from the ManageTeam claim) + can(); opens the menu.
     * Data: team claim { team-1, [ManageTeam] }; no system permissions; team 'Team 1'.
     */
    it('should show Manage Teams when user can manage a team but cannot edit the view', async () => {
      await renderTopbar({
        systemPermissions: [],
        teamClaims: [manageTeamClaim()],
        team: TEAM_1,
        topbarView: TopbarView.PLAYER_PLAYER,
      });
      await openUserMenu();
      expect(screen.getByText('Manage Teams')).toBeInTheDocument();
      // Manage Teams replaces Edit View for these users.
      expect(screen.queryByText('Edit View')).not.toBeInTheDocument();
    });

    /**
     * Verifies: when the user can edit the view, Edit View takes precedence and
     *   Manage Teams is suppressed.
     * Interacts with: canManageAnyTeam$ + can(); opens the menu via click.
     * Data: systemPermissions [ManageViews] plus a ManageTeam claim; team 'Team 1'.
     */
    it('should hide Manage Teams when user can edit the view (Edit View takes precedence)', async () => {
      await renderTopbar({
        systemPermissions: [SystemPermission.ManageViews],
        teamClaims: [manageTeamClaim()],
        team: TEAM_1,
        topbarView: TopbarView.PLAYER_PLAYER,
      });
      await openUserMenu();
      expect(screen.queryByText('Manage Teams')).not.toBeInTheDocument();
      expect(screen.getByText('Edit View')).toBeInTheDocument();
    });

    /**
     * Verifies: Manage Teams is hidden for a user whose only team claim lacks ManageTeam.
     * Interacts with: the real canManageAnyTeam$ (getManageableTeamIds over the claims) + can(); opens the menu.
     * Data: team claim { team-1, [ViewTeam] }; no system permissions; team 'Team 1'; PLAYER_PLAYER view.
     */
    it('should hide Manage Teams when the team claim lacks ManageTeam', async () => {
      await renderTopbar({
        systemPermissions: [],
        teamClaims: [
          { teamId: 'team-1', permissionValues: [TeamPermission.ViewTeam] },
        ],
        team: TEAM_1,
        topbarView: TopbarView.PLAYER_PLAYER,
      });
      await openUserMenu();
      // The menu is open (Reset UI renders), so the absence below is the gate.
      expect(screen.getByText('Reset UI')).toBeInTheDocument();
      expect(screen.queryByText('Manage Teams')).not.toBeInTheDocument();
    });

    /**
     * Verifies: Manage Teams is hidden when no team is set, despite team-manage rights.
     * Interacts with: canManageAnyTeam$; opens the menu via click.
     * Data: team claim { team-1, [ManageTeam] }; team undefined; PLAYER_PLAYER view.
     */
    it('should hide Manage Teams when team is not set even if user can manage a team', async () => {
      await renderTopbar({
        teamClaims: [manageTeamClaim()],
        team: undefined,
        topbarView: TopbarView.PLAYER_PLAYER,
      });
      await openUserMenu();
      expect(screen.queryByText('Manage Teams')).not.toBeInTheDocument();
    });

    /**
     * Verifies: choosing Manage Teams in the user menu opens the manage teams dialog with the current view id.
     * Interacts with: the rendered user menu (canManageAnyTeam$ gate); MatDialog.open (dialogOpen spy).
     * Data: team claim { team-1, [ManageTeam] }; team 'Team 1'; viewId 'view-42'; PLAYER_PLAYER view.
     */
    it('opens the manage teams dialog with the view id from the menu', async () => {
      const { dialogOpen } = await renderTopbar({
        teamClaims: [manageTeamClaim()],
        team: TEAM_1,
        viewId: 'view-42',
        topbarView: TopbarView.PLAYER_PLAYER,
      });
      const user = await openUserMenu();
      await user.click(screen.getByRole('menuitem', { name: 'Manage Teams' }));
      expect(dialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ data: { viewId: 'view-42' } }),
      );
    });
  });

  describe('team menu', () => {
    const teams: Team[] = [TEAM_1, { id: 'team-9', name: 'Team 9' }];

    /**
     * Verifies: picking a team in the Select a Team menu emits its id on setTeam.
     * Interacts with: the rendered Select a Team menu; the setTeam output.
     * Data: teams Team 1 and Team 9; current team Team 1; Team 9 picked.
     */
    it('emits setTeam with the picked team id', async () => {
      const user = userEvent.setup();
      const setTeam = vi.fn();
      await renderTopbar({ teams, team: TEAM_1, on: { setTeam } });
      await user.click(screen.getByLabelText('Select a Team'));
      await user.click(screen.getByText('Team 9'));
      expect(setTeam).toHaveBeenCalledExactlyOnceWith('team-9');
    });

    /**
     * Verifies: picking a team that has no id emits nothing.
     * Interacts with: the rendered Select a Team menu; the setTeam output.
     * Data: teams Team 1 and an id-less 'Unsaved' team; 'Unsaved' picked.
     */
    it('does not emit setTeam for a team without an id', async () => {
      const user = userEvent.setup();
      const setTeam = vi.fn();
      await renderTopbar({
        teams: [TEAM_1, { id: '', name: 'Unsaved' }],
        team: TEAM_1,
        on: { setTeam },
      });
      await user.click(screen.getByLabelText('Select a Team'));
      await user.click(screen.getByText('Unsaved'));
      expect(setTeam).not.toHaveBeenCalled();
    });

    /**
     * Verifies: the Users button opens the presence dialog.
     * Interacts with: the rendered Users button; MatDialog.open (dialogOpen spy).
     * Data: teams Team 1 and Team 9.
     */
    it('opens the presence dialog from the Users button', async () => {
      const user = userEvent.setup();
      const { dialogOpen } = await renderTopbar({ teams, team: TEAM_1 });
      await user.click(screen.getByLabelText('Users'));
      expect(dialogOpen).toHaveBeenCalledExactlyOnceWith(
        expect.anything(),
        expect.objectContaining({ height: '75%' }),
      );
    });
  });

  describe('Dark Theme toggle', () => {
    /**
     * Verifies: switching the Dark Theme toggle sets the theme it switches to.
     * Interacts with: the rendered slide toggle in the user menu; ComnAuthQuery.userTheme$; ComnAuthService.setUserTheme.
     * Data: one row per starting theme.
     */
    it.each<[string, string]>([
      ['light-theme', 'dark-theme'],
      ['dark-theme', 'light-theme'],
    ])('switches from %s to %s', async (theme, expected) => {
      const { setUserTheme } = await renderTopbar({ theme });
      const user = await openUserMenu();
      await user.click(screen.getByRole('switch'));
      expect(setUserTheme).toHaveBeenCalledExactlyOnceWith(expected);
    });
  });

  describe('Edit View', () => {
    /**
     * Verifies: the Edit View item links to the view's admin page and, when clicked, emits editView instead of
     *   following the link.
     * Interacts with: the rendered Edit View item; the editView output.
     * Data: ManageViews granted; team Team 1; viewId 'view-42'.
     */
    it('links to the view admin page and emits editView on click', async () => {
      const editView = vi.fn();
      await renderTopbar({
        systemPermissions: [SystemPermission.ManageViews],
        team: TEAM_1,
        viewId: 'view-42',
        topbarView: TopbarView.PLAYER_PLAYER,
        on: { editView },
      });
      const user = await openUserMenu();
      const item = screen.getByText('Edit View').closest('a')!;
      expect(item.getAttribute('href')).toContain(
        '/admin?section=views&view=view-42',
      );
      await user.click(item);
      expect(editView).toHaveBeenCalledTimes(1);
      expect(editView.mock.calls[0][0].defaultPrevented).toBe(true);
    });

    /**
     * Verifies: editFnNewTab, which no template binds, emits editView with the event flagged for a new browser tab.
     * Interacts with: the editView output.
     * Data: event { foo: 1 }.
     */
    it('editFnNewTab emits the event flagged for a new browser tab', async () => {
      const editView = vi.fn();
      const { fixture } = await renderTopbar({ on: { editView } });
      fixture.componentInstance.editFnNewTab({ foo: 1 });
      expect(editView).toHaveBeenCalledWith({ foo: 1, isNewBrowserTab: true });
    });
  });

  /**
   * Verifies: sidenavToggleFn, which no template binds, emits the negation of the sidenav's opened state.
   * Interacts with: the sidenavToggle output; reads sidenav.opened.
   * Data: sidenav stub opened=true (expects emitted false).
   */
  it('sidenavToggleFn emits the negation of the current sidenav opened state', async () => {
    const sidenavToggle = vi.fn();
    const { fixture } = await renderTopbar({
      sidenav: { opened: true } as MatSidenav,
      on: { sidenavToggle },
    });
    fixture.componentInstance.sidenavToggleFn();
    expect(sidenavToggle).toHaveBeenCalledWith(false);
  });

  /**
   * Verifies: closeUserPresence, which the presence dialog's closeMe output calls, closes all dialogs.
   * Interacts with: MatDialog.closeAll (dialogCloseAll spy).
   * Data: default render; the dialog itself is stubbed, so the method is called directly.
   */
  it('closeUserPresence closes all dialogs', async () => {
    const { fixture, dialogCloseAll } = await renderTopbar();
    fixture.componentInstance.closeUserPresence();
    expect(dialogCloseAll).toHaveBeenCalled();
  });

  describe('Reset UI', () => {
    /**
     * Verifies: Reset UI asks for confirmation naming the team.
     * Interacts with: the rendered Reset UI item; CrucibleDialogService.confirm (confirm spy).
     * Data: PLAYER_PLAYER view; team 'Team 7'; confirmResult false (a confirmed reset reloads the page, which jsdom
     *   cannot do).
     */
    it('prompts for confirmation with the team name', async () => {
      const { confirm } = await renderTopbar({
        team: { id: 'team-7', name: 'Team 7' },
        topbarView: TopbarView.PLAYER_PLAYER,
        confirmResult: false,
      });
      const user = await openUserMenu();
      await user.click(screen.getByText('Reset UI'));
      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Reset UI?',
          message: expect.stringContaining('Team 7'),
          confirmText: 'Reset',
        }),
      );
    });

    /**
     * Verifies: a cancelled Reset UI leaves the team's stored UI state untouched.
     * Interacts with: the rendered Reset UI item; CrucibleDialogService.confirm (answers false); localStorage.
     * Data: team 'Team 7'; confirmResult false; localStorage seeded under 'team-7'.
     */
    it('does nothing when the reset is cancelled', async () => {
      localStorage.setItem('team-7', '{"width":300}');
      await renderTopbar({
        team: { id: 'team-7', name: 'Team 7' },
        topbarView: TopbarView.PLAYER_PLAYER,
        confirmResult: false,
      });
      const user = await openUserMenu();
      await user.click(screen.getByText('Reset UI'));
      expect(localStorage.getItem('team-7')).toBe('{"width":300}');
      localStorage.removeItem('team-7');
    });
  });

  /**
   * Verifies: openSnackBar, which the team id copy calls on success, opens a snackbar with the message at the top.
   * Interacts with: MatSnackBar.open (snackbarOpen spy).
   * Data: message 'Saved'; jsdom has no clipboard, so the method is called directly.
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
});
