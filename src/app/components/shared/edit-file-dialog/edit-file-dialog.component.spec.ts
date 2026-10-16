// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MatDialogRef } from '@angular/material/dialog';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { FileService } from '../../../generated/player-api';
import { EditFileDialogComponent } from './edit-file-dialog.component';
import { renderComponent } from '../../../test-utils/render-component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { A11yModule } from '@angular/cdk/a11y';
import { dialogRefStub } from '../../../test-utils/dialog-refs';
import { ApiStub } from '../../../test-utils/api-stub';

async function renderDialog(
  overrides: {
    oldName?: string;
    oldTeams?: string[];
  } = {},
) {
  const { oldName = 'doc.txt', oldTeams = ['team-a'] } = overrides;

  const { dialogRef, close } = dialogRefStub<EditFileDialogComponent>();

  const updateFile = vi.fn(() => of(undefined));

  const rendered = await renderComponent(EditFileDialogComponent, {
    declarations: [EditFileDialogComponent],
    imports: [
      MatFormFieldModule,
      MatInputModule,
      A11yModule,
      ...CRUCIBLE_DIALOG_IMPORTS,
    ],
    componentProperties: {
      fileId: 'f1',
      viewId: 'v1',
      oldName,
      oldTeams,
    },
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      {
        provide: FileService,
        useValue: { updateFile } satisfies ApiStub<FileService>,
      },
    ],
  });

  return { ...rendered, close, updateFile };
}

describe('EditFileDialogComponent', () => {
  /**
   * Verifies: the Name field shows the file's name without its extension.
   * Interacts with: the rendered Name field.
   * Data: oldName 'notes.md'.
   */
  it('shows the file name without its extension', async () => {
    await renderDialog({ oldName: 'notes.md' });
    expect(screen.getByLabelText('Name')).toHaveValue('notes');
  });

  /**
   * Verifies: saving keeps the original extension on the edited name, updates the file with its teams unchanged, and
   *   closes with the new name and teams.
   * Interacts with: the Name field and Save button; FileService.updateFile; MatDialogRef.close.
   * Data: oldName 'doc.txt' edited to 'new-doc'; oldTeams ['team-a'].
   */
  it('saves the new name with the original extension', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const user = userEvent.setup();
    const { updateFile, close } = await renderDialog({
      oldName: 'doc.txt',
      oldTeams: ['team-a'],
    });
    const name = screen.getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'new-doc', { skipClick: true });
    await user.click(screen.getByText('Save'));
    expect(updateFile).toHaveBeenCalledExactlyOnceWith(
      'f1',
      'new-doc.txt',
      ['team-a'],
      null,
    );
    expect(close).toHaveBeenCalledExactlyOnceWith({
      name: 'new-doc.txt',
      teams: ['team-a'],
    });
  });

  /**
   * Verifies: a refused update logs the error and leaves the dialog open.
   * Interacts with: the Save button; FileService.updateFile (fails); console.log; MatDialogRef.close.
   * Data: updateFile fails with a 403.
   */
  it('stays open when the update fails', async () => {
    const logged = vi.spyOn(console, 'log').mockImplementation(() => {});
    const user = userEvent.setup();
    const { updateFile, close } = await renderDialog();
    updateFile.mockReturnValueOnce(throwError(() => '403'));
    await user.type(screen.getByLabelText('Name'), '2');
    await user.click(screen.getByText('Save'));
    expect(close).not.toHaveBeenCalled();
    expect(logged).toHaveBeenLastCalledWith('Error updating file: 403');
  });
});
