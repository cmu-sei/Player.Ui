// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NameDialogComponent } from './name-dialog.component';
import { renderComponent } from '../../../test-utils/render-component';

async function renderDialog(
  overrides: {
    data?: Record<string, unknown>;
  } = {},
) {
  const { data = { nameValue: 'Alpha' } } = overrides;

  const close = vi.fn();
  const dialogRef = { close, disableClose: false } as unknown as MatDialogRef<
    NameDialogComponent
  >;

  const rendered = await renderComponent(NameDialogComponent, {
    declarations: [NameDialogComponent],
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });

  return { ...rendered, close, dialogRef, data };
}

describe('NameDialogComponent', () => {
  /**
   * Verifies: the component instantiates under the dialog providers.
   * Interacts with: MatDialogRef and MAT_DIALOG_DATA stubs via renderDialog.
   * Data: default dialog data { nameValue: 'Alpha' }.
   */
  it('creates the component', async () => {
    const { fixture } = await renderDialog();
    expect(fixture.componentInstance).toBeTruthy();
  });

  /**
   * Verifies: the component forces disableClose=true on the dialog ref on init.
   * Interacts with: MatDialogRef.disableClose (seeded false in the stub).
   * Data: default dialog data.
   */
  it('sets disableClose on the dialog ref', async () => {
    const { dialogRef } = await renderDialog();
    expect(dialogRef.disableClose).toBe(true);
  });

  /**
   * Verifies: the name form control is initialized from data.nameValue.
   * Interacts with: component reactive form built on init from MAT_DIALOG_DATA.
   * Data: dialog data { nameValue: 'Hi' }.
   */
  it('seeds the name form control from data.nameValue', async () => {
    const { fixture } = await renderDialog({ data: { nameValue: 'Hi' } });
    expect(fixture.componentInstance.form.value.name).toBe('Hi');
  });

  /**
   * Verifies: validators supplied via data.validators are attached to the name
   *   control (invalid for too-short input, valid once satisfied).
   * Interacts with: component form validation; Angular Validators.minLength.
   * Data: dialog data with a minLength(5) validator and seed 'x'.
   */
  it('applies extra validators from data.validators', async () => {
    const { fixture } = await renderDialog({
      data: {
        nameValue: 'x',
        validators: [{ name: 'minLength', validator: Validators.minLength(5) }],
      },
    });
    const ctrl = fixture.componentInstance.form.controls['name'];
    expect(ctrl.valid).toBe(false); // 'x' is shorter than 5
    ctrl.setValue('longer');
    expect(ctrl.valid).toBe(true);
  });

  /**
   * Verifies: the `name` getter exposes the underlying name form control.
   * Interacts with: component form control accessor.
   * Data: default dialog data { nameValue: 'Alpha' }.
   */
  it('name getter returns the name form control', async () => {
    const { fixture } = await renderDialog();
    expect(fixture.componentInstance.name.value).toBe('Alpha');
  });

  /**
   * Verifies: onClick() mutates the shared data object (wasCancelled=false,
   *   nameValue updated, removeArtifacts defaulted false) and closes with it.
   * Interacts with: MatDialogRef.close; mutates the injected MAT_DIALOG_DATA.
   * Data: dialog data { nameValue: 'A' } edited to 'B'; no artifacts present.
   */
  it('onClick() closes with data.wasCancelled=false and the edited name', async () => {
    const { fixture, close, data } = await renderDialog({
      data: { nameValue: 'A' },
    });
    fixture.componentInstance.form.get('name').setValue('B');
    fixture.componentInstance.onClick();
    expect(close).toHaveBeenCalledWith(data);
    expect(data.wasCancelled).toBe(false);
    expect(data.nameValue).toBe('B');
    expect(data.removeArtifacts).toBe(false); // no artifacts provided
  });

  /**
   * Verifies: when artifacts exist, onClick() keeps the user's removeArtifacts
   *   selection rather than overwriting it with the default.
   * Interacts with: component.removeArtifacts flag; mutates injected data.
   * Data: dialog data with artifacts ['art-1'] and removeArtifacts set true.
   */
  it('onClick() preserves the user removeArtifacts choice when artifacts exist', async () => {
    const data = { nameValue: 'A', artifacts: ['art-1'] };
    const { fixture } = await renderDialog({ data });
    fixture.componentInstance.removeArtifacts = true;
    fixture.componentInstance.onClick();
    expect((data as { removeArtifacts?: boolean }).removeArtifacts).toBe(true);
  });

  /**
   * Verifies: onCancel() flags data.wasCancelled=true and closes with the data.
   * Interacts with: MatDialogRef.close; mutates the injected MAT_DIALOG_DATA.
   * Data: default dialog data.
   */
  it('onCancel() closes with data.wasCancelled=true', async () => {
    const { fixture, close, data } = await renderDialog();
    fixture.componentInstance.onCancel();
    expect(close).toHaveBeenCalledWith(data);
    expect(data.wasCancelled).toBe(true);
  });

  describe('description field (data.showDescription)', () => {
    /**
     * Verifies: when showDescription is set, a description control is added and
     *   seeded from data.descriptionValue.
     * Interacts with: component form built on init from MAT_DIALOG_DATA.
     * Data: dialog data with showDescription true and descriptionValue 'Initial desc'.
     */
    it('adds a description control seeded from data.descriptionValue', async () => {
      const { fixture } = await renderDialog({
        data: {
          nameValue: 'A',
          showDescription: true,
          descriptionValue: 'Initial desc',
        },
      });
      expect(fixture.componentInstance.form.get('description')?.value).toBe(
        'Initial desc',
      );
    });

    /**
     * Verifies: the added description control defaults to '' when no
     *   descriptionValue is supplied.
     * Interacts with: component form built on init from MAT_DIALOG_DATA.
     * Data: dialog data with showDescription true and no descriptionValue.
     */
    it('defaults the description control to empty when no value is given', async () => {
      const { fixture } = await renderDialog({
        data: { nameValue: 'A', showDescription: true },
      });
      expect(fixture.componentInstance.form.get('description')?.value).toBe('');
    });

    /**
     * Verifies: onClick() writes the edited description control value back into
     *   data.descriptionValue.
     * Interacts with: MatDialogRef.close; mutates the injected MAT_DIALOG_DATA.
     * Data: dialog data with showDescription true; description edited to 'Updated'.
     */
    it('onClick() writes the edited description back into data', async () => {
      const { fixture, data } = await renderDialog({
        data: { nameValue: 'A', showDescription: true, descriptionValue: '' },
      });
      fixture.componentInstance.form.get('description').setValue('Updated');
      fixture.componentInstance.onClick();
      expect(data.descriptionValue).toBe('Updated');
    });

    /**
     * Verifies: no description control is created when showDescription is absent.
     * Interacts with: component form built on init from MAT_DIALOG_DATA.
     * Data: dialog data { nameValue: 'A' } with no showDescription flag.
     */
    it('does not add a description control when showDescription is absent', async () => {
      const { fixture } = await renderDialog({ data: { nameValue: 'A' } });
      expect(fixture.componentInstance.form.get('description')).toBeNull();
    });
  });
});
