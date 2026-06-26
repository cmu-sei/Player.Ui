// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import {
  Team,
  View,
  Application,
  ApplicationInstance,
  ApplicationTemplate,
} from '../../../generated/player-api';
import { ApplicationService } from '../../../generated/player-api';
import { DialogService } from '../../../services/dialog/dialog.service';
import {
  ObjectType,
  TeamApplicationsSelectComponent,
} from './team-applications-select.component';
import { renderComponent } from '../../../test-utils/render-component';

const team: Team = { id: 't1', name: 'Red' };
const view: View = { id: 'v1', name: 'Demo View' };

const appA: Application = { id: 'a1', name: 'App A' };
const appB: Application = { id: 'a2', name: 'App B' };

const instA: ApplicationInstance = {
  id: 'i1',
  teamId: 't1',
  applicationId: 'a1',
  displayOrder: 0,
  name: 'App A',
};
const instB: ApplicationInstance = {
  id: 'i2',
  teamId: 't1',
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

  const getTeamApplicationInstances = vi.fn(() => of(instances));
  const getViewApplications = vi.fn(() => of(viewApps));
  const getApplicationTemplates = vi.fn(() => of(templates));
  const createApplicationInstance = vi.fn(() => of({} as ApplicationInstance));
  const moveUpApplicationInstance = vi.fn(() => of(instances));
  const moveDownApplicationInstance = vi.fn(() => of(instances));
  const deleteApplicationInstance = vi.fn(() => of(undefined));
  const updateApplicationInstance = vi.fn(() => of({} as ApplicationInstance));
  const confirm = vi.fn(() => of({ confirm: confirmRemove }));

  const rendered = await renderComponent(
    TeamApplicationsSelectComponent,
    {
      declarations: [TeamApplicationsSelectComponent],
      schemas: [NO_ERRORS_SCHEMA],
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
          },
        },
        { provide: DialogService, useValue: { confirm } },
      ],
    },
  );

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

describe('TeamApplicationsSelectComponent', () => {
  /**
   * Verifies: the team-applications select component instantiates successfully.
   * Interacts with: renderComponent with a stubbed ApplicationService and DialogService.
   * Data: default team/view and two app instances (instA, instB).
   */
  it('creates the component', async () => {
    const { fixture } = await renderSelect();
    expect(fixture.componentInstance).toBeTruthy();
  });

  /**
   * Verifies: ngOnInit sets subjectType=Team and loads the team's application instances.
   * Interacts with: stubbed ApplicationService.getTeamApplicationInstances.
   * Data: default team 't1'; instances [instA, instB].
   */
  it('ngOnInit sets subjectType to Team and loads instances when team is provided', async () => {
    const { fixture, getTeamApplicationInstances } = await renderSelect();
    expect(fixture.componentInstance.subjectType).toBe(ObjectType.Team);
    expect(getTeamApplicationInstances).toHaveBeenCalledWith('t1');
    expect(fixture.componentInstance.applications).toEqual([instA, instB]);
  });

  /**
   * Verifies: without a team the subjectType remains Unknown (no Team setup).
   * Interacts with: ngOnInit reading the team input.
   * Data: team override null.
   */
  it('ngOnInit stays Unknown when no team is provided', async () => {
    const { fixture } = await renderSelect({ team: null });
    expect(fixture.componentInstance.subjectType).toBe(ObjectType.Unknown);
  });

  /**
   * Verifies: the available-view-apps list excludes apps the team already has instances of.
   * Interacts with: getViewApplications vs the loaded instances.
   * Data: viewApps [appA, appB, appC] with team already using appA/appB — only appC remains.
   */
  it('refreshViewAppsAvailable only keeps view apps not already used by the team', async () => {
    const { fixture } = await renderSelect({
      viewApps: [appA, appB, { id: 'a3', name: 'App C' }],
    });
    expect(fixture.componentInstance.viewApplications).toEqual([
      { id: 'a3', name: 'App C' },
    ]);
  });

  /**
   * Verifies: addViewAppToTeam creates an instance with displayOrder = current count and reloads instances.
   * Interacts with: stubbed ApplicationService.createApplicationInstance and getTeamApplicationInstances.
   * Data: two existing instances, so adding appA uses displayOrder 2.
   */
  it('addViewAppToTeam creates an instance with the next displayOrder and reloads', async () => {
    const { fixture, createApplicationInstance, getTeamApplicationInstances } =
      await renderSelect();
    createApplicationInstance.mockClear();
    getTeamApplicationInstances.mockClear();
    fixture.componentInstance.addViewAppToTeam(appA);
    expect(createApplicationInstance).toHaveBeenCalledWith('t1', {
      teamId: 't1',
      applicationId: 'a1',
      displayOrder: 2, // 2 instances already present
    });
    expect(getTeamApplicationInstances).toHaveBeenCalled();
  });

  /**
   * Verifies: moveAppUp calls moveUpApplicationInstance and replaces applications with the returned ordering.
   * Interacts with: stubbed ApplicationService.moveUpApplicationInstance.
   * Data: instance id 'i2'; service returns reordered list [instB, instA].
   */
  it('moveAppUp calls moveUpApplicationInstance and stores the new list', async () => {
    const newList: ApplicationInstance[] = [instB, instA];
    const { fixture, moveUpApplicationInstance } = await renderSelect();
    moveUpApplicationInstance.mockReturnValueOnce(of(newList));
    fixture.componentInstance.moveAppUp('i2');
    expect(moveUpApplicationInstance).toHaveBeenCalledWith('i2');
    expect(fixture.componentInstance.applications).toEqual(newList);
  });

  /**
   * Verifies: moveAppDown delegates to moveDownApplicationInstance with the instance id.
   * Interacts with: stubbed ApplicationService.moveDownApplicationInstance.
   * Data: instance id 'i1'.
   */
  it('moveAppDown calls moveDownApplicationInstance', async () => {
    const { fixture, moveDownApplicationInstance } = await renderSelect();
    fixture.componentInstance.moveAppDown('i1');
    expect(moveDownApplicationInstance).toHaveBeenCalledWith('i1');
  });

  /**
   * Verifies: removeApplicationInstanceFromTeam deletes the instance once the user confirms.
   * Interacts with: stubbed DialogService.confirm and ApplicationService.deleteApplicationInstance.
   * Data: confirmRemove=true; instA (id 'i1').
   */
  it('removeApplicationInstanceFromTeam only deletes after confirm', async () => {
    const { fixture, deleteApplicationInstance } = await renderSelect({
      confirmRemove: true,
    });
    fixture.componentInstance.removeApplicationInstanceFromTeam(instA);
    expect(deleteApplicationInstance).toHaveBeenCalledWith('i1');
  });

  /**
   * Verifies: a declined confirm leaves deleteApplicationInstance uncalled.
   * Interacts with: stubbed DialogService.confirm and ApplicationService.deleteApplicationInstance.
   * Data: confirmRemove=false.
   */
  it('removeApplicationInstanceFromTeam is a no-op when confirm returns false', async () => {
    const { fixture, deleteApplicationInstance } = await renderSelect({
      confirmRemove: false,
    });
    fixture.componentInstance.removeApplicationInstanceFromTeam(instA);
    expect(deleteApplicationInstance).not.toHaveBeenCalled();
  });

  /**
   * Verifies: getAppName returns the app's own name when present.
   * Interacts with: component.getAppName (pure method).
   * Data: app { name: 'Named' }.
   */
  it('getAppName returns the app.name when set', async () => {
    const { fixture } = await renderSelect();
    expect(
      fixture.componentInstance.getAppName({ id: 'x', name: 'Named' }),
    ).toBe('Named');
  });

  /**
   * Verifies: getAppName falls back to the matching template's name when the app has no name.
   * Interacts with: component.getAppName resolving against loaded templates.
   * Data: app with applicationTemplateId 'tmpl-1'; template named 'From Template'.
   */
  it('getAppName falls back to template name via applicationTemplateId', async () => {
    const template: ApplicationTemplate = { id: 'tmpl-1', name: 'From Template' };
    const { fixture } = await renderSelect({ templates: [template] });
    expect(
      fixture.componentInstance.getAppName({
        id: 'x',
        applicationTemplateId: 'tmpl-1',
      }),
    ).toBe('From Template');
  });

  /**
   * Verifies: getAppName returns null when neither a name nor a resolvable template is available.
   * Interacts with: component.getAppName (no templates loaded).
   * Data: app { id: 'x' } only.
   */
  it('getAppName returns null when neither name nor known template id is present', async () => {
    const { fixture } = await renderSelect();
    expect(fixture.componentInstance.getAppName({ id: 'x' })).toBeNull();
  });
});
