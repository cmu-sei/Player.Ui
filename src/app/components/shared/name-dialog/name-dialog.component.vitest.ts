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
  it('creates the component', async () => {
    const { fixture } = await renderDialog();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('sets disableClose on the dialog ref', async () => {
    const { dialogRef } = await renderDialog();
    expect(dialogRef.disableClose).toBe(true);
  });

  it('seeds the name form control from data.nameValue', async () => {
    const { fixture } = await renderDialog({ data: { nameValue: 'Hi' } });
    expect(fixture.componentInstance.form.value.name).toBe('Hi');
  });

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

  it('name getter returns the name form control', async () => {
    const { fixture } = await renderDialog();
    expect(fixture.componentInstance.name.value).toBe('Alpha');
  });

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

  it('onClick() preserves the user removeArtifacts choice when artifacts exist', async () => {
    const data = { nameValue: 'A', artifacts: ['art-1'] };
    const { fixture } = await renderDialog({ data });
    fixture.componentInstance.removeArtifacts = true;
    fixture.componentInstance.onClick();
    expect((data as { removeArtifacts?: boolean }).removeArtifacts).toBe(true);
  });

  it('onCancel() closes with data.wasCancelled=true', async () => {
    const { fixture, close, data } = await renderDialog();
    fixture.componentInstance.onCancel();
    expect(close).toHaveBeenCalledWith(data);
    expect(data.wasCancelled).toBe(true);
  });

  describe('description field (data.showDescription)', () => {
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

    it('defaults the description control to empty when no value is given', async () => {
      const { fixture } = await renderDialog({
        data: { nameValue: 'A', showDescription: true },
      });
      expect(fixture.componentInstance.form.get('description')?.value).toBe('');
    });

    it('onClick() writes the edited description back into data', async () => {
      const { fixture, data } = await renderDialog({
        data: { nameValue: 'A', showDescription: true, descriptionValue: '' },
      });
      fixture.componentInstance.form.get('description').setValue('Updated');
      fixture.componentInstance.onClick();
      expect(data.descriptionValue).toBe('Updated');
    });

    it('does not add a description control when showDescription is absent', async () => {
      const { fixture } = await renderDialog({ data: { nameValue: 'A' } });
      expect(fixture.componentInstance.form.get('description')).toBeNull();
    });
  });
});
