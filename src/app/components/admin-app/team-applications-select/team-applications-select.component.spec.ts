// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { of } from 'rxjs';
import {
  Team,
  View,
  Application,
  ApplicationInstance,
  ApplicationTemplate,
} from '../../../generated/player-api';
import { ApplicationService } from '../../../generated/player-api';
import { TeamApplicationsSelectComponent } from './team-applications-select.component';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { renderComponent } from '../../../test-utils/render-component';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { ApiStub } from '../../../test-utils/api-stub';
import { dialogRefStub } from '../../../test-utils/dialog-refs';

const team: Team = { id: 't1', name: 'Red' };
const view: View = { id: 'v1', name: 'Demo View' };

const makeApplication = (
  application: Omit<Application, 'viewId'>,
): Application => ({ viewId: 'v1', ...application });

const appA = makeApplication({ id: 'a1', name: 'App A' });
const appB = makeApplication({ id: 'a2', name: 'App B' });

const instA: ApplicationInstance = {
  id: 'i1',
  applicationId: 'a1',
  displayOrder: 0,
  name: 'App A',
  url: 'https://a.test',
};
const instB: ApplicationInstance = {
  id: 'i2',
  applicationId: 'a2',
  displayOrder: 1,
  name: 'App B',
};

async function renderSelect(
  overrides: {
    team?: Team | null;
    view?: View | null;
    instances?: ApplicationInstance[];
    viewApps?: Application[];
    templates?: ApplicationTemplate[];
    confirmRemove?: boolean;
  } = {},
) {
  const {
    team: t = team,
    view: v = view,
    instances = [instA, instB],
    viewApps = [appA, appB],
    templates = [],
    confirmRemove = true,
  } = overrides;

  const getTeamApplicationInstances = vi.fn(() =>
    of(structuredClone(instances)),
  );
  const getViewApplications = vi.fn(() => of(structuredClone(viewApps)));
  const getApplicationTemplates = vi.fn(() => of(templates));
  const createApplicationInstance = vi.fn(() => of({} as ApplicationInstance));
  const moveUpApplicationInstance = vi.fn(() => of(instances));
  const moveDownApplicationInstance = vi.fn(() => of(instances));
  const deleteApplicationInstance = vi.fn(() => of(undefined));
  const updateApplicationInstance = vi.fn(() => of({} as ApplicationInstance));
  const confirm = vi.fn(
    () => dialogRefStub<unknown, boolean>(confirmRemove).dialogRef,
  );

  const rendered = await renderComponent(TeamApplicationsSelectComponent, {
    imports: [
      MatExpansionModule,
      MatDividerModule,
      MatIconModule,
      MatMenuModule,
      MatButtonModule,
    ],
    declarations: [TeamApplicationsSelectComponent],
    componentProperties: { team: t, view: v },
    providers: [
      {
        provide: ApplicationService,
        useValue: {
          getTeamApplicationInstances,
          getViewApplications,
          getApplicationTemplates,
          createApplicationInstance,
          moveUpApplicationInstance,
          moveDownApplicationInstance,
          deleteApplicationInstance,
          updateApplicationInstance,
        } satisfies ApiStub<ApplicationService>,
      },
      {
        provide: CrucibleDialogService,
        useValue: { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>,
      },
    ],
  });

  return {
    ...rendered,
    getTeamApplicationInstances,
    getViewApplications,
    createApplicationInstance,
    moveUpApplicationInstance,
    moveDownApplicationInstance,
    deleteApplicationInstance,
    updateApplicationInstance,
    confirm,
  };
}

/** Titles of the team's application panels, in render order. */
function appTitles(container: Element): string[] {
  return Array.from(container.querySelectorAll('mat-panel-title')).map(
    (title) => title.textContent?.trim() ?? '',
  );
}

/** The panel of the named application. */
function appPanel(container: Element, name: string): HTMLElement {
  const panel = Array.from(
    container.querySelectorAll<HTMLElement>('mat-expansion-panel'),
  ).find(
    (p) => p.querySelector('mat-panel-title')?.textContent?.trim() === name,
  );
  if (!panel) {
    throw new Error(`No application panel for ${name}`);
  }
  return panel;
}

describe('TeamApplicationsSelectComponent', () => {
  /**
   * Verifies: the team's applications are listed in display order with their URL and flags, and the first cannot move
   *   up nor the last down.
   * Interacts with: ApplicationService.getTeamApplicationInstances; the rendered panels and Move Up / Move Down buttons.
   * Data: App A (order 0) and App B (order 1) on team Red.
   */
  it('lists the team applications with their move limits', async () => {
    const { container, getTeamApplicationInstances } = await renderSelect();
    expect(getTeamApplicationInstances).toHaveBeenCalledExactlyOnceWith('t1');
    expect(appTitles(container)).toEqual(['App A', 'App B']);
    const moveUp = (name: string) =>
      within(appPanel(container, name)).getByTitle(
        'Move Up',
      ) as HTMLButtonElement;
    const moveDown = (name: string) =>
      within(appPanel(container, name)).getByTitle(
        'Move Down',
      ) as HTMLButtonElement;
    expect([moveUp('App A').disabled, moveDown('App A').disabled]).toEqual([
      true,
      false,
    ]);
    expect([moveUp('App B').disabled, moveDown('App B').disabled]).toEqual([
      false,
      true,
    ]);
    expect(
      within(appPanel(container, 'App A')).getByText('https://a.test'),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: in the Add Application menu, a view application without its own name shows its template's name, and
   *   one with neither shows no name.
   * Interacts with: ApplicationService.getViewApplications and getApplicationTemplates; the Add Application menu.
   * Data: team Red has App A; the view adds one application from template Chat and one with no name or template.
   */
  it('names a view application after its template in the menu', async () => {
    const user = userEvent.setup();
    await renderSelect({
      instances: [instA],
      viewApps: [
        appA,
        makeApplication({ id: 'a3', applicationTemplateId: 'tm1' }),
        makeApplication({ id: 'a4' }),
      ],
      templates: [{ id: 'tm1', name: 'Chat' }],
    });
    await user.click(screen.getByText('Add Application'));
    const menu = document.querySelector<HTMLElement>('.mat-mdc-menu-panel')!;
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent?.trim()),
    ).toEqual(['Chat', '']);
  });

  /**
   * Verifies: Add Application offers only the view's applications the team does not have, and adding one creates an
   *   instance at the end of the order and reloads the list.
   * Interacts with: the Add Application menu; ApplicationService.getViewApplications, createApplicationInstance and
   *   getTeamApplicationInstances.
   * Data: team Red has App A; the view has App A and App B; App B added.
   */
  it('adds a view application the team does not have', async () => {
    const user = userEvent.setup();
    const {
      container,
      createApplicationInstance,
      getTeamApplicationInstances,
    } = await renderSelect({ instances: [instA] });
    getTeamApplicationInstances.mockReturnValue(of([instA, instB]));
    await user.click(screen.getByText('Add Application'));
    const menu = document.querySelector<HTMLElement>('.mat-mdc-menu-panel')!;
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent?.trim()),
    ).toEqual(['App B']);
    await user.click(within(menu).getByText('App B'));
    expect(createApplicationInstance).toHaveBeenCalledExactlyOnceWith('t1', {
      teamId: 't1',
      applicationId: 'a2',
      displayOrder: 1,
    });
    expect(appTitles(container)).toEqual(['App A', 'App B']);
  });

  /**
   * Verifies: Add Application is not offered once the team has every view application.
   * Interacts with: ApplicationService.getViewApplications; the rendered toolbar.
   * Data: team Red has App A and App B, the view's only applications.
   */
  it('offers no Add Application when the team has every view application', async () => {
    await renderSelect();
    expect(screen.queryByText('Add Application')).not.toBeInTheDocument();
  });

  /**
   * Verifies: Move Up and Move Down reorder the application and the list follows the order the API returns.
   * Interacts with: the panels' Move Up / Move Down buttons; ApplicationService.moveUpApplicationInstance and
   *   moveDownApplicationInstance.
   * Data: one row per direction; the API returns App B before App A.
   */
  it.each<
    [
      string,
      string,
      'moveUpApplicationInstance' | 'moveDownApplicationInstance',
      string,
    ]
  >([
    ['Move Up', 'App B', 'moveUpApplicationInstance', 'i2'],
    ['Move Down', 'App A', 'moveDownApplicationInstance', 'i1'],
  ])('%s on %s reorders the list', async (button, name, endpoint, id) => {
    const user = userEvent.setup();
    const rendered = await renderSelect();
    rendered[endpoint].mockReturnValue(
      of([
        { ...instB, displayOrder: 0 },
        { ...instA, displayOrder: 1 },
      ]),
    );
    const panel = appPanel(rendered.container, name);
    await user.click(panel.querySelector('mat-expansion-panel-header')!);
    await user.click(within(panel).getByTitle(button));
    expect(rendered[endpoint]).toHaveBeenCalledExactlyOnceWith(id);
    expect(appTitles(rendered.container)).toEqual(['App B', 'App A']);
  });

  /**
   * Verifies: a confirmed Remove Application deletes the instance, renumbers the ones after it, and reloads; a declined
   *   one does nothing.
   * Interacts with: the panel's Remove Application button; CrucibleDialogService.confirm;
   *   ApplicationService.deleteApplicationInstance, updateApplicationInstance and getTeamApplicationInstances.
   * Data: one row per answer; App A removed from Red, so App B moves from order 1 to 0.
   */
  it.each<[string, boolean, string[]]>([
    [
      'removes the application and renumbers the rest when confirmed',
      true,
      ['App B'],
    ],
    ['keeps the application when declined', false, ['App A', 'App B']],
  ])('%s', async (_case, confirmRemove, remaining) => {
    const user = userEvent.setup();
    const r = await renderSelect({ confirmRemove });
    r.getTeamApplicationInstances.mockReturnValue(
      of([{ ...instB, displayOrder: 0 }]),
    );
    const panel = appPanel(r.container, 'App A');
    await user.click(panel.querySelector('mat-expansion-panel-header')!);
    await user.click(within(panel).getByText('Remove Application'));
    expect(r.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'Are you sure that you want to remove application App A from team Red?',
      }),
    );
    expect(r.deleteApplicationInstance).toHaveBeenCalledTimes(
      confirmRemove ? 1 : 0,
    );
    expect(r.updateApplicationInstance.mock.calls).toEqual(
      confirmRemove
        ? [['i2', { teamId: 't1', applicationId: 'a2', displayOrder: 0 }]]
        : [],
    );
    expect(appTitles(r.container)).toEqual(remaining);
  });

  /**
   * Verifies: without a team the select logs, requests nothing and lists nothing.
   * Interacts with: ngOnInit's team guard; console.log; ApplicationService.getTeamApplicationInstances.
   * Data: team null.
   */
  it('requests nothing without a team', async () => {
    const logged = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { container, getTeamApplicationInstances } = await renderSelect({
      team: null,
    });
    expect(getTeamApplicationInstances).not.toHaveBeenCalled();
    expect(appTitles(container)).toEqual([]);
    expect(logged).toHaveBeenCalledTimes(1);
  });
});
