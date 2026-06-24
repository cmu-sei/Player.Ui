// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
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

async function renderTeamRoles(
  hasManageRoles = false,
  overrides: {
    nameResult?: { wasCancelled: boolean; nameValue?: string };
    confirmResult?: { confirm: boolean };
  } = {},
) {
  const {
    nameResult = { wasCancelled: true, nameValue: '' },
    confirmResult = { confirm: false },
  } = overrides;

  const stubs = {
    getRoles: vi.fn(() => of(mockTeamRoles)),
    editRole: vi.fn(() => of(mockTeamRoles[0])),
    createRole: vi.fn(() => of(mockTeamRoles[0])),
    deleteRole: vi.fn(() => of(undefined)),
    addPermission: vi.fn(() => of(undefined)),
    removePermission: vi.fn(() => of(undefined)),
    load: vi.fn(() => of(mockTeamPermissions)),
    createTeamPermission: vi.fn(() => of(mockTeamPermissions[0])),
    name: vi.fn(() => of(nameResult)),
    confirm: vi.fn(() => of(confirmResult)),
  };

  const rendered = await renderComponent(TeamRolesComponent, {
    declarations: [TeamRolesComponent],
    imports: [MatTableModule, MatCheckboxModule],
    providers: [
      {
        provide: UserPermissionsService,
        useValue: createMockUserPermissionsService(hasManageRoles),
      },
      {
        provide: TeamPermissionsService,
        useValue: {
          teamPermissions$: new BehaviorSubject(
            mockTeamPermissions,
          ).asObservable(),
          load: stubs.load,
          createTeamPermission: stubs.createTeamPermission,
        },
      },
      {
        provide: TeamRolesService,
        useValue: {
          roles$: new BehaviorSubject(mockTeamRoles).asObservable(),
          getRoles: stubs.getRoles,
          editRole: stubs.editRole,
          createRole: stubs.createRole,
          deleteRole: stubs.deleteRole,
          addPermission: stubs.addPermission,
          removePermission: stubs.removePermission,
        },
      },
      {
        provide: DialogService,
        useValue: { confirm: stubs.confirm, name: stubs.name },
      },
    ],
  });

  return { ...rendered, stubs };
}

function getAddButton(container: Element): HTMLButtonElement {
  // The Add button has [matTooltip]="adding ? 'Cancel' : 'Add'" and fontIcon mdi-plus-circle
  const buttons = container.querySelectorAll('th button[mat-icon-button]');
  // First button in the header row is the Add/Cancel button
  return buttons[0] as HTMLButtonElement;
}

describe('TeamRolesComponent', () => {
  /**
   * Verifies: the team-permission-matrix component instantiates successfully.
   * Interacts with: renderComponent with stubbed UserPermissionsService, TeamPermissionsService, TeamRolesService, DialogService.
   * Data: default renderTeamRoles (no ManageRoles, cancelled name/confirm dialogs).
   */
  it('should create the component', async () => {
    const { fixture } = await renderTeamRoles();
    expect(fixture.componentInstance).toBeTruthy();
  });

  /**
   * Verifies: the "Permissions" matrix header is rendered.
   * Interacts with: the rendered DOM (queried via Testing Library screen).
   * Data: default renderTeamRoles.
   */
  it('should show Permissions header', async () => {
    await renderTeamRoles();
    expect(screen.getByText('Permissions')).toBeInTheDocument();
  });

  /**
   * Verifies: a team role from the roles stream renders as a column header.
   * Interacts with: the rendered DOM driven by the TeamRolesService.roles$ stub.
   * Data: mockTeamRoles (single 'TeamTestRole').
   */
  it('should display the team role column header', async () => {
    await renderTeamRoles();
    expect(screen.getByText('TeamTestRole')).toBeInTheDocument();
  });

  /**
   * Verifies: the Add button is enabled when the user holds ManageRoles.
   * Interacts with: the rendered header button; UserPermissionsService permission stub.
   * Data: renderTeamRoles(true) — ManageRoles granted.
   */
  it('should enable Add button when user has ManageRoles permission', async () => {
    const { container } = await renderTeamRoles(true);
    const addBtn = getAddButton(container);
    expect(addBtn).not.toBeNull();
    expect(addBtn.disabled).toBe(false);
  });

  /**
   * Verifies: the Add button is disabled when the user lacks ManageRoles.
   * Interacts with: the rendered header button; UserPermissionsService permission stub.
   * Data: renderTeamRoles(false) — ManageRoles denied.
   */
  it('should disable Add button when user lacks ManageRoles permission', async () => {
    const { container } = await renderTeamRoles(false);
    const addBtn = getAddButton(container);
    expect(addBtn).not.toBeNull();
    expect(addBtn.disabled).toBe(true);
  });

  /**
   * Verifies: Rename and Delete controls appear for a mutable team role when ManageRoles is present.
   * Interacts with: the rendered DOM (queried by title).
   * Data: renderTeamRoles(true); mockTeamRoles role is non-immutable.
   */
  it('should show Rename and Delete buttons for non-immutable role when ManageRoles present', async () => {
    await renderTeamRoles(true);
    expect(screen.getByTitle('Rename Role')).toBeInTheDocument();
    expect(screen.getByTitle('Delete Role')).toBeInTheDocument();
  });

  /**
   * Verifies: Rename and Delete controls are hidden when ManageRoles is absent.
   * Interacts with: the rendered DOM (queried by title).
   * Data: renderTeamRoles(false).
   */
  it('should hide Rename and Delete buttons when ManageRoles absent', async () => {
    await renderTeamRoles(false);
    expect(screen.queryByTitle('Rename Role')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete Role')).not.toBeInTheDocument();
  });

  describe('hasPermission()', () => {
    /**
     * Verifies: the synthetic "All" row reports its state from role.allPermissions rather than the list.
     * Interacts with: component.hasPermission (pure method).
     * Data: role with allPermissions=true; permission named 'All'.
     */
    it('reads allPermissions for the synthetic "All" row', async () => {
      const { fixture } = await renderTeamRoles();
      const role = { allPermissions: true, permissions: [] } as never;
      expect(
        fixture.componentInstance.hasPermission({ name: 'All' } as never, role),
      ).toBe(true);
    });

    /**
     * Verifies: a normal team permission is matched by id against the role's list (true present, false absent).
     * Interacts with: component.hasPermission (pure method).
     * Data: role with permission tp-1; queried for tp-1 (hit) and tp-x (miss).
     */
    it('checks the role permission list for a normal permission', async () => {
      const { fixture } = await renderTeamRoles();
      const role = { permissions: [{ id: 'tp-1' }] } as never;
      expect(
        fixture.componentInstance.hasPermission(
          { id: 'tp-1', name: 'ViewTeam' } as never,
          role,
        ),
      ).toBe(true);
      expect(
        fixture.componentInstance.hasPermission(
          { id: 'tp-x', name: 'Other' } as never,
          role,
        ),
      ).toBe(false);
    });
  });

  describe('setPermission()', () => {
    /**
     * Verifies: toggling "All" flips role.allPermissions and persists via editRole keyed by role id.
     * Interacts with: stubbed TeamRolesService.editRole (id + role signature).
     * Data: role with allPermissions=false; "All" permission checked=true.
     */
    it('edits the role (by id) when toggling the "All" permission', async () => {
      const { fixture, stubs } = await renderTeamRoles();
      const role = { id: 'trole-1', allPermissions: false } as never;
      fixture.componentInstance.setPermission(
        { name: 'All' } as never,
        role,
        { checked: true } as never,
      );
      expect(role.allPermissions).toBe(true);
      expect(stubs.editRole).toHaveBeenCalledWith('trole-1', role);
    });

    /**
     * Verifies: checking a team permission not yet on the role calls addPermission with the full permission.
     * Interacts with: stubbed TeamRolesService.addPermission.
     * Data: role with empty permissions; tp-2 checked=true.
     */
    it('adds a permission when checked and not already present', async () => {
      const { fixture, stubs } = await renderTeamRoles();
      const role = { id: 'trole-1', permissions: [] } as never;
      const perm = { id: 'tp-2', name: 'EditTeam' } as never;
      fixture.componentInstance.setPermission(perm, role, {
        checked: true,
      } as never);
      expect(stubs.addPermission).toHaveBeenCalledWith('trole-1', perm);
    });

    /**
     * Verifies: unchecking a permission calls removePermission with the role id and permission id.
     * Interacts with: stubbed TeamRolesService.removePermission.
     * Data: role already holding tp-2; tp-2 checked=false.
     */
    it('removes a permission when unchecked', async () => {
      const { fixture, stubs } = await renderTeamRoles();
      const role = { id: 'trole-1', permissions: [{ id: 'tp-2' }] } as never;
      const perm = { id: 'tp-2', name: 'EditTeam' } as never;
      fixture.componentInstance.setPermission(perm, role, {
        checked: false,
      } as never);
      expect(stubs.removePermission).toHaveBeenCalledWith('trole-1', 'tp-2');
    });
  });

  describe('addRole()', () => {
    /**
     * Verifies: a confirmed name dialog drives createRole with the entered team-role name.
     * Interacts with: stubbed DialogService.name and TeamRolesService.createRole.
     * Data: nameResult override (nameValue 'New Team Role').
     */
    it('creates a team role when the dialog returns a name', async () => {
      const { fixture, stubs } = await renderTeamRoles(true, {
        nameResult: { wasCancelled: false, nameValue: 'New Team Role' },
      });
      fixture.componentInstance.addRole();
      expect(stubs.createRole).toHaveBeenCalledWith({ name: 'New Team Role' });
    });

    /**
     * Verifies: a cancelled name dialog leaves createRole untouched.
     * Interacts with: stubbed DialogService.name and TeamRolesService.createRole.
     * Data: nameResult override (wasCancelled=true).
     */
    it('does nothing when the dialog is cancelled', async () => {
      const { fixture, stubs } = await renderTeamRoles(true, {
        nameResult: { wasCancelled: true },
      });
      fixture.componentInstance.addRole();
      expect(stubs.createRole).not.toHaveBeenCalled();
    });
  });

  /**
   * Verifies: addPermission() feeds the dialog's entered name into TeamPermissionsService.createTeamPermission.
   * Interacts with: stubbed DialogService.name and TeamPermissionsService.createTeamPermission.
   * Data: nameResult override (nameValue 'New Team Perm').
   */
  it('addPermission() creates a team permission from the dialog result', async () => {
    const { fixture, stubs } = await renderTeamRoles(true, {
      nameResult: { wasCancelled: false, nameValue: 'New Team Perm' },
    });
    fixture.componentInstance.addPermission();
    expect(stubs.createTeamPermission).toHaveBeenCalledWith({
      name: 'New Team Perm',
    });
  });

  /**
   * Verifies: renameRole() applies the dialog name onto the role and persists via editRole keyed by id.
   * Interacts with: stubbed DialogService.name and TeamRolesService.editRole.
   * Data: nameResult override (nameValue 'Renamed'); role starting name 'Old'.
   */
  it('renameRole() edits the role with the new name', async () => {
    const { fixture, stubs } = await renderTeamRoles(true, {
      nameResult: { wasCancelled: false, nameValue: 'Renamed' },
    });
    const role = { id: 'trole-1', name: 'Old' } as never;
    fixture.componentInstance.renameRole(role);
    expect(role.name).toBe('Renamed');
    expect(stubs.editRole).toHaveBeenCalledWith('trole-1', role);
  });

  describe('deleteRole()', () => {
    /**
     * Verifies: a confirmed delete dialog drives deleteRole with the team-role id.
     * Interacts with: stubbed DialogService.confirm and TeamRolesService.deleteRole.
     * Data: confirmResult override { confirm: true }.
     */
    it('deletes when confirmed', async () => {
      const { fixture, stubs } = await renderTeamRoles(true, {
        confirmResult: { confirm: true },
      });
      fixture.componentInstance.deleteRole({
        id: 'trole-1',
        name: 'X',
      } as never);
      expect(stubs.deleteRole).toHaveBeenCalledWith('trole-1');
    });

    /**
     * Verifies: a declined confirm dialog leaves deleteRole untouched.
     * Interacts with: stubbed DialogService.confirm and TeamRolesService.deleteRole.
     * Data: confirmResult override { confirm: false }.
     */
    it('is a no-op when cancelled', async () => {
      const { fixture, stubs } = await renderTeamRoles(true, {
        confirmResult: { confirm: false },
      });
      fixture.componentInstance.deleteRole({
        id: 'trole-1',
        name: 'X',
      } as never);
      expect(stubs.deleteRole).not.toHaveBeenCalled();
    });
  });

  /**
   * Verifies: trackById returns the item's id for *ngFor identity tracking.
   * Interacts with: component.trackById (pure method).
   * Data: an object literal { id: 'abc' }.
   */
  it('trackById returns the item id', async () => {
    const { fixture } = await renderTeamRoles();
    expect(fixture.componentInstance.trackById(0, { id: 'abc' })).toBe('abc');
  });
});
