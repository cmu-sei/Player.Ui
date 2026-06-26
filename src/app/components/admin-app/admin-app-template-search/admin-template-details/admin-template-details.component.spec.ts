// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ApplicationTemplate } from '../../../../generated/player-api';
import { ApplicationService } from '../../../../generated/player-api/api/application.service';
import { DialogService } from '../../../../services/dialog/dialog.service';
import { AdminTemplateDetailsComponent } from './admin-template-details.component';
import { renderComponent } from '../../../../test-utils/render-component';

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
    appTemplate?: ApplicationTemplate;
    confirm?: boolean;
  } = {},
) {
  const { appTemplate = { ...template }, confirm = true } = overrides;

  const updateApplicationTemplate = vi.fn((_id: string, t: ApplicationTemplate) =>
    of(t),
  );
  const deleteApplicationTemplate = vi.fn(() => of(undefined));
  const confirmDialog = vi.fn(() => of({ confirm }));

  const rendered = await renderComponent(AdminTemplateDetailsComponent, {
    declarations: [AdminTemplateDetailsComponent],
    imports: [MatCheckboxModule],
    componentProperties: { appTemplate },
    providers: [
      {
        provide: ApplicationService,
        useValue: {
          updateApplicationTemplate,
          deleteApplicationTemplate,
        },
      },
      {
        provide: DialogService,
        useValue: { confirm: confirmDialog },
      },
    ],
  });

  return {
    ...rendered,
    updateApplicationTemplate,
    deleteApplicationTemplate,
    confirmDialog,
  };
}

describe('AdminTemplateDetailsComponent', () => {
  /**
   * Verifies: the component instantiates without error.
   * Interacts with: ApplicationService + DialogService stubs.
   * Data: default template input.
   */
  it('creates the component', async () => {
    const { fixture } = await renderDetails();
    expect(fixture.componentInstance).toBeTruthy();
  });

  /**
   * Verifies: editAppTemplate calls the update API with the template id and the
   *   current template object.
   * Interacts with: ApplicationService.updateApplicationTemplate spy.
   * Data: default template (id 't1').
   */
  it('editAppTemplate calls updateApplicationTemplate with id and template', async () => {
    const { fixture, updateApplicationTemplate } = await renderDetails();
    fixture.componentInstance.editAppTemplate();
    expect(updateApplicationTemplate).toHaveBeenCalledWith(
      't1',
      fixture.componentInstance.appTemplate,
    );
  });

  /**
   * Verifies: editAppTemplate replaces the local appTemplate with the server
   *   response (e.g. a renamed template).
   * Interacts with: ApplicationService.updateApplicationTemplate stub returning updated.
   * Data: response template renamed to 'Renamed'.
   * Why: renders its own component inline (not renderDetails) so the update stub
   *      can return a distinct response object.
   */
  it('editAppTemplate updates appTemplate from response', async () => {
    const updated: ApplicationTemplate = { ...template, name: 'Renamed' };
    const updateApplicationTemplate = vi.fn(() => of(updated));
    const { fixture } = await renderComponent(AdminTemplateDetailsComponent, {
      declarations: [AdminTemplateDetailsComponent],
      imports: [MatCheckboxModule],
      componentProperties: { appTemplate: { ...template } },
      providers: [
        {
          provide: ApplicationService,
          useValue: {
            updateApplicationTemplate,
            deleteApplicationTemplate: vi.fn(),
          },
        },
        { provide: DialogService, useValue: { confirm: () => of({ confirm: false }) } },
      ],
    });
    fixture.componentInstance.editAppTemplate();
    expect(fixture.componentInstance.appTemplate.name).toBe('Renamed');
  });

  /**
   * Verifies: confirming the delete dialog deletes the template and emits
   *   refresh(true).
   * Interacts with: DialogService.confirm + ApplicationService.deleteApplicationTemplate;
   *   component.refresh output.
   * Data: confirm = true; template id 't1'.
   */
  it('deleteApplicationTemplate emits refresh(true) when user confirms', async () => {
    const { fixture, deleteApplicationTemplate } = await renderDetails({
      confirm: true,
    });
    const spy = vi.fn();
    fixture.componentInstance.refresh.subscribe(spy);
    fixture.componentInstance.deleteApplicationTemplate();
    expect(deleteApplicationTemplate).toHaveBeenCalledWith('t1');
    expect(spy).toHaveBeenCalledWith(true);
  });

  /**
   * Verifies: cancelling the delete dialog neither deletes nor emits refresh.
   * Interacts with: DialogService.confirm + ApplicationService.deleteApplicationTemplate;
   *   component.refresh output.
   * Data: confirm = false.
   */
  it('deleteApplicationTemplate does nothing when user cancels', async () => {
    const { fixture, deleteApplicationTemplate } = await renderDetails({
      confirm: false,
    });
    const spy = vi.fn();
    fixture.componentInstance.refresh.subscribe(spy);
    fixture.componentInstance.deleteApplicationTemplate();
    expect(deleteApplicationTemplate).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
  });

  /**
   * Verifies: the template detail view exposes a Delete button.
   * Interacts with: rendered DOM via screen.findByRole.
   * Data: default template input.
   */
  it('renders a Delete Application Template button', async () => {
    await renderDetails();
    expect(
      await screen.findByRole('button', { name: /Delete Application Template/ }),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: clicking Delete opens the confirm dialog with a title and a body
   *   referencing the template name.
   * Interacts with: DialogService.confirm spy; userEvent click.
   * Data: confirm = false; template named 'Alpha'.
   */
  it('clicking the delete button triggers the confirmation dialog', async () => {
    const user = userEvent.setup();
    const { confirmDialog } = await renderDetails({ confirm: false });
    await user.click(
      screen.getByRole('button', { name: /Delete Application Template/ }),
    );
    expect(confirmDialog).toHaveBeenCalledWith(
      'Delete Application Template?',
      expect.stringContaining('Alpha'),
    );
  });
});
