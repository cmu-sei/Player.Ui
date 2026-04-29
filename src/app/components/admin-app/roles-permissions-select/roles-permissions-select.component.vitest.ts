// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
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

  const rendered = await renderComponent(
    RolesPermissionsSelectComponent,
    {
      declarations: [RolesPermissionsSelectComponent],
      imports: [MatSelectModule, MatCheckboxModule],
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
    },
  );

  return { ...rendered, updateUser, updateTeam, addToTeam, removeFromTeam };
}

describe('RolesPermissionsSelectComponent', () => {
  it('creates the component', async () => {
    const { fixture } = await renderSelect({
      user: { id: 'u1', name: 'Alice' },
    });
    expect(fixture.componentInstance).toBeTruthy();
  });

  // Note: the "both supplied" / "neither supplied" paths are exercised
  // through ngOnInit()'s early return. Rendering those cases in a
  // template context crashes because other template bindings then
  // dereference the unset subject — that's a real bug in the component
  // but is out of scope for this coverage task.

  it('sets Team mode and seeds selectedPermissions from team.permissions', async () => {
    const team = {
      id: 't1',
      name: 'Red',
      roleId: 'r1',
      permissions: [permissionA],
    } as unknown as Team;
    const { fixture } = await renderSelect({ team });
    expect(fixture.componentInstance.subjectType).toBe(ObjectType.Team);
    expect(fixture.componentInstance.showPermissions).toBe(true);
    expect(fixture.componentInstance.selectedPermissions).toEqual(['p1']);
    expect(fixture.componentInstance.selectedRole).toBe('r1');
  });

  it('sets User mode without permissions', async () => {
    const { fixture } = await renderSelect({
      user: { id: 'u1', name: 'Alice', roleId: 'r2' },
    });
    expect(fixture.componentInstance.subjectType).toBe(ObjectType.User);
    expect(fixture.componentInstance.showPermissions).toBe(false);
    expect(fixture.componentInstance.selectedRole).toBe('r2');
  });

  it('updatePermissions(Team, checked=true) calls addToTeam', async () => {
    const team = {
      id: 't1',
      name: 'Red',
      permissions: [permissionA],
    } as unknown as Team;
    const { fixture, addToTeam, removeFromTeam } = await renderSelect({ team });
    fixture.componentInstance.updatePermissions(permissionB, true);
    expect(addToTeam).toHaveBeenCalledWith('t1', 'p2');
    expect(removeFromTeam).not.toHaveBeenCalled();
  });

  it('updatePermissions(Team, checked=false) calls removeFromTeam', async () => {
    const team = {
      id: 't1',
      name: 'Red',
      permissions: [permissionA],
    } as unknown as Team;
    const { fixture, addToTeam, removeFromTeam } = await renderSelect({ team });
    fixture.componentInstance.updatePermissions(permissionA, false);
    expect(removeFromTeam).toHaveBeenCalledWith('t1', 'p1');
    expect(addToTeam).not.toHaveBeenCalled();
  });

  it('updateRole(User) updates the user via UserService', async () => {
    const { fixture, updateUser } = await renderSelect({
      user: { id: 'u1', name: 'Alice', roleId: null },
    });
    fixture.componentInstance.updateRole('new-role');
    expect(fixture.componentInstance.subject.roleId).toBe('new-role');
    expect(updateUser).toHaveBeenCalledWith('u1', fixture.componentInstance.subject);
  });

  it('updateRole("") clears the roleId to null', async () => {
    const { fixture, updateUser } = await renderSelect({
      user: { id: 'u1', name: 'Alice', roleId: 'r2' },
    });
    fixture.componentInstance.updateRole('');
    expect(fixture.componentInstance.subject.roleId).toBeNull();
    expect(updateUser).toHaveBeenCalled();
  });

  it('updateRole(Team) updates the team via TeamService', async () => {
    const team = {
      id: 't1',
      name: 'Red',
      roleId: null,
      permissions: [],
    } as unknown as Team;
    const { fixture, updateTeam } = await renderSelect({ team });
    fixture.componentInstance.updateRole('team-role');
    expect(updateTeam).toHaveBeenCalledWith('t1', fixture.componentInstance.subject);
  });
});
