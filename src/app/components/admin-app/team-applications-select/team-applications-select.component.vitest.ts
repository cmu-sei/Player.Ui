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
  it('creates the component', async () => {
    const { fixture } = await renderSelect();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('ngOnInit sets subjectType to Team and loads instances when team is provided', async () => {
    const { fixture, getTeamApplicationInstances } = await renderSelect();
    expect(fixture.componentInstance.subjectType).toBe(ObjectType.Team);
    expect(getTeamApplicationInstances).toHaveBeenCalledWith('t1');
    expect(fixture.componentInstance.applications).toEqual([instA, instB]);
  });

  it('ngOnInit stays Unknown when no team is provided', async () => {
    const { fixture } = await renderSelect({ team: null });
    expect(fixture.componentInstance.subjectType).toBe(ObjectType.Unknown);
  });

  it('refreshViewAppsAvailable only keeps view apps not already used by the team', async () => {
    const { fixture } = await renderSelect({
      viewApps: [appA, appB, { id: 'a3', name: 'App C' }],
    });
    expect(fixture.componentInstance.viewApplications).toEqual([
      { id: 'a3', name: 'App C' },
    ]);
  });

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

  it('moveAppUp calls moveUpApplicationInstance and stores the new list', async () => {
    const newList: ApplicationInstance[] = [instB, instA];
    const { fixture, moveUpApplicationInstance } = await renderSelect();
    moveUpApplicationInstance.mockReturnValueOnce(of(newList));
    fixture.componentInstance.moveAppUp('i2');
    expect(moveUpApplicationInstance).toHaveBeenCalledWith('i2');
    expect(fixture.componentInstance.applications).toEqual(newList);
  });

  it('moveAppDown calls moveDownApplicationInstance', async () => {
    const { fixture, moveDownApplicationInstance } = await renderSelect();
    fixture.componentInstance.moveAppDown('i1');
    expect(moveDownApplicationInstance).toHaveBeenCalledWith('i1');
  });

  it('removeApplicationInstanceFromTeam only deletes after confirm', async () => {
    const { fixture, deleteApplicationInstance } = await renderSelect({
      confirmRemove: true,
    });
    fixture.componentInstance.removeApplicationInstanceFromTeam(instA);
    expect(deleteApplicationInstance).toHaveBeenCalledWith('i1');
  });

  it('removeApplicationInstanceFromTeam is a no-op when confirm returns false', async () => {
    const { fixture, deleteApplicationInstance } = await renderSelect({
      confirmRemove: false,
    });
    fixture.componentInstance.removeApplicationInstanceFromTeam(instA);
    expect(deleteApplicationInstance).not.toHaveBeenCalled();
  });

  it('getAppName returns the app.name when set', async () => {
    const { fixture } = await renderSelect();
    expect(
      fixture.componentInstance.getAppName({ id: 'x', name: 'Named' }),
    ).toBe('Named');
  });

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

  it('getAppName returns null when neither name nor known template id is present', async () => {
    const { fixture } = await renderSelect();
    expect(fixture.componentInstance.getAppName({ id: 'x' })).toBeNull();
  });
});
