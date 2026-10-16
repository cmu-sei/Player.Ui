// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { NameDialogComponent } from './name-dialog.component';
import { renderComponent } from '../../../test-utils/render-component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { A11yModule } from '@angular/cdk/a11y';
import { dialogRefStub } from '../../../test-utils/dialog-refs';

async function renderDialog(
  overrides: {
    data?: Record<string, unknown>;
  } = {},
) {
  const { data = { nameValue: 'Alpha' } } = overrides;

  const { dialogRef, close } = dialogRefStub<NameDialogComponent>();

  const rendered = await renderComponent(NameDialogComponent, {
    declarations: [NameDialogComponent],
    imports: [
      MatFormFieldModule,
      MatInputModule,
      A11yModule,
      ...CRUCIBLE_DIALOG_IMPORTS,
    ],
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });

  return { ...rendered, close, dialogRef, data };
}

/** The dialog's Save button. */
function saveButton(): HTMLButtonElement {
  return screen.getByText('Save').closest('button')!;
}

describe('NameDialogComponent', () => {
  /**
   * Verifies: the dialog shows its title, message and the current name, with Save disabled until the name is edited.
   * Interacts with: the rendered crucible-dialog title, message, Name field and Save button.
   * Data: title 'Rename', message 'Pick a name'; nameValue 'Hi'.
   */
  it('shows the current name with Save disabled until it changes', async () => {
    const { fixture } = await renderDialog({ data: { nameValue: 'Hi' } });
    fixture.componentInstance.title = 'Rename';
    fixture.componentInstance.message = 'Pick a name';
    fixture.detectChanges();
    expect(screen.getByRole('heading')).toHaveTextContent('Rename');
    expect(screen.getByText('Pick a name')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Hi');
    expect(saveButton().disabled).toBe(true);
  });

  /**
   * Verifies: editing the name and saving closes with the dialog data carrying the new name, and removeArtifacts false
   *   when there are no artifacts.
   * Interacts with: the Name field and Save button; MatDialogRef.close; the injected MAT_DIALOG_DATA.
   * Data: nameValue 'A' edited to 'B'; no artifacts.
   */
  it('closes with the edited name', async () => {
    const user = userEvent.setup();
    const { close, data } = await renderDialog({ data: { nameValue: 'A' } });
    const name = screen.getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'B', { skipClick: true });
    expect(saveButton().disabled).toBe(false);
    await user.click(saveButton());
    expect(close).toHaveBeenCalledExactlyOnceWith(data);
    expect(data).toEqual({ nameValue: 'B', removeArtifacts: false });
  });

  /**
   * Verifies: with artifacts, saving passes removeArtifacts through as the component holds it (true by default).
   * Interacts with: the Save button; the injected MAT_DIALOG_DATA.
   * Data: artifacts ['art-1']; name edited to 'B'.
   */
  it('keeps removeArtifacts true when artifacts exist', async () => {
    const user = userEvent.setup();
    const { data } = await renderDialog({
      data: { nameValue: 'A', artifacts: ['art-1'] },
    });
    await user.type(screen.getByLabelText('Name'), 'B');
    await user.click(saveButton());
    expect(data).toEqual({
      nameValue: 'AB',
      artifacts: ['art-1'],
      removeArtifacts: true,
    });
  });

  /**
   * Verifies: an emptied name cannot be saved, and a name failing a caller's validator shows its message and keeps Save
   *   disabled.
   * Interacts with: the Name field, its mat-error and the Save button; data.validators.
   * Data: a minLength(5) validator with message 'At least 5'; 'abc' typed, then cleared.
   */
  it('blocks a name that fails its validators', async () => {
    const user = userEvent.setup();
    await renderDialog({
      data: {
        nameValue: 'Alpha',
        validators: [
          {
            name: 'minlength',
            validator: Validators.minLength(5),
            errorMessage: 'At least 5',
          },
        ],
      },
    });
    const name = screen.getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'abc', { skipClick: true });
    await user.tab();
    expect(screen.getByText('At least 5')).toBeInTheDocument();
    expect(saveButton().disabled).toBe(true);
    await user.clear(name);
    expect(saveButton().disabled).toBe(true);
  });

  describe('description field (data.showDescription)', () => {
    /**
     * Verifies: with showDescription the Description field shows the given value (or nothing), and the edited value is
     *   saved with the name.
     * Interacts with: the Description and Name fields; the Save button; the injected MAT_DIALOG_DATA.
     * Data: one row per starting description; description changed to 'Updated'.
     */
    it.each<[string, string | undefined, string]>([
      ['a given description', 'Initial desc', 'Initial desc'],
      ['no description', undefined, ''],
    ])('shows and saves %s', async (_case, descriptionValue, shown) => {
      const user = userEvent.setup();
      const { data } = await renderDialog({
        data: { nameValue: 'A', showDescription: true, descriptionValue },
      });
      const description = screen.getByLabelText('Description');
      expect(description).toHaveValue(shown);
      await user.clear(description);
      await user.type(description, 'Updated', { skipClick: true });
      await user.click(saveButton());
      expect(data.descriptionValue).toBe('Updated');
    });

    /**
     * Verifies: without showDescription no Description field renders.
     * Interacts with: the rendered form.
     * Data: nameValue 'A' only.
     */
    it('renders no Description field without showDescription', async () => {
      await renderDialog({ data: { nameValue: 'A' } });
      expect(screen.queryByLabelText('Description')).not.toBeInTheDocument();
    });
  });
});
