// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { of, BehaviorSubject } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { TeamRolesComponent } from './team-roles.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { UserPermissionsService } from '../../../../services/permissions/user-permissions.service';
import { TeamPermissionsService } from '../../../../services/permissions/team-permissions.service';
import { TeamRolesService } from '../../../../services/roles/team-roles.service';
import { DialogService } from '../../../../services/dialog/dialog.service';
import { SystemPermission } from '../../../../generated/player-api';

const mockTeamPermissions = [
  { id: 'tp-1', name: 'ViewTeam', description: 'Can view team', immutable: true },
  { id: 'tp-2', name: 'EditTeam', description: 'Can edit team', immutable: false },
];

const mockTeamRoles = [
  {
    id: 'trole-1',
    name: 'TeamTestRole',
    immutable: false,
    allPermissions: false,
    permissions: [{ id: 'tp-1', name: 'ViewTeam' }],
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

const mockTeamPermissionsService = {
  teamPermissions$: new BehaviorSubject(mockTeamPermissions).asObservable(),
  load: () => of(mockTeamPermissions),
};

const mockTeamRolesService = {
  roles$: new BehaviorSubject(mockTeamRoles).asObservable(),
  getRoles: () => of(mockTeamRoles),
};

const mockDialogService = {
  confirm: () => of({ confirm: false }),
  name: () => of({ wasCancelled: true, nameValue: '' }),
};

async function renderTeamRoles(hasManageRoles = false) {
  return renderComponent(TeamRolesComponent, {
    declarations: [TeamRolesComponent],
    imports: [MatTableModule, MatCheckboxModule],
    providers: [
      {
        provide: UserPermissionsService,
        useValue: createMockUserPermissionsService(hasManageRoles),
      },
      { provide: TeamPermissionsService, useValue: mockTeamPermissionsService },
      { provide: TeamRolesService, useValue: mockTeamRolesService },
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

describe('TeamRolesComponent', () => {
  it('should create the component', async () => {
    const { fixture } = await renderTeamRoles();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show Permissions header', async () => {
    await renderTeamRoles();
    expect(screen.getByText('Permissions')).toBeInTheDocument();
  });

  it('should display the team role column header', async () => {
    await renderTeamRoles();
    expect(screen.getByText('TeamTestRole')).toBeInTheDocument();
  });

  it('should enable Add button when user has ManageRoles permission', async () => {
    const { container } = await renderTeamRoles(true);
    const addBtn = getAddButton(container);
    expect(addBtn).not.toBeNull();
    expect(addBtn.disabled).toBe(false);
  });

  it('should disable Add button when user lacks ManageRoles permission', async () => {
    const { container } = await renderTeamRoles(false);
    const addBtn = getAddButton(container);
    expect(addBtn).not.toBeNull();
    expect(addBtn.disabled).toBe(true);
  });

  it('should show Rename and Delete buttons for non-immutable role when ManageRoles present', async () => {
    await renderTeamRoles(true);
    expect(screen.getByTitle('Rename Role')).toBeInTheDocument();
    expect(screen.getByTitle('Delete Role')).toBeInTheDocument();
  });

  it('should hide Rename and Delete buttons when ManageRoles absent', async () => {
    await renderTeamRoles(false);
    expect(screen.queryByTitle('Rename Role')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete Role')).not.toBeInTheDocument();
  });
});
