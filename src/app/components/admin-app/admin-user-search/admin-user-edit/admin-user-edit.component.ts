// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnChanges,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import {
  User,
  UserService,
  Role,
  RoleService,
  Permission,
  PermissionService,
} from '../../../../generated/player-api';
import { ErrorStateMatcher } from '@angular/material/core';
import {
  UntypedFormControl,
  FormGroupDirective,
  NgForm,
  Validators,
} from '@angular/forms';

@Component({
  selector: 'app-admin-user-edit',
  templateUrl: './admin-user-edit.component.html',
  styleUrls: ['./admin-user-edit.component.scss'],
})
export class AdminUserEditComponent implements OnChanges {
  @Input() user: User;
  @Output() editComplete = new EventEmitter<boolean>();

  public nameFormControl = new UntypedFormControl('', [
    Validators.required,
    Validators.minLength(4),
  ]);

  public matcher = new UserErrorStateMatcher();
  public originalUser: User;
  public permissions: Permission[] = [];
  public selectedPermissions: string[] = [];
  public roles: Role[] = [];

  constructor(private userService: UserService) {}

  /**
   * Called when the form changes
   */
  ngOnChanges() {
    this.originalUser = this.user;
    this.selectedPermissions = [];
  }

  /**
   * Returns the edit form to the user search screen
   */
  returnToUserSearch(): void {
    this.editComplete.emit(true);
  }

  /**
   * Saves the current user
   */
  save() {
    console.log(this.nameFormControl.value);
    if (this.user.name !== this.nameFormControl.value) {
      this.user.name = this.nameFormControl.value;

      this.userService.updateUser(this.user.id, this.user).subscribe((user) => {
        this.user = user;
      });
    }
  }

  /**
   * Updates the user permissions
   * @param permission
   */
  updatePermissions(permission) {
    // const index = this.user.permissions.findIndex(
    //   (x) => x.id === permission.id
    // );
    // if (index === -1) {
    //   this.user.permissions.push(permission);
    //   this.permissionService
    //     .addPermissionToUser(this.user.id, permission.id)
    //     .subscribe();
    // } else {
    //   this.user.permissions.slice(index);
    //   this.permissionService
    //     .removePermissionFromUser(this.user.id, permission.id)
    //     .subscribe();
    // }
  }

  /**
   * Updates the user role
   */
  updateRole() {
    if (!this.user.roleId) {
      this.user.roleId = null;
      this.user.roleName = null;
    } else {
      this.user.roleName = this.roles.find(
        (x) => x.id === this.user.roleId
      ).name;
    }
    this.userService.updateUser(this.user.id, this.user).subscribe();
  }
}

/** Error when invalid control is dirty, touched, or submitted. */
export class UserErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(
    control: UntypedFormControl | null,
    form: FormGroupDirective | NgForm | null
  ): boolean {
    const isSubmitted = form && form.submitted;
    return !!(control && control.invalid && (control.dirty || isSubmitted));
  }
}
