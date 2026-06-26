// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { HttpResponse } from '@angular/common/http';
import { Clipboard } from '@angular/cdk/clipboard';
import {
  Team,
  TeamService,
  View,
  ViewService,
  UserService,
  FileService,
} from '../../../../generated/player-api';
import { ApplicationService } from '../../../../generated/player-api';
import { DialogService } from '../../../../services/dialog/dialog.service';
import { TeamPermissionsService } from '../../../../services/permissions/team-permissions.service';
import { TeamRolesService } from '../../../../services/roles/team-roles.service';
import {
  AdminViewEditComponent,
  TeamUserApp,
  UserErrorStateMatcher,
} from './admin-view-edit.component';
import { renderComponent } from '../../../../test-utils/render-component';

type ServiceStubs = {
  updateView: ReturnType<typeof vi.fn>;
  deleteView: ReturnType<typeof vi.fn>;
  getViewTeams: ReturnType<typeof vi.fn>;
  deleteTeam: ReturnType<typeof vi.fn>;
  getTeam: ReturnType<typeof vi.fn>;
  updateTeam: ReturnType<typeof vi.fn>;
  createTeam: ReturnType<typeof vi.fn>;
  getTeamUsers: ReturnType<typeof vi.fn>;
  uploadMultipleFiles: ReturnType<typeof vi.fn>;
  deleteFile: ReturnType<typeof vi.fn>;
  updateFile: ReturnType<typeof vi.fn>;
  getViewFiles: ReturnType<typeof vi.fn>;
  download: ReturnType<typeof vi.fn>;
  getApplicationTemplates: ReturnType<typeof vi.fn>;
  createApplication: ReturnType<typeof vi.fn>;
  getViewApplications: ReturnType<typeof vi.fn>;
  confirm: ReturnType<typeof vi.fn>;
  addRemoveUsersToTeam: ReturnType<typeof vi.fn>;
  editFile: ReturnType<typeof vi.fn>;
  createApplicationDialog: ReturnType<typeof vi.fn>;
  clipboardCopy: ReturnType<typeof vi.fn>;
};

async function renderEdit(
  overrides: {
    confirmResult?: boolean;
    initialView?: View;
  } = {},
) {
  const {
    confirmResult = true,
    initialView = { id: 'v1', name: 'Demo View', description: 'd', status: 'Active' },
  } = overrides;

  const stubs: ServiceStubs = {
    updateView: vi.fn((_id: string, v: View) => of({ ...v, id: 'v1' })),
    deleteView: vi.fn(() => of(undefined)),
    getViewTeams: vi.fn(() => of([])),
    deleteTeam: vi.fn(() => of(undefined)),
    getTeam: vi.fn((id: string) =>
      of({ id, name: 'Old' } as Team),
    ),
    updateTeam: vi.fn((_id: string, t: Team) => of({ ...t })),
    createTeam: vi.fn((_viewId: string, t: Team) =>
      of({ ...t, id: 'new-team' }),
    ),
    getTeamUsers: vi.fn(() => of([])),
    uploadMultipleFiles: vi.fn(() => of(undefined)),
    deleteFile: vi.fn(() => of(null)),
    updateFile: vi.fn(() => of(undefined)),
    getViewFiles: vi.fn(() => of([])),
    download: vi.fn(() => of(new Blob(['x']))),
    getApplicationTemplates: vi.fn(() => of([])),
    createApplication: vi.fn(() => of({ id: 'app-1', name: 'App' })),
    getViewApplications: vi.fn(() => of([])),
    confirm: vi.fn(() => of({ confirm: confirmResult })),
    addRemoveUsersToTeam: vi.fn(() => of({ teamUsers: [] })),
    editFile: vi.fn(() => of({ name: 'renamed.txt' })),
    createApplicationDialog: vi.fn(() => of(undefined)),
    clipboardCopy: vi.fn(),
  };

  const rendered = await renderComponent(AdminViewEditComponent, {
    declarations: [AdminViewEditComponent],
    schemas: [NO_ERRORS_SCHEMA],
    providers: [
      {
        provide: ViewService,
        useValue: { updateView: stubs.updateView, deleteView: stubs.deleteView },
      },
      {
        provide: TeamService,
        useValue: {
          getViewTeams: stubs.getViewTeams,
          deleteTeam: stubs.deleteTeam,
          getTeam: stubs.getTeam,
          updateTeam: stubs.updateTeam,
          createTeam: stubs.createTeam,
        },
      },
      { provide: UserService, useValue: { getTeamUsers: stubs.getTeamUsers } },
      {
        provide: FileService,
        useValue: {
          uploadMultipleFiles: stubs.uploadMultipleFiles,
          deleteFile: stubs.deleteFile,
          updateFile: stubs.updateFile,
          getViewFiles: stubs.getViewFiles,
          download: stubs.download,
        },
      },
      {
        provide: ApplicationService,
        useValue: {
          getApplicationTemplates: stubs.getApplicationTemplates,
          createApplication: stubs.createApplication,
          getViewApplications: stubs.getViewApplications,
        },
      },
      {
        provide: DialogService,
        useValue: {
          confirm: stubs.confirm,
          addRemoveUsersToTeam: stubs.addRemoveUsersToTeam,
          editFile: stubs.editFile,
          createApplication: stubs.createApplicationDialog,
        },
      },
      {
        provide: TeamPermissionsService,
        useValue: { load: vi.fn(() => of([])) },
      },
      {
        provide: TeamRolesService,
        useValue: { getRoles: vi.fn(() => of([])) },
      },
      {
        provide: Clipboard,
        useValue: { copy: stubs.clipboardCopy },
      },
    ],
  });

  rendered.fixture.componentInstance.view = initialView;
  return { ...rendered, stubs };
}

describe('AdminViewEditComponent', () => {
  /**
   * Verifies: the view-edit component instantiates successfully.
   * Interacts with: renderComponent with the full ServiceStubs set (View/Team/User/File/Application/Dialog services, Clipboard).
   * Data: default renderEdit (initialView 'Demo View', confirm=true).
   */
  it('creates the component', async () => {
    const { fixture } = await renderEdit();
    expect(fixture.componentInstance).toBeTruthy();
  });

  /**
   * Verifies: after init the teams and viewFiles collections start empty.
   * Interacts with: the empty-stream stubs (getViewTeams/getViewFiles return of([])).
   * Data: default renderEdit.
   */
  it('ngOnInit loads team permissions and roles', async () => {
    const { fixture } = await renderEdit();
    const c = fixture.componentInstance;
    expect(c.teams).toEqual([]);
    expect(c.viewFiles).toEqual([]);
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
    expect(
      (stubs.updateView.mock.calls[0][1] as View).name,
    ).toBe('Renamed View');
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
   * Interacts with: stubbed DialogService.confirm, ViewService.deleteView, editComplete output.
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
   * Interacts with: stubbed DialogService.confirm and ViewService.deleteView.
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
   * Verifies: deleteTeam calls TeamService.deleteTeam with the team id once the user confirms.
   * Interacts with: stubbed DialogService.confirm and TeamService.deleteTeam.
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
    } as never);
    const no = fixture.componentInstance.isAllTeamsSelected({
      id: 'f1',
      teamIds: ['t1'],
    } as never);
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
    c.viewApplicationsSelectComponent = {
      updateApplications,
      currentApp: { id: 'x' },
    } as never;
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
    c.viewApplicationsSelectComponent = {
      updateApplications: vi.fn(),
      currentApp: undefined,
    } as never;
    c.addViewApplication({ id: null, name: 'New Application' } as never);
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
    c.viewApplicationsSelectComponent = {
      updateApplications: vi.fn(),
      currentApp: undefined,
    } as never;
    c.addViewApplication({ id: 'tpl-9', name: 'From Template' } as never);
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
   * Verifies: saveTeamName fetches the team, applies the new name, writes it back, and updates the local list.
   * Interacts with: stubbed TeamService.getTeam and updateTeam.
   * Data: a team 't1' renamed to 'Renamed'.
   */
  it('saveTeamName fetches, renames, and writes the team back', async () => {
    const { fixture, stubs } = await renderEdit();
    const c = fixture.componentInstance;
    c.teams = [new TeamUserApp('Old', { id: 't1', name: 'Old' } as Team, [])];
    c.saveTeamName('Renamed', 't1');
    expect(stubs.getTeam).toHaveBeenCalledWith('t1');
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
    stubs.addRemoveUsersToTeam.mockReturnValueOnce(
      of({ teamUsers: [{ id: 'u1', name: 'Alice' }] }),
    );
    c.openUsersDialog({ id: 't1', name: 'Red' });
    expect(stubs.addRemoveUsersToTeam).toHaveBeenCalled();
    expect(c.teams[0].users).toEqual([{ id: 'u1', name: 'Alice' }]);
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
    c.selectFile([file] as unknown as FileList);
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
    c.selectFile([fileA, fileB] as unknown as FileList);
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
    c.viewFiles = [{ id: 'f1', name: 'dup.txt' } as never];
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
   * Interacts with: stubbed DialogService.confirm and FileService.deleteFile.
   * Data: confirmResult=true; viewFiles [f1 a.txt, f2 b.txt]; delete f1.
   */
  it('deleteFile removes the file from viewFiles when confirmed and delete succeeds', async () => {
    const { fixture, stubs } = await renderEdit({ confirmResult: true });
    const c = fixture.componentInstance;
    c.viewFiles = [
      { id: 'f1', name: 'a.txt' } as never,
      { id: 'f2', name: 'b.txt' } as never,
    ];
    c.deleteFile('f1', 'a.txt');
    expect(stubs.deleteFile).toHaveBeenCalledWith('f1');
    expect(c.viewFiles.map((f) => f.id)).toEqual(['f2']);
  });

  /**
   * Verifies: a declined confirm leaves FileService.deleteFile uncalled.
   * Interacts with: stubbed DialogService.confirm and FileService.deleteFile.
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
    c.viewFiles = [{ id: 'f1', name: 'old.txt' } as never];
    stubs.editFile.mockReturnValueOnce(of({ name: 'new.txt' }));
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
      of({ id: 'app-7', name: 'doc.txt' }),
    );
    c.createApplication({ id: 'f1', name: 'doc.txt' } as never);
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
    const file = { id: 'f1', name: 'doc.txt', teamIds: [] } as never;
    fixture.componentInstance.teamsForFileUpdated({ value: ['t1'] }, file);
    expect(stubs.updateFile).toHaveBeenCalledWith('f1', 'doc.txt', ['t1'], null);
  });

  /**
   * Verifies: teamsForFileUpdated with an empty selection clears file.teamIds locally but skips the save.
   * Interacts with: stubbed FileService.updateFile.
   * Data: change value [] for file f1 that previously had ['t1'].
   */
  it('teamsForFileUpdated clears teams locally but does not save when none selected', async () => {
    const { fixture, stubs } = await renderEdit();
    const file = { id: 'f1', name: 'doc.txt', teamIds: ['t1'] } as never;
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
    const file = { id: 'f1', name: 'doc.txt', teamIds: [] } as never;
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
    const file = { id: 'f1', name: 'doc.txt', teamIds: ['t1'] } as never;
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
    c.selectFile([new File(['x'], 'up.txt')] as unknown as FileList);
    stubs.uploadMultipleFiles.mockReturnValueOnce(
      of(new HttpResponse({ status: 201, body: [{ id: 'f9', name: 'up.txt' }] })),
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
    c.stepper = { selectedIndex: 3 } as never;
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
    vi.restoreAllMocks();
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
    vi.restoreAllMocks();
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
      const getApps = vi.spyOn(c, 'getExistingApps').mockImplementation(() => {});
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
      c.viewApplicationsSelectComponent = { updateApplications } as never;
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
      const control = { invalid: true, dirty: true } as never;
      expect(matcher.isErrorState(control, null)).toBe(true);
    });

    /**
     * Verifies: an invalid control on a submitted form is an error state even if pristine.
     * Interacts with: UserErrorStateMatcher.isErrorState (pure).
     * Data: control { invalid: true, dirty: false }, form { submitted: true }.
     */
    it('is an error state when invalid and the form was submitted', () => {
      const matcher = new UserErrorStateMatcher();
      const control = { invalid: true, dirty: false } as never;
      const form = { submitted: true } as never;
      expect(matcher.isErrorState(control, form)).toBe(true);
    });

    /**
     * Verifies: a valid control is not an error state.
     * Interacts with: UserErrorStateMatcher.isErrorState (pure).
     * Data: control { invalid: false, dirty: true }, no form.
     */
    it('is not an error state when the control is valid', () => {
      const matcher = new UserErrorStateMatcher();
      const control = { invalid: false, dirty: true } as never;
      expect(matcher.isErrorState(control, null)).toBe(false);
    });
  });
});
