// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSelectHarness } from '@angular/material/select/testing';
import { of } from 'rxjs';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import {
  ApplicationInstance,
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
import { ApiStub } from '../../../test-utils/api-stub';

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

  // Red has one application instance, Blue three.
  const getTeamApplicationInstances = vi.fn((teamId: string) =>
    of<ApplicationInstance[]>(
      Array.from({ length: teamId === 'team-b' ? 3 : 1 }, (_, i) => ({
        id: `${teamId}-instance-${i}`,
      })),
    ),
  );
  const createApplicationInstance = vi.fn(() => of({}));

  const rendered = await renderComponent(CreateApplicationDialogComponent, {
    declarations: [CreateApplicationDialogComponent],
    imports: [MatFormFieldModule, ...CRUCIBLE_DIALOG_IMPORTS, MatSelectModule],
    componentProperties: {
      applicationId: 'app-1',
      file: structuredClone(file),
      currentTeams,
    },
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      {
        provide: ApplicationService,
        useValue: {
          getTeamApplicationInstances,
          createApplicationInstance,
        } satisfies ApiStub<ApplicationService>,
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
   * Verifies: the dialog names the new application and preselects the teams the file is shared with.
   * Interacts with: the rendered title and the Teams select (MatSelectHarness).
   * Data: file doc.txt shared with Red and Blue.
   */
  it('names the application and preselects the file teams', async () => {
    const { fixture } = await renderDialog();
    expect(
      screen.getByText('An application named doc.txt has been created.'),
    ).toBeInTheDocument();
    const teams =
      await TestbedHarnessEnvironment.loader(fixture).getHarness(
        MatSelectHarness,
      );
    expect(await teams.getValueText()).toBe('Red, Blue');
  });

  /**
   * Verifies: Add to Selected adds the application to each chosen team at the end of its order, and closes with the
   *   chosen teams.
   * Interacts with: the Teams select (MatSelectHarness); the Add to Selected button;
   *   ApplicationService.getTeamApplicationInstances and createApplicationInstance; MatDialogRef.close.
   * Data: Blue deselected, so only Red (one application already) is chosen.
   */
  it('adds the application to the chosen teams', async () => {
    const {
      fixture,
      createApplicationInstance,
      getTeamApplicationInstances,
      close,
    } = await renderDialog();
    const teams =
      await TestbedHarnessEnvironment.loader(fixture).getHarness(
        MatSelectHarness,
      );
    await teams.open();
    await teams.clickOptions({ text: 'Blue' });
    await teams.close();
    await userEvent.setup().click(screen.getByText('Add to Selected'));
    expect(getTeamApplicationInstances).toHaveBeenCalledExactlyOnceWith(
      'team-a',
    );
    expect(createApplicationInstance).toHaveBeenCalledExactlyOnceWith(
      'team-a',
      {
        teamId: 'team-a',
        applicationId: 'app-1',
        displayOrder: 1,
      },
    );
    expect(close).toHaveBeenCalledExactlyOnceWith({ teams: ['team-a'] });
  });

  /**
   * Verifies: Add to Selected with both preselected teams creates one application instance per team, each at the end
   *   of that team's order, and closes with both teams.
   * Interacts with: the Add to Selected button; ApplicationService.getTeamApplicationInstances and
   *   createApplicationInstance; MatDialogRef.close.
   * Data: file shared with Red (one application already) and Blue (three); the selection is left as preselected.
   */
  it('adds the application to each preselected team', async () => {
    const { createApplicationInstance, getTeamApplicationInstances, close } =
      await renderDialog();
    await userEvent.setup().click(screen.getByText('Add to Selected'));
    expect(getTeamApplicationInstances.mock.calls).toEqual([
      ['team-a'],
      ['team-b'],
    ]);
    expect(createApplicationInstance.mock.calls).toEqual([
      ['team-a', { teamId: 'team-a', applicationId: 'app-1', displayOrder: 1 }],
      ['team-b', { teamId: 'team-b', applicationId: 'app-1', displayOrder: 3 }],
    ]);
    expect(close).toHaveBeenCalledExactlyOnceWith({
      teams: ['team-a', 'team-b'],
    });
  });
});
