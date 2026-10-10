// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ActivatedRoute } from '@angular/router';
import { FileService, Team, TeamService } from '../../../generated/player-api';
import { FileModel } from '../../../generated/player-api/model/fileModel';
import { FileBrowseComponent } from './file-browse.component';
import { renderComponent } from '../../../test-utils/render-component';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ApiStub } from '../../../test-utils/api-stub';
import { activatedRouteStub } from '../../../test-utils/activated-route';

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

  const getViewFiles = vi.fn(() => of(structuredClone(f)));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const getMyViewTeams = vi.fn(() => of(t));
  const download = vi.fn(() => of(new Blob(['x'])));

  const rendered = await renderComponent(FileBrowseComponent, {
    imports: [MatListModule, MatIconModule, MatButtonModule],
    declarations: [FileBrowseComponent],
    providers: [
      {
        provide: FileService,
        useValue: { getViewFiles, download } satisfies ApiStub<FileService>,
      },
      {
        provide: TeamService,
        useValue: { getMyViewTeams } satisfies ApiStub<TeamService>,
      },
      {
        provide: ActivatedRoute,
        useValue: activatedRouteStub({}, { id: viewId }).route,
      },
    ],
  });

  return { ...rendered, getViewFiles, getMyViewTeams, download };
}

/** File names listed for the selected team, in render order. */
function listedFiles(container: Element): string[] {
  return Array.from(container.querySelectorAll('mat-list-item')).map(
    (item) => item.textContent?.trim() ?? '',
  );
}

describe('FileBrowseComponent', () => {
  /**
   * Verifies: the view's files and the user's teams load for the route's view, a button per team renders, and no
   *   file is listed until a team is picked.
   * Interacts with: FileService.getViewFiles and TeamService.getMyViewTeams with the ActivatedRoute id; the rendered
   *   team buttons and file list.
   * Data: route id 'v1'; teams Red and Blue; three files.
   */
  it('loads the files and teams of the routed view', async () => {
    const { container, getViewFiles, getMyViewTeams } = await renderBrowse();
    expect(getViewFiles).toHaveBeenCalledExactlyOnceWith('v1');
    expect(getMyViewTeams).toHaveBeenCalledExactlyOnceWith('v1');
    expect(screen.getByText('Red')).toBeInTheDocument();
    expect(screen.getByText('Blue')).toBeInTheDocument();
    expect(listedFiles(container)).toEqual([]);
  });

  /**
   * Verifies: picking a team lists the files shared with it.
   * Interacts with: the rendered team buttons; the file list.
   * Data: one row per team; doc.txt for Red, image.png for Blue, shared.pdf for both.
   */
  it.each<[string, string[]]>([
    ['Red', ['doc.txt', 'shared.pdf']],
    ['Blue', ['image.png', 'shared.pdf']],
  ])('lists the files of team %s', async (team, expected) => {
    const user = userEvent.setup();
    const { container } = await renderBrowse();
    await user.click(screen.getByText(team));
    expect(listedFiles(container)).toEqual(expected);
  });

  /**
   * Verifies: Download fetches the file and clicks a link to it, naming the download for a document and not for an
   *   image (which opens in the browser).
   * Interacts with: the file's Download button; FileService.download; URL.createObjectURL; the created link.
   * Data: one row per file of team Red's and Blue's lists.
   */
  it.each<[string, string, string, string | null]>([
    ['Red', 'doc.txt', 'f1', 'doc.txt'],
    ['Blue', 'image.png', 'f2', null],
  ])('downloads %s team file %s', async (team, name, id, downloadName) => {
    const user = userEvent.setup();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const { container, download } = await renderBrowse();
    await user.click(screen.getByText(team));
    const { anchor, setDownload, click } = makeAnchorStub();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob://x');
    stubAnchorCreation(anchor);
    const item = Array.from(container.querySelectorAll('mat-list-item')).find(
      (i) => i.textContent?.trim() === name,
    )!;
    await user.click(within(item as HTMLElement).getByTitle('Download'));
    expect(download).toHaveBeenCalledExactlyOnceWith(id);
    expect(anchor.getAttribute('href')).toBe('blob://x');
    expect(anchor.getAttribute('target')).toBe('_blank');
    expect(setDownload.mock.calls).toEqual(
      downloadName ? [[downloadName]] : [],
    );
    expect(click).toHaveBeenCalledTimes(1);
  });
});
