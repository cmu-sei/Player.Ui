// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { MatDialogRef } from '@angular/material/dialog';
import { FileService } from '../../../generated/player-api';
import { EditFileDialogComponent } from './edit-file-dialog.component';
import { renderComponent } from '../../../test-utils/render-component';

async function renderDialog(
  overrides: {
    oldName?: string;
    oldTeams?: string[];
  } = {},
) {
  const { oldName = 'doc.txt', oldTeams = ['team-a'] } = overrides;

  const close = vi.fn();
  const dialogRef = { close } as unknown as MatDialogRef<
    EditFileDialogComponent
  >;

  const updateFile = vi.fn(() => of(undefined));

  const rendered = await renderComponent(EditFileDialogComponent, {
    declarations: [EditFileDialogComponent],
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
  it('creates the component', async () => {
    const { fixture } = await renderDialog();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('splits the filename into name + extension on init', async () => {
    const { fixture } = await renderDialog({ oldName: 'notes.md' });
    expect(fixture.componentInstance.form.value.name).toBe('notes');
    expect(fixture.componentInstance.extension).toBe('.md');
  });

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
