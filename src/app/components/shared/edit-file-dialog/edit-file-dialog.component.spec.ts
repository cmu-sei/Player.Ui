// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { MatDialogRef } from '@angular/material/dialog';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { FileService } from '../../../generated/player-api';
import { EditFileDialogComponent } from './edit-file-dialog.component';
import { renderComponent } from '../../../test-utils/render-component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { A11yModule } from '@angular/cdk/a11y';
import { dialogRefStub } from '../../../test-utils/dialog-refs';

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
      { provide: FileService, useValue: { updateFile } },
    ],
  });

  return { ...rendered, close, updateFile };
}

describe('EditFileDialogComponent', () => {
  /**
   * Verifies: ngOnInit splits the original filename into a name control value
   *   and a retained extension.
   * Interacts with: component init parsing of the oldName input.
   * Data: oldName override 'notes.md' (expects name 'notes', extension '.md').
   */
  it('splits the filename into name + extension on init', async () => {
    const { fixture } = await renderDialog({ oldName: 'notes.md' });
    expect(fixture.componentInstance.form.value.name).toBe('notes');
    expect(fixture.componentInstance.extension).toBe('.md');
  });

  /**
   * Verifies: submit() reattaches the original extension to the edited name,
   *   persists via updateFile, then closes with the resulting name + teams.
   * Interacts with: FileService.updateFile and MatDialogRef.close.
   * Data: oldName 'doc.txt' edited to 'new-doc'; oldTeams ['team-a'].
   */
  it('submit() appends the original extension to the new name and persists', async () => {
    const { fixture, updateFile, close } = await renderDialog({
      oldName: 'doc.txt',
      oldTeams: ['team-a'],
    });
    fixture.componentInstance.form.get('name').setValue('new-doc');
    fixture.componentInstance.submit();
    expect(updateFile).toHaveBeenCalledWith(
      'f1',
      'new-doc.txt',
      ['team-a'],
      null,
    );
    expect(close).toHaveBeenCalledWith({
      name: 'new-doc.txt',
      teams: ['team-a'],
    });
  });

  /**
   * Verifies: cancel() closes with the unchanged original name and teams and
   *   does not persist anything.
   * Interacts with: MatDialogRef.close; asserts FileService.updateFile unused.
   * Data: oldName 'doc.txt'; oldTeams ['team-a','team-b'].
   */
  it('cancel() closes the dialog with the original name + teams', async () => {
    const { fixture, close, updateFile } = await renderDialog({
      oldName: 'doc.txt',
      oldTeams: ['team-a', 'team-b'],
    });
    fixture.componentInstance.cancel();
    expect(close).toHaveBeenCalledWith({
      name: 'doc.txt',
      teams: ['team-a', 'team-b'],
    });
    expect(updateFile).not.toHaveBeenCalled();
  });
});
