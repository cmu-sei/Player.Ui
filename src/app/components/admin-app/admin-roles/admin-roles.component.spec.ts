// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Component } from '@angular/core';
import { screen } from '@testing-library/angular';
import { AdminRolesComponent } from './admin-roles.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { MatTabsModule } from '@angular/material/tabs';

@Component({ selector: 'app-roles', template: '' })
class RolesStubComponent {}

@Component({ selector: 'app-team-roles', template: '' })
class TeamRolesStubComponent {}

async function renderAdminRoles() {
  return renderComponent(AdminRolesComponent, {
    declarations: [AdminRolesComponent],
    imports: [MatTabsModule, RolesStubComponent, TeamRolesStubComponent],
  });
}

describe('AdminRolesComponent', () => {
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
