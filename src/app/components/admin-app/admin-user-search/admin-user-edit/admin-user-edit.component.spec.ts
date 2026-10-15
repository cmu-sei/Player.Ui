// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Component, input } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { User, UserService, Role } from '../../../../generated/player-api';
import { AdminUserEditComponent } from './admin-user-edit.component';
import { renderComponent } from '../../../../test-utils/render-component';
import { MatButtonModule } from '@angular/material/button';
import { ApiStub } from '../../../../test-utils/api-stub';

const user: User = {
  id: 'u1',
  name: 'Alice',
  roleId: null,
  roleName: null,
};

const roles: Role[] = [
  { id: 'r1', name: 'Admin', permissions: [] },
  { id: 'r2', name: 'User', permissions: [] },
];

@Component({ selector: 'app-roles-permissions-select', template: '' })
class RolesPermissionsSelectStubComponent {
  readonly user = input<User>();
}

async function renderEdit(overrides: { user?: User; roles?: Role[] } = {}) {
  const { user: u = { ...user }, roles: rs = roles } = overrides;
  const updateUser = vi.fn((_id: string, next: User) => of(next));

  const rendered = await renderComponent(AdminUserEditComponent, {
    declarations: [AdminUserEditComponent],
    imports: [MatButtonModule, RolesPermissionsSelectStubComponent],
    componentProperties: { user: u, roles: rs },
    providers: [
      {
        provide: UserService,
        useValue: { updateUser } satisfies ApiStub<UserService>,
      },
    ],
  });

  return { ...rendered, updateUser };
}

describe('AdminUserEditComponent', () => {
  /**
   * Verifies: ngOnChanges snapshots the current user into originalUser and clears selectedPermissions.
   * Interacts with: component.ngOnChanges (lifecycle, no service call).
   * Data: user mutated to name 'Alice2' and selectedPermissions seeded with ['p1'] before invoking the hook.
   */
  it('ngOnChanges captures the current user as originalUser and clears the selection', async () => {
    const { fixture } = await renderEdit();
    fixture.componentInstance.user = { ...user, name: 'Alice2' };
    fixture.componentInstance.selectedPermissions = ['p1'];
    fixture.componentInstance.ngOnChanges();
    expect(fixture.componentInstance.originalUser).toBe(
      fixture.componentInstance.user,
    );
    expect(fixture.componentInstance.selectedPermissions).toEqual([]);
  });

  /**
   * Verifies: the template hands the edited user down to the roles/permissions child.
   * Interacts with: the RolesPermissionsSelectStubComponent standing in for app-roles-permissions-select.
   * Data: a distinct user fixture (id 'u9', name 'Zed') so the identity assertion cannot match by accident.
   */
  it('passes the user down to the roles/permissions child', async () => {
    const edited: User = { ...user, id: 'u9', name: 'Zed' };
    const { fixture } = await renderEdit({ user: edited });
    const select = fixture.debugElement.query(
      By.directive(RolesPermissionsSelectStubComponent),
    ).componentInstance as RolesPermissionsSelectStubComponent;
    expect(select.user()).toBe(edited);
  });

  /**
   * Verifies: the page is titled with the user's name, and Done emits editComplete true.
   * Interacts with: the rendered title and Done button; the editComplete output.
   * Data: default user Alice.
   */
  it('shows the user and completes from Done', async () => {
    const editComplete = vi.fn();
    const { fixture } = await renderEdit();
    fixture.componentInstance.editComplete.subscribe(editComplete);
    expect(screen.getByText(`Edit User ${user.name}`)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByText('Done'));
    expect(editComplete).toHaveBeenCalledExactlyOnceWith(true);
  });

  /**
   * Verifies: save() pushes the changed name through UserService.updateUser.
   * Interacts with: nameFormControl and stubbed UserService.updateUser; save() is called directly, as no rendered
   *   control calls it.
   * Data: name form control set to 'Renamed' (differs from the original).
   */
  it('save() updates the user name and calls UserService.updateUser when name changed', async () => {
    const { fixture, updateUser } = await renderEdit();
    fixture.componentInstance.nameFormControl.setValue('Renamed');
    fixture.componentInstance.save();
    expect(updateUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ name: 'Renamed' }),
    );
  });

  /**
   * Verifies: save() skips the update call when the name matches the existing value.
   * Interacts with: nameFormControl and stubbed UserService.updateUser; save() is called directly, as no rendered
   *   control calls it.
   * Data: name form control set back to the original user.name.
   */
  it('save() is a no-op when the name is unchanged', async () => {
    const { fixture, updateUser } = await renderEdit();
    fixture.componentInstance.nameFormControl.setValue(user.name);
    fixture.componentInstance.save();
    expect(updateUser).not.toHaveBeenCalled();
  });

  /**
   * Verifies: updateRole resolves roleName from the matching roles entry and persists via updateUser.
   * Interacts with: the roles input lookup and stubbed UserService.updateUser; updateRole() is called directly, as no
   *   rendered control calls it.
   * Data: user override with roleId 'r2' (resolves to role name 'User').
   */
  it('updateRole resolves the role name from the selected roleId', async () => {
    const { fixture, updateUser } = await renderEdit({
      user: { ...user, roleId: 'r2' },
    });
    fixture.componentInstance.updateRole();
    expect(fixture.componentInstance.user.roleName).toBe('User');
    expect(updateUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ roleId: 'r2', roleName: 'User' }),
    );
  });

  /**
   * Verifies: updateRole nulls both roleId and roleName when the selected roleId is falsy, still persisting.
   * Interacts with: stubbed UserService.updateUser; updateRole() is called directly, as no rendered control calls it.
   * Data: user override with roleId '' and a stale roleName 'Admin'.
   */
  it('updateRole clears role name when roleId is falsy', async () => {
    const { fixture, updateUser } = await renderEdit({
      user: { ...user, roleId: '', roleName: 'Admin' },
    });
    fixture.componentInstance.updateRole();
    expect(fixture.componentInstance.user.roleId).toBeNull();
    expect(fixture.componentInstance.user.roleName).toBeNull();
    expect(updateUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ roleId: null, roleName: null }),
    );
  });
});
