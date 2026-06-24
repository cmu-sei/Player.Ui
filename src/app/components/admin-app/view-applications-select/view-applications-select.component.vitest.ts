// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {
  View,
  Application,
  ApplicationTemplate,
} from '../../../generated/player-api';
import { ApplicationService } from '../../../generated/player-api';
import { DialogService } from '../../../services/dialog/dialog.service';
import {
  AppErrorStateMatcher,
  ViewApplicationsSelectComponent,
} from './view-applications-select.component';
import { renderComponent } from '../../../test-utils/render-component';

const view: View = { id: 'v1', name: 'Demo' };
const appA: Application = {
  id: 'a1',
  name: 'Alpha',
  url: 'https://a.test',
  icon: 'icon-a.png',
};

async function renderSelect(
  overrides: {
    view?: View | null;
    apps?: Application[];
    templates?: ApplicationTemplate[];
    confirmDelete?: boolean;
  } = {},
) {
  const {
    view: v = view,
    apps = [appA],
    templates = [],
    confirmDelete = true,
  } = overrides;

  const getViewApplications = vi.fn(() => of(apps));
  const getApplicationTemplates = vi.fn(() => of(templates));
  const getApplication = vi.fn((id: string) =>
    of({ ...apps.find((a) => a.id === id) } as Application),
  );
  const updateApplication = vi.fn(() => of({} as Application));
  const deleteApplication = vi.fn(() => of(undefined));
  const confirm = vi.fn(() => of({ confirm: confirmDelete }));

  const rendered = await renderComponent(
    ViewApplicationsSelectComponent,
    {
      declarations: [ViewApplicationsSelectComponent],
      imports: [MatSelectModule, MatCheckboxModule, MatSlideToggleModule],
      schemas: [NO_ERRORS_SCHEMA],
      componentProperties: { view: v },
      providers: [
        {
          provide: ApplicationService,
          useValue: {
            getViewApplications,
            getApplicationTemplates,
            getApplication,
            updateApplication,
            deleteApplication,
          },
        },
        { provide: DialogService, useValue: { confirm } },
      ],
    },
  );

  return {
    ...rendered,
    getViewApplications,
    getApplication,
    updateApplication,
    deleteApplication,
    confirm,
  };
}

describe('ViewApplicationsSelectComponent', () => {
  it('creates the component', async () => {
    const { fixture } = await renderSelect();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads view applications and templates on init when view is provided', async () => {
    const { fixture, getViewApplications } = await renderSelect();
    expect(getViewApplications).toHaveBeenCalledWith('v1');
    expect(fixture.componentInstance.applications).toEqual([appA]);
    expect(fixture.componentInstance.isLoading).toBe(false);
  });

  it('is a no-op on init when view is missing', async () => {
    const { fixture, getViewApplications } = await renderSelect({ view: null });
    expect(getViewApplications).not.toHaveBeenCalled();
    expect(fixture.componentInstance.applications).toBeUndefined();
  });

  it('saveApplicationName coerces empty string to null and persists', async () => {
    const { fixture, updateApplication } = await renderSelect();
    fixture.componentInstance.saveApplicationName('', 'a1');
    expect(updateApplication).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ name: null }),
    );
  });

  it('saveApplicationUrl coerces empty string to null and persists', async () => {
    const { fixture, updateApplication } = await renderSelect();
    fixture.componentInstance.saveApplicationUrl('', 'a1');
    expect(updateApplication).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ url: null }),
    );
  });

  it('saveApplicationIcon coerces empty string to null and persists', async () => {
    const { fixture, updateApplication } = await renderSelect();
    fixture.componentInstance.saveApplicationIcon('', 'a1');
    expect(updateApplication).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ icon: null }),
    );
  });

  it('saveApplicationEmbeddable persists the application directly', async () => {
    const { fixture, updateApplication } = await renderSelect();
    fixture.componentInstance.saveApplicationEmbeddable({ ...appA, embeddable: true });
    expect(updateApplication).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ embeddable: true }),
    );
  });

  it('deleteViewApplication only deletes after confirm', async () => {
    const { fixture, deleteApplication } = await renderSelect({
      confirmDelete: true,
    });
    fixture.componentInstance.deleteViewApplication(appA);
    expect(deleteApplication).toHaveBeenCalledWith('a1');
  });

  it('deleteViewApplication is a no-op when confirm returns false', async () => {
    const { fixture, deleteApplication } = await renderSelect({
      confirmDelete: false,
    });
    fixture.componentInstance.deleteViewApplication(appA);
    expect(deleteApplication).not.toHaveBeenCalled();
  });

  it('getAppName returns the app name when set', async () => {
    const { fixture } = await renderSelect();
    expect(fixture.componentInstance.getAppName({ id: 'x', name: 'N' })).toBe(
      'N',
    );
  });

  it('getAppName falls back to template name', async () => {
    const template: ApplicationTemplate = { id: 'tmpl-1', name: 'Templ' };
    const { fixture } = await renderSelect({ templates: [template] });
    expect(
      fixture.componentInstance.getAppName({
        id: 'x',
        applicationTemplateId: 'tmpl-1',
      }),
    ).toBe('Templ');
  });

  it('getAppName returns "Application" when no name or template', async () => {
    const { fixture } = await renderSelect();
    expect(fixture.componentInstance.getAppName({ id: 'x' })).toBe(
      'Application',
    );
  });

  it('getAppIcon returns the app icon when set', async () => {
    const { fixture } = await renderSelect();
    expect(
      fixture.componentInstance.getAppIcon({ id: 'x', icon: 'i.png' }),
    ).toBe('i.png');
  });

  it('getAppIcon falls back to template icon', async () => {
    const template: ApplicationTemplate = {
      id: 'tmpl-1',
      name: 'Templ',
      icon: 'tmpl.png',
    };
    const { fixture } = await renderSelect({ templates: [template] });
    expect(
      fixture.componentInstance.getAppIcon({
        id: 'x',
        applicationTemplateId: 'tmpl-1',
      }),
    ).toBe('tmpl.png');
  });

  it('getAppIcon returns the default dashboard image when nothing is set', async () => {
    const { fixture } = await renderSelect();
    expect(fixture.componentInstance.getAppIcon({ id: 'x' })).toBe(
      'assets/img/SP_Icon_Dashboard.png',
    );
  });

  it('saveApplicationLoadInBackground persists the application', async () => {
    const { fixture, updateApplication } = await renderSelect();
    fixture.componentInstance.saveApplicationLoadInBackground({
      ...appA,
      loadInBackground: true,
    });
    expect(updateApplication).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ loadInBackground: true }),
    );
  });

  it('saveApplicationTemplateId persists the application', async () => {
    const { fixture, updateApplication } = await renderSelect();
    fixture.componentInstance.saveApplicationTemplateId({
      ...appA,
      applicationTemplateId: 'tmpl-1',
    });
    expect(updateApplication).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ applicationTemplateId: 'tmpl-1' }),
    );
  });

  describe('getTemplate()', () => {
    it('returns the matching template by id', async () => {
      const template: ApplicationTemplate = { id: 'tmpl-1', name: 'Templ' };
      const { fixture } = await renderSelect({ templates: [template] });
      expect(fixture.componentInstance.getTemplate('tmpl-1')).toEqual(template);
    });

    it('returns undefined when no template matches', async () => {
      const { fixture } = await renderSelect({
        templates: [{ id: 'tmpl-1', name: 'Templ' }],
      });
      expect(fixture.componentInstance.getTemplate('missing')).toBeUndefined();
    });
  });

  describe('AppErrorStateMatcher', () => {
    const matcher = new AppErrorStateMatcher();

    it('is an error when the control is invalid and dirty', () => {
      const control = { invalid: true, dirty: true } as never;
      expect(matcher.isErrorState(control, null)).toBe(true);
    });

    it('is an error when the control is invalid and the form is submitted', () => {
      const control = { invalid: true, dirty: false } as never;
      const form = { submitted: true } as never;
      expect(matcher.isErrorState(control, form)).toBe(true);
    });

    it('is not an error when the control is valid', () => {
      const control = { invalid: false, dirty: true } as never;
      expect(matcher.isErrorState(control, null)).toBe(false);
    });

    it('is not an error for a null control', () => {
      expect(matcher.isErrorState(null, null)).toBe(false);
    });
  });
});
