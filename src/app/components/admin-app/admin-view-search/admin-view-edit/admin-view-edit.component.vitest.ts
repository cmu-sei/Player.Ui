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
  it('creates the component', async () => {
    const { fixture } = await renderEdit();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('ngOnInit loads team permissions and roles', async () => {
    const { fixture } = await renderEdit();
    const c = fixture.componentInstance;
    expect(c.teams).toEqual([]);
    expect(c.viewFiles).toEqual([]);
  });

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

  it('returnToViewSearch emits editComplete with the current view id', async () => {
    const { fixture } = await renderEdit();
    const spy = vi.fn();
    fixture.componentInstance.editComplete.subscribe(spy);
    fixture.componentInstance.returnToViewSearch();
    expect(spy).toHaveBeenCalledWith('v1');
  });

  it('saveView calls updateView when the name changed', async () => {
    const { fixture, stubs } = await renderEdit();
    fixture.componentInstance.viewNameFormControl.setValue('Renamed View');
    fixture.componentInstance.saveView();
    expect(stubs.updateView).toHaveBeenCalled();
    expect(
      (stubs.updateView.mock.calls[0][1] as View).name,
    ).toBe('Renamed View');
  });

  it('saveView is a no-op when name and description unchanged', async () => {
    const { fixture, stubs } = await renderEdit();
    fixture.componentInstance.viewNameFormControl.setValue('Demo View');
    fixture.componentInstance.descriptionFormControl.setValue('d');
    fixture.componentInstance.saveView();
    expect(stubs.updateView).not.toHaveBeenCalled();
  });

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

  it('deleteView is a no-op when cancelled', async () => {
    const { fixture, stubs } = await renderEdit({ confirmResult: false });
    fixture.componentInstance.deleteView();
    expect(stubs.deleteView).not.toHaveBeenCalled();
  });

  it('setDefaultTeam sets the id on the view and calls updateView', async () => {
    const { fixture, stubs } = await renderEdit();
    fixture.componentInstance.setDefaultTeam('team-42');
    expect(fixture.componentInstance.view.defaultTeamId).toBe('team-42');
    expect(stubs.updateView).toHaveBeenCalled();
  });

  it('deleteTeam only deletes when user confirms', async () => {
    const { fixture, stubs } = await renderEdit({ confirmResult: true });
    fixture.componentInstance.deleteTeam({ id: 't1', name: 'Red' });
    expect(stubs.deleteTeam).toHaveBeenCalledWith('t1');
  });

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

  it('updateViewTeams is a no-op when there is no view id', async () => {
    const { fixture, stubs } = await renderEdit();
    fixture.componentInstance.view = {};
    fixture.componentInstance.updateViewTeams();
    expect(stubs.getViewTeams).not.toHaveBeenCalled();
  });

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

  it('saveViewStatus persists the current view', async () => {
    const { fixture, stubs } = await renderEdit();
    fixture.componentInstance.view = { id: 'v1', status: 'Inactive' } as View;
    fixture.componentInstance.saveViewStatus();
    expect(stubs.updateView).toHaveBeenCalledWith('v1', {
      id: 'v1',
      status: 'Inactive',
    });
  });

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

  it('openUsersDialog is a no-op when team is undefined', async () => {
    const { fixture, stubs } = await renderEdit();
    fixture.componentInstance.openUsersDialog(undefined);
    expect(stubs.addRemoveUsersToTeam).not.toHaveBeenCalled();
  });

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

  it('selectFile stages the selected files', async () => {
    const { fixture } = await renderEdit();
    const c = fixture.componentInstance;
    c.staged = [];
    const file = new File(['data'], 'doc.txt');
    c.selectFile([file] as unknown as FileList);
    expect(c.staged).toHaveLength(1);
    expect(c.uploading).toBe(false);
  });

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

  it('getDownloadLink copies the file URI to the clipboard', async () => {
    const { fixture, stubs } = await renderEdit();
    fixture.componentInstance.getDownloadLink({ id: 'f1', name: 'doc.txt' });
    expect(stubs.clipboardCopy).toHaveBeenCalledWith(
      expect.stringContaining('/file?id=f1&name=doc.txt'),
    );
  });

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

  it('deleteFile is a no-op when cancelled', async () => {
    const { fixture, stubs } = await renderEdit({ confirmResult: false });
    fixture.componentInstance.deleteFile('f1', 'a.txt');
    expect(stubs.deleteFile).not.toHaveBeenCalled();
  });

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

  it('teamsForFileUpdated saves when teams are selected', async () => {
    const { fixture, stubs } = await renderEdit();
    const file = { id: 'f1', name: 'doc.txt', teamIds: [] } as never;
    fixture.componentInstance.teamsForFileUpdated({ value: ['t1'] }, file);
    expect(stubs.updateFile).toHaveBeenCalledWith('f1', 'doc.txt', ['t1'], null);
  });

  it('teamsForFileUpdated clears teams locally but does not save when none selected', async () => {
    const { fixture, stubs } = await renderEdit();
    const file = { id: 'f1', name: 'doc.txt', teamIds: ['t1'] } as never;
    fixture.componentInstance.teamsForFileUpdated({ value: [] }, file);
    expect(file.teamIds).toEqual([]);
    expect(stubs.updateFile).not.toHaveBeenCalled();
  });

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

  it('toggleAllTeamsForViewFile clears teams locally without saving when unchecked', async () => {
    const { fixture, stubs } = await renderEdit();
    const file = { id: 'f1', name: 'doc.txt', teamIds: ['t1'] } as never;
    fixture.componentInstance.toggleAllTeamsForViewFile(false, file);
    expect(file.teamIds).toEqual([]);
    expect(stubs.updateFile).not.toHaveBeenCalled();
  });

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

  it('resetStepper returns the stepper to index 0 and clears the view', async () => {
    const { fixture } = await renderEdit();
    const c = fixture.componentInstance;
    c.stepper = { selectedIndex: 3 } as never;
    c.resetStepper();
    expect(c.stepper.selectedIndex).toBe(0);
    expect(c.view).toBeUndefined();
  });

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
    it('is an error state when the control is invalid and dirty', () => {
      const matcher = new UserErrorStateMatcher();
      const control = { invalid: true, dirty: true } as never;
      expect(matcher.isErrorState(control, null)).toBe(true);
    });

    it('is an error state when invalid and the form was submitted', () => {
      const matcher = new UserErrorStateMatcher();
      const control = { invalid: true, dirty: false } as never;
      const form = { submitted: true } as never;
      expect(matcher.isErrorState(control, form)).toBe(true);
    });

    it('is not an error state when the control is valid', () => {
      const matcher = new UserErrorStateMatcher();
      const control = { invalid: false, dirty: true } as never;
      expect(matcher.isErrorState(control, null)).toBe(false);
    });
  });
});
