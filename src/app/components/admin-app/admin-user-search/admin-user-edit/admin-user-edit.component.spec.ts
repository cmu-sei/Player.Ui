// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { User, UserService, Role } from '../../../../generated/player-api';
import { AdminUserEditComponent } from './admin-user-edit.component';
import { renderComponent } from '../../../../test-utils/render-component';

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

async function renderEdit(overrides: { user?: User; roles?: Role[] } = {}) {
  const { user: u = { ...user }, roles: rs = roles } = overrides;
  const updateUser = vi.fn((_id: string, next: User) => of(next));

  const rendered = await renderComponent(AdminUserEditComponent, {
    declarations: [AdminUserEditComponent],
    componentProperties: { user: u, roles: rs },
    providers: [
      { provide: UserService, useValue: { updateUser } },
    ],
  });

  return { ...rendered, updateUser };
}

describe('AdminUserEditComponent', () => {
  /**
   * Verifies: the user-edit component instantiates successfully.
   * Interacts with: renderComponent with a stubbed UserService.
   * Data: default user 'Alice' and the two-role roles fixture.
   */
  it('creates the component', async () => {
    const { fixture } = await renderEdit();
    expect(fixture.componentInstance).toBeTruthy();
  });

  /**
   * Verifies: ngOnChanges snapshots the current user into originalUser and resets selectedPermissions to empty.
   * Interacts with: component.ngOnChanges (lifecycle, no service call).
   * Data: user mutated to name 'Alice2' before invoking the hook.
   */
  it('ngOnChanges captures the current user as originalUser', async () => {
    const { fixture } = await renderEdit();
    fixture.componentInstance.user = { ...user, name: 'Alice2' };
    fixture.componentInstance.ngOnChanges();
    expect(fixture.componentInstance.originalUser).toBe(
      fixture.componentInstance.user,
    );
    expect(fixture.componentInstance.selectedPermissions).toEqual([]);
  });

  /**
   * Verifies: returnToUserSearch emits true on the editComplete output.
   * Interacts with: the component's editComplete EventEmitter (subscribed spy).
   * Data: default user.
   */
  it('returnToUserSearch emits editComplete=true', async () => {
    const { fixture } = await renderEdit();
    const spy = vi.fn();
    fixture.componentInstance.editComplete.subscribe(spy);
    fixture.componentInstance.returnToUserSearch();
    expect(spy).toHaveBeenCalledWith(true);
  });

  /**
   * Verifies: save() pushes the changed name through UserService.updateUser.
   * Interacts with: nameFormControl and stubbed UserService.updateUser.
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
   * Interacts with: nameFormControl and stubbed UserService.updateUser.
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
   * Interacts with: the roles input lookup and stubbed UserService.updateUser.
   * Data: user override with roleId 'r2' (resolves to role name 'User').
   */
  it('updateRole resolves the role name from the selected roleId', async () => {
    const { fixture, updateUser } = await renderEdit({
      user: { ...user, roleId: 'r2' },
    });
    fixture.componentInstance.updateRole();
    expect(fixture.componentInstance.user.roleName).toBe('User');
    expect(updateUser).toHaveBeenCalledWith('u1', fixture.componentInstance.user);
  });

  /**
   * Verifies: updateRole nulls both roleId and roleName when the selected roleId is falsy, still persisting.
   * Interacts with: stubbed UserService.updateUser.
   * Data: user override with roleId '' and a stale roleName 'Admin'.
   */
  it('updateRole clears role name when roleId is falsy', async () => {
    const { fixture, updateUser } = await renderEdit({
      user: { ...user, roleId: '', roleName: 'Admin' },
    });
    fixture.componentInstance.updateRole();
    expect(fixture.componentInstance.user.roleId).toBeNull();
    expect(fixture.componentInstance.user.roleName).toBeNull();
    expect(updateUser).toHaveBeenCalled();
  });
});
