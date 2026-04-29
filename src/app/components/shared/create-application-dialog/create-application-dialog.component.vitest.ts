// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import {
  ApplicationService,
  FileModel,
  Team,
} from '../../../generated/player-api';
import { TeamUserApp } from '../../admin-app/admin-view-search/admin-view-edit/admin-view-edit.component';
import { CreateApplicationDialogComponent } from './create-application-dialog.component';
import { renderComponent } from '../../../test-utils/render-component';

const file: FileModel = {
  id: 'f1',
  name: 'doc.txt',
  teamIds: ['team-a', 'team-b'],
};
const currentTeams: TeamUserApp[] = [
  new TeamUserApp('Red', { id: 'team-a', name: 'Red' } as Team, []),
  new TeamUserApp('Blue', { id: 'team-b', name: 'Blue' } as Team, []),
];

async function renderDialog() {
  const close = vi.fn();
  const dialogRef = { close } as unknown as MatDialogRef<
    CreateApplicationDialogComponent
  >;

  const getTeamApplicationInstances = vi.fn(() => of([{}]));
  const createApplicationInstance = vi.fn(() => of({}));

  const rendered = await renderComponent(CreateApplicationDialogComponent, {
    declarations: [CreateApplicationDialogComponent],
    imports: [MatSelectModule],
    schemas: [NO_ERRORS_SCHEMA],
    componentProperties: {
      applicationId: 'app-1',
      file,
      viewName: 'Demo',
      currentTeams,
    },
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      {
        provide: ApplicationService,
        useValue: { getTeamApplicationInstances, createApplicationInstance },
      },
    ],
  });

  return {
    ...rendered,
    close,
    getTeamApplicationInstances,
    createApplicationInstance,
  };
}

describe('CreateApplicationDialogComponent', () => {
  it('creates the component', async () => {
    const { fixture } = await renderDialog();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('seeds the teams form control from file.teamIds on init', async () => {
    const { fixture } = await renderDialog();
    expect(fixture.componentInstance.form.value.teams).toEqual([
      'team-a',
      'team-b',
    ]);
  });

  it('submit() creates an app instance for each selected team and closes', async () => {
    const { fixture, createApplicationInstance, close } = await renderDialog();
    fixture.componentInstance.submit();
    expect(createApplicationInstance).toHaveBeenCalledTimes(2);
    expect(createApplicationInstance).toHaveBeenCalledWith('team-a', {
      teamId: 'team-a',
      applicationId: 'app-1',
      displayOrder: 1,
    });
    expect(close).toHaveBeenCalledWith({ teams: ['team-a', 'team-b'] });
  });

  it('cancel() closes the dialog with an empty teams array', async () => {
    const { fixture, close, createApplicationInstance } = await renderDialog();
    fixture.componentInstance.cancel();
    expect(close).toHaveBeenCalledWith({ teams: [] });
    expect(createApplicationInstance).not.toHaveBeenCalled();
  });
});
