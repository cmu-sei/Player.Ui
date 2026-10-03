// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
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
          loggedInUser$: new BehaviorSubject({
            profile: { name: 'Test User' },
          } as AuthUser),
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
          userTheme$: of('light-theme'),
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
     * Verifies: the Administration link is hidden for a user holding no View* permission.
     * Interacts with: UserPermissionsService.canViewAdminstration(); opens the menu via click.
     * Data: systemPermissions [ManageRoles] — a non-View* permission; PLAYER_HOME view.
     * Why: an empty permission list would also hide the link, so a user who holds a
     *   different system permission is the case that pins the View* filter itself.
     */
    it('should hide Administration link when user lacks any View* permission', async () => {
      await renderTopbar({
        systemPermissions: [SystemPermission.ManageRoles],
        topbarView: TopbarView.PLAYER_HOME,
      });
      await openUserMenu();
      expect(screen.queryByText('Administration')).not.toBeInTheDocument();
    });

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
     * Why: the system path has to hold on its own, with the view-permission path unavailable.
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
     * Why: this is the path a scoped-team user takes. Both cases used to pass a single
     *   canManageViews boolean into a can() stub that ignored its arguments, so they were
     *   the same test twice and neither pinned the permission it named.
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
     *   team 'Team 1'; PLAYER_PLAYER view. The API edits a view only for ManageViews or ManageView
     *   (player.api Features/Views/Requests/Edit.cs:60).
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
     * Why: with no claims at all the entry would be hidden even if the ManageTeam filter
     *   were gone, so a claim for a different team permission is what pins the filter.
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
      sidenav: { opened: true } as MatSidenav,
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
     * Verifies: the Reset UI item is available in the menu while in the player view.
     * Interacts with: topbarView input + team input; opens the menu via click.
     * Data: PLAYER_PLAYER view; team 'Team 1'.
     */
    it('should show Reset UI option in menu when in player view', async () => {
      await renderTopbar({
        topbarView: TopbarView.PLAYER_PLAYER,
        team: TEAM_1,
      });
      await openUserMenu();
      expect(screen.getByText('Reset UI')).toBeInTheDocument();
    });

    /**
     * Verifies: resetUI opens a confirm dialog whose message names the team.
     * Interacts with: CrucibleDialogService.confirm (confirm spy).
     * Data: team 'Team 7'; confirmResult false.
     * Why: the confirmed branch calls window.location.reload(), which jsdom does not
     *      implement and which cannot be stubbed, so only the prompt is asserted.
     */
    it('prompts for confirmation with the team name', async () => {
      // The confirmed branch is not exercised: on a positive confirm resetUI()
      // calls window.location.reload(). jsdom reports that as "Not implemented:
      // navigation to another Document" (a console error, which fails the
      // test), and Location.reload is non-configurable and non-writable, so it
      // cannot be stubbed. With confirmResult false the confirm observable
      // still emits, so this asserts the team-specific prompt; the cancelled
      // state is covered below.
      const { fixture, confirm } = await renderTopbar({
        team: { id: 'team-7', name: 'Team 7' },
        confirmResult: false,
      });
      fixture.componentInstance.resetUI();
      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Reset UI?',
          message: expect.stringContaining('Team 7'),
          confirmText: 'Reset',
        }),
      );
    });

    /**
     * Verifies: a cancelled confirm leaves persisted team UI state untouched.
     * Interacts with: CrucibleDialogService.confirm (emits cancel) and localStorage.
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
