// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { By } from '@angular/platform-browser';
import { defer, of } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSelectHarness } from '@angular/material/select/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RolesService } from '../../../services/roles/roles.service';
import { TeamRolesService } from '../../../services/roles/team-roles.service';
import { TeamPermissionsService } from '../../../services/permissions/team-permissions.service';
import { TeamPermissionScopesService } from '../../../services/permissions/team-permission-scopes.service';
import { MatSelect, MatSelectModule } from '@angular/material/select';
import {
  User,
  Team,
  UserService,
  TeamService,
  Role,
  RoleService,
  TeamPermissionModel,
  TeamPermissionService,
  TeamRole,
  TeamRoleService,
  TeamPermissionScopeService,
} from '../../../generated/player-api';
import { RolesPermissionsSelectComponent } from './roles-permissions-select.component';
import { renderComponent } from '../../../test-utils/render-component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { ApiStub } from '../../../test-utils/api-stub';

const permissionA: TeamPermissionModel = { id: 'p1', name: 'A' };
const permissionB: TeamPermissionModel = { id: 'p2', name: 'B' };
const systemRoles: Role[] = [
  { id: 'r1', name: 'Observer' },
  { id: 'r2', name: 'Content Developer' },
];
// Lead includes permission B.
const teamRoles: TeamRole[] = [
  { id: 'tr1', name: 'Lead', permissions: [permissionB] },
  { id: 'tr2', name: 'Member', permissions: [] },
];

async function renderSelect(
  overrides: {
    user?: User | null;
    team?: Team | null;
    canEdit?: boolean;
    allTeams?: Team[];
    scopeError?: boolean;
    loadCatalogs?: boolean;
  } = {},
) {
  const {
    user = null,
    team = null,
    canEdit = true,
    allTeams = [],
    scopeError = false,
    loadCatalogs = true,
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

  // The catalogs the parent page loads into the real role and permission
  // services before it renders this select.
  const getRoles = vi.fn(() => of<Role[]>(structuredClone(systemRoles)));
  const getTeamRoles = vi.fn(() => of<TeamRole[]>(structuredClone(teamRoles)));
  const getTeamPermissions = vi.fn(() =>
    of<TeamPermissionModel[]>([
      structuredClone(permissionA),
      structuredClone(permissionB),
    ]),
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
          getTeamPermissions,
        } satisfies ApiStub<TeamPermissionService>,
      },
      {
        provide: RoleService,
        useValue: { getRoles } satisfies ApiStub<RoleService>,
      },
      {
        provide: TeamRoleService,
        useValue: { getTeamRoles } satisfies ApiStub<TeamRoleService>,
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

  if (loadCatalogs) {
    TestBed.inject(RolesService).getRoles().subscribe();
    TestBed.inject(TeamRolesService).getRoles().subscribe();
    TestBed.inject(TeamPermissionsService).load().subscribe();
    rendered.fixture.detectChanges();
    await rendered.fixture.whenStable();
  }

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
   * Verifies: rendering with both a user and a team, or with neither, throws a TypeError from the template (current behavior).
   * Interacts with: ngOnInit's early return (it logs and leaves `subject` unset) and the template's subject.roleId binding.
   * Data: one row with a user and a team, one with neither.
   */
  it.each<[string, { user?: User; team?: Team }]>([
    ['both a user and a team', { user: { id: 'u1' }, team: { id: 't1' } }],
    ['neither a user nor a team', {}],
  ])('throws while rendering with %s', async (_label, inputs) => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    // Current behavior; see agent-docs/ui-test-bugs/player.ui.md.
    await expect(renderSelect(inputs)).rejects.toThrow(TypeError);
  });

  /** The rendered selects: Role, then (Team mode) Additional Permissions and Scoped Teams. */
  async function selects(
    fixture: ComponentFixture<RolesPermissionsSelectComponent>,
  ) {
    return TestbedHarnessEnvironment.loader(fixture).getAllHarnesses(
      MatSelectHarness,
    );
  }

  /**
   * Verifies: for a user, only the Role select renders, offering None plus every system role by name, with the user's role
   *   selected.
   * Interacts with: the real RolesService catalog; the rendered selects (MatSelectHarness).
   * Data: user Alice with role r2 (Content Developer); system roles Observer and Content Developer.
   */
  it('offers None and the system roles for a user', async () => {
    const { fixture } = await renderSelect({
      user: { id: 'u1', name: 'Alice', roleId: 'r2' },
    });
    const all = await selects(fixture);
    expect(all).toHaveLength(1);
    const [role] = all;
    expect(await role.getValueText()).toBe('Content Developer');
    await role.open();
    expect(
      await Promise.all((await role.getOptions()).map((o) => o.getText())),
    ).toEqual(['None', 'Content Developer', 'Observer']);
  });

  /**
   * Verifies: for a team, the Role select offers the team roles without None, and Additional Permissions shows the
   *   team's own permissions selected and marks those its role already includes.
   * Interacts with: the real TeamRolesService and TeamPermissionsService catalogs; the rendered selects.
   * Data: team Red with role Lead (includes B) and permission A; team permissions A and B.
   */
  it('shows the team role and permissions for a team', async () => {
    const { fixture } = await renderSelect({
      team: {
        id: 't1',
        name: 'Red',
        roleId: 'tr1',
        permissions: [permissionA],
      },
    });
    const [role, permissions] = await selects(fixture);
    expect(await role.getValueText()).toBe('Lead');
    await role.open();
    expect(
      await Promise.all((await role.getOptions()).map((o) => o.getText())),
    ).toEqual(['Lead', 'Member']);
    await role.close();
    expect(await permissions.getValueText()).toBe('A');
    await permissions.open();
    expect(
      await Promise.all(
        (await permissions.getOptions()).map((o) => o.getText()),
      ),
    ).toEqual(['A', 'BIncluded in role']);
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
   * Verifies: in Team mode canEdit false disables the role select but leaves the Additional Permissions and Scoped
   *   Teams selects enabled (current behavior; latent, as no caller passes canEdit with a team).
   * Interacts with: the three rendered MatSelects (MatSelectHarness).
   * Data: team Red with canEdit false; allTeams Red and Blue.
   */
  it('leaves the team permission and scope selects enabled with canEdit false', async () => {
    const { fixture } = await renderSelect({
      team: { id: 't1', name: 'Red', permissions: [] },
      allTeams: [
        { id: 't1', name: 'Red' },
        { id: 't2', name: 'Blue' },
      ],
      canEdit: false,
    });
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const [role, permissions, scopes] =
      await loader.getAllHarnesses(MatSelectHarness);
    expect(await role.isDisabled()).toBe(true);
    // Current behavior; see agent-docs/ui-test-bugs/player.ui.md.
    expect(await permissions.isDisabled()).toBe(false);
    expect(await scopes.isDisabled()).toBe(false);
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
   * Verifies: choosing a role for a user saves the user with that role, and choosing None saves a null role.
   * Interacts with: the rendered Role select (MatSelectHarness); UserService.updateUser.
   * Data: user Alice with no role; Observer chosen, then None.
   */
  it('saves the chosen user role, and None as a null role', async () => {
    const { fixture, updateUser } = await renderSelect({
      user: { id: 'u1', name: 'Alice', roleId: null },
    });
    const [role] = await selects(fixture);
    await role.open();
    await role.clickOptions({ text: 'Observer' });
    expect(updateUser).toHaveBeenLastCalledWith('u1', {
      id: 'u1',
      name: 'Alice',
      roleId: 'r1',
    });
    await role.open();
    await role.clickOptions({ text: 'None' });
    expect(updateUser).toHaveBeenLastCalledWith('u1', {
      id: 'u1',
      name: 'Alice',
      roleId: null,
    });
  });

  /**
   * Verifies: choosing a role for a team saves the team with that role.
   * Interacts with: the rendered Role select (MatSelectHarness); TeamService.updateTeam.
   * Data: team Red with no role; Member chosen.
   */
  it('saves the chosen team role', async () => {
    const team: Team = { id: 't1', name: 'Red', roleId: null, permissions: [] };
    const { fixture, updateTeam, updateUser } = await renderSelect({ team });
    const [role] = await selects(fixture);
    await role.open();
    await role.clickOptions({ text: 'Member' });
    expect(updateTeam).toHaveBeenCalledExactlyOnceWith(
      't1',
      expect.objectContaining({ id: 't1', roleId: 'tr2' }),
    );
    expect(updateUser).not.toHaveBeenCalled();
  });

  /**
   * Verifies: ticking a permission adds it to the team and unticking one removes it.
   * Interacts with: the rendered Additional Permissions select (MatSelectHarness); the real TeamPermissionsService
   *   addToTeam and removeFromTeam over the TeamPermissionService stubs.
   * Data: team Red holding A; B ticked, then A unticked.
   */
  it('adds and removes team permissions from Additional Permissions', async () => {
    const team: Team = { id: 't1', name: 'Red', permissions: [permissionA] };
    const { fixture, addToTeam, removeFromTeam } = await renderSelect({ team });
    const [, permissions] = await selects(fixture);
    await permissions.open();
    await permissions.clickOptions({ text: /^B/ });
    expect(addToTeam).toHaveBeenCalledExactlyOnceWith('t1', 'p2');
    await permissions.clickOptions({ text: 'A' });
    expect(removeFromTeam).toHaveBeenCalledExactlyOnceWith('t1', 'p1');
    expect(team.permissions?.map((p) => p.id)).toEqual(['p2']);
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
