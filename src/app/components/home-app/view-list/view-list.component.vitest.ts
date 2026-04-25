// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { of } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { ViewListComponent } from './view-list.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { UserPermissionsService } from '../../../services/permissions/user-permissions.service';
import { ViewsService } from '../../../services/views/views.service';
import { DialogService } from '../../../services/dialog/dialog.service';
import { SystemPermission } from '../../../generated/player-api';

function createMockPermissionsService(hasCreateViews: boolean) {
  return {
    permissions$: of(hasCreateViews ? [SystemPermission.CreateViews] : []),
    teamPermissions$: of([]),
    load: () => of(hasCreateViews ? [SystemPermission.CreateViews] : []),
    loadTeamPermissions: () => of([]),
    canViewAdminstration: () => of(false),
    hasPermission: (p: string) =>
      of(hasCreateViews && p === SystemPermission.CreateViews),
    can: () => of(false),
  };
}

const mockViewsService = {
  views$: of([]),
  loadMyViews: () => of([]),
  createView: () => of({}),
};

const mockDialogService = {
  confirm: () => of(true),
  name: () => of({ wasCancelled: true, nameValue: '' }),
};

async function renderViewList(hasCreateViews = false) {
  return renderComponent(ViewListComponent, {
    declarations: [ViewListComponent],
    imports: [MatTableModule, MatSortModule],
    providers: [
      {
        provide: UserPermissionsService,
        useValue: createMockPermissionsService(hasCreateViews),
      },
      { provide: ViewsService, useValue: mockViewsService },
      { provide: DialogService, useValue: mockDialogService },
    ],
  });
}

describe('ViewListComponent', () => {
  it('should create the component without error', async () => {
    const { fixture } = await renderViewList();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show "Add New View" button when user has CreateViews permission', async () => {
    const { container } = await renderViewList(true);
    expect(
      container.querySelector('button[mattooltip="Add New View"]'),
    ).not.toBeNull();
  });

  it('should hide "Add New View" button when user lacks CreateViews permission', async () => {
    const { container } = await renderViewList(false);
    expect(
      container.querySelector('button[mattooltip="Add New View"]'),
    ).toBeNull();
  });
});
