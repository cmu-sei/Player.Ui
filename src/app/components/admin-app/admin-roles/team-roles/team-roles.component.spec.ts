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
import { TeamRolesComponent } from './team-roles.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { userPermissionsProvider } from 'src/app/test-utils/mock-user-permissions.service';
import { TeamPermissionsService } from '../../../../services/permissions/team-permissions.service';
import { TeamRolesService } from '../../../../services/roles/team-roles.service';
import { DialogService } from '../../../../services/dialog/dialog.service';
import {
  Role,
  SystemPermission,
  TeamPermissionModel,
  TeamRole,
} from '../../../../generated/player-api';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltip, MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';

const mockTeamPermissions = [
  {
    id: 'tp-1',
    name: 'ViewTeam',
    description: 'Can view team',
    immutable: true,
  },
  {
    id: 'tp-2',
    name: 'EditTeam',
    description: 'Can edit team',
    immutable: false,
  },
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

async function renderTeamRoles(
  hasManageRoles = false,
  overrides: {
    nameResult?: { wasCancelled: boolean; nameValue?: string };
    confirmResult?: boolean;
    roles?: typeof mockTeamRoles;
  } = {},
) {
  const {
    nameResult = { wasCancelled: true, nameValue: '' },
    confirmResult = false,
    roles = structuredClone(mockTeamRoles),
  } = overrides;

  const stubs = {
    getRoles: vi.fn(() => of(roles)),
    editRole: vi.fn(() => of(mockTeamRoles[0])),
    createRole: vi.fn(() => of(mockTeamRoles[0])),
    deleteRole: vi.fn(() => of(undefined)),
    addPermission: vi.fn(() => of(undefined)),
    removePermission: vi.fn(() => of(undefined)),
    load: vi.fn(() => of(mockTeamPermissions)),
    createTeamPermission: vi.fn(() => of(mockTeamPermissions[0])),
    name: vi.fn(() => of(nameResult)),
    confirm: vi.fn(() => ({
      afterClosed: () => of(confirmResult),
    })),
  };

  const rendered = await renderComponent(TeamRolesComponent, {
    declarations: [TeamRolesComponent],
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
  fixture: ComponentFixture<TeamRolesComponent>,
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
  fixture: ComponentFixture<TeamRolesComponent>,
  checked: boolean,
): MatCheckboxChange {
  const source = fixture.debugElement
    .query(By.directive(MatCheckbox))
    .injector.get(MatCheckbox);
  return { source, checked };
}

// Matrix cell checkboxes in row order: All, then one per loaded team permission.
function matrixCheckboxes(fixture: ComponentFixture<TeamRolesComponent>) {
  return TestbedHarnessEnvironment.loader(fixture).getAllHarnesses(
    MatCheckboxHarness,
  );
}

describe('TeamRolesComponent', () => {
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
    const { fixture } = await renderTeamRoles(true);
    expect(getAddButton(fixture).disabled).toBe(false);
  });

  /**
   * Verifies: the Add button is disabled when the user lacks ManageRoles.
   * Interacts with: the rendered header button; UserPermissionsService permission stub.
   * Data: renderTeamRoles(false) — ManageRoles denied.
   */
  it('should disable Add button when user lacks ManageRoles permission', async () => {
    const { fixture } = await renderTeamRoles(false);
    expect(getAddButton(fixture).disabled).toBe(true);
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
      const role: Role = { allPermissions: true, permissions: [] };
      expect(
        fixture.componentInstance.hasPermission({ name: 'All' }, role),
      ).toBe(true);
    });

    /**
     * Verifies: a normal team permission is matched by id against the role's list (true present, false absent).
     * Interacts with: component.hasPermission (pure method).
     * Data: role with permission tp-1; queried for tp-1 (hit) and tp-x (miss).
     */
    it('checks the role permission list for a normal permission', async () => {
      const { fixture } = await renderTeamRoles();
      const role: Role = { permissions: [{ id: 'tp-1' }] };
      expect(
        fixture.componentInstance.hasPermission(
          { id: 'tp-1', name: 'ViewTeam' },
          role,
        ),
      ).toBe(true);
      expect(
        fixture.componentInstance.hasPermission(
          { id: 'tp-x', name: 'Other' },
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
      const role: TeamRole = { id: 'trole-1', allPermissions: false };
      fixture.componentInstance.setPermission(
        { name: 'All' },
        role,
        checkboxChange(fixture, true),
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
      const role: TeamRole = { id: 'trole-1', permissions: [] };
      const perm: TeamPermissionModel = { id: 'tp-2', name: 'EditTeam' };
      fixture.componentInstance.setPermission(
        perm,
        role,
        checkboxChange(fixture, true),
      );
      expect(stubs.addPermission).toHaveBeenCalledWith('trole-1', perm);
    });

    /**
     * Verifies: unchecking a permission calls removePermission with the role id and permission id.
     * Interacts with: stubbed TeamRolesService.removePermission.
     * Data: role already holding tp-2; tp-2 checked=false.
     */
    it('removes a permission when unchecked', async () => {
      const { fixture, stubs } = await renderTeamRoles();
      const role: TeamRole = { id: 'trole-1', permissions: [{ id: 'tp-2' }] };
      const perm: TeamPermissionModel = { id: 'tp-2', name: 'EditTeam' };
      fixture.componentInstance.setPermission(
        perm,
        role,
        checkboxChange(fixture, false),
      );
      expect(stubs.removePermission).toHaveBeenCalledWith('trole-1', 'tp-2');
    });
  });

  describe('permission matrix checkboxes', () => {
    /**
     * Verifies: each rendered checkbox reports the team role's current state.
     * Interacts with: the rendered matrix through MatCheckboxHarness.
     * Data: renderTeamRoles(true); rows are All (allPermissions false), ViewTeam (held), EditTeam (not held).
     * Why: pins the [checked]="hasPermission(permission, role)" binding — the calls-only tests below pass
     *   with that binding dropped.
     */
    it('reflects the team role state in the rendered checkboxes', async () => {
      const { fixture } = await renderTeamRoles(true);
      const [all, viewTeam, editTeam] = await matrixCheckboxes(fixture);
      expect(await all.isChecked()).toBe(false);
      expect(await viewTeam.isChecked()).toBe(true);
      expect(await editTeam.isChecked()).toBe(false);
    });

    /**
     * Verifies: checking a permission the team role lacks adds it to that role.
     * Interacts with: the EditTeam checkbox via MatCheckboxHarness; stubbed TeamRolesService.addPermission.
     * Data: renderTeamRoles(true); mockTeamRoles holds tp-1 only, so tp-2 is the unheld row.
     * Why: drives the (change)="setPermission(permission, role, $event)" binding rather than calling the
     *   method directly — deleting that binding leaves every method-level test green.
     */
    it('checking a permission the role lacks calls addPermission', async () => {
      const { fixture, stubs } = await renderTeamRoles(true);
      const [, , editTeam] = await matrixCheckboxes(fixture);
      await editTeam.check();
      expect(stubs.addPermission).toHaveBeenCalledWith(
        'trole-1',
        expect.objectContaining({ id: 'tp-2', name: 'EditTeam' }),
      );
      expect(stubs.removePermission).not.toHaveBeenCalled();
    });

    /**
     * Verifies: unchecking a permission the team role holds removes it from that role.
     * Interacts with: the ViewTeam checkbox via MatCheckboxHarness; stubbed TeamRolesService.removePermission.
     * Data: renderTeamRoles(true); mockTeamRoles holds tp-1, the checked row.
     */
    it('unchecking a permission the role holds calls removePermission', async () => {
      const { fixture, stubs } = await renderTeamRoles(true);
      const [, viewTeam] = await matrixCheckboxes(fixture);
      await viewTeam.uncheck();
      expect(stubs.removePermission).toHaveBeenCalledWith('trole-1', 'tp-1');
      expect(stubs.addPermission).not.toHaveBeenCalled();
    });

    /**
     * Verifies: checking the synthetic All row flips allPermissions on the team role and saves it by id.
     * Interacts with: the All checkbox via MatCheckboxHarness; stubbed TeamRolesService.editRole.
     * Data: renderTeamRoles(true); the rendered role starts with allPermissions false.
     */
    it('checking the All row edits the role with allPermissions set', async () => {
      const { fixture, stubs, roles } = await renderTeamRoles(true);
      const [all] = await matrixCheckboxes(fixture);
      await all.check();
      expect(roles[0].allPermissions).toBe(true);
      expect(stubs.editRole).toHaveBeenCalledWith(
        'trole-1',
        expect.objectContaining({ id: 'trole-1', allPermissions: true }),
      );
    });

    /**
     * Verifies: without ManageRoles every matrix checkbox renders disabled.
     * Interacts with: the rendered matrix through MatCheckboxHarness; UserPermissionsService stub.
     * Data: renderTeamRoles(false) — three rows (All plus the two team permissions).
     * Why: pins the [disabled] binding, the only thing keeping a read-only user from editing the matrix.
     */
    it('disables every checkbox when the user lacks ManageRoles', async () => {
      const { fixture } = await renderTeamRoles(false);
      const boxes = await matrixCheckboxes(fixture);
      expect(boxes).toHaveLength(3);
      for (const box of boxes) {
        expect(await box.isDisabled()).toBe(true);
      }
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
    const role: TeamRole = { id: 'trole-1', name: 'Old' };
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
        confirmResult: true,
      });
      fixture.componentInstance.deleteRole({ id: 'trole-1', name: 'X' });
      expect(stubs.deleteRole).toHaveBeenCalledWith('trole-1');
    });

    /**
     * Verifies: a declined confirm dialog leaves deleteRole untouched.
     * Interacts with: stubbed DialogService.confirm and TeamRolesService.deleteRole.
     * Data: confirmResult override { confirm: false }.
     */
    it('is a no-op when cancelled', async () => {
      const { fixture, stubs } = await renderTeamRoles(true, {
        confirmResult: false,
      });
      fixture.componentInstance.deleteRole({ id: 'trole-1', name: 'X' });
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
