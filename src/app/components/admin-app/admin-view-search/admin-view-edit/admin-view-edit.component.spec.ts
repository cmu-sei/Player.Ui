// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, input } from '@angular/core';
import { EMPTY, firstValueFrom, Observable, of, throwError } from 'rxjs';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { HttpEvent, HttpResponse } from '@angular/common/http';
import {
  FormGroup,
  FormGroupDirective,
  UntypedFormControl,
  Validators,
} from '@angular/forms';
import { Clipboard } from '@angular/cdk/clipboard';
import {
  CrucibleDialogService,
  CRUCIBLE_DIALOG_IMPORTS,
} from '@cmusei/crucible-common';
import {
  Team,
  TeamPermissionModel,
  TeamPermissionService,
  TeamRole,
  TeamRoleService,
  TeamService,
  View,
  ViewService,
  UserService,
  FileService,
  FileModel,
} from '../../../../generated/player-api';
import {
  Application,
  ApplicationService,
} from '../../../../generated/player-api';
import { DialogService } from '../../../../services/dialog/dialog.service';
import type { TeamUser } from '../../../shared/add-remove-users-dialog/add-remove-users-dialog.component';
import {
  AdminViewEditComponent,
  TeamUserApp,
  UserErrorStateMatcher,
} from './admin-view-edit.component';
import { renderComponent } from '../../../../test-utils/render-component';
import { fileList } from '../../../../test-utils/file-list';
import { ViewApplicationsSelectComponent } from '../../view-applications-select/view-applications-select.component';
import { MatExpansionModule } from '@angular/material/expansion';
import { ClipboardModule } from 'ngx-clipboard';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
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

// Children of the stepper's step contents, which render only after a second
// change-detection pass (the empty-teams test triggers one).
@Component({ selector: 'app-view-applications-select', template: '' })
class ViewApplicationsSelectStubComponent {
  readonly view = input<View>();
}

@Component({ selector: 'app-roles-permissions-select', template: '' })
class RolesPermissionsSelectStubComponent {
  readonly team = input<Team>();
  readonly allTeams = input<Team[]>();
}

@Component({ selector: 'app-team-applications-select', template: '' })
class TeamApplicationsSelectStubComponent {
  readonly view = input<View>();
  readonly team = input<Team>();
}

// The parent only ever touches these three members of the applications-select
// child, so the stand-in is typed off the real component: renaming any of them
// breaks this spec at compile time.
type ApplicationsSelectStub = Pick<
  ViewApplicationsSelectComponent,
  'view' | 'currentApp' | 'updateApplications'
>;

function applicationsSelectStub(
  overrides: Partial<ApplicationsSelectStub> = {},
): ViewApplicationsSelectComponent {
  const stub: ApplicationsSelectStub = {
    view: undefined,
    currentApp: undefined,
    updateApplications: vi.fn(),
    ...overrides,
  };
  return stub as ViewApplicationsSelectComponent;
}

async function renderEdit(
  overrides: {
    confirmResult?: boolean;
    initialView?: View;
  } = {},
) {
  const {
    confirmResult = true,
    initialView = {
      id: 'v1',
      name: 'Demo View',
      description: 'd',
      status: 'Active',
    },
  } = overrides;

  const stubs = {
    updateView: vi.fn((_id: string, v: View) => of({ ...v, id: 'v1' })),
    deleteView: vi.fn(() => of(undefined)),
    getViewTeams: vi.fn(() => of([])),
    deleteTeam: vi.fn(() => of(undefined)),
    getTeam: vi.fn((id: string) => of({ id, name: 'Old' } as Team)),
    updateTeam: vi.fn((_id: string, t: Team) => of({ ...t })),
    createTeam: vi.fn((_viewId: string, t: Team) =>
      of({ ...t, id: 'new-team' }),
    ),
    getTeamUsers: vi.fn(() => of([])),
    // The component calls the 'events' overload. EMPTY keeps it inert; the
    // upload test supplies its own HttpResponse.
    uploadMultipleFiles: vi.fn((): Observable<HttpEvent<FileModel[]>> => EMPTY),
    deleteFile: vi.fn(() => of(null)),
    updateFile: vi.fn(() => of(undefined)),
    getViewFiles: vi.fn(() => of([])),
    download: vi.fn(() => of(new Blob(['x']))),
    getApplicationTemplates: vi.fn(() => of([])),
    createApplication: vi.fn((viewId: string) =>
      of<Application>({ id: 'app-1', name: 'App', viewId }),
    ),
    getViewApplications: vi.fn(() => of([])),
    confirm: vi.fn(
      () => dialogRefStub<unknown, boolean>(confirmResult).dialogRef,
    ),
    // Typed to what the dialogs close ({ teamUsers }, { name, teams },
    // { teams }). DialogService declares Observable<boolean> for these three
    // methods, so the DialogService provider below is not checked against
    // Pick<DialogService, ...>.
    addRemoveUsersToTeam: vi.fn(() =>
      of<{ teamUsers: TeamUser[] }>({ teamUsers: [] }),
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
    providers: [
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
          getTeam: stubs.getTeam,
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

  rendered.fixture.componentInstance.view = initialView;
  return { ...rendered, stubs };
}

describe('AdminViewEditComponent', () => {
  /**
   * Verifies: ngOnInit loads the team permission and team role catalogs into their services.
   * Interacts with: the real TeamPermissionsService.load and TeamRolesService.getRoles over the
   *   TeamPermissionService.getTeamPermissions and TeamRoleService.getTeamRoles stubs.
   * Data: default renderEdit; one team permission (ViewTeam) and one team role (Member).
   * Why: the child selects read these services' streams, so the catalogs must land there.
   */
  it('ngOnInit loads team permissions and roles', async () => {
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
   * Verifies: ngOnInit clears any previously held view, team, file, and app state.
   * Interacts with: component.ngOnInit re-run against a dirtied instance.
   * Data: instance seeded with a view plus non-empty teams/staged/viewFiles/appNames.
   */
  it('ngOnInit resets the previously loaded view state', async () => {
    const { fixture } = await renderEdit();
    const c = fixture.componentInstance;
    c.view = { id: 'v1', name: 'Stale' };
    c.teams = [new TeamUserApp('Red', { id: 't1' } as Team, [])];
    // PlayerFile is module-private to the component, so the staged entry is
    // typed off the field it is assigned to.
    c.staged = [{ id: 'f0', file: new File([], 'stale.txt') }];
    c.viewFiles = [{ id: 'f1', name: 'stale.txt' }];
    c.appNames = ['Stale App'];

    c.ngOnInit();

    expect(c.view).toBeUndefined();
    expect(c.teams).toEqual([]);
    expect(c.staged).toEqual([]);
    expect(c.viewFiles).toEqual([]);
    expect(c.appNames).toEqual([]);
    expect(c.isLoadingTeams).toBe(false);
  });

  /**
   * Verifies: setView copies the view's name and description into the respective form controls.
   * Interacts with: component.setView and viewName/description FormControls.
   * Data: a view literal (name 'Test', description 'desc').
   */
  it('setView applies name and description from the given view', async () => {
    const { fixture } = await renderEdit();
    fixture.componentInstance.setView({
      id: 'v2',
      name: 'Test',
      description: 'desc',
    });
    expect(fixture.componentInstance.viewNameFormControl.value).toBe('Test');
    expect(fixture.componentInstance.descriptionFormControl.value).toBe('desc');
  });

  /**
   * Verifies: setView(null) clears the name and description form controls back to empty.
   * Interacts with: component.setView and viewName/description FormControls.
   * Data: a populated view first, then null.
   */
  it('setView with null clears form values', async () => {
    const { fixture } = await renderEdit();
    fixture.componentInstance.setView({
      id: 'v2',
      name: 'Test',
      description: 'desc',
    });
    fixture.componentInstance.setView(null);
    expect(fixture.componentInstance.viewNameFormControl.value).toBe('');
    expect(fixture.componentInstance.descriptionFormControl.value).toBe('');
  });

  /**
   * Verifies: returnToViewSearch emits the current view's id on the editComplete output.
   * Interacts with: the component's editComplete EventEmitter (subscribed spy).
   * Data: initialView with id 'v1'.
   */
  it('returnToViewSearch emits editComplete with the current view id', async () => {
    const { fixture } = await renderEdit();
    const spy = vi.fn();
    fixture.componentInstance.editComplete.subscribe(spy);
    fixture.componentInstance.returnToViewSearch();
    expect(spy).toHaveBeenCalledWith('v1');
  });

  /**
   * Verifies: saveView calls ViewService.updateView with the new name when the name form control changed.
   * Interacts with: viewNameFormControl and stubbed ViewService.updateView (call args inspected).
   * Data: name control set to 'Renamed View' (differs from initialView).
   */
  it('saveView calls updateView when the name changed', async () => {
    const { fixture, stubs } = await renderEdit();
    fixture.componentInstance.viewNameFormControl.setValue('Renamed View');
    fixture.componentInstance.saveView();
    expect(stubs.updateView).toHaveBeenCalled();
    expect((stubs.updateView.mock.calls[0][1] as View).name).toBe(
      'Renamed View',
    );
  });

  /**
   * Verifies: saveView skips the update when both name and description match the current view.
   * Interacts with: viewName/description FormControls and stubbed ViewService.updateView.
   * Data: controls set to the initialView's 'Demo View' / 'd'.
   */
  it('saveView is a no-op when name and description unchanged', async () => {
    const { fixture, stubs } = await renderEdit();
    fixture.componentInstance.viewNameFormControl.setValue('Demo View');
    fixture.componentInstance.descriptionFormControl.setValue('d');
    fixture.componentInstance.saveView();
    expect(stubs.updateView).not.toHaveBeenCalled();
  });

  /**
   * Verifies: a confirmed delete calls deleteView('v1') and emits null on editComplete (not the view id).
   * Interacts with: stubbed CrucibleDialogService.confirm, ViewService.deleteView, editComplete output.
   * Data: confirmResult=true.
   * Why: emitting null (rather than the deleted view's id) keeps the parent search from re-selecting it.
   */
  it('deleteView deletes and returns to search when confirmed', async () => {
    const { fixture, stubs } = await renderEdit({ confirmResult: true });
    const spy = vi.fn();
    fixture.componentInstance.editComplete.subscribe(spy);
    fixture.componentInstance.deleteView();
    expect(stubs.deleteView).toHaveBeenCalledWith('v1');
    // After a delete editComplete emits null (rather than the view id) so the
    // parent search returns to the list without re-selecting the deleted view.
    expect(spy).toHaveBeenCalledWith(null);
  });

  /**
   * Verifies: a declined confirm leaves deleteView untouched.
   * Interacts with: stubbed CrucibleDialogService.confirm and ViewService.deleteView.
   * Data: confirmResult=false.
   */
  it('deleteView is a no-op when cancelled', async () => {
    const { fixture, stubs } = await renderEdit({ confirmResult: false });
    fixture.componentInstance.deleteView();
    expect(stubs.deleteView).not.toHaveBeenCalled();
  });

  /**
   * Verifies: setDefaultTeam writes the team id onto view.defaultTeamId and persists via updateView.
   * Interacts with: stubbed ViewService.updateView.
   * Data: team id 'team-42'.
   */
  it('setDefaultTeam sets the id on the view and calls updateView', async () => {
    const { fixture, stubs } = await renderEdit();
    fixture.componentInstance.setDefaultTeam('team-42');
    expect(fixture.componentInstance.view.defaultTeamId).toBe('team-42');
    expect(stubs.updateView).toHaveBeenCalled();
  });

  /**
   * Verifies: deleting the view's last team leaves the Teams step on its spinner, with Add New Team hidden (current behavior).
   * Interacts with: the rendered Delete Team and Add New Team buttons; stubbed CrucibleDialogService.confirm,
   *   TeamService.deleteTeam and TeamService.getViewTeams (which then returns no teams).
   * Data: confirmResult=true; view v1 with one team, Red (t1).
   */
  it('leaves the Teams step on a spinner after the last team is deleted', async () => {
    const user = userEvent.setup();
    const { fixture, stubs } = await renderEdit({ confirmResult: true });
    const c = fixture.componentInstance;
    c.view = { id: 'v1', name: 'Demo View' };
    stubs.getViewTeams.mockReturnValueOnce(of([{ id: 't1', name: 'Red' }]));
    c.updateViewTeams();
    fixture.detectChanges();
    expect(screen.getByText('Add New Team')).toBeInTheDocument();

    // After the delete, getViewTeams returns the default empty list.
    await user.click(screen.getByText('Delete Team'));

    expect(stubs.deleteTeam).toHaveBeenCalledWith('t1');
    expect(c.isLoadingTeams).toBe(true);
    expect(screen.queryByText('Add New Team')).not.toBeInTheDocument();
  });

  /**
   * Verifies: deleteTeam calls TeamService.deleteTeam with the team id once the user confirms.
   * Interacts with: stubbed CrucibleDialogService.confirm and TeamService.deleteTeam.
   * Data: confirmResult=true; team { id: 't1' }.
   */
  it('deleteTeam only deletes when user confirms', async () => {
    const { fixture, stubs } = await renderEdit({ confirmResult: true });
    fixture.componentInstance.deleteTeam({ id: 't1', name: 'Red' });
    expect(stubs.deleteTeam).toHaveBeenCalledWith('t1');
  });

  /**
   * Verifies: toggleAllTeamsForFile sets teamsForFile to every team id when checked and empties it when unchecked.
   * Interacts with: component.toggleAllTeamsForFile and the teams collection.
   * Data: two TeamUserApp teams (t1, t2).
   */
  it('toggleAllTeamsForFile selects all team ids when checked, empties when unchecked', async () => {
    const { fixture } = await renderEdit();
    fixture.componentInstance.teams = [
      new TeamUserApp('Red', { id: 't1' } as Team, []),
      new TeamUserApp('Blue', { id: 't2' } as Team, []),
    ];
    fixture.componentInstance.toggleAllTeamsForFile(true);
    expect(fixture.componentInstance.teamsForFile).toEqual(['t1', 't2']);
    fixture.componentInstance.toggleAllTeamsForFile(false);
    expect(fixture.componentInstance.teamsForFile).toEqual([]);
  });

  /**
   * Verifies: onTeamsForFileChange sets selectAllTeamsForFile true only when every team is selected.
   * Interacts with: component.onTeamsForFileChange and teams/teamsForFile state.
   * Data: two teams; selection of both (true) then one (false).
   */
  it('onTeamsForFileChange computes selectAllTeamsForFile based on selection', async () => {
    const { fixture } = await renderEdit();
    fixture.componentInstance.teams = [
      new TeamUserApp('Red', { id: 't1' } as Team, []),
      new TeamUserApp('Blue', { id: 't2' } as Team, []),
    ];
    fixture.componentInstance.teamsForFile = ['t1', 't2'];
    fixture.componentInstance.onTeamsForFileChange();
    expect(fixture.componentInstance.selectAllTeamsForFile).toBe(true);
    fixture.componentInstance.teamsForFile = ['t1'];
    fixture.componentInstance.onTeamsForFileChange();
    expect(fixture.componentInstance.selectAllTeamsForFile).toBe(false);
  });

  /**
   * Verifies: isAllTeamsSelected returns true only when the file's teamIds cover every team.
   * Interacts with: component.isAllTeamsSelected against the teams collection.
   * Data: two teams; file with both ids (true) vs one id (false).
   */
  it('isAllTeamsSelected returns true when all team ids are on the file', async () => {
    const { fixture } = await renderEdit();
    fixture.componentInstance.teams = [
      new TeamUserApp('Red', { id: 't1' } as Team, []),
      new TeamUserApp('Blue', { id: 't2' } as Team, []),
    ];
    const yes = fixture.componentInstance.isAllTeamsSelected({
      id: 'f1',
      teamIds: ['t1', 't2'],
    });
    const no = fixture.componentInstance.isAllTeamsSelected({
      id: 'f1',
      teamIds: ['t1'],
    });
    expect(yes).toBe(true);
    expect(no).toBe(false);
  });

  /**
   * Verifies: updateApplicationTemplates stores the fetched templates onto applicationTemplates.
   * Interacts with: stubbed ApplicationService.getApplicationTemplates (re-stubbed for this call).
   * Data: a single template ('Template').
   */
  it('updateApplicationTemplates stores the fetched templates', async () => {
    const { fixture, stubs } = await renderEdit();
    stubs.getApplicationTemplates.mockReturnValueOnce(
      of([{ id: 'tpl-1', name: 'Template' }]),
    );
    fixture.componentInstance.updateApplicationTemplates();
    expect(fixture.componentInstance.applicationTemplates).toEqual([
      { id: 'tpl-1', name: 'Template' },
    ]);
  });

  /**
   * Verifies: updateViewTeams fetches the view's teams plus their users and stores them sorted by name.
   * Interacts with: stubbed TeamService.getViewTeams and UserService.getTeamUsers.
   * Data: unsorted teams (Zebra, Alpha) — asserted ordered Alpha, Zebra; isLoadingTeams cleared.
   */
  it('updateViewTeams loads teams with their users and sorts them by name', async () => {
    const { fixture, stubs } = await renderEdit();
    const c = fixture.componentInstance;
    c.view = { id: 'v1' };
    stubs.getViewTeams.mockReturnValueOnce(
      of([
        { id: 't2', name: 'Zebra' },
        { id: 't1', name: 'Alpha' },
      ]),
    );
    stubs.getTeamUsers.mockReturnValue(of([{ id: 'u1', name: 'Alice' }]));
    c.updateViewTeams();
    expect(stubs.getViewTeams).toHaveBeenCalledWith('v1');
    expect(c.teams.map((t) => t.name)).toEqual(['Alpha', 'Zebra']);
    expect(c.isLoadingTeams).toBe(false);
  });

  describe('progress flags after a failed request', () => {
    type Rendered = Awaited<ReturnType<typeof renderEdit>>;
    type Act = (r: Rendered, failure: Error) => void;
    const loadTeams: Act = ({ fixture, stubs }, failure) => {
      stubs.getViewTeams.mockReturnValueOnce(throwError(() => failure));
      fixture.componentInstance.view = { id: 'v1' };
      fixture.componentInstance.updateViewTeams();
    };
    const loadTeamUsers: Act = ({ fixture, stubs }, failure) => {
      stubs.getViewTeams.mockReturnValueOnce(of([{ id: 't1', name: 'Red' }]));
      stubs.getTeamUsers.mockReturnValueOnce(throwError(() => failure));
      fixture.componentInstance.view = { id: 'v1' };
      fixture.componentInstance.updateViewTeams();
    };
    const upload: Act = ({ fixture, stubs }, failure) => {
      const c = fixture.componentInstance;
      c.view = { id: 'v1' };
      c.teamsForFile = ['t1'];
      c.selectFile(fileList(new File(['x'], 'up.txt')));
      stubs.uploadMultipleFiles.mockReturnValueOnce(throwError(() => failure));
      c.uploadFile();
    };

    /**
     * Verifies: a failed request leaves its progress flag set (the teams spinner or the upload bar) and lets the error escape (current behavior).
     * Interacts with: the failing endpoint (TeamService.getViewTeams, UserService.getTeamUsers or
     *   FileService.uploadMultipleFiles); the component's progress flag; captureUnhandledRxErrors.
     * Data: view v1; the row's endpoint fails with a 500 on its next call.
     */
    it.each<[string, Act, 'isLoadingTeams' | 'uploading']>([
      ['getViewTeams in updateViewTeams', loadTeams, 'isLoadingTeams'],
      ['getTeamUsers in updateViewTeams', loadTeamUsers, 'isLoadingTeams'],
      ['uploadMultipleFiles in uploadFile', upload, 'uploading'],
    ])('leaves %s stuck when it fails', async (_label, act, flag) => {
      const errors = captureUnhandledRxErrors();
      const failure = new Error('500');
      const rendered = await renderEdit();
      act(rendered, failure);
      await flush();
      expect(rendered.fixture.componentInstance[flag]).toBe(true);
      expect(errors).toEqual([failure]);
    });
  });

  /**
   * Verifies: updateViewTeams skips the fetch when the view has no id.
   * Interacts with: stubbed TeamService.getViewTeams.
   * Data: view set to {} (no id).
   */
  it('updateViewTeams is a no-op when there is no view id', async () => {
    const { fixture, stubs } = await renderEdit();
    fixture.componentInstance.view = {};
    fixture.componentInstance.updateViewTeams();
    expect(stubs.getViewTeams).not.toHaveBeenCalled();
  });

  /**
   * Verifies: updateView pushes the current view into the child app-select, triggers its reload, and clears its currentApp.
   * Interacts with: the stubbed viewApplicationsSelectComponent ViewChild (updateApplications spy).
   * Data: a fake child component with a preset currentApp.
   */
  it('updateView pushes the view into the application-select child', async () => {
    const { fixture } = await renderEdit();
    const c = fixture.componentInstance;
    const updateApplications = vi.fn();
    c.viewApplicationsSelectComponent = applicationsSelectStub({
      updateApplications,
      currentApp: { id: 'x', viewId: 'v1' },
    });
    c.view = { id: 'v1', name: 'Demo View' };
    c.updateView();
    expect(c.viewApplicationsSelectComponent.view).toEqual(c.view);
    expect(updateApplications).toHaveBeenCalled();
    expect(c.viewApplicationsSelectComponent.currentApp).toBeUndefined();
  });

  /**
   * Verifies: addViewApplication with a null template id creates a blank app carrying just name + viewId.
   * Interacts with: stubbed ApplicationService.createApplication.
   * Data: template arg { id: null, name: 'New Application' }.
   * Why: the null id path sends the name (not an applicationTemplateId), distinct from the template-id path below.
   */
  it('addViewApplication creates an app from a blank template (no template id)', async () => {
    const { fixture, stubs } = await renderEdit();
    const c = fixture.componentInstance;
    c.view = { id: 'v1' };
    c.viewApplicationsSelectComponent = applicationsSelectStub();
    c.addViewApplication(c.BLANK_TEMPLATE);
    expect(stubs.createApplication).toHaveBeenCalledWith('v1', {
      name: 'New Application',
      viewId: 'v1',
    });
  });

  /**
   * Verifies: addViewApplication with a real template id creates an app carrying viewId + applicationTemplateId (no name).
   * Interacts with: stubbed ApplicationService.createApplication.
   * Data: template arg { id: 'tpl-9' }.
   */
  it('addViewApplication creates an app from an existing template id', async () => {
    const { fixture, stubs } = await renderEdit();
    const c = fixture.componentInstance;
    c.view = { id: 'v1' };
    c.viewApplicationsSelectComponent = applicationsSelectStub();
    c.addViewApplication({ id: 'tpl-9', name: 'From Template' });
    expect(stubs.createApplication).toHaveBeenCalledWith('v1', {
      viewId: 'v1',
      applicationTemplateId: 'tpl-9',
    });
  });

  /**
   * Verifies: saveViewStatus calls updateView with the current view (carrying its status).
   * Interacts with: stubbed ViewService.updateView.
   * Data: view with status 'Inactive'.
   */
  it('saveViewStatus persists the current view', async () => {
    const { fixture, stubs } = await renderEdit();
    fixture.componentInstance.view = { id: 'v1', status: 'Inactive' } as View;
    fixture.componentInstance.saveViewStatus();
    expect(stubs.updateView).toHaveBeenCalledWith('v1', {
      id: 'v1',
      status: 'Inactive',
    });
  });

  /**
   * Verifies: saveTeamName applies the form value, writes it back, and updates the local list.
   * Interacts with: stubbed TeamService.updateTeam.
   * Data: a team 't1' renamed to 'Renamed'.
   */
  it('saveTeamName fetches, renames, and writes the team back', async () => {
    const { fixture, stubs } = await renderEdit();
    const c = fixture.componentInstance;
    const team = new TeamUserApp('Old', { id: 't1', name: 'Old' } as Team, []);
    c.teams = [team];
    c.teamNameFormControl.setValue('Renamed');
    c.saveTeamName(team);
    expect(stubs.updateTeam).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ name: 'Renamed' }),
    );
    expect(c.teams[0].team.name).toBe('Renamed');
  });

  /**
   * Verifies: openUsersDialog applies the dialog's returned teamUsers onto the matching team's users.
   * Interacts with: stubbed DialogService.addRemoveUsersToTeam.
   * Data: dialog returns teamUsers [Alice] for team 't1'.
   */
  it('openUsersDialog updates the team users with the dialog result', async () => {
    const { fixture, stubs } = await renderEdit();
    const c = fixture.componentInstance;
    c.teams = [new TeamUserApp('Red', { id: 't1', name: 'Red' } as Team, [])];
    // What AddRemoveUsersDialogComponent.done() closes with.
    const alice: TeamUser = {
      name: 'Alice',
      user: { id: 'u1', name: 'Alice' },
      teamMembership: { id: 'm1', userId: 'u1', teamId: 't1' },
    };
    stubs.addRemoveUsersToTeam.mockReturnValueOnce(of({ teamUsers: [alice] }));
    c.openUsersDialog({ id: 't1', name: 'Red' });
    expect(stubs.addRemoveUsersToTeam).toHaveBeenCalled();
    // TeamUserApp.users is typed User[] but receives the TeamUser rows; only
    // its length is rendered (the member badge). The addRemoveUsersToTeam stub
    // in renderEdit() is typed to the { teamUsers } close value.
    expect(c.teams[0].users).toEqual([alice]);
  });

  /**
   * Verifies: openUsersDialog does nothing when called without a team.
   * Interacts with: stubbed DialogService.addRemoveUsersToTeam.
   * Data: team argument undefined.
   */
  it('openUsersDialog is a no-op when team is undefined', async () => {
    const { fixture, stubs } = await renderEdit();
    fixture.componentInstance.openUsersDialog(undefined);
    expect(stubs.addRemoveUsersToTeam).not.toHaveBeenCalled();
  });

  /**
   * Verifies: addNewTeam creates a 'New Team', prepends it to teams, and sets it as currentTeam.
   * Interacts with: stubbed TeamService.createTeam (returns id 'new-team').
   * Data: empty teams list; view 'v1'.
   */
  it('addNewTeam creates a team and prepends it as the current team', async () => {
    const { fixture, stubs } = await renderEdit();
    const c = fixture.componentInstance;
    c.view = { id: 'v1' };
    c.teams = [];
    c.addNewTeam();
    expect(stubs.createTeam).toHaveBeenCalledWith('v1', { name: 'New Team' });
    expect(c.teams[0].team.id).toBe('new-team');
    expect(c.currentTeam.team.id).toBe('new-team');
  });

  /**
   * Verifies: selectFile stages the chosen files and leaves uploading false.
   * Interacts with: component.selectFile and the staged collection.
   * Data: a single File('doc.txt') passed as a FileList.
   */
  it('selectFile stages the selected files', async () => {
    const { fixture } = await renderEdit();
    const c = fixture.componentInstance;
    c.staged = [];
    const file = new File(['data'], 'doc.txt');
    c.selectFile(fileList(file));
    expect(c.staged).toHaveLength(1);
    expect(c.uploading).toBe(false);
  });

  /**
   * Verifies: removeFile drops only the matching staged entry, keeping the rest.
   * Interacts with: component.selectFile / removeFile and the staged collection.
   * Data: two staged files (a.txt, b.txt); removing the first leaves b.txt.
   */
  it('removeFile drops the matching staged file', async () => {
    const { fixture } = await renderEdit();
    const c = fixture.componentInstance;
    const fileA = new File(['a'], 'a.txt');
    const fileB = new File(['b'], 'b.txt');
    c.staged = [];
    c.selectFile(fileList(fileA, fileB));
    c.removeFile(c.staged[0]);
    expect(c.staged.map((f) => f.file.name)).toEqual(['b.txt']);
  });

  /**
   * Verifies: getDownloadLink copies a file URI (id + name query) to the clipboard.
   * Interacts with: the stubbed Clipboard.copy spy.
   * Data: file { id: 'f1', name: 'doc.txt' }.
   */
  it('getDownloadLink copies the file URI to the clipboard', async () => {
    const { fixture, stubs } = await renderEdit();
    fixture.componentInstance.getDownloadLink({ id: 'f1', name: 'doc.txt' });
    expect(stubs.clipboardCopy).toHaveBeenCalledWith(
      expect.stringContaining('/file?id=f1&name=doc.txt'),
    );
  });

  /**
   * Verifies: getViewFiles merges fetched files, skipping any whose name already exists locally.
   * Interacts with: stubbed FileService.getViewFiles.
   * Data: existing viewFiles [dup.txt]; fetch returns dup.txt + new.txt — only new.txt added.
   */
  it('getViewFiles appends fetched files without duplicating by name', async () => {
    const { fixture, stubs } = await renderEdit();
    const c = fixture.componentInstance;
    c.view = { id: 'v1' };
    c.viewFiles = [{ id: 'f1', name: 'dup.txt' }];
    stubs.getViewFiles.mockReturnValueOnce(
      of([
        { id: 'f1b', name: 'dup.txt' },
        { id: 'f2', name: 'new.txt' },
      ]),
    );
    c.getViewFiles();
    expect(c.viewFiles.map((f) => f.name)).toEqual(['dup.txt', 'new.txt']);
  });

  /**
   * Verifies: a confirmed deleteFile calls FileService.deleteFile and removes the file from viewFiles.
   * Interacts with: stubbed CrucibleDialogService.confirm and FileService.deleteFile.
   * Data: confirmResult=true; viewFiles [f1 a.txt, f2 b.txt]; delete f1.
   */
  it('deleteFile removes the file from viewFiles when confirmed and delete succeeds', async () => {
    const { fixture, stubs } = await renderEdit({ confirmResult: true });
    const c = fixture.componentInstance;
    c.viewFiles = [
      { id: 'f1', name: 'a.txt' },
      { id: 'f2', name: 'b.txt' },
    ];
    c.deleteFile('f1', 'a.txt');
    expect(stubs.deleteFile).toHaveBeenCalledWith('f1');
    expect(c.viewFiles.map((f) => f.id)).toEqual(['f2']);
  });

  /**
   * Verifies: a declined confirm leaves FileService.deleteFile uncalled.
   * Interacts with: stubbed CrucibleDialogService.confirm and FileService.deleteFile.
   * Data: confirmResult=false.
   */
  it('deleteFile is a no-op when cancelled', async () => {
    const { fixture, stubs } = await renderEdit({ confirmResult: false });
    fixture.componentInstance.deleteFile('f1', 'a.txt');
    expect(stubs.deleteFile).not.toHaveBeenCalled();
  });

  /**
   * Verifies: editFile sends the file/view/name/teams to the dialog and applies the returned name locally.
   * Interacts with: stubbed DialogService.editFile.
   * Data: file f1 'old.txt' on team t1; dialog returns name 'new.txt'.
   */
  it('editFile updates the file name from the dialog result', async () => {
    const { fixture, stubs } = await renderEdit();
    const c = fixture.componentInstance;
    c.view = { id: 'v1' };
    c.viewFiles = [{ id: 'f1', name: 'old.txt' }];
    stubs.editFile.mockReturnValueOnce(of({ name: 'new.txt', teams: ['t1'] }));
    c.editFile('f1', 'old.txt', ['t1']);
    expect(stubs.editFile).toHaveBeenCalledWith('f1', 'v1', 'old.txt', ['t1']);
    expect(c.viewFiles[0].name).toBe('new.txt');
  });

  /**
   * Verifies: createApplication makes an embeddable app from a file, tracks its name, then opens the dialog.
   * Interacts with: stubbed ApplicationService.createApplication and DialogService.createApplication.
   * Data: file f1 'doc.txt'; createApplication returns id 'app-7'.
   */
  it('createApplication creates the app then opens the create-application dialog', async () => {
    const { fixture, stubs } = await renderEdit();
    const c = fixture.componentInstance;
    c.view = { id: 'v1', name: 'Demo View' };
    c.appNames = [];
    stubs.createApplication.mockReturnValueOnce(
      of({ id: 'app-7', name: 'doc.txt', viewId: 'v1' }),
    );
    c.createApplication({ id: 'f1', name: 'doc.txt' });
    expect(stubs.createApplication).toHaveBeenCalledWith(
      'v1',
      expect.objectContaining({ name: 'doc.txt', embeddable: true }),
    );
    expect(c.appNames).toContain('doc.txt');
    expect(stubs.createApplicationDialog).toHaveBeenCalled();
  });

  /**
   * Verifies: getExistingApps fills appNames with the names of the view's applications.
   * Interacts with: stubbed ApplicationService.getViewApplications.
   * Data: fetch returns apps named 'App A', 'App B'.
   */
  it('getExistingApps populates appNames from the view applications', async () => {
    const { fixture, stubs } = await renderEdit();
    const c = fixture.componentInstance;
    c.view = { id: 'v1' };
    stubs.getViewApplications.mockReturnValueOnce(
      of([{ name: 'App A' }, { name: 'App B' }]),
    );
    c.getExistingApps();
    expect(c.appNames).toEqual(['App A', 'App B']);
  });

  /**
   * Verifies: teamsForFileUpdated persists via FileService.updateFile when teams are selected.
   * Interacts with: stubbed FileService.updateFile.
   * Data: change value ['t1'] for file f1 'doc.txt'.
   */
  it('teamsForFileUpdated saves when teams are selected', async () => {
    const { fixture, stubs } = await renderEdit();
    const file: FileModel = { id: 'f1', name: 'doc.txt', teamIds: [] };
    fixture.componentInstance.teamsForFileUpdated({ value: ['t1'] }, file);
    expect(stubs.updateFile).toHaveBeenCalledWith(
      'f1',
      'doc.txt',
      ['t1'],
      null,
    );
  });

  /**
   * Verifies: teamsForFileUpdated with an empty selection clears file.teamIds locally but skips the save.
   * Interacts with: stubbed FileService.updateFile.
   * Data: change value [] for file f1 that previously had ['t1'].
   */
  it('teamsForFileUpdated clears teams locally but does not save when none selected', async () => {
    const { fixture, stubs } = await renderEdit();
    const file: FileModel = {
      id: 'f1',
      name: 'doc.txt',
      teamIds: ['t1'],
    };
    fixture.componentInstance.teamsForFileUpdated({ value: [] }, file);
    expect(file.teamIds).toEqual([]);
    expect(stubs.updateFile).not.toHaveBeenCalled();
  });

  /**
   * Verifies: toggleAllTeamsForViewFile(true) assigns every team id to the file and persists via updateFile.
   * Interacts with: stubbed FileService.updateFile against the teams collection.
   * Data: two teams (t1, t2); file f1 'doc.txt'.
   */
  it('toggleAllTeamsForViewFile selects all and saves when checked', async () => {
    const { fixture, stubs } = await renderEdit();
    const c = fixture.componentInstance;
    c.teams = [
      new TeamUserApp('Red', { id: 't1' } as Team, []),
      new TeamUserApp('Blue', { id: 't2' } as Team, []),
    ];
    const file: FileModel = { id: 'f1', name: 'doc.txt', teamIds: [] };
    c.toggleAllTeamsForViewFile(true, file);
    expect(file.teamIds).toEqual(['t1', 't2']);
    expect(stubs.updateFile).toHaveBeenCalledWith(
      'f1',
      'doc.txt',
      ['t1', 't2'],
      null,
    );
  });

  /**
   * Verifies: toggleAllTeamsForViewFile(false) clears file.teamIds locally without calling updateFile.
   * Interacts with: stubbed FileService.updateFile.
   * Data: file f1 that previously had ['t1'].
   */
  it('toggleAllTeamsForViewFile clears teams locally without saving when unchecked', async () => {
    const { fixture, stubs } = await renderEdit();
    const file: FileModel = {
      id: 'f1',
      name: 'doc.txt',
      teamIds: ['t1'],
    };
    fixture.componentInstance.toggleAllTeamsForViewFile(false, file);
    expect(file.teamIds).toEqual([]);
    expect(stubs.updateFile).not.toHaveBeenCalled();
  });

  /**
   * Verifies: on a 201 response uploadFile appends the returned files to viewFiles and clears staged/uploading.
   * Interacts with: stubbed FileService.uploadMultipleFiles (returns an HttpResponse).
   * Data: staged 'up.txt' for teams ['t1']; response body [{ f9 up.txt }].
   * Why: the upload result is wrapped in an HttpResponse(status 201) so the component reads .body / .status.
   */
  it('uploadFile pushes uploaded files from a 201 response and clears the staged list', async () => {
    const { fixture, stubs } = await renderEdit();
    const c = fixture.componentInstance;
    c.view = { id: 'v1' };
    c.teamsForFile = ['t1'];
    c.viewFiles = [];
    c.staged = [];
    c.selectFile(fileList(new File(['x'], 'up.txt')));
    stubs.uploadMultipleFiles.mockReturnValueOnce(
      of(
        new HttpResponse({ status: 201, body: [{ id: 'f9', name: 'up.txt' }] }),
      ),
    );
    c.uploadFile();
    expect(stubs.uploadMultipleFiles).toHaveBeenCalled();
    expect(c.viewFiles.map((f) => f.name)).toContain('up.txt');
    expect(c.staged).toEqual([]);
    expect(c.uploading).toBe(false);
  });

  /**
   * Verifies: saveView still persists (exactly once) when only the description differs from the current view.
   * Interacts with: viewName/description FormControls and stubbed ViewService.updateView (call args inspected).
   * Data: name unchanged ('Demo View'); description changed to 'A new description'.
   */
  it('saveView updates when only the description changed', async () => {
    const { fixture, stubs } = await renderEdit();
    const c = fixture.componentInstance;
    c.viewNameFormControl.setValue('Demo View'); // unchanged
    c.descriptionFormControl.setValue('A new description');
    c.saveView();
    expect(stubs.updateView).toHaveBeenCalledTimes(1);
    expect((stubs.updateView.mock.calls[0][1] as View).description).toBe(
      'A new description',
    );
  });

  /**
   * Verifies: resetStepper rewinds the stepper to index 0 and unsets the current view.
   * Interacts with: the fake stepper reference and component.view.
   * Data: stepper preset to selectedIndex 3.
   */
  it('resetStepper returns the stepper to index 0 and clears the view', async () => {
    const { fixture } = await renderEdit();
    const c = fixture.componentInstance;
    c.stepper = { selectedIndex: 3 } as MatStepper;
    c.resetStepper();
    expect(c.stepper.selectedIndex).toBe(0);
    expect(c.view).toBeUndefined();
  });

  /**
   * Verifies: downloadFile fetches the blob and, for non-image files, sets the anchor download attribute and clicks it.
   * Interacts with: stubbed FileService.download; spied document.createElement / URL.createObjectURL and anchor.click.
   * Data: file f1 'report.txt'.
   * Why: a real anchor is injected via createElement spy so click() and the download attribute can be asserted in jsdom.
   */
  it('downloadFile sets the download attribute for non-image files', async () => {
    const { fixture, stubs } = await renderEdit();
    const link = document.createElement('a');
    const clickSpy = vi.spyOn(link, 'click').mockImplementation(() => {});
    vi.spyOn(document, 'createElement').mockReturnValueOnce(link);
    vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:url');
    stubs.download.mockReturnValueOnce(of(new Blob(['x'])));
    fixture.componentInstance.downloadFile('f1', 'report.txt');
    expect(link.download).toBe('report.txt');
    expect(clickSpy).toHaveBeenCalled();
  });

  /**
   * Verifies: downloadFile leaves the download attribute empty for image/pdf files (open in-browser instead).
   * Interacts with: stubbed FileService.download; spied document.createElement / URL.createObjectURL.
   * Data: file f1 'photo.png'.
   * Why: relies on the createElement spy returning a real anchor so link.download can be asserted.
   */
  it('downloadFile opens image/pdf files in the browser (no download attribute)', async () => {
    const { fixture, stubs } = await renderEdit();
    const link = document.createElement('a');
    vi.spyOn(link, 'click').mockImplementation(() => {});
    vi.spyOn(document, 'createElement').mockReturnValueOnce(link);
    vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:url');
    stubs.download.mockReturnValueOnce(of(new Blob(['x'])));
    fixture.componentInstance.downloadFile('f1', 'photo.png');
    expect(link.download).toBe('');
  });

  describe('onViewStepChange', () => {
    /**
     * Verifies: landing on the files step (index 3) refreshes files, apps, and teams.
     * Interacts with: spies on getViewFiles, getExistingApps, updateViewTeams.
     * Data: step event { selectedIndex: 3 }.
     */
    it('refreshes files, apps, and teams on the files step (index 3)', async () => {
      const { fixture } = await renderEdit();
      const c = fixture.componentInstance;
      c.view = { id: 'v1' };
      const getFiles = vi.spyOn(c, 'getViewFiles').mockImplementation(() => {});
      const getApps = vi
        .spyOn(c, 'getExistingApps')
        .mockImplementation(() => {});
      const getTeams = vi
        .spyOn(c, 'updateViewTeams')
        .mockImplementation(() => {});
      c.onViewStepChange({ selectedIndex: 3 });
      expect(getFiles).toHaveBeenCalled();
      expect(getApps).toHaveBeenCalled();
      expect(getTeams).toHaveBeenCalled();
    });

    /**
     * Verifies: landing on the teams step (index 2) clears currentTeam and refreshes teams.
     * Interacts with: spy on updateViewTeams.
     * Data: step event { selectedIndex: 2 }.
     */
    it('refreshes teams on the teams step (index 2)', async () => {
      const { fixture } = await renderEdit();
      const c = fixture.componentInstance;
      const getTeams = vi
        .spyOn(c, 'updateViewTeams')
        .mockImplementation(() => {});
      c.onViewStepChange({ selectedIndex: 2 });
      expect(c.currentTeam).toBeUndefined();
      expect(getTeams).toHaveBeenCalled();
    });

    /**
     * Verifies: moving to the applications step (index 1) refreshes app templates and the child's applications.
     * Interacts with: spy on updateApplicationTemplates and the child's updateApplications.
     * Data: step event { selectedIndex: 1 }.
     */
    it('refreshes app templates when leaving the teams step (index 1)', async () => {
      const { fixture } = await renderEdit();
      const c = fixture.componentInstance;
      const updateApplications = vi.fn();
      c.viewApplicationsSelectComponent = applicationsSelectStub({
        updateApplications,
      });
      const getTemplates = vi
        .spyOn(c, 'updateApplicationTemplates')
        .mockImplementation(() => {});
      c.onViewStepChange({ selectedIndex: 1 });
      expect(getTemplates).toHaveBeenCalled();
      expect(updateApplications).toHaveBeenCalled();
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
