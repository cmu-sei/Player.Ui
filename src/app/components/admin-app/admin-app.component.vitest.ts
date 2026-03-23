// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { AdminAppComponent } from './admin-app.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { UserPermissionsService } from '../../services/permissions/user-permissions.service';
import { SystemPermission } from '../../generated/player-api';
import { RouterQuery } from '@datorama/akita-ng-router-store';

async function renderAdmin(overrides: { permissions?: string[] } = {}) {
  const { permissions = [] } = overrides;

  return renderComponent(AdminAppComponent, {
    declarations: [AdminAppComponent],
    providers: [
      {
        provide: UserPermissionsService,
        useValue: {
          permissions$: of(permissions),
          teamPermissions$: of([]),
          loadPermissions: () => of([]),
        },
      },
      {
        provide: RouterQuery,
        useValue: {
          selectQueryParams: () => of(null),
          select: () => of(null),
        },
      },
    ],
  });
}

describe('AdminAppComponent', () => {
  it('should create the component', async () => {
    const { fixture } = await renderAdmin();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display the Administration header', async () => {
    await renderAdmin();
    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  it('should show Views nav item when user has ViewViews permission', async () => {
    await renderAdmin({ permissions: [SystemPermission.ViewViews] });
    expect(screen.getByText('Views')).toBeInTheDocument();
  });

  it('should show Users nav item when user has ViewUsers permission', async () => {
    await renderAdmin({ permissions: [SystemPermission.ViewUsers] });
    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('should hide nav items when user has no permissions', async () => {
    await renderAdmin({ permissions: [] });
    expect(screen.queryByText('Views')).not.toBeInTheDocument();
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
    expect(screen.queryByText('Application Templates')).not.toBeInTheDocument();
    expect(screen.queryByText('Roles')).not.toBeInTheDocument();
  });

  it('should show all nav items when user has all permissions', async () => {
    await renderAdmin({
      permissions: [
        SystemPermission.ViewViews,
        SystemPermission.ViewUsers,
        SystemPermission.ViewApplications,
        SystemPermission.ViewRoles,
        SystemPermission.ViewWebhookSubscriptions,
      ],
    });
    expect(screen.getByText('Views')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Application Templates')).toBeInTheDocument();
    expect(screen.getByText('Roles')).toBeInTheDocument();
    expect(screen.getByText('Subscriptions')).toBeInTheDocument();
  });

  it('should show Webhook Subscriptions nav when ViewWebhookSubscriptions permission present', async () => {
    await renderAdmin({
      permissions: [SystemPermission.ViewWebhookSubscriptions],
    });
    expect(screen.getByText('Subscriptions')).toBeInTheDocument();
  });

  it('should hide Webhook Subscriptions nav when ViewWebhookSubscriptions permission absent', async () => {
    await renderAdmin({ permissions: [] });
    expect(screen.queryByText('Subscriptions')).not.toBeInTheDocument();
  });

  it('should show Applications nav when ViewApplications permission present', async () => {
    await renderAdmin({
      permissions: [SystemPermission.ViewApplications],
    });
    expect(screen.getByText('Application Templates')).toBeInTheDocument();
  });

  it('should hide Applications nav when ViewApplications permission absent', async () => {
    await renderAdmin({ permissions: [] });
    expect(screen.queryByText('Application Templates')).not.toBeInTheDocument();
  });

  it('should hide Users nav when only ViewApplications permission present', async () => {
    await renderAdmin({ permissions: [SystemPermission.ViewApplications] });
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
  });

  it('should hide Roles nav when only ViewApplications permission present', async () => {
    await renderAdmin({ permissions: [SystemPermission.ViewApplications] });
    expect(screen.queryByText('Roles')).not.toBeInTheDocument();
  });

  it('should hide Views nav when only ViewUsers permission present', async () => {
    await renderAdmin({ permissions: [SystemPermission.ViewUsers] });
    expect(screen.queryByText('Views')).not.toBeInTheDocument();
  });

  it('should hide Subscriptions nav when only ViewUsers permission present', async () => {
    await renderAdmin({ permissions: [SystemPermission.ViewUsers] });
    expect(screen.queryByText('Subscriptions')).not.toBeInTheDocument();
  });

  it('should hide Views nav when only ViewRoles permission present', async () => {
    await renderAdmin({ permissions: [SystemPermission.ViewRoles] });
    expect(screen.queryByText('Views')).not.toBeInTheDocument();
  });

  it('should hide Users nav when only ViewRoles permission present', async () => {
    await renderAdmin({ permissions: [SystemPermission.ViewRoles] });
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
  });
});
