// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
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

async function renderDetails(
  overrides: {
    confirm?: boolean;
    permissions?: SystemPermission[];
  } = {},
) {
  const {
    confirm = true,
    permissions = [
      SystemPermission.ViewApplications,
      SystemPermission.ManageApplications,
    ],
  } = overrides;

  // The API echoes the saved template back.
  const updateApplicationTemplate = vi.fn(
    (_id: string, t: ApplicationTemplate) => of(structuredClone(t)),
  );
  const deleteApplicationTemplate = vi.fn(() => of(undefined));
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
    ],
    componentProperties: { appTemplate: structuredClone(template) },
    on: { refresh },
    providers: [
      ...permissionDataProviders({ system: permissions }),
      {
        provide: ApplicationService,
        useValue: {
          updateApplicationTemplate,
          deleteApplicationTemplate,
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
    expect(deleteApplicationTemplate).toHaveBeenCalledExactlyOnceWith('t1');
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
   * Verifies: a user who holds only ViewApplications gets an editable form and the Delete button (current behavior).
   * Interacts with: the rendered inputs and Delete button; the real UserPermissionsService over stubbed permission endpoints.
   * Data: system permissions [ViewApplications].
   */
  it('offers editing and Delete to a user with only ViewApplications', async () => {
    await renderDetails({ permissions: [SystemPermission.ViewApplications] });
    // Current behavior; see agent-docs/ui-test-bugs/player.ui.md.
    expect((screen.getByLabelText('Name') as HTMLInputElement).disabled).toBe(
      false,
    );
    expect(screen.getByText('Delete Application Template')).toBeInTheDocument();
  });
});
