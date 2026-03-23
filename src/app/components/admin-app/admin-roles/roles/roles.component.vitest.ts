// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { of, BehaviorSubject } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { SystemRolesComponent } from './roles.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { UserPermissionsService } from '../../../../services/permissions/user-permissions.service';
import { PermissionsService } from '../../../../services/permissions/permissions.service';
import { RolesService } from '../../../../services/roles/roles.service';
import { DialogService } from '../../../../services/dialog/dialog.service';
import { SystemPermission } from '../../../../generated/player-api';

const mockPermissions = [
  { id: 'perm-1', name: 'ViewViews', description: 'Can view views', immutable: true },
  { id: 'perm-2', name: 'ManageUsers', description: 'Can manage users', immutable: false },
];

const mockRoles = [
  {
    id: 'role-1',
    name: 'TestRole',
    immutable: false,
    allPermissions: false,
    permissions: [{ id: 'perm-1', name: 'ViewViews' }],
  },
];

function createMockUserPermissionsService(hasManageRoles: boolean) {
  return {
    permissions$: of(hasManageRoles ? [SystemPermission.ManageRoles] : []),
    teamPermissions$: of([]),
    load: () => of(hasManageRoles ? [SystemPermission.ManageRoles] : []),
    loadTeamPermissions: () => of([]),
    canViewAdminstration: () => of(hasManageRoles),
    hasPermission: (p: string) =>
      of(hasManageRoles && p === SystemPermission.ManageRoles),
    can: () => of(false),
  };
}

const mockPermissionsDataService = {
  permissions$: new BehaviorSubject(mockPermissions).asObservable(),
  load: () => of(mockPermissions),
};

const mockRolesService = {
  roles$: new BehaviorSubject(mockRoles).asObservable(),
  getRoles: () => of(mockRoles),
};

const mockDialogService = {
  confirm: () => of({ confirm: false }),
  name: () => of({ wasCancelled: true, nameValue: '' }),
};

async function renderRoles(hasManageRoles = false) {
  return renderComponent(SystemRolesComponent, {
    declarations: [SystemRolesComponent],
    imports: [MatTableModule, MatCheckboxModule],
    providers: [
      {
        provide: UserPermissionsService,
        useValue: createMockUserPermissionsService(hasManageRoles),
      },
      { provide: PermissionsService, useValue: mockPermissionsDataService },
      { provide: RolesService, useValue: mockRolesService },
      { provide: DialogService, useValue: mockDialogService },
    ],
  });
}

function getAddButton(container: Element): HTMLButtonElement {
  // The Add button has [matTooltip]="adding ? 'Cancel' : 'Add'" and fontIcon mdi-plus-circle
  const buttons = container.querySelectorAll('th button[mat-icon-button]');
  // First button in the header row is the Add/Cancel button
  return buttons[0] as HTMLButtonElement;
}

describe('SystemRolesComponent', () => {
  it('should create the component', async () => {
    const { fixture } = await renderRoles();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show Permissions header', async () => {
    await renderRoles();
    expect(screen.getByText('Permissions')).toBeInTheDocument();
  });

  it('should display the role column header', async () => {
    await renderRoles();
    expect(screen.getByText('TestRole')).toBeInTheDocument();
  });

  it('should enable Add button when user has ManageRoles permission', async () => {
    const { container } = await renderRoles(true);
    const addBtn = getAddButton(container);
    expect(addBtn).not.toBeNull();
    expect(addBtn.disabled).toBe(false);
  });

  it('should disable Add button when user lacks ManageRoles permission', async () => {
    const { container } = await renderRoles(false);
    const addBtn = getAddButton(container);
    expect(addBtn).not.toBeNull();
    expect(addBtn.disabled).toBe(true);
  });

  it('should show Rename and Delete buttons for non-immutable role when ManageRoles present', async () => {
    await renderRoles(true);
    expect(screen.getByTitle('Rename Role')).toBeInTheDocument();
    expect(screen.getByTitle('Delete Role')).toBeInTheDocument();
  });

  it('should hide Rename and Delete buttons when ManageRoles absent', async () => {
    await renderRoles(false);
    expect(screen.queryByTitle('Rename Role')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete Role')).not.toBeInTheDocument();
  });
});
