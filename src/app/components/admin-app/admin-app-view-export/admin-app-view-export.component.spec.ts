// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatSelectModule } from '@angular/material/select';
import { ArchiveType } from '../../../generated/player-api';
import { ViewsService } from '../../../services/views/views.service';
import FileDownloadUtils from '../../../utilities/file-download-utils';
import { AdminAppViewExportComponent } from './admin-app-view-export.component';
import { renderComponent } from '../../../test-utils/render-component';

type ExportResult = {
  blob: Blob;
  filename: string;
  hasErrors: boolean;
};

async function renderExport(
  overrides: {
    ids?: string[];
    exportResult?: ExportResult;
  } = {},
) {
  const {
    ids = ['view-1'],
    exportResult = {
      blob: new Blob(['x']),
      filename: 'views.zip',
      hasErrors: false,
    },
  } = overrides;

  const exportFn = vi.fn(() => of(exportResult));
  vi.spyOn(FileDownloadUtils, 'downloadFile').mockImplementation(() => {});

  const rendered = await renderComponent(AdminAppViewExportComponent, {
    declarations: [AdminAppViewExportComponent],
    imports: [MatSelectModule],
    componentProperties: { ids },
    providers: [
      {
        provide: ViewsService,
        useValue: { export: exportFn },
      },
    ],
  });

  return { ...rendered, exportFn };
}

describe('AdminAppViewExportComponent', () => {
  /**
   * Verifies: the component instantiates without error.
   * Interacts with: ViewsService.export stub + FileDownloadUtils spy.
   * Data: default render (one id, success result).
   */
  it('creates the component', async () => {
    const { fixture } = await renderExport();
    expect(fixture.componentInstance).toBeTruthy();
  });

  /**
   * Verifies: the form defaults its archiveType to the first ArchiveType key.
   * Interacts with: component.form.
   * Data: default render.
   */
  it('initializes the form with the first archive type', async () => {
    const { fixture } = await renderExport();
    expect(fixture.componentInstance.form.value.archiveType).toBe(
      Object.keys(ArchiveType)[0],
    );
  });

  /**
   * Verifies: the export button shows the selected count "Export (N)" when ids
   *   are supplied.
   * Interacts with: rendered DOM via screen.findByRole.
   * Data: ids of length 2.
   */
  it('shows "Export (N)" label when ids are provided', async () => {
    await renderExport({ ids: ['a', 'b'] });
    expect(
      await screen.findByRole('button', { name: /Export \(2\)/ }),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: the export button reads "Export All" when no ids are selected.
   * Interacts with: rendered DOM via screen.findByRole.
   * Data: empty ids array.
   */
  it('shows "Export All" label when ids is empty', async () => {
    await renderExport({ ids: [] });
    expect(
      await screen.findByRole('button', { name: /Export All/ }),
    ).toBeInTheDocument();
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
   * Verifies: submitting calls ViewsService.export with the ids and the resolved
   *   ArchiveType enum value (not the key).
   * Interacts with: ViewsService.export spy; userEvent click.
   * Data: ids = ['view-1','view-2'] with default first archive type.
   */
  it('calls ViewsService.export with ids and archive type on submit', async () => {
    const user = userEvent.setup();
    const { exportFn } = await renderExport({ ids: ['view-1', 'view-2'] });
    await user.click(screen.getByRole('button', { name: /Export/ }));
    const firstArchive = ArchiveType[
      Object.keys(ArchiveType)[0] as keyof typeof ArchiveType
    ];
    expect(exportFn).toHaveBeenCalledWith(['view-1', 'view-2'], firstArchive);
  });

  /**
   * Verifies: a clean export result downloads the blob under its filename and
   *   emits complete(true).
   * Interacts with: ViewsService.export stub + FileDownloadUtils.downloadFile spy;
   *   component.complete output.
   * Data: export result with hasErrors=false, filename 'views.zip'.
   */
  it('downloads the file and emits complete(true) when export has no errors', async () => {
    const user = userEvent.setup();
    const { fixture } = await renderExport({
      exportResult: {
        blob: new Blob(['x']),
        filename: 'views.zip',
        hasErrors: false,
      },
    });
    const spy = vi.fn();
    fixture.componentInstance.complete.subscribe(spy);
    await user.click(screen.getByRole('button', { name: /Export/ }));
    expect(FileDownloadUtils.downloadFile).toHaveBeenCalledWith(
      expect.any(Blob),
      'views.zip',
    );
    expect(spy).toHaveBeenCalledWith(true);
  });

  /**
   * Verifies: an export result flagged with errors surfaces the partial-error
   *   message.
   * Interacts with: ViewsService.export stub; rendered DOM.
   * Data: export result with hasErrors=true.
   */
  it('shows the error message when export reports archive errors', async () => {
    const user = userEvent.setup();
    const { fixture } = await renderExport({
      exportResult: {
        blob: new Blob(['x']),
        filename: 'views.zip',
        hasErrors: true,
      },
    });
    await user.click(screen.getByRole('button', { name: /Export/ }));
    fixture.detectChanges();
    expect(
      await screen.findByText(/Some errors occurred during export/),
    ).toBeInTheDocument();
  });
});
