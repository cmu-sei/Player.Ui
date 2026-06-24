// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { AdminRolesComponent } from './admin-roles.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { MatTabsModule } from '@angular/material/tabs';

async function renderAdminRoles() {
  return renderComponent(AdminRolesComponent, {
    declarations: [AdminRolesComponent],
    imports: [MatTabsModule],
  });
}

describe('AdminRolesComponent', () => {
  /**
   * Verifies: the tab-container component instantiates successfully.
   * Interacts with: renderComponent importing MatTabsModule.
   * Data: no overrides.
   */
  it('should create', async () => {
    const { fixture } = await renderAdminRoles();
    expect(fixture.componentInstance).toBeTruthy();
  });

  /**
   * Verifies: the "Roles" tab label is rendered.
   * Interacts with: the rendered DOM (queried via Testing Library screen).
   * Data: no overrides.
   */
  it('should display Roles tab', async () => {
    await renderAdminRoles();
    expect(screen.getByText('Roles')).toBeInTheDocument();
  });

  /**
   * Verifies: the "Team Roles" tab label is rendered.
   * Interacts with: the rendered DOM (queried via Testing Library screen).
   * Data: no overrides.
   */
  it('should display Team Roles tab', async () => {
    await renderAdminRoles();
    expect(screen.getByText('Team Roles')).toBeInTheDocument();
  });
});
