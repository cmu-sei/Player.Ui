// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import { of, BehaviorSubject } from 'rxjs';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatCheckboxHarness } from '@angular/material/checkbox/testing';
import { MatTableModule } from '@angular/material/table';
import {
  MatCheckbox,
  MatCheckboxChange,
  MatCheckboxModule,
} from '@angular/material/checkbox';
import { SystemRolesComponent } from './roles.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { userPermissionsProvider } from 'src/app/test-utils/mock-user-permissions.service';
import { PermissionsService } from '../../../../services/permissions/permissions.service';
import { RolesService } from '../../../../services/roles/roles.service';
import { DialogService } from '../../../../services/dialog/dialog.service';
import {
  Permission,
  Role,
  SystemPermission,
} from '../../../../generated/player-api';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltip, MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';

const mockPermissions = [
  {
    id: 'perm-1',
    name: 'ViewViews',
    description: 'Can view views',
    immutable: true,
  },
  {
    id: 'perm-2',
    name: 'ManageUsers',
    description: 'Can manage users',
    immutable: false,
  },
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

async function renderRoles(
  hasManageRoles = false,
  overrides: {
    nameResult?: { wasCancelled: boolean; nameValue?: string };
    confirmResult?: boolean;
    roles?: typeof mockRoles;
  } = {},
) {
  const {
    nameResult = { wasCancelled: true, nameValue: '' },
    confirmResult = false,
    roles = structuredClone(mockRoles),
  } = overrides;

  const stubs = {
    getRoles: vi.fn(() => of(roles)),
    editRole: vi.fn(() => of(mockRoles[0])),
    createRole: vi.fn(() => of(mockRoles[0])),
    deleteRole: vi.fn(() => of(undefined)),
    addPermission: vi.fn(() => of(undefined)),
    removePermission: vi.fn(() => of(undefined)),
    load: vi.fn(() => of(mockPermissions)),
    createPermission: vi.fn(() => of(mockPermissions[0])),
    name: vi.fn(() => of(nameResult)),
    confirm: vi.fn(() => ({
      afterClosed: () => of(confirmResult),
    })),
  };

  const rendered = await renderComponent(SystemRolesComponent, {
    declarations: [SystemRolesComponent],
    imports: [
      MatIconModule,
      MatTooltipModule,
      MatButtonModule,
      MatTableModule,
      MatCheckboxModule,
    ],
    providers: [
      userPermissionsProvider(
        hasManageRoles ? [SystemPermission.ManageRoles] : [],
      ),
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
          roles$: new BehaviorSubject(roles).asObservable(),
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
        useValue: { name: stubs.name },
      },
      {
        provide: CrucibleDialogService,
        useValue: { confirm: stubs.confirm },
      },
    ],
  });

  return { ...rendered, stubs, roles };
}

// The Add button carries [matTooltip]="adding ? 'Cancel' : 'Add'", so it is
// found by asking each MatTooltip directive for its message rather than by
// picking a position out of the header row's buttons.
function getAddButton(
  fixture: ComponentFixture<SystemRolesComponent>,
): HTMLButtonElement {
  const button = fixture.debugElement
    .queryAll(By.directive(MatTooltip))
    .find((el) => el.injector.get(MatTooltip).message === 'Add');
  if (!button) {
    throw new Error('No button with an "Add" tooltip was rendered');
  }
  return button.nativeElement as HTMLButtonElement;
}

function checkboxChange(
  fixture: ComponentFixture<SystemRolesComponent>,
  checked: boolean,
): MatCheckboxChange {
  const source = fixture.debugElement
    .query(By.directive(MatCheckbox))
    .injector.get(MatCheckbox);
  return { source, checked };
}

// Matrix cell checkboxes in row order: All, then one per loaded permission.
function matrixCheckboxes(fixture: ComponentFixture<SystemRolesComponent>) {
  return TestbedHarnessEnvironment.loader(fixture).getAllHarnesses(
    MatCheckboxHarness,
  );
}

describe('SystemRolesComponent', () => {
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
    const { fixture } = await renderRoles(true);
    expect(getAddButton(fixture).disabled).toBe(false);
  });

  /**
   * Verifies: the Add button is disabled when the user lacks ManageRoles.
   * Interacts with: the rendered header button; UserPermissionsService permission stub.
   * Data: renderRoles(false) — ManageRoles denied.
   */
  it('should disable Add button when user lacks ManageRoles permission', async () => {
    const { fixture } = await renderRoles(false);
    expect(getAddButton(fixture).disabled).toBe(true);
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
      const role: Role = { allPermissions: true, permissions: [] };
      expect(
        fixture.componentInstance.hasPermission({ name: 'All' }, role),
      ).toBe(true);
    });

    /**
     * Verifies: a normal permission is matched by id against the role's permission list (true present, false absent).
     * Interacts with: component.hasPermission (pure method).
     * Data: role with permission perm-1; queried for perm-1 (hit) and perm-x (miss).
     */
    it('checks the role permission list for a normal permission', async () => {
      const { fixture } = await renderRoles();
      const role: Role = { permissions: [{ id: 'perm-1' }] };
      expect(
        fixture.componentInstance.hasPermission(
          { id: 'perm-1', name: 'ViewViews' },
          role,
        ),
      ).toBe(true);
      expect(
        fixture.componentInstance.hasPermission(
          { id: 'perm-x', name: 'Other' },
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
      const role: Role = { id: 'role-1', allPermissions: false };
      fixture.componentInstance.setPermission(
        { name: 'All' },
        role,
        checkboxChange(fixture, true),
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
      const role: Role = { id: 'role-1', permissions: [] };
      const perm: Permission = { id: 'perm-2', name: 'ManageUsers' };
      fixture.componentInstance.setPermission(
        perm,
        role,
        checkboxChange(fixture, true),
      );
      expect(stubs.addPermission).toHaveBeenCalledWith('role-1', perm);
    });

    /**
     * Verifies: unchecking a permission calls removePermission with the role id and permission id.
     * Interacts with: stubbed RolesService.removePermission.
     * Data: role already holding perm-2; perm-2 checked=false.
     */
    it('removes a permission when unchecked', async () => {
      const { fixture, stubs } = await renderRoles();
      const role: Role = { id: 'role-1', permissions: [{ id: 'perm-2' }] };
      const perm: Permission = { id: 'perm-2', name: 'ManageUsers' };
      fixture.componentInstance.setPermission(
        perm,
        role,
        checkboxChange(fixture, false),
      );
      expect(stubs.removePermission).toHaveBeenCalledWith('role-1', 'perm-2');
    });
  });

  describe('permission matrix checkboxes', () => {
    /**
     * Verifies: each rendered checkbox reports the role's current state.
     * Interacts with: the rendered matrix through MatCheckboxHarness.
     * Data: renderRoles(true); rows are All (allPermissions false), ViewViews (held), ManageUsers (not held).
     * Why: pins the [checked]="hasPermission(permission, role)" binding — the calls-only tests below pass
     *   with that binding dropped.
     */
    it('reflects the role state in the rendered checkboxes', async () => {
      const { fixture } = await renderRoles(true);
      const [all, viewViews, manageUsers] = await matrixCheckboxes(fixture);
      expect(await all.isChecked()).toBe(false);
      expect(await viewViews.isChecked()).toBe(true);
      expect(await manageUsers.isChecked()).toBe(false);
    });

    /**
     * Verifies: checking a permission the role lacks adds it to that role.
     * Interacts with: the ManageUsers checkbox via MatCheckboxHarness; stubbed RolesService.addPermission.
     * Data: renderRoles(true); mockRoles holds perm-1 only, so perm-2 is the unheld row.
     * Why: drives the (change)="setPermission(permission, role, $event)" binding rather than calling the
     *   method directly — deleting that binding leaves every method-level test green.
     */
    it('checking a permission the role lacks calls addPermission', async () => {
      const { fixture, stubs } = await renderRoles(true);
      const [, , manageUsers] = await matrixCheckboxes(fixture);
      await manageUsers.check();
      expect(stubs.addPermission).toHaveBeenCalledWith(
        'role-1',
        expect.objectContaining({ id: 'perm-2', name: 'ManageUsers' }),
      );
      expect(stubs.removePermission).not.toHaveBeenCalled();
    });

    /**
     * Verifies: unchecking a permission the role holds removes it from that role.
     * Interacts with: the ViewViews checkbox via MatCheckboxHarness; stubbed RolesService.removePermission.
     * Data: renderRoles(true); mockRoles holds perm-1, the checked row.
     */
    it('unchecking a permission the role holds calls removePermission', async () => {
      const { fixture, stubs } = await renderRoles(true);
      const [, viewViews] = await matrixCheckboxes(fixture);
      await viewViews.uncheck();
      expect(stubs.removePermission).toHaveBeenCalledWith('role-1', 'perm-1');
      expect(stubs.addPermission).not.toHaveBeenCalled();
    });

    /**
     * Verifies: checking the synthetic All row flips allPermissions on the role and saves it.
     * Interacts with: the All checkbox via MatCheckboxHarness; stubbed RolesService.editRole.
     * Data: renderRoles(true); the rendered role starts with allPermissions false.
     */
    it('checking the All row edits the role with allPermissions set', async () => {
      const { fixture, stubs, roles } = await renderRoles(true);
      const [all] = await matrixCheckboxes(fixture);
      await all.check();
      expect(roles[0].allPermissions).toBe(true);
      expect(stubs.editRole).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'role-1', allPermissions: true }),
      );
    });

    /**
     * Verifies: without ManageRoles every matrix checkbox renders disabled.
     * Interacts with: the rendered matrix through MatCheckboxHarness; UserPermissionsService stub.
     * Data: renderRoles(false) — three rows (All plus the two permissions).
     * Why: pins the [disabled] binding, the only thing keeping a read-only user from editing the matrix.
     */
    it('disables every checkbox when the user lacks ManageRoles', async () => {
      const { fixture } = await renderRoles(false);
      const boxes = await matrixCheckboxes(fixture);
      expect(boxes).toHaveLength(3);
      for (const box of boxes) {
        expect(await box.isDisabled()).toBe(true);
      }
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
    const role: Role = { id: 'role-1', name: 'Old' };
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
        confirmResult: true,
      });
      fixture.componentInstance.deleteRole({ id: 'role-1', name: 'X' });
      expect(stubs.deleteRole).toHaveBeenCalledWith('role-1');
    });

    /**
     * Verifies: a declined confirm dialog leaves deleteRole untouched.
     * Interacts with: stubbed DialogService.confirm and RolesService.deleteRole.
     * Data: confirmResult override { confirm: false }.
     */
    it('is a no-op when cancelled', async () => {
      const { fixture, stubs } = await renderRoles(true, {
        confirmResult: false,
      });
      fixture.componentInstance.deleteRole({ id: 'role-1', name: 'X' });
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
