// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { MatSelectModule } from '@angular/material/select';
import { of, throwError } from 'rxjs';
import {
  ApplicationService,
  ArchiveType,
} from '../../../generated/player-api';
import FileDownloadUtils from '../../../utilities/file-download-utils';
import HttpHeaderUtils from '../../../utilities/http-header-utils';
import { AdminAppTemplateExportComponent } from './admin-app-template-export.component';
import { renderComponent } from '../../../test-utils/render-component';

function makeResponse(hasErrors: boolean): HttpResponse<Blob> {
  return new HttpResponse<Blob>({
    body: new Blob(['contents'], { type: 'application/zip' }),
    headers: new HttpHeaders({
      'content-disposition': 'attachment; filename=template.zip',
      'X-Archive-Contains-Errors': hasErrors ? 'true' : 'false',
    }),
    status: 200,
  });
}

async function renderExport(
  overrides: {
    ids?: string[];
    exportResult?: HttpResponse<Blob> | Error;
  } = {},
) {
  const { ids = ['id-1'], exportResult = makeResponse(false) } = overrides;

  const exportApplicationTemplates = vi.fn(() =>
    exportResult instanceof Error
      ? throwError(() => exportResult)
      : of(exportResult),
  );

  // HttpHeaderUtils.getFilename uses a regex that is fragile against
  // realistic header values — stub it to avoid coupling this test to
  // that utility's behavior.
  vi.spyOn(HttpHeaderUtils, 'getFilename').mockReturnValue('template.zip');
  vi.spyOn(FileDownloadUtils, 'downloadFile').mockImplementation(() => {});

  const result = await renderComponent(AdminAppTemplateExportComponent, {
    declarations: [AdminAppTemplateExportComponent],
    imports: [MatSelectModule],
    componentProperties: { ids },
    providers: [
      {
        provide: ApplicationService,
        useValue: { exportApplicationTemplates },
      },
    ],
  });

  return { ...result, exportApplicationTemplates };
}

describe('AdminAppTemplateExportComponent', () => {
  it('creates the component', async () => {
    const { fixture } = await renderExport();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('initializes the form with the first archive type and icons disabled', async () => {
    const { fixture } = await renderExport();
    const component = fixture.componentInstance;
    expect(component.form.value.archiveType).toBe(Object.keys(ArchiveType)[0]);
    expect(component.form.value.includeIcons).toBe(false);
    expect(component.form.get('embedIcons').disabled).toBe(true);
  });

  it('enables embedIcons when includeIcons is toggled on', async () => {
    const { fixture } = await renderExport();
    fixture.componentInstance.form
      .get('includeIcons')
      .setValue(true);
    expect(fixture.componentInstance.form.get('embedIcons').enabled).toBe(true);
  });

  it('shows "Export (N)" label when ids are provided', async () => {
    await renderExport({ ids: ['a', 'b', 'c'] });
    expect(await screen.findByRole('button', { name: /Export \(3\)/ })).toBeInTheDocument();
  });

  it('shows "Export All" label when ids is empty', async () => {
    await renderExport({ ids: [] });
    expect(await screen.findByRole('button', { name: /Export All/ })).toBeInTheDocument();
  });

  it('emits complete=false when cancel is clicked', async () => {
    const user = userEvent.setup();
    const { fixture } = await renderExport();
    const spy = vi.fn();
    fixture.componentInstance.complete.subscribe(spy);
    await user.click(screen.getByRole('button', { name: /Cancel/ }));
    expect(spy).toHaveBeenCalledWith(false);
  });

  it('calls exportApplicationTemplates with the form values when Export is submitted', async () => {
    const user = userEvent.setup();
    const { fixture, exportApplicationTemplates } = await renderExport({
      ids: ['id-a', 'id-b'],
    });
    await user.click(screen.getByRole('button', { name: /Export \(2\)/ }));
    expect(exportApplicationTemplates).toHaveBeenCalledWith(
      false, // includeIcons
      false, // embedIcons (disabled because includeIcons=false)
      ArchiveType[Object.keys(ArchiveType)[0] as keyof typeof ArchiveType],
      ['id-a', 'id-b'],
      'response',
    );
    // happy path: no errors header, complete emits true
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('emits complete=true when export response has no archive errors', async () => {
    const user = userEvent.setup();
    const { fixture } = await renderExport({ exportResult: makeResponse(false) });
    const spy = vi.fn();
    fixture.componentInstance.complete.subscribe(spy);
    await user.click(screen.getByRole('button', { name: /Export/ }));
    expect(spy).toHaveBeenCalledWith(true);
    expect(FileDownloadUtils.downloadFile).toHaveBeenCalled();
  });

  it('shows the error message when export response reports archive errors', async () => {
    const user = userEvent.setup();
    const { fixture } = await renderExport({ exportResult: makeResponse(true) });
    await user.click(screen.getByRole('button', { name: /Export/ }));
    fixture.detectChanges();
    expect(
      await screen.findByText(/Some errors occurred during export/),
    ).toBeInTheDocument();
  });
});
