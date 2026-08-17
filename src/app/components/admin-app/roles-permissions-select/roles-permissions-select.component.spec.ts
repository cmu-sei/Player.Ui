// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { MatSelectModule } from '@angular/material/select';
import {
  User,
  Team,
  UserService,
  TeamService,
  Permission,
} from '../../../generated/player-api';
import { RolesService } from '../../../services/roles/roles.service';
import { TeamRolesService } from '../../../services/roles/team-roles.service';
import { TeamPermissionsService } from '../../../services/permissions/team-permissions.service';
import {
  ObjectType,
  RolesPermissionsSelectComponent,
} from './roles-permissions-select.component';
import { renderComponent } from '../../../test-utils/render-component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';

const permissionA: Permission = { id: 'p1', name: 'A' };
const permissionB: Permission = { id: 'p2', name: 'B' };

async function renderSelect(
  overrides: { user?: User | null; team?: Team | null } = {},
) {
  const { user = null, team = null } = overrides;

  const updateUser = vi.fn(() => of({}));
  const updateTeam = vi.fn(() => of({}));
  const addToTeam = vi.fn(() => of({}));
  const removeFromTeam = vi.fn(() => of({}));

  const rendered = await renderComponent(RolesPermissionsSelectComponent, {
    declarations: [RolesPermissionsSelectComponent],
    imports: [
      MatFormFieldModule,
      MatIconModule,
      MatTooltipModule,
      MatButtonModule,
      MatSelectModule,
    ],
    componentProperties: { user, team },
    providers: [
      { provide: UserService, useValue: { updateUser } },
      { provide: TeamService, useValue: { updateTeam } },
      {
        provide: TeamPermissionsService,
        useValue: {
          teamPermissions$: of([permissionA, permissionB]),
          addToTeam,
          removeFromTeam,
        },
      },
      {
        provide: TeamRolesService,
        useValue: { roles$: of([]) },
      },
      {
        provide: RolesService,
        useValue: { roles$: of([]) },
      },
    ],
  });

  return { ...rendered, updateUser, updateTeam, addToTeam, removeFromTeam };
}

describe('RolesPermissionsSelectComponent', () => {
  // Note: the "both supplied" / "neither supplied" paths are exercised
  // through ngOnInit()'s early return. Rendering those cases in a
  // template context crashes because other template bindings then
  // dereference the unset subject — that's a real bug in the component
  // but is out of scope for this coverage task.

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
   * Verifies: checking a permission in Team mode calls addToTeam and not removeFromTeam.
   * Interacts with: stubbed TeamPermissionsService.addToTeam / removeFromTeam.
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
   * Interacts with: stubbed TeamPermissionsService.addToTeam / removeFromTeam.
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
});
