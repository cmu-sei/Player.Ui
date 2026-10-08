// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import {
  FormGroup,
  FormGroupDirective,
  UntypedFormControl,
  Validators,
} from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  View,
  Application,
  ApplicationTemplate,
} from '../../../generated/player-api';
import { ApplicationService } from '../../../generated/player-api';
import {
  AppErrorStateMatcher,
  ViewApplicationsSelectComponent,
} from './view-applications-select.component';
import { renderComponent } from '../../../test-utils/render-component';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { ApiStub } from '../../../test-utils/api-stub';
import { dialogRefStub } from '../../../test-utils/dialog-refs';
import {
  captureUnhandledRxErrors,
  flush,
} from '../../../test-utils/unhandled-rx-errors';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ComponentFixture } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSelectHarness } from '@angular/material/select/testing';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';

const view: View = { id: 'v1', name: 'Demo' };
const makeApplication = (
  application: Omit<Application, 'viewId'>,
): Application => ({ viewId: 'v1', ...application });

const appA = makeApplication({
  id: 'a1',
  name: 'Alpha',
  url: 'https://a.test',
  icon: 'icon-a.png',
});

async function renderSelect(
  overrides: {
    view?: View | null;
    apps?: Application[];
    templates?: ApplicationTemplate[];
    confirmDelete?: boolean;
    appsError?: Error;
  } = {},
) {
  const {
    view: v = view,
    apps = [appA],
    templates = [],
    confirmDelete = true,
    appsError,
  } = overrides;

  const getViewApplications = vi.fn(() =>
    appsError ? throwError(() => appsError) : of(structuredClone(apps)),
  );
  const getApplicationTemplates = vi.fn(() => of(templates));
  const getApplication = vi.fn((id: string) =>
    of({ ...apps.find((a) => a.id === id) } as Application),
  );
  const updateApplication = vi.fn(() => of({} as Application));
  const deleteApplication = vi.fn(() => of(undefined));
  const confirm = vi.fn(
    () => dialogRefStub<unknown, boolean>(confirmDelete).dialogRef,
  );

  const rendered = await renderComponent(ViewApplicationsSelectComponent, {
    declarations: [ViewApplicationsSelectComponent],
    imports: [
      MatExpansionModule,
      MatCardModule,
      MatFormFieldModule,
      MatProgressSpinnerModule,
      MatInputModule,
      MatButtonModule,
      MatSelectModule,
    ],
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
    getViewApplications,
    getApplication,
    updateApplication,
    deleteApplication,
    confirm,
  };
}

/** Titles of the rendered application panels, in render order. */
function appTitles(container: Element): string[] {
  return Array.from(container.querySelectorAll('mat-panel-title')).map(
    (title) => title.textContent?.trim() ?? '',
  );
}

/** Opens the application panel at the index, as the user does. */
async function openPanel(
  r: Awaited<ReturnType<typeof renderSelect>>,
  index = 0,
) {
  const user = userEvent.setup();
  await user.click(
    r.container.querySelectorAll('mat-expansion-panel-header')[index],
  );
  return user;
}

/** The select of the form field with the label, inside the opened panel. */
async function selectOf(
  fixture: ComponentFixture<ViewApplicationsSelectComponent>,
  label: string,
) {
  const field = await TestbedHarnessEnvironment.loader(fixture).getHarness(
    MatFormFieldHarness.with({ floatingLabelText: label }),
  );
  return (await field.getControl(MatSelectHarness))!;
}

describe('ViewApplicationsSelectComponent', () => {
  /**
   * Verifies: a failed applications request leaves the loading spinner up and lets the error escape (current behavior).
   * Interacts with: ApplicationService.getViewApplications (throws); the rendered spinner; captureUnhandledRxErrors.
   * Data: getViewApplications fails with a 500 for view v1.
   */
  it('leaves the spinner up when the applications request fails', async () => {
    const errors = captureUnhandledRxErrors();
    const failure = new Error('500');
    await renderSelect({ appsError: failure });
    await flush();
    // Current behavior; see agent-docs/ui-test-bugs/player.ui.md.
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(errors).toEqual([failure]);
  });

  /**
   * Verifies: the view's applications are listed with their name and icon, falling back to the template's, then to
   *   "Application" and the dashboard icon; the spinner is gone.
   * Interacts with: ApplicationService.getViewApplications and getApplicationTemplates; the panel titles and icons.
   * Data: one app with its own name and icon, one from template Chat, one with no name or template, one whose
   *   template is missing.
   */
  it('lists the applications with their names and icons', async () => {
    const chat: ApplicationTemplate = {
      id: 'tm1',
      name: 'Chat',
      icon: 'chat.png',
    };
    const { container, getViewApplications } = await renderSelect({
      apps: [
        appA,
        makeApplication({ id: 'a2', applicationTemplateId: 'tm1' }),
        makeApplication({ id: 'a3' }),
        makeApplication({ id: 'a4', applicationTemplateId: 'gone' }),
      ],
      templates: [chat],
    });
    expect(getViewApplications).toHaveBeenCalledExactlyOnceWith('v1');
    expect(appTitles(container)).toEqual([
      'Alpha',
      'Chat',
      'Application',
      'Application',
    ]);
    expect(
      Array.from(container.querySelectorAll('img.app-icon')).map((img) =>
        img.getAttribute('src'),
      ),
    ).toEqual([
      'icon-a.png',
      'chat.png',
      'assets/img/SP_Icon_Dashboard.png',
      'assets/img/SP_Icon_Dashboard.png',
    ]);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  /**
   * Verifies: without a view the select logs, requests nothing and lists nothing.
   * Interacts with: ngOnInit's view guard; console.log; ApplicationService.getViewApplications.
   * Data: view null.
   */
  it('requests nothing without a view', async () => {
    const logged = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { container, getViewApplications } = await renderSelect({
      view: null,
    });
    expect(getViewApplications).not.toHaveBeenCalled();
    expect(appTitles(container)).toEqual([]);
    expect(logged).toHaveBeenCalledTimes(1);
  });

  /**
   * Verifies: changing a text field of an application saves the application with the new value, and an emptied field
   *   saves null.
   * Interacts with: the opened panel's field (change on blur); ApplicationService.getApplication and updateApplication.
   * Data: one row per field and value; Alpha (a1).
   */
  it.each<[string, keyof Application, string, string | null]>([
    ['Application Name', 'name', 'Renamed', 'Renamed'],
    ['Application URL', 'url', 'https://b.test', 'https://b.test'],
    ['Icon Path', 'icon', 'icon-b.png', 'icon-b.png'],
    ['Application Name', 'name', '', null],
    ['Application URL', 'url', '', null],
    ['Icon Path', 'icon', '', null],
  ])('saves %s set to "%s" as %s', async (label, field, typed, saved) => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const r = await renderSelect();
    const user = await openPanel(r);
    const input = screen.getByLabelText(label);
    await user.clear(input);
    if (typed) {
      await user.type(input, typed, { skipClick: true });
    }
    await user.tab();
    expect(r.getApplication).toHaveBeenCalledExactlyOnceWith('a1');
    expect(r.updateApplication).toHaveBeenCalledExactlyOnceWith('a1', {
      ...appA,
      [field]: saved,
    });
  });

  /**
   * Verifies: choosing an option in a flag or template select saves the application with that value.
   * Interacts with: the opened panel's select (MatSelectHarness); ApplicationService.updateApplication.
   * Data: one row per select; Alpha (a1); template Chat (tm1).
   */
  it.each<[string, string, keyof Application, unknown]>([
    ['Embeddable', 'False', 'embeddable', false],
    ['Load in Background', 'True', 'loadInBackground', true],
    ['Application Template', 'Chat', 'applicationTemplateId', 'tm1'],
  ])('saves the %s choice %s', async (label, option, field, value) => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const r = await renderSelect({ templates: [{ id: 'tm1', name: 'Chat' }] });
    await openPanel(r);
    const select = await selectOf(r.fixture, label);
    await select.open();
    await select.clickOptions({ text: option });
    expect(r.updateApplication).toHaveBeenCalledExactlyOnceWith(
      'a1',
      expect.objectContaining({ id: 'a1', [field]: value }),
    );
  });

  /**
   * Verifies: an application made from a template shows the template's fields read-only below its own.
   * Interacts with: the opened panel's template section.
   * Data: an application from template Chat (chat.test, chat.png).
   */
  it('shows the template fields read-only', async () => {
    const r = await renderSelect({
      apps: [makeApplication({ id: 'a2', applicationTemplateId: 'tm1' })],
      templates: [
        { id: 'tm1', name: 'Chat', url: 'https://chat.test', icon: 'chat.png' },
      ],
    });
    await openPanel(r);
    const name = screen.getByLabelText(
      'Template Application Name',
    ) as HTMLInputElement;
    expect(name).toHaveValue('Chat');
    expect(name.disabled).toBe(true);
    expect(screen.getByLabelText('Template Application URL')).toHaveValue(
      'https://chat.test',
    );
  });

  /**
   * Verifies: a confirmed Delete Application deletes it and reloads the list; a declined one deletes nothing.
   * Interacts with: the opened panel's Delete Application button; CrucibleDialogService.confirm;
   *   ApplicationService.deleteApplication and getViewApplications.
   * Data: one row per answer; Alpha; the reload returns no applications.
   */
  it.each<[string, boolean, string[]]>([
    ['deletes the application when confirmed', true, []],
    ['keeps the application when declined', false, ['Alpha']],
  ])('%s', async (_case, confirmDelete, remaining) => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const r = await renderSelect({ confirmDelete });
    const user = await openPanel(r);
    r.getViewApplications.mockReturnValue(of([]));
    await user.click(screen.getByText('Delete Application'));
    expect(r.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Delete Application',
        message: 'Are you sure that you want to remove the application Alpha?',
      }),
    );
    expect(r.deleteApplication).toHaveBeenCalledTimes(confirmDelete ? 1 : 0);
    expect(appTitles(r.container)).toEqual(remaining);
  });

  describe('AppErrorStateMatcher', () => {
    const matcher = new AppErrorStateMatcher();

    /**
     * Verifies: a dirty invalid control is an error state.
     * Interacts with: AppErrorStateMatcher.isErrorState (pure).
     * Data: control { invalid: true, dirty: true }, no form.
     */
    it('is an error when the control is invalid and dirty', () => {
      const control = new UntypedFormControl('', Validators.required);
      control.markAsDirty();
      expect(matcher.isErrorState(control, null)).toBe(true);
    });

    /**
     * Verifies: an invalid control on a submitted form is an error state even if pristine.
     * Interacts with: AppErrorStateMatcher.isErrorState (pure).
     * Data: control { invalid: true, dirty: false }, form { submitted: true }.
     */
    it('is an error when the control is invalid and the form is submitted', () => {
      const control = new UntypedFormControl('', Validators.required);
      const form = new FormGroupDirective([], []);
      form.form = new FormGroup({});
      form.onSubmit(new Event('submit'));
      expect(control.dirty).toBe(false);
      expect(matcher.isErrorState(control, form)).toBe(true);
    });

    /**
     * Verifies: a valid control is not an error state.
     * Interacts with: AppErrorStateMatcher.isErrorState (pure).
     * Data: control { invalid: false, dirty: true }, no form.
     */
    it('is not an error when the control is valid', () => {
      const control = new UntypedFormControl('a value', Validators.required);
      control.markAsDirty();
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
