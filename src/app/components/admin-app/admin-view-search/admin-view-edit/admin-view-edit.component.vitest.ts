// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
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
import { AdminViewEditComponent, TeamUserApp } from './admin-view-edit.component';
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
  confirm: ReturnType<typeof vi.fn>;
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
    confirm: vi.fn(() => of({ confirm: confirmResult })),
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
          getViewFiles: vi.fn(() => of([])),
          download: vi.fn(() => of(new Blob(['x']))),
        },
      },
      {
        provide: ApplicationService,
        useValue: {
          getApplicationTemplates: vi.fn(() => of([])),
          createApplication: vi.fn(() => of({})),
          getViewApplications: vi.fn(() => of([])),
        },
      },
      { provide: DialogService, useValue: { confirm: stubs.confirm } },
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
    expect(spy).toHaveBeenCalledWith('v1');
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
});
