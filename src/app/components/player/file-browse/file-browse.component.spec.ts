// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { FileService, Team, TeamService } from '../../../generated/player-api';
import { FileModel } from '../../../generated/player-api/model/fileModel';
import { FileBrowseComponent } from './file-browse.component';
import { renderComponent } from '../../../test-utils/render-component';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

const files: FileModel[] = [
  { id: 'f1', name: 'doc.txt', teamIds: ['team-a'] },
  { id: 'f2', name: 'image.png', teamIds: ['team-b'] },
  { id: 'f3', name: 'shared.pdf', teamIds: ['team-a', 'team-b'] },
];

const teams: Team[] = [
  { id: 'team-a', name: 'Red' },
  { id: 'team-b', name: 'Blue' },
];

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

function stubAnchorCreation(anchor: HTMLAnchorElement) {
  const createElement = document.createElement.bind(document);
  return vi
    .spyOn(document, 'createElement')
    .mockImplementation(((tag: string) =>
      tag === 'a'
        ? anchor
        : createElement(tag)) as typeof document.createElement);
}

async function renderBrowse(
  overrides: {
    viewId?: string;
    files?: FileModel[];
    teams?: Team[];
  } = {},
) {
  const { viewId = 'v1', files: f = files, teams: t = teams } = overrides;

  const getViewFiles = vi.fn(() => of(f));
  const getMyViewTeams = vi.fn(() => of(t));
  const download = vi.fn(() => of(new Blob(['x'])));

  const rendered = await renderComponent(FileBrowseComponent, {
    imports: [MatListModule, MatIconModule, MatButtonModule],
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
            paramMap: convertToParamMap({ id: viewId }),
          },
        },
      },
    ],
  });

  return { ...rendered, getViewFiles, getMyViewTeams, download };
}

describe('FileBrowseComponent', () => {
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
   * Verifies: downloadFile fetches the blob, points the anchor at the object URL, names the download after
   *   the file, and clicks it for a non-image file.
   * Interacts with: FileService.download, URL.createObjectURL spy, document.createElement anchor stub.
   * Data: file id 'f1' / 'doc.txt'.
   * Why: the download attribute is the whole point of this branch, so it is asserted with the file name
   *   rather than left to a no-op setter; the anchor's click is stubbed to avoid jsdom
   *   "Not implemented: navigation".
   */
  it('downloadFile triggers a browser download for a non-image file', async () => {
    const { fixture, download } = await renderBrowse();
    const { anchor, setDownload, click } = makeAnchorStub();
    const createUrl = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob://x');
    stubAnchorCreation(anchor);
    fixture.componentInstance.downloadFile('f1', 'doc.txt');
    expect(download).toHaveBeenCalledWith('f1');
    expect(createUrl).toHaveBeenCalled();
    expect(anchor.getAttribute('href')).toBe('blob://x');
    expect(anchor.getAttribute('target')).toBe('_blank');
    expect(setDownload).toHaveBeenCalledWith('doc.txt');
    expect(click).toHaveBeenCalled();
  });

  /**
   * Verifies: downloadFile omits the anchor download attribute for image files (opens inline instead of
   *   forcing a save) while still clicking the anchor.
   * Interacts with: FileService.download, anchor download setter spy via createElement stub.
   * Data: file id 'f2' / 'image.png'.
   * Why: instruments the anchor's download setter so it can assert the attribute is never assigned, and
   *   asserts the click so a downloadFile that did nothing at all could not pass.
   */
  it('downloadFile does not set download attribute for image files', async () => {
    const { fixture } = await renderBrowse();
    const { anchor, setDownload, click } = makeAnchorStub();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob://x');
    stubAnchorCreation(anchor);
    fixture.componentInstance.downloadFile('f2', 'image.png');
    expect(setDownload).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
  });
});
