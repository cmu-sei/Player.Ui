// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import {
  FileService,
  Team,
  TeamService,
} from '../../../generated/player-api';
import { FileModel } from '../../../generated/player-api/model/fileModel';
import { FileBrowseComponent } from './file-browse.component';
import { renderComponent } from '../../../test-utils/render-component';

const files: FileModel[] = [
  { id: 'f1', name: 'doc.txt', teamIds: ['team-a'] },
  { id: 'f2', name: 'image.png', teamIds: ['team-b'] },
  { id: 'f3', name: 'shared.pdf', teamIds: ['team-a', 'team-b'] },
];

const teams: Team[] = [
  { id: 'team-a', name: 'Red' },
  { id: 'team-b', name: 'Blue' },
];

async function renderBrowse(
  overrides: {
    viewId?: string;
    files?: FileModel[];
    teams?: Team[];
  } = {},
) {
  const {
    viewId = 'v1',
    files: f = files,
    teams: t = teams,
  } = overrides;

  const getViewFiles = vi.fn(() => of(f));
  const getMyViewTeams = vi.fn(() => of(t));
  const download = vi.fn(() => of(new Blob(['x'])));

  const rendered = await renderComponent(FileBrowseComponent, {
    declarations: [FileBrowseComponent],
    providers: [
      {
        provide: FileService,
        useValue: { getViewFiles, download },
      },
      {
        provide: TeamService,
        useValue: { getMyViewTeams },
      },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            paramMap: {
              get: (k: string) => (k === 'id' ? viewId : null),
            },
          },
        },
      },
    ],
  });

  return { ...rendered, getViewFiles, getMyViewTeams, download };
}

describe('FileBrowseComponent', () => {
  /**
   * Verifies: FileBrowseComponent instantiates successfully.
   * Interacts with: renderBrowse harness with FileService/TeamService/ActivatedRoute stubs.
   * Data: default renderBrowse() (three files across two teams).
   */
  it('creates the component', async () => {
    const { fixture } = await renderBrowse();
    expect(fixture.componentInstance).toBeTruthy();
  });

  /**
   * Verifies: init fetches files and teams using the view id from the route, populating files and a teams map.
   * Interacts with: FileService.getViewFiles, TeamService.getMyViewTeams, ActivatedRoute.snapshot.paramMap.
   * Data: route id 'v1'; default files/teams; asserts teams map has 2 entries.
   */
  it('loads files and teams on init using the route id', async () => {
    const { fixture, getViewFiles, getMyViewTeams } = await renderBrowse();
    expect(getViewFiles).toHaveBeenCalledWith('v1');
    expect(getMyViewTeams).toHaveBeenCalledWith('v1');
    expect(fixture.componentInstance.files).toEqual(files);
    expect(fixture.componentInstance.teams.size).toBe(2);
  });

  /**
   * Verifies: filtered() returns only files whose teamIds include the selected team.
   * Interacts with: component.selectTeam then filtered() seam.
   * Data: default files; selectTeam('team-a') expects f1 and f3.
   */
  it('filtered() returns files belonging to the current team', async () => {
    const { fixture } = await renderBrowse();
    fixture.componentInstance.selectTeam('team-a');
    expect(fixture.componentInstance.filtered().map((f) => f.id)).toEqual([
      'f1',
      'f3',
    ]);
  });

  /**
   * Verifies: filtered() returns an empty array when no team has been selected.
   * Interacts with: component.filtered() seam without a prior selectTeam.
   * Data: default renderBrowse().
   */
  it('filtered() returns empty when currentTeam is unset', async () => {
    const { fixture } = await renderBrowse();
    expect(fixture.componentInstance.filtered()).toEqual([]);
  });

  /**
   * Verifies: selectTeam stores the chosen team id in currentTeam.
   * Interacts with: component.selectTeam seam.
   * Data: selectTeam('team-b').
   */
  it('selectTeam updates currentTeam', async () => {
    const { fixture } = await renderBrowse();
    fixture.componentInstance.selectTeam('team-b');
    expect(fixture.componentInstance.currentTeam).toBe('team-b');
  });

  /**
   * Verifies: downloadFile fetches the blob, creates an object URL, and clicks a generated anchor for a non-image file.
   * Interacts with: FileService.download, URL.createObjectURL spy, document.createElement anchor stub.
   * Data: file id 'f1' / 'doc.txt'.
   * Why: stubs the anchor's click to avoid jsdom "Not implemented: navigation" when a real download is triggered.
   */
  it('downloadFile triggers a browser download for a non-image file', async () => {
    const { fixture, download } = await renderBrowse();
    const createUrl = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob://x');
    const click = vi.fn();
    // Stub the anchor click to avoid jsdom "Not implemented: navigation".
    const createEl = vi
      .spyOn(document, 'createElement')
      .mockImplementation(((tag: string) => {
        if (tag === 'a') {
          return {
            set href(_v: string) {},
            get href() {
              return '';
            },
            set download(_v: string) {},
            target: '',
            click,
          } as unknown as HTMLElement;
        }
        return document.createElement.wrappedMethod(tag);
      }) as typeof document.createElement);
    fixture.componentInstance.downloadFile('f1', 'doc.txt');
    expect(download).toHaveBeenCalledWith('f1');
    expect(createUrl).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    createEl.mockRestore();
    createUrl.mockRestore();
  });

  /**
   * Verifies: downloadFile omits the anchor download attribute for image files (opens inline instead of forcing a save).
   * Interacts with: FileService.download, anchor download setter spy via createElement stub.
   * Data: file id 'f2' / 'image.png'.
   * Why: instruments the anchor's download setter so it can assert the attribute is never assigned.
   */
  it('downloadFile does not set download attribute for image files', async () => {
    const { fixture } = await renderBrowse();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob://x');
    const setDownload = vi.fn();
    const anchorStub = {
      set href(_v: string) {},
      get href() {
        return '';
      },
      set download(v: string) {
        setDownload(v);
      },
      target: '',
      click: vi.fn(),
    };
    const createEl = vi
      .spyOn(document, 'createElement')
      .mockReturnValue(anchorStub as unknown as HTMLAnchorElement);
    fixture.componentInstance.downloadFile('f2', 'image.png');
    expect(setDownload).not.toHaveBeenCalled();
    createEl.mockRestore();
  });
});
