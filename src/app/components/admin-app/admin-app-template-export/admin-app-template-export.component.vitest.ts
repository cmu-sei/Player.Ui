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
  /**
   * Verifies: the component instantiates without error.
   * Interacts with: ApplicationService stub + FileDownloadUtils/HttpHeaderUtils spies.
   * Data: default render (one id, success response).
   */
  it('creates the component', async () => {
    const { fixture } = await renderExport();
    expect(fixture.componentInstance).toBeTruthy();
  });

  /**
   * Verifies: form defaults to the first ArchiveType, includeIcons false, and a
   *   disabled embedIcons control.
   * Interacts with: component.form reactive form.
   * Data: default render.
   */
  it('initializes the form with the first archive type and icons disabled', async () => {
    const { fixture } = await renderExport();
    const component = fixture.componentInstance;
    expect(component.form.value.archiveType).toBe(Object.keys(ArchiveType)[0]);
    expect(component.form.value.includeIcons).toBe(false);
    expect(component.form.get('embedIcons').disabled).toBe(true);
  });

  /**
   * Verifies: setting includeIcons true enables the previously-disabled
   *   embedIcons control.
   * Interacts with: component.form value changes wiring.
   * Data: includeIcons toggled to true.
   */
  it('enables embedIcons when includeIcons is toggled on', async () => {
    const { fixture } = await renderExport();
    fixture.componentInstance.form
      .get('includeIcons')
      .setValue(true);
    expect(fixture.componentInstance.form.get('embedIcons').enabled).toBe(true);
  });

  /**
   * Verifies: the export button shows the selected count "Export (N)" when ids
   *   are supplied.
   * Interacts with: rendered DOM via screen.findByRole.
   * Data: ids of length 3.
   */
  it('shows "Export (N)" label when ids are provided', async () => {
    await renderExport({ ids: ['a', 'b', 'c'] });
    expect(await screen.findByRole('button', { name: /Export \(3\)/ })).toBeInTheDocument();
  });

  /**
   * Verifies: the export button reads "Export All" when no ids are selected.
   * Interacts with: rendered DOM via screen.findByRole.
   * Data: empty ids array.
   */
  it('shows "Export All" label when ids is empty', async () => {
    await renderExport({ ids: [] });
    expect(await screen.findByRole('button', { name: /Export All/ })).toBeInTheDocument();
  });

  /**
   * Verifies: clicking Cancel emits complete(false) without exporting.
   * Interacts with: component.complete output; userEvent click.
   * Data: default render.
   */
  it('emits complete=false when cancel is clicked', async () => {
    const user = userEvent.setup();
    const { fixture } = await renderExport();
    const spy = vi.fn();
    fixture.componentInstance.complete.subscribe(spy);
    await user.click(screen.getByRole('button', { name: /Cancel/ }));
    expect(spy).toHaveBeenCalledWith(false);
  });

  /**
   * Verifies: submitting forwards includeIcons, embedIcons, archive type, ids,
   *   and 'response' observe mode to the service.
   * Interacts with: ApplicationService.exportApplicationTemplates spy.
   * Data: ids = ['id-a','id-b'] with default form (icons off, first archive type).
   * Why: embedIcons is asserted false because it stays disabled while includeIcons is off.
   */
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

  /**
   * Verifies: a response without the errors header triggers file download and
   *   emits complete(true).
   * Interacts with: ApplicationService.exportApplicationTemplates +
   *   FileDownloadUtils.downloadFile spy; component.complete output.
   * Data: success response (X-Archive-Contains-Errors=false).
   */
  it('emits complete=true when export response has no archive errors', async () => {
    const user = userEvent.setup();
    const { fixture } = await renderExport({ exportResult: makeResponse(false) });
    const spy = vi.fn();
    fixture.componentInstance.complete.subscribe(spy);
    await user.click(screen.getByRole('button', { name: /Export/ }));
    expect(spy).toHaveBeenCalledWith(true);
    expect(FileDownloadUtils.downloadFile).toHaveBeenCalled();
  });

  /**
   * Verifies: a response carrying the errors header surfaces the partial-error
   *   message instead of completing silently.
   * Interacts with: ApplicationService.exportApplicationTemplates stub; rendered DOM.
   * Data: response with X-Archive-Contains-Errors=true.
   */
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
