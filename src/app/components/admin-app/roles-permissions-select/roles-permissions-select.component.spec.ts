// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { By } from '@angular/platform-browser';
import { defer, of } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSelectHarness } from '@angular/material/select/testing';
import { ComponentFixture } from '@angular/core/testing';
import { TeamPermissionScopesService } from '../../../services/permissions/team-permission-scopes.service';
import { MatSelect, MatSelectModule } from '@angular/material/select';
import {
  User,
  Team,
  UserService,
  TeamService,
  Permission,
  TeamPermissionService,
  TeamPermissionScopeService,
} from '../../../generated/player-api';
import {
  ObjectType,
  RolesPermissionsSelectComponent,
} from './roles-permissions-select.component';
import { renderComponent } from '../../../test-utils/render-component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { ApiStub } from '../../../test-utils/api-stub';

const permissionA: Permission = { id: 'p1', name: 'A' };
const permissionB: Permission = { id: 'p2', name: 'B' };

async function renderSelect(
  overrides: {
    user?: User | null;
    team?: Team | null;
    canEdit?: boolean;
    allTeams?: Team[];
    scopeError?: boolean;
  } = {},
) {
  const {
    user = null,
    team = null,
    canEdit = true,
    allTeams = [],
    scopeError = false,
  } = overrides;

  const updateUser = vi.fn(() => of({}));
  const updateTeam = vi.fn(() => of({}));
  // The real TeamPermissionsService.addToTeam/removeFromTeam call these. The
  // real role and permission services start with empty streams, which is all
  // these tests need.
  const addToTeam = vi.fn((_teamId: string, _permissionId: string) => of({}));
  const removeFromTeam = vi.fn((_teamId: string, _permissionId: string) =>
    of({}),
  );

  // The real TeamPermissionScopesService calls these. A failure arrives
  // asynchronously, as an HTTP error does, after the select has applied the
  // user's change to its model.
  const scopeResult = () =>
    scopeError ? defer(() => Promise.reject(new Error('403'))) : of(undefined);
  const addScope = vi.fn((_teamId: string, _targetTeamId: string) =>
    scopeResult(),
  );
  const removeScope = vi.fn((_teamId: string, _targetTeamId: string) =>
    scopeResult(),
  );

  const rendered = await renderComponent(RolesPermissionsSelectComponent, {
    declarations: [RolesPermissionsSelectComponent],
    imports: [
      MatFormFieldModule,
      MatIconModule,
      MatTooltipModule,
      MatButtonModule,
      MatSelectModule,
      FormsModule,
    ],
    componentProperties: { user, team, canEdit, allTeams },
    providers: [
      {
        provide: UserService,
        useValue: { updateUser } satisfies ApiStub<UserService>,
      },
      {
        provide: TeamService,
        useValue: { updateTeam } satisfies ApiStub<TeamService>,
      },
      {
        provide: TeamPermissionService,
        useValue: {
          addTeamPermissionToTeam: addToTeam,
          removeTeamPermissionFromTeam: removeFromTeam,
        } satisfies ApiStub<TeamPermissionService>,
      },
      {
        provide: TeamPermissionScopeService,
        useValue: {
          addTeamPermissionScope: addScope,
          removeTeamPermissionScope: removeScope,
        } satisfies ApiStub<TeamPermissionScopeService>,
      },
      // Real: a thin wrapper over the endpoints above (a placeholder in the
      // default providers).
      TeamPermissionScopesService,
    ],
  });

  return {
    ...rendered,
    updateUser,
    updateTeam,
    addToTeam,
    removeFromTeam,
    addScope,
    removeScope,
  };
}

describe('RolesPermissionsSelectComponent', () => {
  /**
   * Verifies: rendering with both a user and a team, or with neither, throws a TypeError from the template instead of showing inert dropdowns (current behavior).
   * Interacts with: ngOnInit's early return (it logs and leaves `subject` unset) and the template's subject.roleId binding.
   * Data: one row with a user and a team, one with neither.
   */
  it.each<[string, { user?: User; team?: Team }]>([
    ['both a user and a team', { user: { id: 'u1' }, team: { id: 't1' } }],
    ['neither a user nor a team', {}],
  ])('throws while rendering with %s', async (_label, inputs) => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await expect(renderSelect(inputs)).rejects.toThrow(TypeError);
  });

  /**
   * Verifies: passing a team puts the component in Team mode, shows permissions, and seeds selection from team.permissions/roleId.
   * Interacts with: ngOnInit reading the team input.
   * Data: team with roleId 'r1' and permission p1.
   */
  it('sets Team mode and seeds selectedPermissions from team.permissions', async () => {
    const team: Team = {
      id: 't1',
      name: 'Red',
      roleId: 'r1',
      permissions: [permissionA],
    };
    const { fixture } = await renderSelect({ team });
    expect(fixture.componentInstance.subjectType).toBe(ObjectType.Team);
    expect(fixture.componentInstance.showPermissions).toBe(true);
    expect(fixture.componentInstance.selectedPermissions).toEqual(['p1']);
    expect(fixture.componentInstance.selectedRole).toBe('r1');
  });

  /**
   * Verifies: passing a user puts the component in User mode, hides the permissions UI, and seeds the role from roleId.
   * Interacts with: ngOnInit reading the user input.
   * Data: user with roleId 'r2'.
   */
  it('sets User mode without permissions', async () => {
    const { fixture } = await renderSelect({
      user: { id: 'u1', name: 'Alice', roleId: 'r2' },
    });
    expect(fixture.componentInstance.subjectType).toBe(ObjectType.User);
    expect(fixture.componentInstance.showPermissions).toBe(false);
    expect(fixture.componentInstance.selectedRole).toBe('r2');
  });

  /**
   * Verifies: the role select is disabled when the caller cannot edit.
   * Interacts with: the Material MatSelect instance rendered by the component.
   * Data: a user and canEdit=false.
   */
  it('disables the role select when editing is not allowed', async () => {
    const { fixture } = await renderSelect({
      user: { id: 'u1', name: 'Alice', roleId: 'r2' },
      canEdit: false,
    });
    const roleSelect = fixture.debugElement.query(By.directive(MatSelect))
      .componentInstance as MatSelect;

    expect(roleSelect.disabled).toBe(true);
  });

  /**
   * Verifies: existing consumers remain editable by default.
   * Interacts with: the component's default canEdit input.
   * Data: a user without an explicit canEdit override.
   */
  it('keeps the role select enabled by default', async () => {
    const { fixture } = await renderSelect({
      user: { id: 'u1', name: 'Alice', roleId: 'r2' },
    });
    const roleSelect = fixture.debugElement.query(By.directive(MatSelect))
      .componentInstance as MatSelect;

    expect(roleSelect.disabled).toBe(false);
  });

  /**
   * Verifies: checking a permission in Team mode calls addToTeam and not removeFromTeam.
   * Interacts with: the real TeamPermissionsService.addToTeam / removeFromTeam over the TeamPermissionService.addTeamPermissionToTeam / removeTeamPermissionFromTeam stubs.
   * Data: team with p1; adding p2 (checked=true).
   */
  it('updatePermissions(Team, checked=true) calls addToTeam', async () => {
    const team: Team = {
      id: 't1',
      name: 'Red',
      permissions: [permissionA],
    };
    const { fixture, addToTeam, removeFromTeam } = await renderSelect({ team });
    fixture.componentInstance.updatePermissions(permissionB, true);
    expect(addToTeam).toHaveBeenCalledWith('t1', 'p2');
    expect(removeFromTeam).not.toHaveBeenCalled();
  });

  /**
   * Verifies: unchecking a permission in Team mode calls removeFromTeam and not addToTeam.
   * Interacts with: the real TeamPermissionsService.addToTeam / removeFromTeam over the TeamPermissionService.addTeamPermissionToTeam / removeTeamPermissionFromTeam stubs.
   * Data: team with p1; removing p1 (checked=false).
   */
  it('updatePermissions(Team, checked=false) calls removeFromTeam', async () => {
    const team: Team = {
      id: 't1',
      name: 'Red',
      permissions: [permissionA],
    };
    const { fixture, addToTeam, removeFromTeam } = await renderSelect({ team });
    fixture.componentInstance.updatePermissions(permissionA, false);
    expect(removeFromTeam).toHaveBeenCalledWith('t1', 'p1');
    expect(addToTeam).not.toHaveBeenCalled();
  });

  /**
   * Verifies: updateRole in User mode writes the new roleId onto the subject and persists that roleId via UserService.updateUser.
   * Interacts with: stubbed UserService.updateUser.
   * Data: user with roleId null; updateRole('new-role').
   * Why: the payload is asserted against the literal roleId rather than against componentInstance.subject —
   *   the subject is the very object the component mutates, so comparing it to itself would pass even if
   *   the assignment were dropped.
   */
  it('updateRole(User) updates the user via UserService', async () => {
    const { fixture, updateUser } = await renderSelect({
      user: { id: 'u1', name: 'Alice', roleId: null },
    });
    fixture.componentInstance.updateRole('new-role');
    expect(fixture.componentInstance.subject.roleId).toBe('new-role');
    expect(updateUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ id: 'u1', roleId: 'new-role' }),
    );
  });

  /**
   * Verifies: updateRole with an empty string nulls the subject's roleId and persists the null.
   * Interacts with: stubbed UserService.updateUser.
   * Data: user with roleId 'r2'; updateRole('').
   */
  it('updateRole("") clears the roleId to null', async () => {
    const { fixture, updateUser } = await renderSelect({
      user: { id: 'u1', name: 'Alice', roleId: 'r2' },
    });
    fixture.componentInstance.updateRole('');
    expect(fixture.componentInstance.subject.roleId).toBeNull();
    expect(updateUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ id: 'u1', roleId: null }),
    );
  });

  /**
   * Verifies: updateRole in Team mode writes the new roleId onto the team and persists that roleId via TeamService.updateTeam.
   * Interacts with: stubbed TeamService.updateTeam.
   * Data: team with roleId null; updateRole('team-role').
   * Why: the assignment in updateRole runs before the subjectType switch, so gating it to the User branch
   *   leaves this path silently saving the old role. Asserting the literal roleId in the payload is what
   *   catches that; asserting componentInstance.subject would compare the mutated object to itself.
   */
  it('updateRole(Team) updates the team via TeamService', async () => {
    const team: Team = {
      id: 't1',
      name: 'Red',
      roleId: null,
      permissions: [],
    };
    const { fixture, updateTeam } = await renderSelect({ team });
    fixture.componentInstance.updateRole('team-role');
    expect(fixture.componentInstance.subject.roleId).toBe('team-role');
    expect(updateTeam).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ id: 't1', roleId: 'team-role' }),
    );
  });

  describe('scoped teams', () => {
    const red: Team = { id: 't1', name: 'Red' };
    const blue: Team = { id: 't2', name: 'Blue' };

    /** Clicks the Blue option in the rendered Scoped Teams select. */
    async function toggleBlue(
      fixture: ComponentFixture<RolesPermissionsSelectComponent>,
    ) {
      const select = await TestbedHarnessEnvironment.loader(fixture).getHarness(
        MatSelectHarness.with({ selector: '[name="scopedTeams"]' }),
      );
      await select.open();
      const [option] = await select.getOptions({ text: 'Blue' });
      await option.click();
      return option;
    }

    /**
     * Verifies: selecting another team in Scoped Teams scopes this team's permissions onto it and records the id on the team.
     * Interacts with: the rendered Scoped Teams select (MatSelectHarness); the real TeamPermissionScopesService.addScope
     *   over TeamPermissionScopeService.addTeamPermissionScope.
     * Data: team Red (t1) with no scoped teams; allTeams [Red, Blue]; Blue selected.
     */
    it('adds a scope when a team is selected', async () => {
      const team: Team = { ...red, scopedTeamIds: [] };
      const { fixture, addScope } = await renderSelect({
        team,
        allTeams: [red, blue],
      });
      const option = await toggleBlue(fixture);
      expect(addScope).toHaveBeenCalledWith('t1', 't2');
      expect(team.scopedTeamIds).toEqual(['t2']);
      expect(await option.isSelected()).toBe(true);
    });

    /**
     * Verifies: deselecting a scoped team removes the scope and drops the id from the team.
     * Interacts with: the rendered Scoped Teams select (MatSelectHarness); the real TeamPermissionScopesService.removeScope
     *   over TeamPermissionScopeService.removeTeamPermissionScope.
     * Data: team Red (t1) already scoped onto Blue (t2); Blue deselected.
     */
    it('removes a scope when a team is deselected', async () => {
      const team: Team = { ...red, scopedTeamIds: ['t2'] };
      const { fixture, removeScope } = await renderSelect({
        team,
        allTeams: [red, blue],
      });
      const option = await toggleBlue(fixture);
      expect(removeScope).toHaveBeenCalledWith('t1', 't2');
      expect(team.scopedTeamIds).toEqual([]);
      expect(await option.isSelected()).toBe(false);
    });

    /**
     * Verifies: when the scope request fails, the selection reverts to the team's saved scoped teams.
     * Interacts with: the rendered Scoped Teams select (MatSelectHarness); the real TeamPermissionScopesService over
     *   failing TeamPermissionScopeService endpoints.
     * Data: one row per direction: adding Blue to [] and removing Blue from ['t2'], each failing with a 403.
     */
    it.each<[string, string[]]>([
      ['adding', []],
      ['removing', ['t2']],
    ])(
      'reverts the selection when %s a scope fails',
      async (_direction, saved) => {
        const team: Team = { ...red, scopedTeamIds: [...saved] };
        const { fixture } = await renderSelect({
          team,
          allTeams: [red, blue],
          scopeError: true,
        });
        const option = await toggleBlue(fixture);
        await fixture.whenStable();
        fixture.detectChanges();
        expect(fixture.componentInstance.selectedScopedTeams).toEqual(saved);
        expect(team.scopedTeamIds).toEqual(saved);
        expect(await option.isSelected()).toBe(saved.includes('t2'));
      },
    );
  });
});
