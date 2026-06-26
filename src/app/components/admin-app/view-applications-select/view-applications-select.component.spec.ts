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
  /**
   * Verifies: the view-applications select component instantiates successfully.
   * Interacts with: renderComponent with a stubbed ApplicationService and DialogService.
   * Data: default view 'v1' with a single app (appA).
   */
  it('creates the component', async () => {
    const { fixture } = await renderSelect();
    expect(fixture.componentInstance).toBeTruthy();
  });

  /**
   * Verifies: ngOnInit fetches the view's applications, stores them, and clears isLoading.
   * Interacts with: stubbed ApplicationService.getViewApplications.
   * Data: default view 'v1'; apps [appA].
   */
  it('loads view applications and templates on init when view is provided', async () => {
    const { fixture, getViewApplications } = await renderSelect();
    expect(getViewApplications).toHaveBeenCalledWith('v1');
    expect(fixture.componentInstance.applications).toEqual([appA]);
    expect(fixture.componentInstance.isLoading).toBe(false);
  });

  /**
   * Verifies: without a view, ngOnInit skips the fetch and leaves applications undefined.
   * Interacts with: stubbed ApplicationService.getViewApplications.
   * Data: view override null.
   */
  it('is a no-op on init when view is missing', async () => {
    const { fixture, getViewApplications } = await renderSelect({ view: null });
    expect(getViewApplications).not.toHaveBeenCalled();
    expect(fixture.componentInstance.applications).toBeUndefined();
  });

  /**
   * Verifies: saveApplicationName converts an empty string to null before persisting via updateApplication.
   * Interacts with: stubbed ApplicationService.updateApplication.
   * Data: empty name for app 'a1'.
   */
  it('saveApplicationName coerces empty string to null and persists', async () => {
    const { fixture, updateApplication } = await renderSelect();
    fixture.componentInstance.saveApplicationName('', 'a1');
    expect(updateApplication).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ name: null }),
    );
  });

  /**
   * Verifies: saveApplicationUrl converts an empty string to null before persisting.
   * Interacts with: stubbed ApplicationService.updateApplication.
   * Data: empty url for app 'a1'.
   */
  it('saveApplicationUrl coerces empty string to null and persists', async () => {
    const { fixture, updateApplication } = await renderSelect();
    fixture.componentInstance.saveApplicationUrl('', 'a1');
    expect(updateApplication).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ url: null }),
    );
  });

  /**
   * Verifies: saveApplicationIcon converts an empty string to null before persisting.
   * Interacts with: stubbed ApplicationService.updateApplication.
   * Data: empty icon for app 'a1'.
   */
  it('saveApplicationIcon coerces empty string to null and persists', async () => {
    const { fixture, updateApplication } = await renderSelect();
    fixture.componentInstance.saveApplicationIcon('', 'a1');
    expect(updateApplication).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ icon: null }),
    );
  });

  /**
   * Verifies: saveApplicationEmbeddable persists the application as-is (no coercion).
   * Interacts with: stubbed ApplicationService.updateApplication.
   * Data: appA with embeddable=true.
   */
  it('saveApplicationEmbeddable persists the application directly', async () => {
    const { fixture, updateApplication } = await renderSelect();
    fixture.componentInstance.saveApplicationEmbeddable({ ...appA, embeddable: true });
    expect(updateApplication).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ embeddable: true }),
    );
  });

  /**
   * Verifies: deleteViewApplication deletes the app once the user confirms.
   * Interacts with: stubbed DialogService.confirm and ApplicationService.deleteApplication.
   * Data: confirmDelete=true; appA (id 'a1').
   */
  it('deleteViewApplication only deletes after confirm', async () => {
    const { fixture, deleteApplication } = await renderSelect({
      confirmDelete: true,
    });
    fixture.componentInstance.deleteViewApplication(appA);
    expect(deleteApplication).toHaveBeenCalledWith('a1');
  });

  /**
   * Verifies: a declined confirm leaves deleteApplication uncalled.
   * Interacts with: stubbed DialogService.confirm and ApplicationService.deleteApplication.
   * Data: confirmDelete=false.
   */
  it('deleteViewApplication is a no-op when confirm returns false', async () => {
    const { fixture, deleteApplication } = await renderSelect({
      confirmDelete: false,
    });
    fixture.componentInstance.deleteViewApplication(appA);
    expect(deleteApplication).not.toHaveBeenCalled();
  });

  /**
   * Verifies: getAppName returns the app's own name when present.
   * Interacts with: component.getAppName (pure method).
   * Data: app { name: 'N' }.
   */
  it('getAppName returns the app name when set', async () => {
    const { fixture } = await renderSelect();
    expect(fixture.componentInstance.getAppName({ id: 'x', name: 'N' })).toBe(
      'N',
    );
  });

  /**
   * Verifies: getAppName resolves to the matching template's name when the app has none.
   * Interacts with: component.getAppName against loaded templates.
   * Data: app with applicationTemplateId 'tmpl-1'; template named 'Templ'.
   */
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

  /**
   * Verifies: getAppName falls back to the literal 'Application' when no name or template resolves.
   * Interacts with: component.getAppName (no templates).
   * Data: app { id: 'x' } only.
   */
  it('getAppName returns "Application" when no name or template', async () => {
    const { fixture } = await renderSelect();
    expect(fixture.componentInstance.getAppName({ id: 'x' })).toBe(
      'Application',
    );
  });

  /**
   * Verifies: getAppIcon returns the app's own icon when present.
   * Interacts with: component.getAppIcon (pure method).
   * Data: app { icon: 'i.png' }.
   */
  it('getAppIcon returns the app icon when set', async () => {
    const { fixture } = await renderSelect();
    expect(
      fixture.componentInstance.getAppIcon({ id: 'x', icon: 'i.png' }),
    ).toBe('i.png');
  });

  /**
   * Verifies: getAppIcon resolves to the matching template's icon when the app has none.
   * Interacts with: component.getAppIcon against loaded templates.
   * Data: app with applicationTemplateId 'tmpl-1'; template icon 'tmpl.png'.
   */
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

  /**
   * Verifies: getAppIcon falls back to the default dashboard asset when neither app nor template supplies an icon.
   * Interacts with: component.getAppIcon (no templates).
   * Data: app { id: 'x' } only.
   */
  it('getAppIcon returns the default dashboard image when nothing is set', async () => {
    const { fixture } = await renderSelect();
    expect(fixture.componentInstance.getAppIcon({ id: 'x' })).toBe(
      'assets/img/SP_Icon_Dashboard.png',
    );
  });

  /**
   * Verifies: saveApplicationLoadInBackground persists the application carrying its loadInBackground flag.
   * Interacts with: stubbed ApplicationService.updateApplication.
   * Data: appA with loadInBackground=true.
   */
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

  /**
   * Verifies: saveApplicationTemplateId persists the application carrying its applicationTemplateId.
   * Interacts with: stubbed ApplicationService.updateApplication.
   * Data: appA with applicationTemplateId 'tmpl-1'.
   */
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
    /**
     * Verifies: getTemplate returns the template whose id matches.
     * Interacts with: component.getTemplate against loaded templates.
     * Data: single template 'tmpl-1'; looked up by 'tmpl-1'.
     */
    it('returns the matching template by id', async () => {
      const template: ApplicationTemplate = { id: 'tmpl-1', name: 'Templ' };
      const { fixture } = await renderSelect({ templates: [template] });
      expect(fixture.componentInstance.getTemplate('tmpl-1')).toEqual(template);
    });

    /**
     * Verifies: getTemplate returns undefined when no template id matches.
     * Interacts with: component.getTemplate against loaded templates.
     * Data: template 'tmpl-1'; looked up by 'missing'.
     */
    it('returns undefined when no template matches', async () => {
      const { fixture } = await renderSelect({
        templates: [{ id: 'tmpl-1', name: 'Templ' }],
      });
      expect(fixture.componentInstance.getTemplate('missing')).toBeUndefined();
    });
  });

  describe('AppErrorStateMatcher', () => {
    const matcher = new AppErrorStateMatcher();

    /**
     * Verifies: a dirty invalid control is an error state.
     * Interacts with: AppErrorStateMatcher.isErrorState (pure).
     * Data: control { invalid: true, dirty: true }, no form.
     */
    it('is an error when the control is invalid and dirty', () => {
      const control = { invalid: true, dirty: true } as never;
      expect(matcher.isErrorState(control, null)).toBe(true);
    });

    /**
     * Verifies: an invalid control on a submitted form is an error state even if pristine.
     * Interacts with: AppErrorStateMatcher.isErrorState (pure).
     * Data: control { invalid: true, dirty: false }, form { submitted: true }.
     */
    it('is an error when the control is invalid and the form is submitted', () => {
      const control = { invalid: true, dirty: false } as never;
      const form = { submitted: true } as never;
      expect(matcher.isErrorState(control, form)).toBe(true);
    });

    /**
     * Verifies: a valid control is not an error state.
     * Interacts with: AppErrorStateMatcher.isErrorState (pure).
     * Data: control { invalid: false, dirty: true }, no form.
     */
    it('is not an error when the control is valid', () => {
      const control = { invalid: false, dirty: true } as never;
      expect(matcher.isErrorState(control, null)).toBe(false);
    });

    /**
     * Verifies: a null control yields no error state (no NPE).
     * Interacts with: AppErrorStateMatcher.isErrorState (pure).
     * Data: null control and null form.
     */
    it('is not an error for a null control', () => {
      expect(matcher.isErrorState(null, null)).toBe(false);
    });
  });
});
