// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatSelectModule } from '@angular/material/select';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { ArchiveType, ViewService } from '../../../generated/player-api';
import { ApiStub } from '../../../test-utils/api-stub';
import FileDownloadUtils from '../../../utilities/file-download-utils';
import { AdminAppViewExportComponent } from './admin-app-view-export.component';
import { renderComponent } from '../../../test-utils/render-component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';

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

  // The real ViewsService.export (a default provider) reads the filename and
  // the error flag from these response headers.
  const exportFn = vi.fn(
    (_archiveType: ArchiveType, _ids?: string[], _observe?: 'response') =>
      of(
        new HttpResponse<Blob>({
          body: exportResult.blob,
          headers: new HttpHeaders({
            'content-disposition': `attachment; filename=${exportResult.filename}`,
            'X-Archive-Contains-Errors': String(exportResult.hasErrors),
          }),
        }),
      ),
  );
  vi.spyOn(FileDownloadUtils, 'downloadFile').mockImplementation(() => {});

  const rendered = await renderComponent(AdminAppViewExportComponent, {
    declarations: [AdminAppViewExportComponent],
    imports: [
      MatFormFieldModule,
      MatButtonModule,
      MatSelectModule,
      ...CRUCIBLE_DIALOG_IMPORTS,
    ],
    componentProperties: { ids },
    providers: [
      {
        provide: ViewService,
        useValue: { exportViews: exportFn } satisfies ApiStub<ViewService>,
      },
    ],
  });

  return { ...rendered, exportFn };
}

describe('AdminAppViewExportComponent', () => {
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
   * Verifies: the shared dialog renders the Export action when ids are supplied.
   * Interacts with: rendered DOM via screen.findByRole.
   * Data: ids of length 2.
   */
  it('shows the Export action when ids are provided', async () => {
    await renderExport({ ids: ['a', 'b'] });
    expect(
      await screen.findByRole('button', { name: /^Export$/ }),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: the shared dialog still renders the Export action when no ids are selected.
   * Interacts with: rendered DOM via screen.findByRole.
   * Data: empty ids array.
   */
  it('shows the Export action when ids is empty', async () => {
    await renderExport({ ids: [] });
    expect(
      await screen.findByRole('button', { name: /^Export$/ }),
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
   * Verifies: submitting exports the ids with the resolved ArchiveType enum value
   *   (not the key), asking for the full response.
   * Interacts with: the real ViewsService.export over the ViewService.exportViews stub; userEvent click.
   * Data: ids = ['view-1','view-2'] with default first archive type.
   */
  it('exports the ids with the selected archive type on submit', async () => {
    const user = userEvent.setup();
    const { exportFn } = await renderExport({ ids: ['view-1', 'view-2'] });
    await user.click(screen.getByRole('button', { name: /Export/ }));
    const firstArchive =
      ArchiveType[Object.keys(ArchiveType)[0] as keyof typeof ArchiveType];
    expect(exportFn).toHaveBeenCalledWith(
      firstArchive,
      ['view-1', 'view-2'],
      'response',
    );
  });

  /**
   * Verifies: a clean export result downloads the blob under its filename and
   *   emits complete(true).
   * Interacts with: the real ViewsService.export over the ViewService.exportViews stub + FileDownloadUtils.downloadFile spy;
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
   * Interacts with: the real ViewsService.export over the ViewService.exportViews stub; rendered DOM.
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
    await fixture.whenStable();
    expect(
      await screen.findByText(/Some errors occurred during export/),
    ).toBeInTheDocument();
  });
});
