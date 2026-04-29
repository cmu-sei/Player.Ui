// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { FileService } from '../../../generated/player-api';
import { OpenFileComponent } from './open-file.component';
import { renderComponent } from '../../../test-utils/render-component';

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

async function renderOpenFile(
  overrides: {
    fileId?: string | null;
    fileName?: string | null;
  } = {},
) {
  const { fileId = 'f1', fileName = 'doc.txt' } = overrides;

  const download = vi.fn(() => of(new Blob(['x'])));

  const rendered = await renderComponent(OpenFileComponent, {
    declarations: [OpenFileComponent],
    providers: [
      { provide: FileService, useValue: { download } },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            queryParamMap: {
              get: (k: string) =>
                k === 'id' ? fileId : k === 'name' ? fileName : null,
            },
          },
        },
      },
    ],
  });

  return { ...rendered, download };
}

describe('OpenFileComponent', () => {
  it('creates the component', async () => {
    const { download } = await renderOpenFile();
    expect(download).toHaveBeenCalledWith('f1');
  });

  it('downloads as attachment for non-image/pdf files', async () => {
    const createUrl = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob://x');
    const { anchor, setDownload, click } = makeAnchorStub();
    const originalCreateEl = document.createElement.bind(document);
    const createEl = vi
      .spyOn(document, 'createElement')
      .mockImplementation(((tag: string) =>
        tag === 'a' ? anchor : originalCreateEl(tag)) as typeof document.createElement);
    await renderOpenFile({ fileId: 'f1', fileName: 'doc.txt' });
    expect(setDownload).toHaveBeenCalledWith('doc.txt');
    expect(click).toHaveBeenCalled();
    createEl.mockRestore();
    createUrl.mockRestore();
  });

  it('opens in browser (no download attribute) for image/pdf files', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob://x');
    const { anchor, setDownload } = makeAnchorStub();
    const originalCreateEl = document.createElement.bind(document);
    const createEl = vi
      .spyOn(document, 'createElement')
      .mockImplementation(((tag: string) =>
        tag === 'a' ? anchor : originalCreateEl(tag)) as typeof document.createElement);
    await renderOpenFile({ fileId: 'f1', fileName: 'image.png' });
    expect(setDownload).not.toHaveBeenCalled();
    createEl.mockRestore();
  });

  it('alerts when the download errors', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const download = vi.fn(() => {
      return new (class extends Object {
        subscribe(next: unknown, err?: (e: unknown) => void) {
          err?.(new Error('boom'));
          return { unsubscribe: () => {} };
        }
      })();
    });
    await renderComponent(OpenFileComponent, {
      declarations: [OpenFileComponent],
      providers: [
        { provide: FileService, useValue: { download } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (k: string) => (k === 'id' ? 'f1' : 'doc.txt'),
              },
            },
          },
        },
      ],
    });
    expect(alertSpy).toHaveBeenCalledWith('Error downloading file');
    alertSpy.mockRestore();
  });
});
