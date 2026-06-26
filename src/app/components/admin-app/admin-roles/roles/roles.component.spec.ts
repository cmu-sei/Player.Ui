// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
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

async function renderRoles(
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
    getRoles: vi.fn(() => of(mockRoles)),
    editRole: vi.fn(() => of(mockRoles[0])),
    createRole: vi.fn(() => of(mockRoles[0])),
    deleteRole: vi.fn(() => of(undefined)),
    addPermission: vi.fn(() => of(undefined)),
    removePermission: vi.fn(() => of(undefined)),
    load: vi.fn(() => of(mockPermissions)),
    createPermission: vi.fn(() => of(mockPermissions[0])),
    name: vi.fn(() => of(nameResult)),
    confirm: vi.fn(() => of(confirmResult)),
  };

  const rendered = await renderComponent(SystemRolesComponent, {
    declarations: [SystemRolesComponent],
    imports: [MatTableModule, MatCheckboxModule],
    providers: [
      {
        provide: UserPermissionsService,
        useValue: createMockUserPermissionsService(hasManageRoles),
      },
      {
        provide: PermissionsService,
        useValue: {
          permissions$: new BehaviorSubject(mockPermissions).asObservable(),
          load: stubs.load,
          createPermission: stubs.createPermission,
        },
      },
      {
        provide: RolesService,
        useValue: {
          roles$: new BehaviorSubject(mockRoles).asObservable(),
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

describe('SystemRolesComponent', () => {
  /**
   * Verifies: the permission-matrix component instantiates successfully.
   * Interacts with: renderComponent with stubbed UserPermissionsService, PermissionsService, RolesService, DialogService.
   * Data: default renderRoles (no ManageRoles, cancelled name/confirm dialogs).
   */
  it('should create the component', async () => {
    const { fixture } = await renderRoles();
    expect(fixture.componentInstance).toBeTruthy();
  });

  /**
   * Verifies: the "Permissions" matrix header is rendered.
   * Interacts with: the rendered DOM (queried via Testing Library screen).
   * Data: default renderRoles.
   */
  it('should show Permissions header', async () => {
    await renderRoles();
    expect(screen.getByText('Permissions')).toBeInTheDocument();
  });

  /**
   * Verifies: a role from the roles stream renders as a column header.
   * Interacts with: the rendered DOM driven by the RolesService.roles$ stub.
   * Data: mockRoles (single 'TestRole').
   */
  it('should display the role column header', async () => {
    await renderRoles();
    expect(screen.getByText('TestRole')).toBeInTheDocument();
  });

  /**
   * Verifies: the Add button is enabled when the user holds ManageRoles.
   * Interacts with: the rendered header button; UserPermissionsService permission stub.
   * Data: renderRoles(true) — ManageRoles granted.
   */
  it('should enable Add button when user has ManageRoles permission', async () => {
    const { container } = await renderRoles(true);
    const addBtn = getAddButton(container);
    expect(addBtn).not.toBeNull();
    expect(addBtn.disabled).toBe(false);
  });

  /**
   * Verifies: the Add button is disabled when the user lacks ManageRoles.
   * Interacts with: the rendered header button; UserPermissionsService permission stub.
   * Data: renderRoles(false) — ManageRoles denied.
   */
  it('should disable Add button when user lacks ManageRoles permission', async () => {
    const { container } = await renderRoles(false);
    const addBtn = getAddButton(container);
    expect(addBtn).not.toBeNull();
    expect(addBtn.disabled).toBe(true);
  });

  /**
   * Verifies: Rename and Delete controls appear for a mutable role when ManageRoles is present.
   * Interacts with: the rendered DOM (queried by title).
   * Data: renderRoles(true); mockRoles role is non-immutable.
   */
  it('should show Rename and Delete buttons for non-immutable role when ManageRoles present', async () => {
    await renderRoles(true);
    expect(screen.getByTitle('Rename Role')).toBeInTheDocument();
    expect(screen.getByTitle('Delete Role')).toBeInTheDocument();
  });

  /**
   * Verifies: Rename and Delete controls are hidden when ManageRoles is absent.
   * Interacts with: the rendered DOM (queried by title).
   * Data: renderRoles(false).
   */
  it('should hide Rename and Delete buttons when ManageRoles absent', async () => {
    await renderRoles(false);
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
      const { fixture } = await renderRoles();
      const role = { allPermissions: true, permissions: [] } as never;
      expect(
        fixture.componentInstance.hasPermission({ name: 'All' } as never, role),
      ).toBe(true);
    });

    /**
     * Verifies: a normal permission is matched by id against the role's permission list (true present, false absent).
     * Interacts with: component.hasPermission (pure method).
     * Data: role with permission perm-1; queried for perm-1 (hit) and perm-x (miss).
     */
    it('checks the role permission list for a normal permission', async () => {
      const { fixture } = await renderRoles();
      const role = { permissions: [{ id: 'perm-1' }] } as never;
      expect(
        fixture.componentInstance.hasPermission(
          { id: 'perm-1', name: 'ViewViews' } as never,
          role,
        ),
      ).toBe(true);
      expect(
        fixture.componentInstance.hasPermission(
          { id: 'perm-x', name: 'Other' } as never,
          role,
        ),
      ).toBe(false);
    });
  });

  describe('setPermission()', () => {
    /**
     * Verifies: toggling the "All" permission flips role.allPermissions and persists via editRole.
     * Interacts with: stubbed RolesService.editRole.
     * Data: role with allPermissions=false; "All" permission checked=true.
     */
    it('edits the role when toggling the "All" permission', async () => {
      const { fixture, stubs } = await renderRoles();
      const role = { id: 'role-1', allPermissions: false } as never;
      fixture.componentInstance.setPermission(
        { name: 'All' } as never,
        role,
        { checked: true } as never,
      );
      expect(role.allPermissions).toBe(true);
      expect(stubs.editRole).toHaveBeenCalledWith(role);
    });

    /**
     * Verifies: checking a normal permission not yet on the role calls addPermission with the full permission.
     * Interacts with: stubbed RolesService.addPermission.
     * Data: role with empty permissions; perm-2 checked=true.
     */
    it('adds a permission when checked and not already present', async () => {
      const { fixture, stubs } = await renderRoles();
      const role = { id: 'role-1', permissions: [] } as never;
      const perm = { id: 'perm-2', name: 'ManageUsers' } as never;
      fixture.componentInstance.setPermission(perm, role, {
        checked: true,
      } as never);
      expect(stubs.addPermission).toHaveBeenCalledWith('role-1', perm);
    });

    /**
     * Verifies: unchecking a permission calls removePermission with the role id and permission id.
     * Interacts with: stubbed RolesService.removePermission.
     * Data: role already holding perm-2; perm-2 checked=false.
     */
    it('removes a permission when unchecked', async () => {
      const { fixture, stubs } = await renderRoles();
      const role = { id: 'role-1', permissions: [{ id: 'perm-2' }] } as never;
      const perm = { id: 'perm-2', name: 'ManageUsers' } as never;
      fixture.componentInstance.setPermission(perm, role, {
        checked: false,
      } as never);
      expect(stubs.removePermission).toHaveBeenCalledWith('role-1', 'perm-2');
    });
  });

  describe('addRole()', () => {
    /**
     * Verifies: a confirmed name dialog drives createRole with the entered name.
     * Interacts with: stubbed DialogService.name and RolesService.createRole.
     * Data: nameResult override (not cancelled, nameValue 'New Role').
     */
    it('creates a role when the dialog returns a name', async () => {
      const { fixture, stubs } = await renderRoles(true, {
        nameResult: { wasCancelled: false, nameValue: 'New Role' },
      });
      fixture.componentInstance.addRole();
      expect(stubs.createRole).toHaveBeenCalledWith({ name: 'New Role' });
    });

    /**
     * Verifies: a cancelled name dialog leaves createRole untouched.
     * Interacts with: stubbed DialogService.name and RolesService.createRole.
     * Data: nameResult override (wasCancelled=true).
     */
    it('does nothing when the dialog is cancelled', async () => {
      const { fixture, stubs } = await renderRoles(true, {
        nameResult: { wasCancelled: true },
      });
      fixture.componentInstance.addRole();
      expect(stubs.createRole).not.toHaveBeenCalled();
    });
  });

  /**
   * Verifies: addPermission() feeds the dialog's entered name into PermissionsService.createPermission.
   * Interacts with: stubbed DialogService.name and PermissionsService.createPermission.
   * Data: nameResult override (nameValue 'New Perm').
   */
  it('addPermission() creates a permission from the dialog result', async () => {
    const { fixture, stubs } = await renderRoles(true, {
      nameResult: { wasCancelled: false, nameValue: 'New Perm' },
    });
    fixture.componentInstance.addPermission();
    expect(stubs.createPermission).toHaveBeenCalledWith({ name: 'New Perm' });
  });

  /**
   * Verifies: renameRole() applies the dialog name onto the role and persists via editRole.
   * Interacts with: stubbed DialogService.name and RolesService.editRole.
   * Data: nameResult override (nameValue 'Renamed'); role starting name 'Old'.
   */
  it('renameRole() edits the role with the new name', async () => {
    const { fixture, stubs } = await renderRoles(true, {
      nameResult: { wasCancelled: false, nameValue: 'Renamed' },
    });
    const role = { id: 'role-1', name: 'Old' } as never;
    fixture.componentInstance.renameRole(role);
    expect(role.name).toBe('Renamed');
    expect(stubs.editRole).toHaveBeenCalledWith(role);
  });

  describe('deleteRole()', () => {
    /**
     * Verifies: a confirmed delete dialog drives deleteRole with the role id.
     * Interacts with: stubbed DialogService.confirm and RolesService.deleteRole.
     * Data: confirmResult override { confirm: true }.
     */
    it('deletes when confirmed', async () => {
      const { fixture, stubs } = await renderRoles(true, {
        confirmResult: { confirm: true },
      });
      fixture.componentInstance.deleteRole({ id: 'role-1', name: 'X' } as never);
      expect(stubs.deleteRole).toHaveBeenCalledWith('role-1');
    });

    /**
     * Verifies: a declined confirm dialog leaves deleteRole untouched.
     * Interacts with: stubbed DialogService.confirm and RolesService.deleteRole.
     * Data: confirmResult override { confirm: false }.
     */
    it('is a no-op when cancelled', async () => {
      const { fixture, stubs } = await renderRoles(true, {
        confirmResult: { confirm: false },
      });
      fixture.componentInstance.deleteRole({ id: 'role-1', name: 'X' } as never);
      expect(stubs.deleteRole).not.toHaveBeenCalled();
    });
  });

  /**
   * Verifies: trackById returns the item's id for *ngFor identity tracking.
   * Interacts with: component.trackById (pure method).
   * Data: an object literal { id: 'abc' }.
   */
  it('trackById returns the item id', async () => {
    const { fixture } = await renderRoles();
    expect(fixture.componentInstance.trackById(0, { id: 'abc' })).toBe('abc');
  });
});
