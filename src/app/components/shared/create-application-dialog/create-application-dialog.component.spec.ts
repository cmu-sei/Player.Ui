// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
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
import { MatFormFieldModule } from '@angular/material/form-field';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { dialogRefStub } from '../../../test-utils/dialog-refs';

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
  const { dialogRef, close } =
    dialogRefStub<CreateApplicationDialogComponent>();

  const getTeamApplicationInstances = vi.fn(() => of([{}]));
  const createApplicationInstance = vi.fn(() => of({}));

  const rendered = await renderComponent(CreateApplicationDialogComponent, {
    declarations: [CreateApplicationDialogComponent],
    imports: [MatFormFieldModule, ...CRUCIBLE_DIALOG_IMPORTS, MatSelectModule],
    componentProperties: {
      applicationId: 'app-1',
      file,
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
  /**
   * Verifies: ngOnInit pre-selects the teams form control from the file's teamIds.
   * Interacts with: component reactive form built on init.
   * Data: file fixture with teamIds ['team-a','team-b'].
   */
  it('seeds the teams form control from file.teamIds on init', async () => {
    const { fixture } = await renderDialog();
    expect(fixture.componentInstance.form.value.teams).toEqual([
      'team-a',
      'team-b',
    ]);
  });

  /**
   * Verifies: submit() issues one createApplicationInstance per selected team
   *   (with teamId/applicationId/displayOrder) then closes with the team list.
   * Interacts with: ApplicationService.createApplicationInstance and MatDialogRef.close.
   * Data: two selected teams seeded from file.teamIds; applicationId 'app-1'.
   */
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
});
