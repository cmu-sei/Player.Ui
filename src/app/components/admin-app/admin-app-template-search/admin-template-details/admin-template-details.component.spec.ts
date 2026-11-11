// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, onTestFinished } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { config, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  ApplicationTemplate,
  SystemPermission,
} from '../../../../generated/player-api';
import { ApplicationService } from '../../../../generated/player-api/api/application.service';
import { AdminTemplateDetailsComponent } from './admin-template-details.component';
import { renderComponent } from '../../../../test-utils/render-component';
import { permissionDataProviders } from '../../../../test-utils/mock-permission-data.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { ApiStub } from '../../../../test-utils/api-stub';
import { dialogRefStub } from '../../../../test-utils/dialog-refs';

const template: ApplicationTemplate = {
  id: 't1',
  name: 'Alpha',
  url: 'https://alpha.test',
  icon: 'assets/img/player.png',
  embeddable: true,
  loadInBackground: false,
};
const other: ApplicationTemplate = {
  id: 't2',
  name: 'Alpha Kept',
  url: 'https://kept.test',
  icon: 'assets/img/player.png',
  embeddable: true,
  loadInBackground: false,
};

async function renderDetails(
  overrides: {
    confirm?: boolean;
    permissions?: SystemPermission[];
    templates?: ApplicationTemplate[];
  } = {},
) {
  const {
    confirm = true,
    templates = [template, other],
    permissions = [
      SystemPermission.ViewApplications,
      SystemPermission.ManageApplications,
    ],
  } = overrides;

  // The API echoes the saved template back.
  const updateApplicationTemplate = vi.fn(
    (_id: string, t: ApplicationTemplate) => of(structuredClone(t)),
  );
  const deleteApplicationTemplate = vi.fn(
    (_id: string, _replacementTemplateId?: string) => of(undefined),
  );
  const getApplicationTemplate = vi.fn((_id: string) =>
    of(structuredClone(template)),
  );
  const confirmDialog = vi.fn(
    () => dialogRefStub<unknown, boolean>(confirm).dialogRef,
  );
  const refresh = vi.fn();

  const rendered = await renderComponent(AdminTemplateDetailsComponent, {
    declarations: [AdminTemplateDetailsComponent],
    imports: [
      MatFormFieldModule,
      MatInputModule,
      MatButtonModule,
      MatCheckboxModule,
      MatSelectModule,
    ],
    componentProperties: {
      appTemplate: structuredClone(template),
      templates: structuredClone(templates),
    },
    on: { refresh },
    providers: [
      ...permissionDataProviders({ system: permissions }),
      {
        provide: ApplicationService,
        useValue: {
          updateApplicationTemplate,
          deleteApplicationTemplate,
          getApplicationTemplate,
        } satisfies ApiStub<ApplicationService>,
      },
      {
        provide: CrucibleDialogService,
        useValue: { confirm: confirmDialog } satisfies Pick<
          CrucibleDialogService,
          'confirm'
        >,
      },
    ],
  });

  return {
    ...rendered,
    updateApplicationTemplate,
    deleteApplicationTemplate,
    getApplicationTemplate,
    confirmDialog,
    refresh,
  };
}

describe('AdminTemplateDetailsComponent', () => {
  /**
   * Verifies: the form shows the template's fields.
   * Interacts with: the rendered Name, URL, Icon Path inputs and the two checkboxes.
   * Data: template Alpha, embeddable, not loaded in the background.
   */
  it('shows the template fields', async () => {
    const { fixture } = await renderDetails();
    // ngModel writes its value after a microtask.
    await fixture.whenStable();
    fixture.detectChanges();
    expect(screen.getByLabelText('Name')).toHaveValue('Alpha');
    expect(screen.getByLabelText('URL')).toHaveValue('https://alpha.test');
    expect(screen.getByLabelText('Icon Path')).toHaveValue(
      'assets/img/player.png',
    );
    expect(screen.getByLabelText('Embeddable')).toBeChecked();
    expect(screen.getByLabelText('Load in background')).not.toBeChecked();
  });

  /**
   * Verifies: editing a text field and leaving it saves the whole template with the new value, and the form then
   *   shows the template the API returned.
   * Interacts with: the rendered Name input (change on blur); ApplicationService.updateApplicationTemplate.
   * Data: Name changed to 'Renamed'; the API answers with the name 'Renamed (saved)'.
   */
  it('saves the template when a field is changed', async () => {
    const user = userEvent.setup();
    const { fixture, updateApplicationTemplate } = await renderDetails();
    updateApplicationTemplate.mockImplementationOnce(
      (_id: string, t: ApplicationTemplate) =>
        of({ ...structuredClone(t), name: 'Renamed (saved)' }),
    );
    const name = screen.getByLabelText('Name');
    name.focus();
    await user.clear(name);
    await user.type(name, 'Renamed', { skipClick: true });
    await user.tab();
    expect(updateApplicationTemplate).toHaveBeenCalledExactlyOnceWith('t1', {
      ...template,
      name: 'Renamed',
    });
    // ngModel writes the returned value after a microtask.
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(name).toHaveValue('Renamed (saved)');
  });

  /**
   * Verifies: toggling a checkbox saves the template with the toggled flag.
   * Interacts with: the rendered Load in background checkbox; ApplicationService.updateApplicationTemplate.
   * Data: Load in background ticked.
   */
  it('saves the template when a checkbox is toggled', async () => {
    const user = userEvent.setup();
    const { updateApplicationTemplate } = await renderDetails();
    await user.click(screen.getByLabelText('Load in background'));
    expect(updateApplicationTemplate).toHaveBeenCalledExactlyOnceWith('t1', {
      ...template,
      loadInBackground: true,
    });
  });

  /**
   * Verifies: confirming Delete deletes the template and emits refresh(true); the prompt names the template.
   * Interacts with: the rendered Delete button; CrucibleDialogService.confirm;
   *   ApplicationService.deleteApplicationTemplate; the refresh output.
   * Data: confirm true; template Alpha (t1).
   */
  it('deletes the template after confirmation and reports it', async () => {
    const user = userEvent.setup();
    const { confirmDialog, deleteApplicationTemplate, refresh } =
      await renderDetails({ confirm: true });
    await user.click(screen.getByText('Delete Application Template'));
    expect(confirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Delete Application Template?',
        message: expect.stringContaining('Alpha'),
      }),
    );
    expect(deleteApplicationTemplate).toHaveBeenCalledExactlyOnceWith(
      't1',
      undefined,
    );
    expect(refresh).toHaveBeenCalledExactlyOnceWith(true);
  });

  /**
   * Verifies: declining the Delete prompt neither deletes nor emits refresh.
   * Interacts with: the rendered Delete button; CrucibleDialogService.confirm;
   *   ApplicationService.deleteApplicationTemplate; the refresh output.
   * Data: confirm false.
   */
  it('does nothing when the deletion is declined', async () => {
    const user = userEvent.setup();
    const { deleteApplicationTemplate, refresh } = await renderDetails({
      confirm: false,
    });
    await user.click(screen.getByText('Delete Application Template'));
    expect(deleteApplicationTemplate).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  /**
   * Verifies: a user who holds only ViewApplications sees the template read-only, with no Delete — the API refuses
   *   both without ManageApplications.
   * Interacts with: the rendered inputs, checkboxes and Delete button; the real UserPermissionsService over stubbed
   *   permission endpoints.
   * Data: system permissions [ViewApplications].
   */
  it('shows the template read-only to a user with only ViewApplications', async () => {
    const { fixture } = await renderDetails({
      permissions: [SystemPermission.ViewApplications],
    });
    await fixture.whenStable();
    fixture.detectChanges();
    for (const label of ['Name', 'URL', 'Icon Path']) {
      expect(screen.getByLabelText(label)).toBeDisabled();
    }
    expect(screen.getByLabelText('Embeddable')).toBeDisabled();
    expect(screen.getByLabelText('Load in background')).toBeDisabled();
    expect(screen.queryByText('Delete Application Template')).toBeNull();
    expect(screen.queryByText('Move its applications to')).toBeNull();
  });

  /**
   * Verifies: choosing a replacement sends it with the delete, the prompt says where the applications go, and the
   *   template itself is not offered as its own replacement.
   * Interacts with: the Move its applications to select; CrucibleDialogService.confirm;
   *   ApplicationService.deleteApplicationTemplate.
   * Data: templates Alpha (t1, the one deleted) and Alpha Kept (t2).
   */
  it('moves the applications to the chosen template when deleting', async () => {
    const user = userEvent.setup();
    const { confirmDialog, deleteApplicationTemplate, refresh } =
      await renderDetails();
    await user.click(screen.getByRole('combobox'));
    const options = screen
      .getAllByRole('option')
      .map((o) => o.textContent?.trim());
    expect(options).toEqual(['None', 'Alpha Kept — https://kept.test']);
    await user.click(screen.getByRole('option', { name: /Alpha Kept/ }));
    await user.click(screen.getByText('Delete Application Template'));
    expect(confirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(
          'Applications that use it will move to Alpha Kept (https://kept.test).',
        ),
      }),
    );
    expect(deleteApplicationTemplate).toHaveBeenCalledExactlyOnceWith(
      't1',
      't2',
    );
    expect(refresh).toHaveBeenCalledExactlyOnceWith(true);
  });

  /**
   * Verifies: when the API refuses an edit (a name another template uses), the form and the template object it
   *   shares with the list show the saved values again rather than the refused one, and the error still propagates
   *   to the app's error handler.
   * Interacts with: the rendered Name input; ApplicationService.updateApplicationTemplate (fails) and
   *   getApplicationTemplate.
   * Data: Name changed to 'Taken'; the API answers 409.
   */
  it('restores the saved template when an edit is refused', async () => {
    const user = userEvent.setup();
    const { fixture, updateApplicationTemplate, getApplicationTemplate } =
      await renderDetails();
    const row = fixture.componentInstance.appTemplate;
    const refused = new HttpErrorResponse({ status: 409 });
    updateApplicationTemplate.mockImplementationOnce(() =>
      throwError(() => refused),
    );
    // Unsubscribed errors go to rxjs's unhandled-error hook, which the app routes to its error handler.
    const errors: unknown[] = [];
    const previous = config.onUnhandledError;
    config.onUnhandledError = (e) => errors.push(e);
    onTestFinished(() => {
      config.onUnhandledError = previous;
    });
    const name = screen.getByLabelText('Name');
    name.focus();
    await user.clear(name);
    await user.type(name, 'Taken', { skipClick: true });
    await user.tab();
    expect(getApplicationTemplate).toHaveBeenCalledExactlyOnceWith('t1');
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(name).toHaveValue('Alpha');
    // The row object the list shares with the panel is restored, not just the panel's copy.
    expect(row.name).toBe('Alpha');
    await vi.waitFor(() => expect(errors).toEqual([refused]));
  });
});
