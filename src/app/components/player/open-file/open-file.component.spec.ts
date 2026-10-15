// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Observable, of, throwError } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { FileService } from '../../../generated/player-api';
import { OpenFileComponent } from './open-file.component';
import { renderComponent } from '../../../test-utils/render-component';
import { ApiStub } from '../../../test-utils/api-stub';
import { activatedRouteStub } from '../../../test-utils/activated-route';

function makeAnchorStub() {
  const setDownload = vi.fn();
  const click = vi.fn();
  const anchor = document.createElement('a');
  Object.defineProperty(anchor, 'download', {
    configurable: true,
    set: setDownload,
    get: () => '',
  });
  anchor.click = click;
  return { anchor, setDownload, click };
}

// The component builds an <a> and clicks it. A real click makes jsdom attempt
// a navigation it does not implement, so every test hands it the stub anchor.
function stubDownloadAnchor() {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob://x');
  const stub = makeAnchorStub();
  const originalCreateEl = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
    tag === 'a'
      ? stub.anchor
      : originalCreateEl(tag)) as typeof document.createElement);
  return stub;
}

async function renderOpenFile(
  overrides: {
    fileId?: string | null;
    fileName?: string | null;
    download?: () => Observable<Blob>;
  } = {},
) {
  const {
    fileId = 'f1',
    fileName = 'doc.txt',
    download: downloadImpl = () => of(new Blob(['x'])),
  } = overrides;

  const download = vi.fn(downloadImpl);

  const rendered = await renderComponent(OpenFileComponent, {
    declarations: [OpenFileComponent],
    providers: [
      {
        provide: FileService,
        useValue: { download } satisfies ApiStub<FileService>,
      },
      {
        provide: ActivatedRoute,
        useValue: activatedRouteStub({
          ...(fileId == null ? {} : { id: fileId }),
          ...(fileName == null ? {} : { name: fileName }),
        }).route,
      },
    ],
  });

  return { ...rendered, download };
}

describe('OpenFileComponent', () => {
  /**
   * Verifies: on creation the component immediately downloads the file from the route's id query param.
   * Interacts with: FileService.download spy, ActivatedRoute.snapshot.queryParamMap, stub download anchor.
   * Data: default renderOpenFile() (id 'f1', name 'doc.txt'); expects download('f1').
   */
  it("downloads the file named by the route's id query param on creation", async () => {
    stubDownloadAnchor();
    const { download } = await renderOpenFile();
    expect(download).toHaveBeenCalledWith('f1');
  });

  /**
   * Verifies: a non-image/pdf file is saved as an attachment by setting the anchor download name and clicking it.
   * Interacts with: FileService.download, URL.createObjectURL spy, anchor stub via createElement.
   * Data: fileName 'doc.txt'; expects download attribute set to 'doc.txt' and a click.
   */
  it('downloads as attachment for non-image/pdf files', async () => {
    const { setDownload, click } = stubDownloadAnchor();
    await renderOpenFile({ fileId: 'f1', fileName: 'doc.txt' });
    expect(setDownload).toHaveBeenCalledWith('doc.txt');
    expect(click).toHaveBeenCalled();
  });

  /**
   * Verifies: an image/pdf file opens inline by leaving the anchor download attribute unset.
   * Interacts with: FileService.download, anchor download setter spy via createElement stub.
   * Data: fileName 'image.png'; expects the download setter never called.
   */
  it('opens in browser (no download attribute) for image/pdf files', async () => {
    const { setDownload } = stubDownloadAnchor();
    await renderOpenFile({ fileId: 'f1', fileName: 'image.png' });
    expect(setDownload).not.toHaveBeenCalled();
  });

  /**
   * Verifies: a failed download surfaces a window.alert with an error message.
   * Interacts with: window.alert spy, FileService.download error path.
   * Data: download stub returns throwError (which errors synchronously on subscribe, during init).
   */
  it('alerts when the download errors', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    // The component's error handler does console.log(err); silence it so the
    // deliberately-triggered error and its stack don't print to test output.
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await renderOpenFile({
      download: () => throwError(() => new Error('boom')),
    });
    expect(alertSpy).toHaveBeenCalledWith('Error downloading file');
  });
});
