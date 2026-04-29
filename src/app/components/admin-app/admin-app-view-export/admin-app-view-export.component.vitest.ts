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
  it('creates the component', async () => {
    const { fixture } = await renderExport();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('initializes the form with the first archive type', async () => {
    const { fixture } = await renderExport();
    expect(fixture.componentInstance.form.value.archiveType).toBe(
      Object.keys(ArchiveType)[0],
    );
  });

  it('shows "Export (N)" label when ids are provided', async () => {
    await renderExport({ ids: ['a', 'b'] });
    expect(
      await screen.findByRole('button', { name: /Export \(2\)/ }),
    ).toBeInTheDocument();
  });

  it('shows "Export All" label when ids is empty', async () => {
    await renderExport({ ids: [] });
    expect(
      await screen.findByRole('button', { name: /Export All/ }),
    ).toBeInTheDocument();
  });

  it('emits complete=false when cancel is clicked', async () => {
    const user = userEvent.setup();
    const { fixture } = await renderExport();
    const spy = vi.fn();
    fixture.componentInstance.complete.subscribe(spy);
    await user.click(screen.getByRole('button', { name: /Cancel/ }));
    expect(spy).toHaveBeenCalledWith(false);
  });

  it('calls ViewsService.export with ids and archive type on submit', async () => {
    const user = userEvent.setup();
    const { exportFn } = await renderExport({ ids: ['view-1', 'view-2'] });
    await user.click(screen.getByRole('button', { name: /Export/ }));
    const firstArchive = ArchiveType[
      Object.keys(ArchiveType)[0] as keyof typeof ArchiveType
    ];
    expect(exportFn).toHaveBeenCalledWith(['view-1', 'view-2'], firstArchive);
  });

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
