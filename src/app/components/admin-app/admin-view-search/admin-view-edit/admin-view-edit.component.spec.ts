// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, forwardRef, Input } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { EMPTY, firstValueFrom, NEVER, Observable, of, throwError } from 'rxjs';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { HttpEvent, HttpEventType, HttpResponse } from '@angular/common/http';
import {
  FormGroup,
  FormGroupDirective,
  UntypedFormControl,
  Validators,
} from '@angular/forms';
import { Clipboard } from '@angular/cdk/clipboard';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSelectHarness } from '@angular/material/select/testing';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';
import {
  CrucibleDialogService,
  CRUCIBLE_DIALOG_IMPORTS,
} from '@cmusei/crucible-common';
import {
  Application,
  ApplicationService,
  ApplicationTemplate,
  FileModel,
  FileService,
  SystemPermission,
  Team,
  TeamPermissionModel,
  TeamPermissionService,
  TeamRole,
  TeamRoleService,
  TeamService,
  User,
  UserService,
  View,
  ViewService,
} from '../../../../generated/player-api';
import { DialogService } from '../../../../services/dialog/dialog.service';
import type { TeamUser } from '../../../shared/add-remove-users-dialog/add-remove-users-dialog.component';
import {
  AdminViewEditComponent,
  UserErrorStateMatcher,
} from './admin-view-edit.component';
import { renderComponent } from '../../../../test-utils/render-component';
import { permissionDataProviders } from '../../../../test-utils/mock-permission-data.service';
import { ViewApplicationsSelectComponent } from '../../view-applications-select/view-applications-select.component';
import { MatExpansionModule } from '@angular/material/expansion';
import { ClipboardModule } from 'ngx-clipboard';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatStepperModule } from '@angular/material/stepper';
import { MatInputModule } from '@angular/material/input';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { ApiStub } from '../../../../test-utils/api-stub';
import { dialogRefStub } from '../../../../test-utils/dialog-refs';
import {
  captureUnhandledRxErrors,
  flush,
} from '../../../../test-utils/unhandled-rx-errors';

const demoView: View = {
  id: 'v1',
  name: 'Demo View',
  description: 'A demo',
  status: 'Active',
  isTemplate: false,
};
const red: Team = { id: 't1', name: 'Red', viewId: 'v1' };
const alpha: Team = { id: 't2', name: 'Alpha', viewId: 'v1' };
const alice: User = { id: 'u1', name: 'Alice' };
const docFile: FileModel = { id: 'f1', name: 'doc.txt', teamIds: ['t1'] };
const template: ApplicationTemplate = { id: 'tmpl-1', name: 'Chat' };

// The edit page drives these members of the applications select. The stub
// provides itself as ViewApplicationsSelectComponent, so the page's
// @ViewChild finds it.
@Component({
  selector: 'app-view-applications-select',
  template: '',
  providers: [
    {
      provide: ViewApplicationsSelectComponent,
      useExisting: forwardRef(() => ViewApplicationsSelectStubComponent),
    },
  ],
})
class ViewApplicationsSelectStubComponent implements Pick<
  ViewApplicationsSelectComponent,
  'currentApp'
> {
  @Input() view!: View;
  currentApp: Application;
  updateApplications = vi.fn();
}

@Component({ selector: 'app-roles-permissions-select', template: '' })
class RolesPermissionsSelectStubComponent {
  @Input() team!: Team;
  @Input() allTeams!: Team[];
}

@Component({ selector: 'app-team-applications-select', template: '' })
class TeamApplicationsSelectStubComponent {
  @Input() view!: View;
  @Input() team!: Team;
}

async function renderEdit(
  overrides: {
    confirmResult?: boolean;
    view?: View;
    teams?: Team[];
    teamUsers?: Record<string, User[]>;
    files?: FileModel[];
    viewApps?: Application[];
    permissions?: SystemPermission[];
    asDialog?: boolean;
    open?: boolean;
  } = {},
) {
  const {
    confirmResult = true,
    view = demoView,
    teams = [red],
    teamUsers = { t1: [alice] },
    files = [docFile],
    viewApps = [],
    permissions = [SystemPermission.ViewViews, SystemPermission.ManageViews],
    asDialog = false,
    open = true,
  } = overrides;

  const stubs = {
    updateView: vi.fn((_id: string, v: View) => of(structuredClone(v))),
    deleteView: vi.fn(() => of(undefined)),
    getViewTeams: vi.fn(() => of(structuredClone(teams))),
    deleteTeam: vi.fn(() => of(undefined)),
    updateTeam: vi.fn((id: string, t: Team) => of<Team>({ ...t, id })),
    createTeam: vi.fn((viewId: string, t: Team) =>
      of<Team>({ ...t, id: 'new-team', viewId }),
    ),
    getTeamUsers: vi.fn((teamId: string) =>
      of(structuredClone(teamUsers[teamId] ?? [])),
    ),
    // The component calls the 'events' overload. EMPTY keeps it inert; the
    // upload tests supply their own events.
    uploadMultipleFiles: vi.fn((): Observable<HttpEvent<FileModel[]>> => EMPTY),
    deleteFile: vi.fn(() => of(null)),
    updateFile: vi.fn(() => of(undefined)),
    getViewFiles: vi.fn(() => of(structuredClone(files))),
    download: vi.fn(() => of(new Blob(['x']))),
    getApplicationTemplates: vi.fn(() => of([structuredClone(template)])),
    // The API echoes the created application back with an id.
    createApplication: vi.fn((_viewId: string, app?: Application) =>
      of<Application>({ ...app, id: 'app-1' }),
    ),
    getViewApplications: vi.fn(() => of(structuredClone(viewApps))),
    confirm: vi.fn(
      () => dialogRefStub<unknown, boolean>(confirmResult).dialogRef,
    ),
    // Typed to what the dialogs close with ({ teamUsers }, { name, teams },
    // { teams }), so the DialogService provider below is not checked against
    // Pick<DialogService, ...>; see agent-docs/ui-test-bugs/player.ui.md.
    addRemoveUsersToTeam: vi.fn(() =>
      of<{ teamUsers: TeamUser[] } | undefined>({ teamUsers: [] }),
    ),
    editFile: vi.fn(() =>
      of<{ name: string; teams: string[] }>({ name: 'renamed.txt', teams: [] }),
    ),
    // Dismissed: afterClosed() emits undefined.
    createApplicationDialog: vi.fn(() => of<{ teams: unknown[] }>(undefined)),
    clipboardCopy: vi.fn(),
    getTeamPermissions: vi.fn(() =>
      of<TeamPermissionModel[]>([{ id: 'tp-1', name: 'ViewTeam' }]),
    ),
    getTeamRoles: vi.fn(() => of<TeamRole[]>([{ id: 'tr-1', name: 'Member' }])),
  };
  const editComplete = vi.fn();

  const rendered = await renderComponent(AdminViewEditComponent, {
    imports: [
      MatExpansionModule,
      MatCardModule,
      MatCheckboxModule,
      MatDialogModule,
      MatFormFieldModule,
      MatIconModule,
      MatMenuModule,
      MatSelectModule,
      MatProgressBarModule,
      MatProgressSpinnerModule,
      MatStepperModule,
      MatInputModule,
      MatBadgeModule,
      MatTooltipModule,
      MatButtonModule,
      ...CRUCIBLE_DIALOG_IMPORTS,
      ClipboardModule,
      ViewApplicationsSelectStubComponent,
      RolesPermissionsSelectStubComponent,
      TeamApplicationsSelectStubComponent,
    ],
    declarations: [AdminViewEditComponent],
    on: { editComplete },
    providers: [
      ...permissionDataProviders({ system: permissions }),
      // In the admin Views section the page is not a dialog; PlayerComponent
      // opens it in one.
      {
        provide: MatDialogRef,
        useValue: asDialog ? dialogRefStub().dialogRef : null,
      },
      {
        provide: ViewService,
        useValue: {
          updateView: stubs.updateView,
          deleteView: stubs.deleteView,
        } satisfies ApiStub<ViewService>,
      },
      {
        provide: TeamService,
        useValue: {
          getViewTeams: stubs.getViewTeams,
          deleteTeam: stubs.deleteTeam,
          updateTeam: stubs.updateTeam,
          createTeam: stubs.createTeam,
        } satisfies ApiStub<TeamService>,
      },
      {
        provide: UserService,
        useValue: {
          getTeamUsers: stubs.getTeamUsers,
        } satisfies ApiStub<UserService>,
      },
      {
        provide: FileService,
        useValue: {
          uploadMultipleFiles: stubs.uploadMultipleFiles,
          deleteFile: stubs.deleteFile,
          updateFile: stubs.updateFile,
          getViewFiles: stubs.getViewFiles,
          download: stubs.download,
        } satisfies ApiStub<FileService>,
      },
      {
        provide: ApplicationService,
        useValue: {
          getApplicationTemplates: stubs.getApplicationTemplates,
          createApplication: stubs.createApplication,
          getViewApplications: stubs.getViewApplications,
        } satisfies ApiStub<ApplicationService>,
      },
      {
        provide: DialogService,
        useValue: {
          addRemoveUsersToTeam: stubs.addRemoveUsersToTeam,
          editFile: stubs.editFile,
          createApplication: stubs.createApplicationDialog,
        },
      },
      {
        provide: CrucibleDialogService,
        useValue: { confirm: stubs.confirm } satisfies Pick<
          CrucibleDialogService,
          'confirm'
        >,
      },
      // The real TeamPermissionsService and TeamRolesService load over these.
      {
        provide: TeamPermissionService,
        useValue: {
          getTeamPermissions: stubs.getTeamPermissions,
        } satisfies ApiStub<TeamPermissionService>,
      },
      {
        provide: TeamRoleService,
        useValue: {
          getTeamRoles: stubs.getTeamRoles,
        } satisfies ApiStub<TeamRoleService>,
      },
      {
        provide: Clipboard,
        useValue: { copy: stubs.clipboardCopy } satisfies Pick<
          Clipboard,
          'copy'
        >,
      },
    ],
  });

  const { fixture } = rendered;
  /** Opens a view the way AdminViewSearchComponent.executeViewAction('edit') does. */
  function openView(next: View) {
    const c = fixture.componentInstance;
    c.resetStepper();
    c.updateView();
    c.updateApplicationTemplates();
    c.setView(structuredClone(next));
    c.updateViewTeams();
    fixture.detectChanges();
  }
  if (open) {
    openView(view);
  }

  const user = userEvent.setup();
  return { ...rendered, stubs, editComplete, openView, user };
}

type Rendered = Awaited<ReturnType<typeof renderEdit>>;

/** The applications select stub. */
function appsSelect(fixture: ComponentFixture<AdminViewEditComponent>) {
  return fixture.debugElement.query(
    By.directive(ViewApplicationsSelectStubComponent),
  ).componentInstance as ViewApplicationsSelectStubComponent;
}

/** The expansion panels of the Teams step, in render order. */
function teamPanels(container: Element): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>('mat-expansion-panel'),
  ).filter((panel) => panel.querySelector('app-team-applications-select'));
}

/** Panel titles of the Teams step, in render order. */
function teamTitles(container: Element): string[] {
  return teamPanels(container).map(
    (panel) =>
      panel
        .querySelector('mat-panel-title')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim() ?? '',
  );
}

/** The Teams step panel of the named team. */
function teamPanel(container: Element, name: string): HTMLElement {
  const panel = teamPanels(container).find((p) =>
    p.querySelector('mat-panel-title')?.textContent?.trim().startsWith(name),
  );
  if (!panel) {
    throw new Error(`No team panel for ${name}`);
  }
  return panel;
}

/** The expansion panels of the Files step for uploaded files, in render order. */
function filePanels(container: Element): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>('mat-expansion-panel'),
  ).filter((panel) => panel.querySelector('button[title="Download"]'));
}

/** File names of the Files step, in render order. */
function fileTitles(container: Element): string[] {
  return filePanels(container).map(
    (panel) =>
      panel.querySelector('mat-panel-title')?.textContent?.trim() ?? '',
  );
}

/** Clicks a step header of the stepper. */
async function goToStep(r: Rendered, label: string) {
  await r.user.click(
    within(r.container.querySelector('mat-vertical-stepper')!).getByText(
      label,
      { selector: '.mat-step-label *, .mat-step-text-label' },
    ),
  );
}

/** Goes to the Teams step and expands the named team, as the user does. */
async function openTeam(r: Rendered, name: string): Promise<HTMLElement> {
  await goToStep(r, 'Teams');
  const panel = teamPanel(r.container, name);
  await r.user.click(panel.querySelector('mat-expansion-panel-header')!);
  return panel;
}

/** Goes to the Files step and expands the named file, as the user does. */
async function openFile(r: Rendered, name: string): Promise<HTMLElement> {
  await goToStep(r, 'Files');
  const panel = filePanels(r.container).find(
    (p) => p.querySelector('mat-panel-title')?.textContent?.trim() === name,
  );
  if (!panel) {
    throw new Error(`No file panel for ${name}`);
  }
  await r.user.click(panel.querySelector('mat-expansion-panel-header')!);
  return panel;
}

/** The Teams with Access select of the field at the index (staged file first, then files). */
async function teamsWithAccess(
  fixture: ComponentFixture<AdminViewEditComponent>,
  index = 0,
) {
  const fields = await TestbedHarnessEnvironment.loader(
    fixture,
  ).getAllHarnesses(
    MatFormFieldHarness.with({ floatingLabelText: 'Teams with Access' }),
  );
  return (await fields[index].getControl(MatSelectHarness))!;
}

describe('AdminViewEditComponent', () => {
  /**
   * Verifies: a user who holds only ViewViews (the admin Views section's gate) gets the view's editable fields and its
   *   Delete View, Add New Application, Add New Team and Delete Team controls (current behavior).
   * Interacts with: the rendered View Information, Applications and Teams steps; the real UserPermissionsService over
   *   stubbed permission endpoints.
   * Data: system permissions [ViewViews]; view v1 with one team, Red.
   */
  it('offers every edit control to a user with only ViewViews', async () => {
    await renderEdit({ permissions: [SystemPermission.ViewViews] });
    // Current behavior; see agent-docs/ui-test-bugs/player.ui.md.
    expect(
      (screen.getByLabelText('Name (required)') as HTMLInputElement).disabled,
    ).toBe(false);
    expect(screen.getByText('Delete View')).toBeInTheDocument();
    expect(screen.getByText('Add New Application')).toBeInTheDocument();
    expect(screen.getByText('Add New Team')).toBeInTheDocument();
    expect(screen.getByText('Delete Team')).toBeInTheDocument();
  });

  /**
   * Verifies: on init the page loads the team permission and team role catalogs its team editors read.
   * Interacts with: the real TeamPermissionsService.load and TeamRolesService.getRoles over the
   *   TeamPermissionService.getTeamPermissions and TeamRoleService.getTeamRoles stubs.
   * Data: one team permission (ViewTeam) and one team role (Member).
   */
  it('loads the team permission and role catalogs on init', async () => {
    const { fixture, stubs } = await renderEdit();
    const c = fixture.componentInstance;
    expect(stubs.getTeamPermissions).toHaveBeenCalledTimes(1);
    expect(stubs.getTeamRoles).toHaveBeenCalledTimes(1);
    expect(
      (await firstValueFrom(c.teamPermissionsService.teamPermissions$)).map(
        (p) => p.name,
      ),
    ).toEqual(['ViewTeam']);
    expect(
      (await firstValueFrom(c.teamRolesService.roles$)).map((r) => r.name),
    ).toEqual(['Member']);
  });

  /**
   * Verifies: nothing renders until a view is opened.
   * Interacts with: the @if (view !== undefined) guard.
   * Data: the page rendered without opening a view.
   */
  it('renders nothing before a view is opened', async () => {
    const { container } = await renderEdit({ open: false });
    expect(container.querySelector('mat-vertical-stepper')).toBeNull();
  });

  describe('View Information', () => {
    /**
     * Verifies: an opened view shows its name in the title and its name, description, status and template flag in the form.
     * Interacts with: setView as the search page calls it; the rendered title and View Information fields.
     * Data: Demo View, Active, not a template.
     */
    it('shows the opened view', async () => {
      const { fixture } = await renderEdit();
      expect(screen.getByText('Edit View: Demo View')).toBeInTheDocument();
      expect(screen.getByLabelText('Name (required)')).toHaveValue('Demo View');
      expect(screen.getByLabelText('Description (required)')).toHaveValue(
        'A demo',
      );
      await fixture.whenStable();
      fixture.detectChanges();
      const status = await (
        await TestbedHarnessEnvironment.loader(fixture).getHarness(
          MatFormFieldHarness.with({ floatingLabelText: 'Status' }),
        )
      ).getControl(MatSelectHarness);
      expect(await status!.getValueText()).toBe('Active');
      expect(screen.getByLabelText('Template')).not.toBeChecked();
    });

    /**
     * Verifies: changing the name and leaving the field saves the view, and the title shows the saved name.
     * Interacts with: the Name input (change on blur); ViewService.updateView.
     * Data: name changed to 'Renamed View'.
     */
    it('saves a changed name', async () => {
      const { stubs, user } = await renderEdit();
      const name = screen.getByLabelText('Name (required)');
      await user.clear(name);
      await user.type(name, 'Renamed View', { skipClick: true });
      await user.tab();
      expect(stubs.updateView).toHaveBeenCalledExactlyOnceWith('v1', {
        ...demoView,
        name: 'Renamed View',
      });
      expect(screen.getByText('Edit View: Renamed View')).toBeInTheDocument();
    });

    /**
     * Verifies: changing only the description saves the view once with the new description.
     * Interacts with: the Description textarea (change on blur); ViewService.updateView.
     * Data: description changed to 'A new description'.
     */
    it('saves a changed description', async () => {
      const { stubs, user } = await renderEdit();
      const description = screen.getByLabelText('Description (required)');
      await user.clear(description);
      await user.type(description, 'A new description', { skipClick: true });
      await user.tab();
      expect(stubs.updateView).toHaveBeenCalledExactlyOnceWith('v1', {
        ...demoView,
        description: 'A new description',
      });
    });

    /**
     * Verifies: leaving Name or Description after putting back its saved value sends no update for either field.
     * Interacts with: the Name input and Description textarea (change on blur); ViewService.updateView; the title.
     * Data: one row per field; the field is first set to an invalid value (not saved), then back to the saved one.
     */
    it.each<[string, string, string]>([
      ['Name (required)', 'abc', 'Demo View'],
      ['Description (required)', '', 'A demo'],
    ])(
      'sends no update when %s is put back to its saved value',
      async (label, invalid, saved) => {
        const { stubs, user } = await renderEdit();
        const field = screen.getByLabelText(label);
        await user.clear(field);
        if (invalid) {
          await user.type(field, invalid, { skipClick: true });
        }
        await user.tab();
        await user.click(field);
        await user.clear(field);
        await user.type(field, saved, { skipClick: true });
        await user.tab();
        expect(field).toHaveValue(saved);
        expect(stubs.updateView).not.toHaveBeenCalled();
        expect(screen.getByText('Edit View: Demo View')).toBeInTheDocument();
      },
    );

    /**
     * Verifies: a name shorter than four characters shows its error, is not saved, and disables Return and Done.
     * Interacts with: the Name input; the mat-error; ViewService.updateView; the Return and Done buttons.
     * Data: name changed to 'abc'.
     */
    it('rejects a name shorter than four characters', async () => {
      const { stubs, user } = await renderEdit();
      const name = screen.getByLabelText('Name (required)');
      await user.clear(name);
      await user.type(name, 'abc', { skipClick: true });
      await user.tab();
      expect(
        screen.getByText('Must contain 4 or more characters'),
      ).toBeInTheDocument();
      expect(stubs.updateView).not.toHaveBeenCalled();
      expect((screen.getByTitle('Return') as HTMLButtonElement).disabled).toBe(
        true,
      );
      expect(
        (screen.getByText('Done').closest('button') as HTMLButtonElement)
          .disabled,
      ).toBe(true);
    });

    /**
     * Verifies: choosing a status saves the view with it.
     * Interacts with: the Status select (MatSelectHarness); ViewService.updateView.
     * Data: Demo View Active; Inactive chosen.
     */
    it('saves a chosen status', async () => {
      const logged = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { fixture, stubs } = await renderEdit();
      const status = await (
        await TestbedHarnessEnvironment.loader(fixture).getHarness(
          MatFormFieldHarness.with({ floatingLabelText: 'Status' }),
        )
      ).getControl(MatSelectHarness);
      await status!.open();
      await status!.clickOptions({ text: 'Inactive' });
      expect(stubs.updateView).toHaveBeenCalledExactlyOnceWith('v1', {
        ...demoView,
        status: 'Inactive',
      });
      expect(logged).toHaveBeenCalledWith('Inactive');
    });

    /**
     * Verifies: ticking Template saves the view as a template.
     * Interacts with: the Template checkbox; ViewService.updateView.
     * Data: Demo View not a template.
     */
    it('saves the view as a template', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const { stubs, user } = await renderEdit();
      await user.click(screen.getByLabelText('Template'));
      expect(stubs.updateView).toHaveBeenCalledExactlyOnceWith('v1', {
        ...demoView,
        isTemplate: true,
      });
    });

    /**
     * Verifies: a confirmed Delete View deletes the view and completes with null, so the search does not reselect it.
     * Interacts with: the Delete View button; CrucibleDialogService.confirm; ViewService.deleteView; the editComplete output.
     * Data: confirmResult true.
     */
    it('deletes the view after confirmation and completes with null', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const { stubs, editComplete, user } = await renderEdit({
        confirmResult: true,
      });
      await user.click(screen.getByText('Delete View'));
      expect(stubs.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Delete View',
          message: 'Are you sure that you want to delete view Demo View?',
        }),
      );
      expect(stubs.deleteView).toHaveBeenCalledExactlyOnceWith('v1');
      expect(editComplete).toHaveBeenCalledExactlyOnceWith(null);
    });

    /**
     * Verifies: a declined Delete View deletes nothing and stays open.
     * Interacts with: the Delete View button; CrucibleDialogService.confirm; ViewService.deleteView; editComplete.
     * Data: confirmResult false.
     */
    it('keeps the view when the deletion is declined', async () => {
      const { stubs, editComplete, user } = await renderEdit({
        confirmResult: false,
      });
      await user.click(screen.getByText('Delete View'));
      expect(stubs.deleteView).not.toHaveBeenCalled();
      expect(editComplete).not.toHaveBeenCalled();
    });

    /**
     * Verifies: Return and Done both complete the edit with the view's id.
     * Interacts with: the Return and Done buttons; the editComplete output.
     * Data: one row per button.
     */
    it.each<[string, () => HTMLElement]>([
      ['Return', () => screen.getByTitle('Return')],
      ['Done', () => screen.getByText('Done')],
    ])('completes with the view id from %s', async (_button, button) => {
      const { editComplete, user } = await renderEdit();
      await user.click(button());
      expect(editComplete).toHaveBeenCalledExactlyOnceWith('v1');
    });

    /**
     * Verifies: opened from the player (in a dialog), the page renders inside a crucible dialog whose Done completes the edit.
     * Interacts with: the injected MatDialogRef; the crucible-dialog layout; the editComplete output.
     * Data: a MatDialogRef is provided.
     */
    it('renders as a dialog when opened in one', async () => {
      const { container, editComplete, user } = await renderEdit({
        asDialog: true,
      });
      const dialog = container.querySelector('crucible-dialog')!;
      expect(dialog).not.toBeNull();
      expect(
        within(dialog as HTMLElement).getByText('Edit View: Demo View'),
      ).toBeInTheDocument();
      await user.click(within(dialog as HTMLElement).getByText('Done'));
      expect(editComplete).toHaveBeenCalledExactlyOnceWith('v1');
    });
  });

  describe('Applications', () => {
    /**
     * Verifies: the applications select gets the opened view, and moving to the Applications step reloads the templates
     *   and the view's applications.
     * Interacts with: the applications select stub; the Applications step header; ApplicationService.getApplicationTemplates.
     * Data: Demo View.
     */
    it('reloads templates and applications on the Applications step', async () => {
      const r = await renderEdit();
      expect(appsSelect(r.fixture).view).toEqual(demoView);
      expect(r.stubs.getApplicationTemplates).toHaveBeenCalledTimes(1);
      await goToStep(r, 'Applications');
      expect(r.stubs.getApplicationTemplates).toHaveBeenCalledTimes(2);
      expect(appsSelect(r.fixture).updateApplications).toHaveBeenCalledTimes(1);
    });

    /**
     * Verifies: Add New Application, Blank Application creates a "New Application" in the view and selects it in the
     *   applications select; choosing a template creates one from that template.
     * Interacts with: the Add New Application menu and its Templates submenu; ApplicationService.createApplication; the
     *   applications select stub.
     * Data: one row per menu choice; template Chat (tmpl-1).
     */
    it.each<[string, string[], Application]>([
      [
        'a blank application',
        ['Blank Application'],
        { name: 'New Application', viewId: 'v1' },
      ],
      [
        'an application from a template',
        ['Templates', 'Chat'],
        { viewId: 'v1', applicationTemplateId: 'tmpl-1' },
      ],
    ])('adds %s from the menu', async (_case, choices, created) => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const r = await renderEdit();
      const { fixture, stubs, user } = r;
      await goToStep(r, 'Applications');
      appsSelect(fixture).updateApplications.mockClear();
      await user.click(screen.getByText('Add New Application'));
      for (const choice of choices) {
        await user.click(await screen.findByText(choice));
      }
      expect(stubs.createApplication).toHaveBeenCalledExactlyOnceWith(
        'v1',
        created,
      );
      expect(appsSelect(fixture).updateApplications).toHaveBeenCalledTimes(1);
      expect(appsSelect(fixture).currentApp).toEqual({
        ...created,
        id: 'app-1',
      });
    });
  });

  describe('Teams', () => {
    /**
     * Verifies: the view's teams are listed by name, each with its member count, the DEFAULT badge on the default team,
     *   and its role and applications editors bound to the team.
     * Interacts with: TeamService.getViewTeams; UserService.getTeamUsers; the Teams step; the child stubs.
     * Data: Red (default, one member) and Alpha (no members), returned unsorted.
     */
    it('lists the teams with member counts and the default badge', async () => {
      const { container, fixture } = await renderEdit({
        view: { ...demoView, defaultTeamId: 't1' },
        teams: [red, alpha],
      });
      expect(teamTitles(container)).toEqual(['Alpha', 'Red DEFAULT']);
      expect(
        teamPanels(container).map(
          (panel) => panel.querySelector('.mat-badge-content')?.textContent,
        ),
      ).toEqual(['0', '1']);
      const roles = fixture.debugElement
        .queryAll(By.directive(RolesPermissionsSelectStubComponent))
        .map(
          (de) => de.componentInstance as RolesPermissionsSelectStubComponent,
        );
      expect(roles.map((r) => r.team.name)).toEqual(['Alpha', 'Red']);
      expect(roles[0].allTeams.map((t) => t.name)).toEqual(['Alpha', 'Red']);
      const apps = fixture.debugElement
        .queryAll(By.directive(TeamApplicationsSelectStubComponent))
        .map(
          (de) => de.componentInstance as TeamApplicationsSelectStubComponent,
        );
      expect(apps.map((a) => [a.view.id, a.team.name])).toEqual([
        ['v1', 'Alpha'],
        ['v1', 'Red'],
      ]);
    });

    /**
     * Verifies: while team members are loading the Teams step shows a spinner and no Add New Team.
     * Interacts with: UserService.getTeamUsers (never answers); the Teams step.
     * Data: Red.
     */
    it('shows a spinner while the teams load', async () => {
      const { container, stubs, openView } = await renderEdit({ open: false });
      stubs.getTeamUsers.mockReturnValue(NEVER);
      openView(demoView);
      expect(container.querySelector('mat-progress-spinner')).not.toBeNull();
      expect(screen.queryByText('Add New Team')).not.toBeInTheDocument();
    });

    /**
     * Verifies: moving to the Teams step reloads the teams.
     * Interacts with: the Teams step header; TeamService.getViewTeams.
     * Data: Red; the reload returns Red and Alpha.
     */
    it('reloads the teams on the Teams step', async () => {
      const r = await renderEdit();
      r.stubs.getViewTeams.mockReturnValue(of([red, alpha]));
      await goToStep(r, 'Teams');
      expect(r.stubs.getViewTeams).toHaveBeenCalledTimes(2);
      expect(teamTitles(r.container)).toEqual(['Alpha', 'Red']);
    });

    /**
     * Verifies: Add New Team creates a "New Team" in the view and lists it first, open, with its name in the name field.
     * Interacts with: the Add New Team button; TeamService.createTeam; the Teams step.
     * Data: Red.
     */
    it('adds a new team and opens it', async () => {
      const r = await renderEdit();
      const { container, stubs, user } = r;
      await goToStep(r, 'Teams');
      await user.click(screen.getByText('Add New Team'));
      expect(stubs.createTeam).toHaveBeenCalledExactlyOnceWith('v1', {
        name: 'New Team',
      });
      expect(teamTitles(container)).toEqual(['New Team', 'Red']);
      const panel = teamPanel(container, 'New Team');
      expect(panel.querySelector('mat-expansion-panel-header')).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      expect(panel.querySelector('#teamNamenew-team')).toHaveValue('New Team');
    });

    /**
     * Verifies: renaming an opened team saves the name with its role and updates the panel title; a name under three
     *   characters is not saved.
     * Interacts with: the team's panel header and Team Name field; TeamService.updateTeam.
     * Data: Red (role tr-1) renamed to 'ab' (rejected), then to 'Crimson'.
     */
    it('renames a team and rejects a too-short name', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const r = await renderEdit({ teams: [{ ...red, roleId: 'tr-1' }] });
      const { container, stubs, user } = r;
      const panel = await openTeam(r, 'Red');
      const name = panel.querySelector<HTMLInputElement>('#teamNamet1')!;
      expect(name).toHaveValue('Red');
      await user.clear(name);
      await user.type(name, 'ab', { skipClick: true });
      await user.tab();
      expect(stubs.updateTeam).not.toHaveBeenCalled();
      await user.clear(name);
      await user.type(name, 'Crimson', { skipClick: true });
      await user.tab();
      expect(stubs.updateTeam).toHaveBeenCalledExactlyOnceWith('t1', {
        name: 'Crimson',
        roleId: 'tr-1',
      });
      expect(teamTitles(container)).toEqual(['Crimson']);
    });

    /**
     * Verifies: ticking a team's Default makes it the view's default team, and unticking clears the default.
     * Interacts with: the team's Default checkbox; ViewService.updateView; the DEFAULT badge.
     * Data: Red; no default team at first.
     */
    it('sets and clears the default team', async () => {
      const r = await renderEdit();
      const { container, stubs, user } = r;
      const panel = await openTeam(r, 'Red');
      await user.click(within(panel).getByLabelText('Default'));
      expect(stubs.updateView).toHaveBeenLastCalledWith('v1', {
        ...demoView,
        defaultTeamId: 't1',
      });
      expect(teamTitles(container)).toEqual(['Red DEFAULT']);
      await user.click(
        within(teamPanel(container, 'Red')).getByLabelText('Default'),
      );
      expect(stubs.updateView).toHaveBeenLastCalledWith('v1', {
        ...demoView,
        defaultTeamId: null,
      });
      expect(teamTitles(container)).toEqual(['Red']);
    });

    /**
     * Verifies: the Users button opens the add/remove users dialog for the team (with role management), and the
     *   member count follows what the dialog closes with; a dismissed dialog leaves it.
     * Interacts with: the team's Users button; DialogService.addRemoveUsersToTeam; the member badge.
     * Data: Red with one member; the dialog closes with two rows, then is dismissed.
     */
    it('updates the member count from the users dialog', async () => {
      const r = await renderEdit();
      const { container, stubs, user } = r;
      await openTeam(r, 'Red');
      const twoRows = [{ name: 'A' }, { name: 'B' }] as TeamUser[];
      stubs.addRemoveUsersToTeam.mockReturnValueOnce(
        of({ teamUsers: twoRows }),
      );
      const usersButton = () =>
        within(teamPanel(container, 'Red'))
          .getByAltText('Users')
          .closest('button')!;
      await user.click(usersButton());
      expect(stubs.addRemoveUsersToTeam).toHaveBeenCalledExactlyOnceWith(
        'Add or Remove Users for team Red',
        red,
        { maxWidth: '100vw', width: 'auto' },
      );
      // Only the length of the closed-with rows is rendered (the member badge).
      const badge = () =>
        teamPanel(container, 'Red').querySelector('.mat-badge-content');
      expect(badge()).toHaveTextContent('2');
      stubs.addRemoveUsersToTeam.mockReturnValueOnce(of(undefined));
      await user.click(usersButton());
      expect(badge()).toHaveTextContent('2');
    });

    /**
     * Verifies: a confirmed Delete Team deletes the team and reloads the teams; a declined one deletes nothing.
     * Interacts with: the team's Delete Team button; CrucibleDialogService.confirm; TeamService.deleteTeam and getViewTeams.
     * Data: one row per answer; Red and Alpha, the reload returning Alpha.
     */
    it.each<[string, boolean, string[]]>([
      ['deletes the team when confirmed', true, ['Alpha']],
      ['keeps the team when declined', false, ['Alpha', 'Red']],
    ])('%s', async (_case, confirmResult, remaining) => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const r = await renderEdit({ confirmResult, teams: [red, alpha] });
      const { container, stubs, user } = r;
      const panel = await openTeam(r, 'Red');
      stubs.getViewTeams.mockReturnValue(of([alpha]));
      await user.click(within(panel).getByText('Delete Team'));
      expect(stubs.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Delete Team',
          message: 'Are you sure that you want to delete team Red?',
        }),
      );
      expect(stubs.deleteTeam).toHaveBeenCalledTimes(confirmResult ? 1 : 0);
      expect(teamTitles(container)).toEqual(remaining);
    });

    /**
     * Verifies: deleting the view's last team leaves the Teams step on its spinner, with Add New Team hidden (current behavior).
     * Interacts with: the rendered Delete Team and Add New Team buttons; stubbed CrucibleDialogService.confirm,
     *   TeamService.deleteTeam and TeamService.getViewTeams (which then returns no teams).
     * Data: confirmResult=true; view v1 with one team, Red (t1).
     */
    it('leaves the Teams step on a spinner after the last team is deleted', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const r = await renderEdit({ confirmResult: true });
      const { container, stubs, user } = r;
      const panel = await openTeam(r, 'Red');
      expect(screen.getByText('Add New Team')).toBeInTheDocument();
      stubs.getViewTeams.mockReturnValue(of([]));
      await user.click(within(panel).getByText('Delete Team'));
      expect(stubs.deleteTeam).toHaveBeenCalledWith('t1');
      // Current behavior; see agent-docs/ui-test-bugs/player.ui.md.
      expect(container.querySelector('mat-progress-spinner')).not.toBeNull();
      expect(screen.queryByText('Add New Team')).not.toBeInTheDocument();
    });
  });

  describe('Files', () => {
    /**
     * Verifies: opening another view after working on the Files step starts it on the first step, View Information,
     *   with the new view's fields.
     * Interacts with: the Files step header; the openView sequence AdminViewSearchComponent.executeViewAction('edit')
     *   runs (resetStepper, then setView); the stepper's current step header; the Name input.
     * Data: Demo View on the Files step, then Second View (v2) opened.
     */
    it('opens a second view on the View Information step', async () => {
      const r = await renderEdit();
      const currentStep = () =>
        r.container.querySelector('mat-step-header[aria-current="step"]');
      await goToStep(r, 'Files');
      expect(currentStep()).toHaveTextContent('Files');
      r.openView({ ...demoView, id: 'v2', name: 'Second View' });
      await r.fixture.whenStable();
      expect(currentStep()).toHaveTextContent('View Information');
      expect(screen.getByText('Edit View: Second View')).toBeInTheDocument();
      expect(screen.getByLabelText('Name (required)')).toHaveValue(
        'Second View',
      );
    });

    /**
     * Verifies: moving to the Files step loads the view's files, its application names and its teams; Add as App is
     *   offered only for a file no application is named after.
     * Interacts with: the Files step header; FileService.getViewFiles; ApplicationService.getViewApplications;
     *   TeamService.getViewTeams; the file panels.
     * Data: files doc.txt and map.png; an application named map.png already exists.
     */
    it('lists the files and offers Add as App for new ones', async () => {
      const r = await renderEdit({
        files: [docFile, { id: 'f2', name: 'map.png', teamIds: ['t1'] }],
        viewApps: [{ id: 'a1', name: 'map.png', viewId: 'v1' }],
      });
      await goToStep(r, 'Files');
      expect(r.stubs.getViewFiles).toHaveBeenCalledExactlyOnceWith('v1', true);
      expect(r.stubs.getViewApplications).toHaveBeenCalledExactlyOnceWith('v1');
      expect(r.stubs.getViewTeams).toHaveBeenCalledTimes(2);
      expect(fileTitles(r.container)).toEqual(['doc.txt', 'map.png']);
      const [doc, map] = filePanels(r.container);
      expect(within(doc).getByTitle('Add as Application')).toBeInTheDocument();
      expect(
        within(map).queryByTitle('Add as Application'),
      ).not.toBeInTheDocument();
    });

    /**
     * Verifies: coming back to the Files step reloads the files without listing any twice.
     * Interacts with: the Files and Teams step headers; FileService.getViewFiles; the file panels.
     * Data: files doc.txt and map.png; Files, then Teams, then Files again.
     */
    it('lists each file once after returning to the Files step', async () => {
      const r = await renderEdit({
        files: [docFile, { id: 'f2', name: 'map.png', teamIds: ['t1'] }],
      });
      await goToStep(r, 'Files');
      await goToStep(r, 'Teams');
      await goToStep(r, 'Files');
      expect(r.stubs.getViewFiles).toHaveBeenCalledTimes(2);
      expect(fileTitles(r.container)).toEqual(['doc.txt', 'map.png']);
    });

    /**
     * Verifies: uploading a file whose name is already listed does not list it twice.
     * Interacts with: the hidden file input, Select All Teams and Upload File; FileService.uploadMultipleFiles.
     * Data: doc.txt listed; doc.txt uploaded again and returned by the API with a 201.
     */
    it('lists a re-uploaded file once', async () => {
      const r = await renderEdit();
      await goToStep(r, 'Files');
      const file = new File(['y'], 'doc.txt');
      await r.user.upload(
        r.container.querySelector<HTMLInputElement>('input[type="file"]')!,
        file,
      );
      // The staged file's panel comes first, before the listed files.
      const [stagedSelectAll] = screen.getAllByLabelText('Select All Teams');
      await r.user.click(stagedSelectAll);
      r.stubs.uploadMultipleFiles.mockReturnValueOnce(
        of(
          new HttpResponse({
            status: 201,
            body: [{ id: 'f9', name: 'doc.txt', teamIds: ['t1'] }],
          }),
        ),
      );
      await r.user.click(screen.getByText('Upload File'));
      expect(r.stubs.uploadMultipleFiles).toHaveBeenCalledTimes(1);
      expect(fileTitles(r.container)).toEqual(['doc.txt']);
    });

    /**
     * Verifies: a staged file can be uploaded only once a team is chosen; Select All Teams chooses every team, and a 201
     *   lists the uploaded file and clears the staged one.
     * Interacts with: the hidden file input behind Add New File; the staged file's Select All Teams and Upload File;
     *   FileService.uploadMultipleFiles.
     * Data: Red and Alpha; up.txt staged; the upload answers 201 with up.txt.
     */
    it('uploads a staged file to the chosen teams', async () => {
      const r = await renderEdit({ teams: [red, alpha], files: [] });
      await goToStep(r, 'Files');
      const file = new File(['x'], 'up.txt');
      await r.user.upload(
        r.container.querySelector<HTMLInputElement>('input[type="file"]')!,
        file,
      );
      expect(screen.getByText('up.txt')).toBeInTheDocument();
      const upload = screen.getByText('Upload File').closest('button')!;
      expect(upload.disabled).toBe(true);
      expect(
        screen.getByText('At least one team must be selected'),
      ).toBeInTheDocument();

      await r.user.click(screen.getByLabelText('Select All Teams'));
      expect(upload.disabled).toBe(false);
      r.stubs.uploadMultipleFiles.mockReturnValueOnce(
        of(
          new HttpResponse({
            status: 201,
            body: [{ id: 'f9', name: 'up.txt', teamIds: ['t2', 't1'] }],
          }),
        ),
      );
      await r.user.click(upload);
      expect(r.stubs.uploadMultipleFiles).toHaveBeenCalledExactlyOnceWith(
        'v1',
        ['t2', 't1'],
        [file],
        'events',
        true,
      );
      expect(fileTitles(r.container)).toEqual(['up.txt']);
      expect(screen.queryByText('Upload File')).not.toBeInTheDocument();
    });

    /**
     * Verifies: picking teams one by one in the staged file's Teams with Access ticks Select All Teams once every team
     *   is chosen.
     * Interacts with: the staged file's Teams with Access select (MatSelectHarness) and Select All Teams checkbox.
     * Data: Red and Alpha; both picked.
     */
    it('ticks Select All Teams once every team is picked', async () => {
      const r = await renderEdit({ teams: [red, alpha], files: [] });
      await goToStep(r, 'Files');
      await r.user.upload(
        r.container.querySelector<HTMLInputElement>('input[type="file"]')!,
        new File(['x'], 'up.txt'),
      );
      const select = await teamsWithAccess(r.fixture);
      await select.open();
      await select.clickOptions({ text: 'Alpha' });
      expect(screen.getByLabelText('Select All Teams')).not.toBeChecked();
      await select.clickOptions({ text: 'Red' });
      // ngModel writes the checkbox after a microtask.
      await r.fixture.whenStable();
      r.fixture.detectChanges();
      expect(screen.getByLabelText('Select All Teams')).toBeChecked();
    });

    /**
     * Verifies: an upload in progress shows its percentage on the progress bar.
     * Interacts with: Upload File; FileService.uploadMultipleFiles (an UploadProgress event); the progress bar.
     * Data: 50 of 200 bytes sent.
     */
    it('shows the upload progress', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const r = await renderEdit({ files: [] });
      await goToStep(r, 'Files');
      await r.user.upload(
        r.container.querySelector<HTMLInputElement>('input[type="file"]')!,
        new File(['x'], 'up.txt'),
      );
      await r.user.click(screen.getByLabelText('Select All Teams'));
      r.stubs.uploadMultipleFiles.mockReturnValueOnce(
        of({ type: HttpEventType.UploadProgress, loaded: 50, total: 200 }),
      );
      await r.user.click(screen.getByText('Upload File'));
      expect(r.container.querySelector('mat-progress-bar')).toHaveAttribute(
        'aria-valuenow',
        '25',
      );
    });

    /**
     * Verifies: Cancel drops the staged file.
     * Interacts with: the staged file's Cancel button.
     * Data: up.txt staged.
     */
    it('drops a staged file on Cancel', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const r = await renderEdit({ files: [] });
      await goToStep(r, 'Files');
      await r.user.upload(
        r.container.querySelector<HTMLInputElement>('input[type="file"]')!,
        new File(['x'], 'up.txt'),
      );
      await r.user.click(screen.getByText('Cancel'));
      expect(screen.queryByText('up.txt')).not.toBeInTheDocument();
    });

    /**
     * Verifies: changing a file's teams saves them, and clearing them warns and saves nothing.
     * Interacts with: the file's Teams with Access select (MatSelectHarness); FileService.updateFile.
     * Data: doc.txt shared with Red; Alpha added, then both removed.
     */
    it('saves a file’s teams and refuses to save none', async () => {
      const r = await renderEdit({ teams: [red, alpha] });
      await openFile(r, 'doc.txt');
      const select = await teamsWithAccess(r.fixture);
      await select.open();
      await select.clickOptions({ text: 'Alpha' });
      expect(r.stubs.updateFile).toHaveBeenCalledExactlyOnceWith(
        'f1',
        'doc.txt',
        ['t2', 't1'],
        null,
      );
      await select.clickOptions({ text: 'Alpha' });
      await select.clickOptions({ text: 'Red' });
      expect(r.stubs.updateFile).toHaveBeenCalledTimes(2);
      expect(
        screen.getByText('At least one team must be selected'),
      ).toBeInTheDocument();
    });

    /**
     * Verifies: a file's Select All Teams shares it with every team and saves; unticking clears its teams without saving.
     * Interacts with: the file's Select All Teams checkbox; FileService.updateFile.
     * Data: doc.txt shared with Red; teams Red and Alpha.
     */
    it('shares a file with all teams from Select All Teams', async () => {
      const r = await renderEdit({ teams: [red, alpha] });
      const panel = await openFile(r, 'doc.txt');
      const selectAll = within(panel).getByLabelText('Select All Teams');
      await r.user.click(selectAll);
      expect(r.stubs.updateFile).toHaveBeenCalledExactlyOnceWith(
        'f1',
        'doc.txt',
        ['t2', 't1'],
        null,
      );
      expect(selectAll).toBeChecked();
      await r.user.click(selectAll);
      expect(r.stubs.updateFile).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText('At least one team must be selected'),
      ).toBeInTheDocument();
    });

    /**
     * Verifies: Download fetches the file and clicks a link to it, naming the download for a document and not for an
     *   image or pdf (which opens in the browser).
     * Interacts with: the file's Download button; FileService.download; URL.createObjectURL; the created link.
     * Data: one row per file name.
     */
    it.each<[string, string]>([
      ['report.txt', 'report.txt'],
      ['photo.png', ''],
      ['guide.pdf', ''],
    ])('downloads %s with download name "%s"', async (name, download) => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const r = await renderEdit({
        files: [{ id: 'f1', name, teamIds: ['t1'] }],
      });
      await openFile(r, name);
      const link = document.createElement('a');
      const click = vi.spyOn(link, 'click').mockImplementation(() => {});
      const createElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation(
        (tag: string, options?: ElementCreationOptions) =>
          tag === 'a' ? link : createElement(tag, options),
      );
      vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:url');
      await r.user.click(screen.getByTitle('Download'));
      expect(r.stubs.download).toHaveBeenCalledExactlyOnceWith('f1');
      expect(link.href).toBe('blob:url');
      expect(link.target).toBe('_blank');
      expect(link.download).toBe(download);
      expect(click).toHaveBeenCalledTimes(1);
    });

    /**
     * Verifies: a confirmed Delete removes the file; a refused delete alerts and keeps it; a declined one does nothing.
     * Interacts with: the file's Delete button; CrucibleDialogService.confirm; FileService.deleteFile; window.alert.
     * Data: one row per outcome; doc.txt.
     */
    it.each<[string, boolean, unknown, string[], boolean]>([
      ['removes the file when confirmed', true, null, [], false],
      ['alerts when the API refuses', true, { status: 403 }, ['doc.txt'], true],
      ['keeps the file when declined', false, null, ['doc.txt'], false],
    ])(
      'Delete %s',
      async (_case, confirmResult, response, remaining, alerted) => {
        const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
        const r = await renderEdit({ confirmResult });
        r.stubs.deleteFile.mockReturnValue(of(response as null));
        await openFile(r, 'doc.txt');
        await r.user.click(screen.getByTitle('Delete'));
        expect(r.stubs.confirm).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Delete File?' }),
        );
        expect(r.stubs.deleteFile).toHaveBeenCalledTimes(confirmResult ? 1 : 0);
        expect(fileTitles(r.container)).toEqual(remaining);
        expect(alert).toHaveBeenCalledTimes(alerted ? 1 : 0);
      },
    );

    /**
     * Verifies: Copy Link copies the file's download link.
     * Interacts with: the file's Copy Link button; Clipboard.copy.
     * Data: doc.txt (f1).
     */
    it('copies the file link', async () => {
      const r = await renderEdit();
      await openFile(r, 'doc.txt');
      await r.user.click(screen.getByTitle('Copy Link'));
      expect(r.stubs.clipboardCopy).toHaveBeenCalledExactlyOnceWith(
        expect.stringMatching(/\/file\?id=f1&name=doc\.txt$/),
      );
    });

    /**
     * Verifies: Edit Name opens the file dialog and the file's title follows the name it closes with.
     * Interacts with: the file's Edit button; DialogService.editFile; the file panel title.
     * Data: doc.txt shared with Red; the dialog closes with 'renamed.txt'.
     */
    it('renames a file from the edit dialog', async () => {
      const r = await renderEdit();
      await openFile(r, 'doc.txt');
      await r.user.click(screen.getByTitle('Edit'));
      expect(r.stubs.editFile).toHaveBeenCalledExactlyOnceWith(
        'f1',
        'v1',
        'doc.txt',
        ['t1'],
      );
      expect(fileTitles(r.container)).toEqual(['renamed.txt']);
    });

    /**
     * Verifies: Add as App creates an embeddable application pointing at the file, opens the team dialog for it, and
     *   stops offering Add as App for that file.
     * Interacts with: the file's Add as Application button; ApplicationService.createApplication;
     *   DialogService.createApplication.
     * Data: doc.txt; teams Red.
     */
    it('adds a file as an application', async () => {
      const r = await renderEdit();
      await openFile(r, 'doc.txt');
      await r.user.click(screen.getByTitle('Add as Application'));
      expect(r.stubs.createApplication).toHaveBeenCalledExactlyOnceWith('v1', {
        name: 'doc.txt',
        url: expect.stringMatching(/\/file\?id=f1&name=doc\.txt$/),
        embeddable: true,
        loadInBackground: false,
        viewId: 'v1',
        icon: '/assets/img/SP_Icon_Intel.png',
      });
      expect(r.stubs.createApplicationDialog).toHaveBeenCalledExactlyOnceWith(
        'app-1',
        expect.objectContaining({ id: 'f1' }),
        [expect.objectContaining({ name: 'Red' })],
      );
      expect(screen.queryByTitle('Add as Application')).not.toBeInTheDocument();
    });
  });

  describe('progress flags after a failed request', () => {
    type Act = (r: Rendered, failure: Error) => Promise<void>;
    const loadTeams: Act = async ({ stubs, openView }, failure) => {
      stubs.getViewTeams.mockReturnValueOnce(throwError(() => failure));
      openView(demoView);
    };
    const loadTeamUsers: Act = async ({ stubs, openView }, failure) => {
      stubs.getTeamUsers.mockReturnValueOnce(throwError(() => failure));
      openView(demoView);
    };
    const upload: Act = async (r, failure) => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      r.openView(demoView);
      await goToStep(r, 'Files');
      await r.user.upload(
        r.container.querySelector<HTMLInputElement>('input[type="file"]')!,
        new File(['x'], 'up.txt'),
      );
      await r.user.click(screen.getByLabelText('Select All Teams'));
      r.stubs.uploadMultipleFiles.mockReturnValueOnce(
        throwError(() => failure),
      );
      await r.user.click(screen.getByText('Upload File'));
    };

    /**
     * Verifies: a failed request leaves its progress indicator up (the teams spinner or the upload bar) and lets the error escape (current behavior).
     * Interacts with: the failing endpoint (TeamService.getViewTeams, UserService.getTeamUsers or
     *   FileService.uploadMultipleFiles); the rendered indicator; captureUnhandledRxErrors.
     * Data: view v1 with team Red; the row's endpoint fails with a 500 on its next call.
     */
    it.each<[string, Act, string]>([
      ['getViewTeams in updateViewTeams', loadTeams, 'mat-progress-spinner'],
      [
        'getTeamUsers in updateViewTeams',
        loadTeamUsers,
        'mat-progress-spinner',
      ],
      ['uploadMultipleFiles in uploadFile', upload, 'mat-progress-bar'],
    ])('leaves %s stuck when it fails', async (_label, act, indicator) => {
      const errors = captureUnhandledRxErrors();
      const failure = new Error('500');
      const rendered = await renderEdit({ open: false, files: [] });
      await act(rendered, failure);
      await flush();
      rendered.fixture.detectChanges();
      // Current behavior; see agent-docs/ui-test-bugs/player.ui.md.
      expect(rendered.container.querySelector(indicator)).not.toBeNull();
      expect(errors).toEqual([failure]);
    });
  });

  describe('UserErrorStateMatcher', () => {
    /**
     * Verifies: a dirty invalid control is reported as an error state.
     * Interacts with: UserErrorStateMatcher.isErrorState (pure).
     * Data: control { invalid: true, dirty: true }, no form.
     */
    it('is an error state when the control is invalid and dirty', () => {
      const matcher = new UserErrorStateMatcher();
      const control = new UntypedFormControl('', Validators.required);
      control.markAsDirty();
      expect(matcher.isErrorState(control, null)).toBe(true);
    });

    /**
     * Verifies: an invalid control on a submitted form is an error state even if pristine.
     * Interacts with: UserErrorStateMatcher.isErrorState (pure).
     * Data: control { invalid: true, dirty: false }, form { submitted: true }.
     */
    it('is an error state when invalid and the form was submitted', () => {
      const matcher = new UserErrorStateMatcher();
      const control = new UntypedFormControl('', Validators.required);
      const form = new FormGroupDirective([], []);
      form.form = new FormGroup({});
      form.onSubmit(new Event('submit'));
      expect(control.dirty).toBe(false);
      expect(matcher.isErrorState(control, form)).toBe(true);
    });

    /**
     * Verifies: a valid control is not an error state.
     * Interacts with: UserErrorStateMatcher.isErrorState (pure).
     * Data: control { invalid: false, dirty: true }, no form.
     */
    it('is not an error state when the control is valid', () => {
      const matcher = new UserErrorStateMatcher();
      const control = new UntypedFormControl('a value', Validators.required);
      control.markAsDirty();
      expect(matcher.isErrorState(control, null)).toBe(false);
    });
  });
});
